# Demos: raw LLM-authored TSX, executed in an opaque-origin sandbox

Markdown rendering (react-markdown, ADR 0001's document pane) is not expressive enough for everything a session must show. A **Demo** is therefore raw TSX written by the LLM, compiled at write time with esbuild, and executed in an `<iframe sandbox="allow-scripts">` — no `allow-same-origin`, so the iframe gets an **opaque origin** (`"null"`) and the browser engine itself blocks it from the host DOM, cookies, storage, and `window.parent` state. No bundler integration, no dynamic `import()` in the host, no XSS surface in the app.

**Storage:** TSX is the source of truth, stored in the turn log with the rest of the LLM's structured response (ADR 0004). The compiled JS is derived data in a sibling `demo_js TEXT NULL` column, written atomically at generation; TSX wins if they ever disagree. esbuild is a real server dependency (Node deployment), not a dev tool.

**Import policy:** the allowlist is React only (`react`, `react/jsx-runtime`, hooks). Any other specifier fails the compile. The compile output is a **self-contained IIFE** that bundles React 19 from the app's own `node_modules` (matching the app's real React with zero CDNs and offline operation; React 18 UMD was the last UMD release and is not what the app runs) — one bundle for harness + Demo so they share a single React instance. Styling is a static CSS reset + custom properties served by the app itself — no Tailwind JIT or other CSS runtime in the sandbox. The LLM styles via inline styles or a `<style>` tag.

**Protocol** (the sandbox's entire cross-boundary surface):

| direction       | message                     | purpose                                        |
| --------------- | --------------------------- | -------------------------------------------- |
| parent → iframe | `DEMO_SET_PART {part: int}` | select the active part (clamped 0..n-1)      |
| iframe → parent | `SANDBOX_RESIZE {height}`   | auto-height (clamped)                          |
| iframe → parent | `SANDBOX_ERROR {message}`   | error banner, non-blocking, never halts a turn |

The Demo's default export accepts a `part: number` prop; a part switch re-renders the mounted component (no remount). The part **count** is a declared, Zod-validated contract field (`demo_parts`, ≥ 1) emitted by the LLM next to the TSX — the host learns the valid range from the contract, never from the sandbox (ADR 0003 invariant: the stage machine consumes contract fields only, never iframe output).

**Considered options:**

- **Markdown-only** — dropped: insufficient expressiveness for interactive concept material (decision, not a technical limit).
- **Component palette + structured props** (LLM picks from hand-written components) — dropped in favor of raw TSX: the palette caps exactly the expressiveness this feature exists for. The sandbox + import allowlist are what make raw TSX safe, not the palette.
- **No message channel at all** (srcdoc regeneration as the only update path) — dropped: live part selection and auto-height need a channel; the three-line protocol above is the minimum that supports them.

**Consequences / deferred (explicit to-dos):**

- Generation-time failure policy — compile/allowlist error → bounded LLM retry with the esbuild error fed back, then degrade to a demo-less turn — is **deferred**; demos must remain optional garnish, no failure mode may stall the stage machine.
- Full error-handling UX (render fallbacks, source-view on crash) is deferred; v1 ships the banner only.
- `event.data` is validated on receipt in both directions; heights clamped; the `demo_js` column is regenerable from TSX (backfill path).
