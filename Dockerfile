# syntax=docker/dockerfile:1
#
# The user-facing app (Next.js 16). Two things decide the shape of this file, and
# both are about what Next does at build time rather than runtime:
#
#   * **`output: "standalone"`** (next.config.ts) makes `.next/standalone/server.js`
#     a server with a traced dependency tree, so the runtime stage carries no
#     `node_modules` install and no dev dependencies. The alternative — `next start`
#     with the full tree — would double this image to run the same thing.
#   * **`NEXT_PUBLIC_*` is inlined at build time**, so the artifact is
#     environment-specific by construction: the CI workflow passes the real origins
#     as build args, and a staging image is a different image, not the same one with
#     different environment.
#
# What the runtime stage therefore needs is exactly: the traced server, the static
# chunks, `public/`, and `messages/` — which is not obvious, and is the one thing
# here that a clean build will not tell you.

FROM node:24-slim AS deps
WORKDIR /app
# Only the manifests first: this layer is the one that stays cached across changes
# to the source, and `npm ci` (not `npm install`) is what makes the lockfile the
# answer rather than a suggestion.
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time configuration. Declared as ARGs with no defaults on purpose: an empty
# value here is visible in the running app (the browser calls an empty origin),
# which is worse than a build that produces an app pointing nowhere.
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_SANDBOX_ORIGIN
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL \
    NEXT_PUBLIC_SANDBOX_ORIGIN=$NEXT_PUBLIC_SANDBOX_ORIGIN \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production
RUN npm run build

FROM node:24-slim AS runtime
WORKDIR /app

# Numeric uid, and no name anywhere. `runAsNonRoot: true` in the cluster manifests
# is verified numerically; a named user turns a working image into a pod stuck in
# CreateContainerConfigError (learned the hard way with the backend image).
RUN groupadd --system --gid 10001 app \
 && useradd --system --uid 10001 --gid 10001 --no-create-home app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

COPY --from=build --chown=10001:10001 /app/.next/standalone ./
COPY --from=build --chown=10001:10001 /app/.next/static ./.next/static
COPY --from=build --chown=10001:10001 /app/public ./public

# `messages/` is copied because it cannot be traced: i18n/request.ts does
# `await import(\`../messages/${locale}.json\`)`, and a specifier built at runtime
# is not something Next's file tracing can see. Without this line the image builds,
# starts, answers `/health`-ish routes, and 500s when it renders a page — which is
# the worst possible order in which to learn it.
COPY --from=build --chown=10001:10001 /app/messages ./messages

USER 10001
EXPOSE 3000

# `exec` so node, not a shell, is PID 1: SIGTERM during a rollout has to reach the
# server or the graceful shutdown never happens.
CMD ["node", "server.js"]
