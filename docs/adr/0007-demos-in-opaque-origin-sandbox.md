# Demos: raw LLM-authored TSX, executed in an opaque-origin sandbox

Markdown rendering (react-markdown, ADR 0001's document pane) is not expressive enough for everything a session must show. A **Demo** is therefore raw TSX written by the LLM, compiled at write time with esbuild, and executed in an `<iframe sandbox="allow-scripts">` — no `allow-same-origin`, so the iframe gets an **opaque origin** (`"null"`) and the browser engine itself blocks it from the host DOM, cookies, storage, and `window.parent` state. No bundler integration, no dynamic `import()` in the host, no XSS surface in the app.

**Storage:** TSX is the source of truth, stored in the turn log with the rest of the LLM's structured response (ADR 0004). The compiled JS is derived data in a sibling `demo_js TEXT NULL` column, written atomically at generation; TSX wins if they ever disagree. esbuild is a real server dependency (Node deployment), not a dev tool.

**Import policy:** the allowlist is React only (`react`, `react/jsx-runtime`, hooks). Any other specifier fails the compile. Each demo compiles to a **small ESM module containing only the demo's code** (React external). React 19 is vendored **once at deploy** as self-contained ESM from the app's own `node_modules` (zero CDNs, offline operation; React 18 UMD was the last UMD release and is not what the app runs), and an import map in the sandbox document routes `react` from both the harness and the demo bundle to that single vendored module — **one React instance** across the trust boundary (two instances would split the hooks dispatcher). Styling is a static CSS reset + custom properties served by the app itself — no Tailwind JIT or other CSS runtime in the sandbox. The LLM styles via inline styles or a `<style>` tag.

**Protocol** (the sandbox's entire cross-boundary surface):

| direction       | message                     | purpose                                        |
| --------------- | --------------------------- | -------------------------------------------- |
| parent → iframe | `DEMO_SET_PART {part: int}` | select the active part (clamped 0..n-1)      |
| iframe → parent | `SANDBOX_RESIZE {height}`   | auto-height (clamped)                          |
| iframe → parent | `SANDBOX_ERROR {message}`   | error banner, non-blocking, never halts a turn |

The Demo's default export accepts a `part: number` prop; a part switch re-renders the mounted component (no remount). The part **count** is a declared, Zod-validated contract field (`demo_parts`, ≥ 1) emitted by the LLM next to the TSX — the host learns the valid range from the contract, never from the sandbox (ADR 0003 invariant: the stage machine consumes contract fields only, never iframe output).

**Delivery:** the iframe loads a demo page route (`/demos/{slug}`) by URL — a server-rendered document **we own byte-for-byte** (import map + a deploy-built **harness** module; the harness, in JSX, `React.lazy`-imports the per-slug bundle inside `Suspense` + an error boundary), all cache-immutable. The slug is an unguessable 128-bit random (never the sequential row id), and the route **403s unless `Sec-Fetch-Dest: iframe`**: outside a sandbox the same URL would execute LLM code in app origin. The page cannot be a Next.js-managed document: an import map must precede every module script, and App Router emits its own into `<head>`; Next's React instance is also private to its chunks. Consequence, accepted as policy: **demo content is public-safe** — a discovered slug serves that demo to anyone; session structure and history stay behind the authenticated API. (IP rate limiting on the route is a bandwidth-abuse backstop only, never the confidentiality mechanism.)

**Considered options:**

- **Markdown-only** — dropped: insufficient expressiveness for interactive concept material (decision, not a technical limit).
- **Component palette + structured props** (LLM picks from hand-written components) — dropped in favor of raw TSX: the palette caps exactly the expressiveness this feature exists for. The sandbox + import allowlist are what make raw TSX safe, not the palette.
- **No message channel at all** (srcdoc regeneration as the only update path) — dropped: live part selection and auto-height need a channel; the three-line protocol above is the minimum that supports them.
- **Self-contained IIFE inlined in the document** (harness + React bundled per demo) — superseded: shipped ~200 KB of React in every artifact, and load/render failures were invisible except by timeout. The harness/vendor split moves React to a once-cached vendor bundle and makes failures catchable by React's own error boundary.
- **srcdoc inlining** (bundle as a string in the iframe's `srcdoc`) — dropped in favor of the demo page route: no browser caching, JS bytes riding the API JSON and a DOM attribute, and the most host-side machinery of the options.
- **Tokenized URLs** (per-artifact capability token, revocable) — dropped in favor of unguessable slugs: same enumeration protection with less machinery. Revive only if the public-safe boundary is ever withdrawn.
- **Static files in `public/`** — dropped: runtime writes to the deploy directory break ADR 0001 (second, unbacked-up store) and die with deploys/scaling.

**Consequences / deferred (explicit to-dos):**

- Generation-time failure policy — compile/allowlist error → bounded LLM retry with the esbuild error fed back, then degrade to a demo-less turn — is **deferred**; demos must remain optional garnish, no failure mode may stall the stage machine.
- Full error-handling UX (render fallbacks, source-view on crash) is deferred; v1 ships the banner only.
- `event.data` is validated on receipt in both directions; heights clamped; the `demo_js` column is regenerable from TSX (backfill path).
