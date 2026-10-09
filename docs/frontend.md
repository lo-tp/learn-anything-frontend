# Frontend — Learn Anything

A guide to adding a new page the way this codebase does it. Covers the frontend surface only (routes, views, components, helpers); the data layer is treated as a black box the page consumes.

## Frontend structure recap

A Next.js (App Router) + React + TypeScript app. Styling uses Tailwind with a semantic token palette and lucide-react icons.

| Folder | Role |
|---|---|
| `app/` | Routes. Root `layout.tsx` + one `page.tsx` per route (e.g. `/`, `/demo`). |
| `views/` | The interactive "page" component. Client component that owns state. |
| `components/` | Pure, props-driven leaf components + `ui/` primitives. |
| `lib/` | Frontend helpers — `time.ts` (relative time), `utils.ts` (`cn()`). |

## The 3-layer model

Every page splits into three layers, and each has a job it shouldn't cross:

| Layer | Where | Role | Server/Client |
|---|---|---|---|
| **Route entry** | `app/<route>/page.tsx` | Thin. Renders the view — no data resolution. Default-exports the page. | Server (default) |
| **View** | `views/<name>.tsx` | The interactive "page". Owns state, **owns its data fetches** (initial on mount + refresh), wires handlers, composes leaf components. | `"use client"` |
| **Leaves** | `components/<kebab-name>.tsx` | Pure, props-driven, no state. Reusable. | Either |

Two ground rules that make this work:

- **The root layout already wraps everything in `<Frame>`** (`app/layout.tsx` → `TopBar` + full-height column). So a page supplies **content only** — never re-add the frame or top bar.
- **`@/*` = repo root** (tsconfig `paths`), so you import `@/views/…`, `@/components/…`, `@/lib/…`.

## A route that is not a page

`app/api/health/route.ts` is the one Route Handler here, and it is not part of the 3-layer model: no view, no leaf, no data. Why it exists, and why it sits outside `app/[locale]` and outside the `proxy.ts` matcher, is argued in that file (#158). Deleting it, or moving it under a locale, takes the public surface to 502 while every pod still reports Ready; the guards are `test/routes/health-route.test.ts` and the image smoke step, and the path is paired with the readiness probe in `learn-anything-infra`'s `manifests/base/frontend.yaml`.

## Adding an interactive page

### 1. Leaf components — `components/<kebab-name>.tsx`
Pure, props-in, named export, kebab-case filename, design tokens, no state. This is your presentational unit: it receives props, renders one visual thing, and owns nothing.

### 2. View — `views/<name>.tsx`
This is the actual interactive page. Mark it `"use client"`, have it own the state, compose the leaves, and use the **standard content frame** — copy the outer `main`/`div` wrapper structure from `views/mine/index.tsx`. Fetch its own data on mount (via `lib/api-client`) and refresh as needed — the route is a static shell that passes no data.

### 3. Route entry — `app/<route>/page.tsx`
A server component. It renders the view and nothing else — the app is a pure client-side frontend (#87): every page is a static shell pre-rendered per locale, and all data fetching happens in the browser (the view fetches on mount and refreshes as needed). Default-export the page.

Navigate to the new route — the frame/top bar come free from the layout.

## Conventions to match (so it looks native)

- **Filenames**: kebab-case for components (`progress-card.tsx`); `views/` named after the page concept (`progress.tsx`).
- **Exports**: named exports for everything **except** the route, which uses a default export.
- **`"use client"`**: only on the view and any leaf that uses state/hooks/events. Pure leaves stay server-compatible.
- **Content frame**: reuse the standard wrapper verbatim — a scrollable `main` holding a centered, max-width, padded `div` (see `views/mine/index.tsx`).
- **Styling**: use the design tokens, not raw hex — `text-on-surface`, `text-on-surface-variant`, `bg-surface-container`, `bg-surface-container-high`, `text-primary`, `border-outline-variant`, `text-error`, `font-display`, `font-mono`. (Full list in `app/globals.css`.)
- **Data flow**: the view is the **single state owner** — and the single **fetcher**; leaves receive props and report back via callbacks (see `NewSessionDialog` → `onAccept` → parent `refresh()`). The exception is **shared chrome**: frame-level components mounted in `components/frame.tsx` (top-bar widgets, dialogs) may own their own state and fetches, because they live outside any single page's view (e.g. `account-menu.tsx`, `sign-in-form.tsx`, `sign-in-modal.tsx` — the sign-in form belongs to the modal, which replaces the old login page, #147).
- **Cross-component signals**: components outside each other's trees communicate through the plain event bus in `lib/auth-events.ts` (#147) — e.g. the API client asks the sign-in modal to open on a 401; surfaces re-fetch on a sign-in. A sign-out is announced too, but the account menu pairs it with a navigation to the public Explore list at the site root: a User-only page is never asked to render without an owner.
- **Identity**: the viewer's sign-in state is settled once per page load by `hooks/use-sign-in-state.ts` — the `GET /auth/me` probe, where a 401 is a Visitor and never opens the modal. Chrome and views read that hook; nothing probes identity for itself, and the top bar offers Explore to a Visitor or Study to a User, never both (#143, ADR-0005).
- **Docs/comments**: each file opens with a short doc block; reference the design doc and ticket (e.g. `per design/progress/card` or `(#31)`) — matching the style of the existing files.

## Backend interactions: loading and error states

Every backend interaction the view owns (#87) gets a loading state, an error state, and an in-flight story — a blank page or a silent failure is a bug, not a state (#132):

- **Loading**: a friendly panel via `components/state-panel.tsx` — never a blank page, and never the empty state doubling as loading.
- **Error**: a panel with a **Retry** button that re-runs the fetch (e.g. `views/mine/index.tsx`). The exception is a self-retrying poll, which shows an honest note about the auto-retry instead (`views/session.tsx`).
- **401**: `lib/api-client` asks the sign-in modal to open over the current surface — the modal replaces the old full-page redirect to login (#147). The page settles into its ordinary error state behind the modal and re-fetches in place on sign-in (`lib/auth-events`); no page suppression, no navigation.
- **In-flight writes**: disable the control while the request is pending and await it before advancing; on failure stay in place with a notice so the action can be retried — a failed write must never be swallowed (e.g. `views/review.tsx`). Fire-and-forget is for misses that cost nothing (`postReviewCard` material).
- **Background refresh**: silent — keep the existing content on failure (the intake re-fetch in `views/mine/index.tsx`).

## Do / Don't

- ✅ Add `app/<route>/page.tsx`; let the layout supply the frame.
- ✅ Keep route entries thin (render the view), and interactivity **plus data fetching** in the `views/` client component.
- ✅ Make leaves pure and reusable.
- ❌ Don't re-wrap in `<Frame>`/`<TopBar>` in the page.
- ❌ Don't fetch data in a route entry — views own their fetches (#87).
- ❌ Don't put state in a leaf, or data-fetching in a component that isn't the view (shared chrome mounted in the frame is the exception — see Conventions).
- ❌ Don't probe `GET /auth/me` from a component — read `useSignInState()` (#143/ADR-0005).
- ✅ Session data comes from the typed backend client (`lib/api-client`); `types/api.d.ts` is generated (`npm run generate:types`), never hand-edited.
- ✅ Give every fetch a loading state and an error state with Retry (`components/state-panel.tsx`) — no silent failures, no swallowed write errors (#132).
