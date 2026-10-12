# Assert that the origins a build declared as build args are the origins the
# image carries, and that each one arrives whole.
#
# POSIX sh. Run inside the built artifact by the smoke step of
# `.github/workflows/build-image.yml` (`docker exec -i … sh -s < this file`, so
# the script travels from the checkout, not from the image), and runnable by hand
# against a local build — which is the only way to tell a defect in the bake from
# a defect in this check:
#
#   NEXT_PUBLIC_BACKEND_URL=https://api.lotp.xyz \
#   NEXT_PUBLIC_SANDBOX_ORIGIN=https://sandbox.lotp.xyz npm run build
#   WANT_BACKEND=https://api.lotp.xyz WANT_SANDBOX=https://sandbox.lotp.xyz \
#     sh .github/scripts/assert-baked-origins.sh
#
# Two shapes, and telling them apart is the whole difficulty:
#
#   legal — the declared origin followed by a path or a query, because the app
#     appends one on purpose (`…/slides/{id}?theme={theme}`, #47 #78).
#   broken — the declared origin followed by whitespace and more text. That is
#     the signature of two build args folded into one: the first shipped image
#     baked `NEXT_PUBLIC_BACKEND_URL` as
#     `https://api.lotp.xyz NEXT_PUBLIC_SANDBOX_ORIGIN=https://sandbox.lotp.xyz`
#     because the `build-args:` block was written without `|`, YAML folded its
#     newlines into spaces, and every browser then called
#     `https://api.lotp.xyz%20…/auth/login`.
#
# A substring check passes on the broken one, so the assertion has to be made at
# a string boundary — and the boundary is whatever the bundler used to open and
# close the literal: `"`, `'` or a backtick. Minifiers keep a template literal as
# a template literal, so `` `https://…/slides/${id}?theme=${theme}` `` contains no
# `"` at all. The previous version of this check (`…lotp\.xyz[^\"]{0,40}`) assumed
# a `"` was the only terminator; with none inside the value its window ran past
# the end of the literal into the code after it, found the space that minified
# code always has, and reported correct code as a defect (#189). Reaching from an
# opening delimiter to the next delimiter of *any* kind cannot do that: it stops
# at the value's own end. Requiring the opening delimiter also means a chunk that
# merely *mentions* an origin mid-sentence is not this assertion's business.
#
# What this cannot tell: `/slides/{id}` (legal) from `.internal` (a different
# host) — both are text appended with no whitespace, and separating them would
# mean knowing the paths, which belongs to the infra side, not to a build guard.
# Nor does it look at `.next/server`: these are browser-facing values, and
# `NEXT_PUBLIC_` as literal text survives in the server bundle, so asserting its
# absence there would only manufacture failures.

set -eu

: "${WANT_BACKEND:?WANT_BACKEND is not set}"
: "${WANT_SANDBOX:?WANT_SANDBOX is not set}"

# Where a built artifact keeps its client chunks — the same relative path inside
# the image (`/app`) and in a working copy after `npm run build`. Tests point it
# at a fixture directory instead.
BUILT="${BUILT:-.next/static}"

# The three characters a bundler can put around an inlined value.
DQ='"'
SQ="'"
BT='`'
DELIM="[$DQ$SQ$BT]"
UNTIL="[^$DQ$SQ$BT]"

# `.` is the only metacharacter a declared origin can contain (a host and a port
# need no others); escaped, the pattern means this origin rather than any three
# characters in its place.
as_pattern() {
  printf '%s' "$1" | sed 's/\./\\&/g'
}

for u in "$WANT_BACKEND" "$WANT_SANDBOX"; do
  literals=$(grep -rhoE "$DELIM$(as_pattern "$u")$UNTIL{0,200}$DELIM" "$BUILT" | sort -u)
  if [ -z "$literals" ]; then
    printf 'origin was not baked into the image as a string literal: %s\n' "$u"
    exit 1
  fi
  appended=$(printf '%s\n' "$literals" | grep -E '[[:space:]]|NEXT_PUBLIC_' | head -3 || true)
  if [ -n "$appended" ]; then
    printf 'a baked origin has text appended to it:\n'
    printf '%s\n' "$appended"
    exit 1
  fi
  printf 'baked whole: %s\n' "$u"
done
