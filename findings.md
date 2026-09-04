# Findings — demo sandbox implementation vs. original plan

Verification of #33 (harness) and #34 (deploy build step) against the plan (ADR 0007, docs/demos.md). Four differences from the original plan:

## 1. postMessage targetOrigin: `"null"` → `"*"` (plan was wrong — amended)

- The docs/demos.md sketch posted with targetOrigin `"null"` in **both** directions.
- Empirical (Chromium 145, 2026): `"null"` is rejected as a *target* origin — `postMessage(msg, "null")` throws `Failed to execute 'postMessage' on 'Window': Invalid target origin 'null'`. This silently killed `DEMO_SET_PART` from the stepper (every part-button click threw).
- `"*"` posts fine and delivers to the opaque-origin frame (verified: iframe switched parts on receipt).
- **Resolution (committed `c67e932`):** targetOrigin is `"*"` in both directions, never `"null"`. Delivery safety is per-field validation/clamping at each receiver — never origin targeting. The host additionally filters receipts on `event.origin === "null"` (the opaque origin's serialization, which *is* observable on receipt). ADR 0007 gained a **Transport** note; docs/demos.md sketch code updated (3 spots).

## 2. CORS requirement (plan was silent — still to document)

- ADR 0007 / docs/demos.md never mention it, but it is mandatory: the opaque-origin sandbox fetches module scripts in **CORS mode**, so the deploy must send `Access-Control-Allow-Origin: *` on all `/demos/**` assets (vendor/, harness.js, per-slug bundle.js and demo page).
- Without the header, module loading fails outright (verified: nothing renders).
- `*` is the right value: assets are public-safe by design (unguessable 128-bit slugs, no credentials, demo content is public-safe per ADR 0007's delivery policy).
- **Not yet written into the repo** — belongs with #32 (the `/demos` routes / deploy work), where it becomes a header on the demo page route and the static assets.

## 3. "Self-contained ESM" was an assumption, not a fact

- Issue #34 expected the vendor artifacts to be near pass-through ESM from `node_modules` ("React 19 is vendored once at deploy as self-contained ESM from the app's own node_modules").
- Reality: **react-dom 19 ships CJS**, so `scripts/build-demos.mjs` performs a CJS→ESM conversion for `vendor/react-dom-client.js`:
  - dynamic facade exposing `Object.keys(require(id))` as named ESM exports, with a banner-injected `var require = ...` shim bound to the real CJS module;
  - the facade must **not** filter underscore-prefixed exports — react-dom's `react-dom/client` entry needs `__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE` present at module evaluation;
  - the facade re-exports react via `import * as __ext_react from "react"` so the import map still collapses everything to one React instance.
- Pitfall confirmed by smoke test, not guesswork: dropping the internals export breaks the first render.
- Acceptance criteria as planned did hold: four artifacts in `out/demos/`, only bare `react` / `react/jsx-runtime` / `react-dom/client` specifiers, non-static `import(`/demos/${slug}/bundle.js`)` passed through, `format: esm` / production / `target: es2020` / minified, ≈ 204 KB total.

## 4. Test rig is scaffolding the plan didn't have

- The plan's verification path assumed the real `/demos/{slug}` routes — which are #32, still open.
- So browser verification runs in a throwaway rig at `/tmp/demo-rig/` (outside the repo): host page (iframe + part stepper + message log + error banner), a 3-part sample demo compiled through the real pipeline, and a CORS-enabled static server on `127.0.0.1:8123` — emulating what #32 will serve, using the real `out/demos/` artifacts.
- Tear down when done: `kill $(lsof -t -i :8123)` and delete `/tmp/demo-rig/`.

## Browser verification checklist (all pass, headless Chromium 145)

1. Counter increments on click.
2. Part switch renders the new part (`DEMO_SET_PART` delivered with `"*"`).
3. Returning to a previous part preserves demo state (re-render, no remount).
4. Intentional crash → `SANDBOX_ERROR` banner; host does not crash.
5. Host log shows both directions of traffic; `event.origin === "null"` receipt filter passes real sandbox messages.
6. Console clean apart from the intentional crash (and favicon 404 in the rig).

Minor observations (non-blocking):
- Initial auto-height jump (50px → 70px) as the harness measures after first paint — the host may want a monotonic/min-height policy; #32 concern.
- `window.DEMO` in harness.tsx is read via a cast (`(window as unknown as { DEMO: DemoMeta }).DEMO`) rather than `declare global`; `parts` is a module-scope constant kept out of `useEffect` deps.
