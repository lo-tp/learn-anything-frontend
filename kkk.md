# Move the demos surface to a standalone `learn-anything-sandbox` repo

## Summary

Move the demos delivery route, its dev showcase host, the sample/harness sources, and the demos build tooling out of `learn-anything` into a standalone, minimal, runnable Next.js app in the sibling repo **`learn-anything-sandbox`** (local dir `~/Desktop/Personal/project/javascript/learn-anything-sandbox` already exists and is empty; GitHub remote `lo-tp/learn-anything-sandbox`). The new repo is the development home for the whole demos surface; `learn-anything` keeps only the re-integration base: the `getDemoBySlug` store stub, its test, and the design docs (ADR 0007, `docs/demos.md`).

Locked decisions (from planning chat):
- Repo shape: **standalone demo host app** (own dev server, own origin).
- Scope: **the whole demos surface** — `app/demos/`, `app/demo-sandbox/`, `core/demos/`, `scripts/build-demos.mjs`, the `build:demos` script, and the demos route tests.
- Repo name: **`learn-anything-sandbox`**.

## New repo: `learn-anything-sandbox`

### Moved from main (deleted from `learn-anything`)
- `app/demos/[...demos]/route.ts` — verbatim (the `/demos/*` catch-all: harness/vendor artifacts, per-request esbuild-compiled `sample` bundle, per-slug pages/bundles via `getDemoBySlug`, Sec-Fetch-Dest gate, CORS `*`, immutable cache headers).
- `app/demo-sandbox/page.tsx` — verbatim (iframe `sandbox="allow-scripts"` host, part stepper, auto-height, error banner, protocol log).
- `core/demos/harness.tsx`, `core/demos/sample.tsx` — verbatim (the trusted harness app; the hand-inserted sample slide deck).
- `scripts/build-demos.mjs` — verbatim (esbuild → `out/demos/harness.js` + `out/demos/vendor/*.js`).
- `test/demos-routes.test.ts` — verbatim (imports `../app/demos/[...demos]/route`, asserts against `out/demos/*`; works unchanged with the moved build script).

### Scaffold (new files)
- `package.json` — `private: true`; deps: `next@16.3.4`, `react@19.2.8`, `react-dom@19.2.8`, `esbuild` (native, runtime-compiled sample); devDeps: `typescript`, `@types/react`, `@types/react-dom`, `@types/node`, `vitest`. Scripts — **moved from main's package.json**: `build:demos` (`node scripts/build-demos.mjs`) plus the `predev`/`prebuild`/`pretest` → `build:demos` hooks; new: `dev`/`build`/`start`, `test` (`vitest run`), `typecheck` (`tsc --noEmit`). No tailwind/radix/lint/husky — the moved pages are inline-styled.
- `core/store.ts` — **new minimal module** exporting `getDemoBySlug` with the same no-db stub behavior as main's `core/store/index.ts` (any slug → `{ js, parts }` with the slug embedded in the JS and `parts >= 1`). Do **not** copy the full main store (it drags in drizzle/pg). The route's `@/core/store` import resolves to this file.
- `tsconfig.json` — copy main's (keeps `@/*` → root alias).
- `next.config.ts` — copy main's: `serverExternalPackages: ["esbuild"]` is **required** for the sample route.
- `vitest.config.mts` — copy main's (`@` alias, `test/**` include).
- `next-env.d.ts`, `.gitignore` (`node_modules/`, `.next/`, `out/`).
- `app/layout.tsx` — minimal root layout (`<html>/<body>`, no globals.css).
- `app/page.tsx` — tiny landing page linking to `/demo-sandbox`.
- `README.md` — purpose; provenance (extracted from `lo-tp/learn-anything`; design in main's `docs/demos.md` + ADR 0007; issues #32/#36/#37); run instructions (`npm install`, `npm run dev` → http://localhost:3000/demo-sandbox); **sync-back workflow**: to ship demos into main, copy `app/demos/`, `app/demo-sandbox/`, `core/demos/`, `scripts/build-demos.mjs`, `test/demos-routes.test.ts` back into `learn-anything` and re-add the `build:demos` script + `predev`/`prebuild`/`pretest` hooks to its `package.json`.

## Main repo (`learn-anything`) changes

- **Delete**: `app/demos/`, `app/demo-sandbox/`, `core/demos/`, `scripts/build-demos.mjs`, `test/demos-routes.test.ts`.
- **`package.json`**: remove the `build:demos` script and the `predev`/`prebuild`/`pretest` hooks (all moved to the sandbox repo).
- **Keep untouched**: `app/demo` (session placeholder — linked by `components/session-card.tsx`, unrelated to the sandbox feature), the `getDemoBySlug` stub in `core/store/index.ts`, `test/demo-lookup.test.ts`, `docs/demos.md`, `docs/adr/0007-*`.
- **`docs/demos.md`**: add a one-line pointer at the top: the demos code (routes, harness/sample, `scripts/build-demos.mjs`) currently lives in the `learn-anything-sandbox` repo; re-integration tracked under map #11/#37. Note the doc's inline code references (`lib/demos/compile.ts`, `core/demos/harness.tsx`, `components/DynamicSandboxRenderer.tsx`) are design-target paths — the pointer makes clear the implementation home moved.

## Git workflow

1. New repo: populate the existing empty local dir, `git init` (+ branch `main`), initial commit, create remote `lo-tp/learn-anything-sandbox` (`gh repo create lo-tp/learn-anything-sandbox --private` or web), push. Fresh history — no `git filter-repo`.
2. Main repo: single commit "Move demos surface (routes, core/demos, build script) to learn-anything-sandbox".

## Verification

**Sandbox repo**
- `npm install && npm run typecheck` clean.
- `npm test` — pretest runs `build:demos`; the moved `demos-routes` suite passes exactly as it does in main today (artifact headers, sample compile, 403 fetch-dest gate, CORS headers).
- `npm run dev` → `http://localhost:3000/demo-sandbox`: sample deck renders (5 slides), stepper posts `DEMO_SET_PART`, `SANDBOX_RESIZE` drives iframe height, protocol log fills; `?auto=1` auto-steps. `/demos/sample` opened in a plain tab → 403; `/demos/sample/bundle.js` in a tab → inert JS text.

**Main repo**
- `npm test`, `npm run typecheck`, `npm run build` all green with no `out/demos` and no demos scripts present (remaining `demo-lookup` stub test needs no artifacts).
- `npm run dev` → `/demo` still renders the SessionShell; `/demos/*` and `/demo-sandbox` now 404 (expected post-move).

## Assumptions

- `learn-anything-sandbox` is a brand-new GitHub repo under the `lo-tp` account; the empty local dir is reused (nothing to lose).
- Fresh git history with a single initial commit.
- The sandbox repo is a development home, not a production deploy; integration into the main app is the later manual copy-back documented in its README (tracked under map #11 / #37).
- No lint/husky/tailwind in the new repo (moved pages are inline-styled; quality gates are `typecheck` + `test`).
- `getDemoBySlug` remains stubbed in main's store (no db columns yet, #32); the sandbox repo carries its own minimal copy of the same stub so it runs standalone.
