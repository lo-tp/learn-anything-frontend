# Demos — design

Status: design settled (discussion closed in [#29](https://github.com/lo-tp/learn-anything/issues/29)); implementation tracked off map [#11](https://github.com/lo-tp/learn-anything/issues/11). Decision record: [ADR 0007](adr/0007-demos-in-opaque-origin-sandbox.md). Terminology per [`CONTEXT.md`](../CONTEXT.md).

A **Demo** is raw TSX the LLM authors, compiled at write time, executed in an opaque-origin sandbox iframe. This document is the implementation design: pipeline, compilation, harness, host renderer, and the schema/contract deltas.

## Pipeline

```
TURN (write path, BE)                          READ/RENDER (FE)
───────────────────────────                    ─────────────────
LLM response {…, demo_tsx, demo_parts}
  → Zod-validate (core/contracts)
  → esbuild.compileDemo(tsx, parts)  ──fail──▶ #30 policy (retry / degrade, deferred)
  → persist log row: response JSONB (TSX = truth) + demo_js TEXT (derived)
                                                      
GET turn log → row { demo_js, demo_parts }  →  buildSandboxDoc(demo_js)  →  <iframe srcdoc>
```

- **TSX is the source of truth** (turn log, ADR 0001/0004). `demo_js` is derived data, regenerable from TSX; if a row ever has TSX without JS, re-compile on read and backfill (see #30).
- Compilation is a **pure function of `(demo_tsx, demo_parts)`** — same input, same bytes. `esbuild` becomes a real `dependencies` entry (Node deployment confirmed).

## Compilation (`lib/demos/compile.ts`, BE)

One esbuild invocation produces **one self-contained IIFE**: the harness and the user's TSX share a single React instance (two instances would split the hooks dispatcher and break rendering). React + react-dom come from the app's own `node_modules` (React 19 — the ADR's import-map mechanism is not needed; bundling the app's real dependencies is what "matching the app's React" actually buys, with **zero CDNs and offline operation**).

```ts
const HARNESS_TSX = (parts: number) => `
import { createRoot } from "react-dom/client";
import Demo from "demo-entry";

const PARTS = ${parts}; // baked in: the harness clamps, never trusts the message
let part = 0;
const root = createRoot(document.getElementById("root")!);
const render = () => root.render(<Demo part={part} />);
render();

addEventListener("message", (e) => {
  if (e.data?.type === "DEMO_SET_PART" && Number.isInteger(e.data.part)) {
    part = Math.min(Math.max(e.data.part, 0), PARTS - 1);
    render(); // re-render, not remount — demo state survives part switches
  }
});

new ResizeObserver(() =>
  parent.postMessage({ type: "SANDBOX_RESIZE", height: document.body.scrollHeight }, "null")
).observe(document.body);

addEventListener("error", (e) =>
  parent.postMessage({ type: "SANDBOX_ERROR", message: e.message }, "null"));
addEventListener("unhandledrejection", (e) =>
  parent.postMessage({ type: "SANDBOX_ERROR", message: String(e.reason) }, "null"));
`;

export async function compileDemo(tsx: string, parts: number): Promise<string> {
  const result = await esbuild.build({
    stdin: { contents: HARNESS_TSX(parts), loader: "tsx", resolveDir: process.cwd() },
    bundle: true,
    format: "iife",
    globalName: "Sandbox",
    minify: true,
    target: "es2020",
    write: false,
    plugins: [
      { // the user's TSX, from memory
        name: "user-demo",
        setup(b) {
          b.onResolve({ filter: /^demo-entry$/ }, () => ({ path: "demo-entry" }));
          b.onLoad({ filter: /^demo-entry$/ }, () => ({ contents: tsx, loader: "tsx" }));
        },
      },
      { // ADR 0007 import policy: React only, enforced at compile time
        name: "react-only",
        setup(b) {
          b.onResolve({ filter: /.*/ }, (args) => {
            if (args.importer === "demo-entry" && !/^react(\/jsx-runtime)?$/.test(args.path)) {
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
- **The IIFE + `external` trap:** esbuild rewrites externalized imports in IIFE output to a `require()` shim that throws in the browser — "map React to a global" via `banner` does *not* intercept the import. Resolved here by externalizing nothing; if externalization were ever needed, redirect the specifier through an `onResolve` plugin, never a banner.
- **Allowlist check is compile-time, not lint-after**: a forbidden import is a build error with the offending specifier, which is exactly the payload a retry-with-error loop (#30) feeds back to the LLM.
- The compiled output is escaped before inlining (`<\/script` → `<\\/script`) — a bundle containing that literal would otherwise terminate the harness script tag.

## Sandbox harness (the srcdoc)

The harness code above *is* the sandbox program; the srcdoc wraps it:

```
<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="{APP_ORIGIN}/demos/reset.css">  ← app-served reset + CSS custom properties (ADR 0007: no CSS runtime)
<body>
  <div id="root"></div>
  <script>{compiled_iife, escaped}</script>
```

- `<iframe sandbox="allow-scripts">` — no `allow-same-origin` → opaque origin (`"null"`). The browser engine, not JS, enforces isolation. No `allow-popups`, no `allow-forms`.
- Styling: the app serves a small static reset + theme custom properties (public asset, loaded by absolute URL — opaque origin blocks *state* sharing, not asset fetches). The LLM styles via inline styles or a `<style>` tag; the generation prompt states the palette via the custom properties.
- The Demo contract: **default export, `part: number` prop, renders only `parts[part]`** — this sentence belongs in the generation prompt template.

## Host renderer (`components/DynamicSandboxRenderer.tsx`)

```
props: { demoJs: string; demoParts: number }
state: { srcDoc, height, error, activePart }
```

- `srcDoc = buildSandboxDoc(demoJs)` — built once; a data change re-writes `srcdoc` (fresh document) or sends `DEMO_SET_PART` (live, no remount).
- Listens for `message` with `event.origin === "null"` (opaque sandboxes serialize to the string `"null"`); validates `event.data` shape on receipt.
  - `SANDBOX_RESIZE` → `setHeight(clamp(h, MIN, MAX))` — **clamped**, an untrusted number feeds CSS.
  - `SANDBOX_ERROR` → banner (v1; full UX in #30). Non-blocking by construction — it sets state, nothing else.
- **Stepper** rendered from `demo_parts` (0..n−1); on change: `iframeRef.current.contentWindow.postMessage({ type: "DEMO_SET_PART", part }, "null")`.
- The host's knowledge of the demo comes **only** from the validated contract (`demo_parts`) — never from sandbox output (ADR 0003 invariant).

## Protocol (full v1 surface — see ADR 0007)

| direction       | message                     | validation at receiver                        |
| --------------- | --------------------------- | --------------------------------------------- |
| parent → iframe | `DEMO_SET_PART {part: int}` | integer, clamped to `0..demo_parts−1` (harness) |
| iframe → parent | `SANDBOX_RESIZE {height}`   | number, clamped to sane bounds (host)          |
| iframe → parent | `SANDBOX_ERROR {message}`   | string, truncated (host)                       |

No other message exists. Adding one is an ADR-level decision (it crosses the trust boundary).

## Schema & contract deltas

- `db/schema.ts`: `session_messages.demo_js: text("demo_js").$type<string>()` — nullable sibling column, written atomically with the row (ADR 0007, decision Q: sibling column over JSONB-nesting or a separate table).
- `core/contracts`: optional `demo_tsx: string` + `demo_parts: int(≥1)` on the response types that may carry a Demo. `demo_parts` without `demo_tsx` (or vice versa) is a contract violation.
- Generation-time sanity check (flag-only for now, enforced in #30): TSX that never references its `part` prop is a contract violation.

## Deferred (tracked in #30)

- Compile/allowlist failure → bounded LLM retry with the esbuild error, then degrade to a demo-less turn.
- Read-time missing `demo_js` → on-demand re-compile + backfill.
- Runtime-crash UX beyond the banner (fallbacks, source-view).
