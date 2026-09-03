# Demos — design

Status: design settled (discussion closed in [#29](https://github.com/lo-tp/learn-anything/issues/29)); implementation tracked off map [#11](https://github.com/lo-tp/learn-anything/issues/11). Decision record: [ADR 0007](adr/0007-demos-in-opaque-origin-sandbox.md). Terminology per [`CONTEXT.md`](../CONTEXT.md).

A **Demo** is raw TSX the LLM authors, compiled at write time, executed in an opaque-origin sandbox iframe. The sandbox document boots a fixed, trusted **harness** (our JSX + Suspense app, built once at deploy); the harness dynamically imports the per-demo bundle and renders it. This document is the implementation design: artifacts, compilation, harness, the demo page, the host renderer, and the schema/contract deltas.

## Pipeline

```
DEPLOY (once, esbuild)
────────────────────────
  node_modules/react ─────────▶ /demos/vendor/react.js             (ESM, self-contained)
  node_modules/react/jsx-runtime ▶ /demos/vendor/react-jsx-runtime.js  (ESM, react external)
  node_modules/react-dom/client ▶ /demos/vendor/react-dom-client.js (ESM, react external)
  core/demos/harness.tsx ──────▶ /demos/harness.js                 (ESM, react external)

TURN (write path, BE)
──────────────────────
LLM response {…, demo_tsx, demo_parts}
  → Zod-validate (core/contracts)
  → esbuild.compileDemo(tsx)  ──fail──▶ #30 policy (retry / degrade, deferred)
  → persist log row:
      response JSONB (TSX = truth)
      demo_js   TEXT  (derived — a small ESM module: the demo's code only)
      demo_slug TEXT  (random 128-bit, unique — the URL name)

RENDER
──────
authenticated API read → { demoSlug, demoParts }        ← no JS bytes over the API
host renders  <iframe sandbox="allow-scripts" src="/demos/{slug}">
  page: import map → harness.js → React.lazy(import("/demos/{slug}/bundle.js"))
  React 19 (vendor, ~200 KB) cached once per device, ever; bundle.js ≈ KBs, per demo
```

## Artifacts

| artifact | built | by | cache |
|---|---|---|---|
| `/demos/vendor/react.js` (+ `react-jsx-runtime`, `react-dom-client`) | **once, at deploy** | esbuild from `node_modules` (self-contained ESM; `react` external in the latter two so all three resolve through the import map to **one** React instance) | `immutable`, once per device |
| `/demos/harness.js` | **once, at deploy** | esbuild, `format: esm`, react external | `immutable`, once per device |
| `GET /demos/{slug}` (HTML) | per request | route: DB lookup by slug | `immutable` (slug unguessable, row append-only) |
| `GET /demos/{slug}/bundle.js` | **per turn, write-time** | esbuild, `format: esm`, react external | `immutable`, once per demo |

**One React instance, guaranteed:** the page's import map routes bare `react` / `react/jsx-runtime` / `react-dom/client` specifiers to the vendor URLs; the browser's module cache makes "same URL = same module" a language guarantee. Two React instances would split the hooks dispatcher ("Invalid hook call") — this is why the vendor files exist at all.

## Compilation (`lib/demos/compile.ts`, BE)

The per-slug bundle contains **only the demo's code** — React is external, so artifacts drop from ~200 KB to a few KB:

```ts
export async function compileDemo(tsx: string): Promise<string> {
  const result = await esbuild.build({
    stdin: { contents: tsx, loader: "tsx", resolveDir: process.cwd() },
    bundle: true,
    format: "esm",
    external: ["react", "react/jsx-runtime"],
    minify: true,
    target: "es2020",
    write: false,
    plugins: [
      { // ADR 0007 import policy: React only, enforced at compile time
        name: "react-only",
        setup(b) {
          b.onResolve({ filter: /.*/ }, (args) => {
            if (args.importer === "\0stdin" && !/^react(\/jsx-runtime)?$/.test(args.path)) {
              return { errors: [{ text: `Demo may only import 'react' (got "${args.path}")` }] };
            }
          });
        },
      },
    ],
  });
  return result.outputFiles[0].text;
}
```

Notes:
- ESM output makes `external` work natively — the old IIFE trap (externals rewritten to a `require()` shim that throws in the browser) does not apply in this format.
- The allowlist check is a resolve plugin running **before** esbuild's own external handling: a forbidden specifier is a build error naming it — exactly the payload a retry-with-error loop (#30) feeds back to the LLM.
- Demo contract: **default export, `part: number` prop, renders only the active part** — stated in the generation prompt template.
- Compilation is a pure function of `demo_tsx`. `esbuild` is a real `dependencies` entry (Node deployment confirmed). `demo_js` is derived data, regenerable from TSX (backfill in #30 reuses the slug → the cached URL keeps working).

## The harness (`core/demos/harness.tsx`, built at deploy)

The harness is the only program in the sandbox that is **not** LLM-generated. It is identical for every demo, trusted, and owns every lifecycle concern the demo is not allowed to have:

```tsx
import React, { lazy, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

const { slug, parts } = window.DEMO; // injected by the page: {slug: string, parts: number}
const Demo = lazy(() => import(`/demos/${slug}/bundle.js`)); // non-static → stays a native import()

class Boundary extends React.Component<
  { onError: (e: unknown) => void; children: React.ReactNode },
  { error: unknown }
> {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { this.props.onError(error); }   // → SANDBOX_ERROR
  render() {
    return this.state.error
      ? null
      : this.props.children;
  }
}

function App() {
  const [part, setPart] = useState(0);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "DEMO_SET_PART" && Number.isInteger(e.data.part)) {
        setPart(Math.min(Math.max(e.data.part, 0), parts - 1)); // clamps, never trusts
      }
    };
    addEventListener("message", onMsg);
    return () => removeEventListener("message", onMsg);
  }, [parts]);

  useEffect(() => {
    new ResizeObserver(() =>
      parent.postMessage({ type: "SANDBOX_RESIZE", height: document.body.scrollHeight }, "null")
    ).observe(document.body);
  }, []);

  return (
    <Boundary onError={(err) =>
      parent.postMessage({ type: "SANDBOX_ERROR", message: String(err?.message ?? err) }, "null")
    }>
      <Suspense fallback={<div style={{ padding: 16, opacity: 0.6 }}>Loading…</div>}>
        <Demo part={part} />
      </Suspense>
    </Boundary>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
```

What the Suspense/Boundary pair buys (this is why the harness is an app, not a script):

- **Loading** → Suspense fallback, a real state instead of a blank document;
- **Import failure** (404, syntax, network drop) → the lazy rejection is caught by the **ErrorBoundary** → `SANDBOX_ERROR` with the actual error;
- **Render crash** → same boundary, a React-idiomatic hook for #30's error UX instead of `window.onerror` string scraping;
- **Part switching** → `setPart` re-render, no remount — demo state survives.

The only failure the boundary cannot see is a **stall** (server hangs before responding to the bundle GET) — a timeout watchdog for that belongs in #30 alongside the error UX.

## The demo page (`GET /demos/{slug}`)

A route that returns one HTML document we own byte-for-byte (it cannot be a Next.js-managed document: an import map must precede every module script, and App Router emits its own into `<head>`; plus Next's React instance is private inside its chunks — see ADR 0007 delivery note).

```html
<!DOCTYPE html><html><head><meta charset="utf-8">
<script type="importmap">
{ "imports": {
    "react": "/demos/vendor/react.js",
    "react/jsx-runtime": "/demos/vendor/react-jsx-runtime.js",
    "react-dom/client": "/demos/vendor/react-dom-client.js"
} }
</script>
<link rel="stylesheet" href="{APP_ORIGIN}/demos/reset.css">   <!-- app-served reset + CSS custom properties -->
<body>
  <div id="root"></div>
  <script>window.DEMO = { slug: "{slug}", parts: {parts} };</script>
  <script type="module" src="/demos/harness.js"></script>
```

Rules, in order of importance:

1. **`Sec-Fetch-Dest` gate — 403 unless `iframe`.** A browser navigating an iframe sends `Sec-Fetch-Dest: iframe`; a top-level tab sends `document`. Without the gate, opening the URL in a tab executes LLM code in **app origin** (cookies, session — full XSS). The sandbox attribute on the embedding iframe is the security boundary; the gate keeps the page from becoming an unsandboxed entry point. (A direct tab on `bundle.js` alone is inert — the browser renders JS source as text — so only the HTML page needs the gate.)
2. **Cache-immutable**: `Cache-Control: public, max-age=31536000, immutable`. Honest because the slug is unguessable (128-bit random, *never* the sequential row id), the row is append-only, and the bundle is written once per row.
3. **Exactly one untrusted thing.** `bundle.js` is the page's only untrusted content; everything else (import map, reset CSS, harness URL) is ours.
4. **Styling.** The LLM styles via inline styles or a `<style>` tag; the palette is the app-served reset + custom properties (ADR 0007: no CSS runtime).
5. **Rate limit: backstop only.** A generous per-IP limit (in-memory LRU; single-instance-bound, fine for this deploy; beware shared NAT/campus IPs). Bandwidth-abuse control, never the confidentiality mechanism — enumeration is already off the table via the slug.

## Sandbox & host renderer (`components/DynamicSandboxRenderer.tsx`)

```
props: { demoSlug: string; demoParts: number }
<iframe sandbox="allow-scripts" src={`/demos/${demoSlug}`}>   ← sandbox attribute is NON-OPTIONAL
state: { height, error, activePart }
```

- `sandbox="allow-scripts"` (no `allow-same-origin` → opaque origin `"null"`) is what makes loading the demo page safe; embedding the URL without it is the XSS the whole design exists to prevent. The sandbox blocks *state*, not resource loads — that's why it can load our same-origin harness/vendor/bundle URLs.
- Listens for `message` with `event.origin === "null"`; validates `event.data` shape on receipt.
  - `SANDBOX_RESIZE` → `setHeight(clamp(h, MIN, MAX))` — an untrusted number feeds CSS, so it is clamped.
  - `SANDBOX_ERROR` → banner (v1; full UX in #30). Non-blocking by construction.
- **Stepper** rendered from `demoParts` (0..n−1); on change: `iframeRef.current.contentWindow.postMessage({ type: "DEMO_SET_PART", part }, "null")`.
- The host's knowledge of the demo comes **only** from the validated contract (`demo_parts`) — never from sandbox output (ADR 0003 invariant).

## Protocol (full v1 surface — see ADR 0007)

| direction       | message                     | validation at receiver                        |
| --------------- | --------------------------- | --------------------------------------------- |
| parent → iframe | `DEMO_SET_PART {part: int}` | integer, clamped to `0..demo_parts−1` (harness) |
| iframe → parent | `SANDBOX_RESIZE {height}`   | number, clamped to sane bounds (host)          |
| iframe → parent | `SANDBOX_ERROR {message}`   | string, truncated (host)                       |

No other message exists. Adding one is an ADR-level decision (it crosses the trust boundary).

## Schema & contract deltas

- `db/schema.ts` on `session_messages`:
  - `demo_js: text("demo_js")` — nullable, derived ESM module (demo code only), regenerable from TSX;
  - `demo_slug: text("demo_slug")` — nullable, `UNIQUE`, `crypto.randomBytes(16).toString("hex")`, minted with `demo_js`. The URL name; never derived from the sequential row id.
- `core/contracts`: optional `demo_tsx: string` + `demo_parts: int(≥1)` on the response types that may carry a Demo. `demo_parts` without `demo_tsx` (or vice versa) is a contract violation.
- Generation-time sanity check (flag-only for now, enforced in #30): TSX that never references its `part` prop is a contract violation.

## Delivery options considered (rejected)

- **Self-contained IIFE inlined in the document** (harness + React bundled per demo, one `<script>`) — superseded: shipped ~200 KB of React in *every* artifact, and load/render failures were invisible except by timeout. The harness/vendor split moves React out of the per-demo artifact and makes failures catchable.
- **srcdoc inlining** — bundle as a string in the iframe's `srcdoc`: no browser caching, JS bytes riding the API JSON, most host-side machinery.
- **Static files in `public/`** — runtime writes to the deploy directory: breaks ADR 0001 (second, unbacked-up store), dies with deploys/scaling. (Deploy-time *build outputs* such as the harness/vendor are different — they're deterministic build artifacts, not runtime data.)
- **Tokenized URLs** (per-artifact capability token, revocable) — same enumeration protection as an unguessable slug, more machinery. Revive only if the **public-safe content** boundary is ever withdrawn.

## Deferred (tracked in #30)

- Compile/allowlist failure → bounded LLM retry with the esbuild error, then degrade to a demo-less turn.
- Read-time missing `demo_js` → on-demand re-compile + backfill (slug unchanged → cached URL keeps working).
- Runtime-crash UX beyond the banner (fallbacks, source-view); stall timeout for hung bundle loads.
