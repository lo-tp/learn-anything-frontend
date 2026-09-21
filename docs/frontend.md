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

## Adding an interactive page

### 1. Leaf components — `components/<kebab-name>.tsx`
Pure, props-in, named export, kebab-case filename, design tokens, no state. This is your presentational unit: it receives props, renders one visual thing, and owns nothing.

### 2. View — `views/<name>.tsx`
This is the actual interactive page. Mark it `"use client"`, have it own the state, compose the leaves, and use the **standard content frame** — copy the outer `main`/`div` wrapper structure from `views/root.tsx`. Fetch its own data on mount (via `lib/api-client`) and refresh as needed — the route is a static shell that passes no data.

### 3. Route entry — `app/<route>/page.tsx`
A server component. It renders the view and nothing else — the app is a pure client-side frontend (#87): every page is a static shell pre-rendered per locale, and all data fetching happens in the browser (the view fetches on mount and refreshes as needed). Default-export the page.

Navigate to the new route — the frame/top bar come free from the layout.

## Conventions to match (so it looks native)

- **Filenames**: kebab-case for components (`progress-card.tsx`); `views/` named after the page concept (`progress.tsx`).
- **Exports**: named exports for everything **except** the route, which uses a default export.
- **`"use client"`**: only on the view and any leaf that uses state/hooks/events. Pure leaves stay server-compatible.
- **Content frame**: reuse the standard wrapper verbatim — a scrollable `main` holding a centered, max-width, padded `div` (see `views/root.tsx`).
- **Styling**: use the design tokens, not raw hex — `text-on-surface`, `text-on-surface-variant`, `bg-surface-container`, `bg-surface-container-high`, `text-primary`, `border-outline-variant`, `text-error`, `font-display`, `font-mono`. (Full list in `app/globals.css`.)
- **Data flow**: the view is the **single state owner** — and the single **fetcher**; leaves receive props and report back via callbacks (see `NewSessionDialog` → `onAccept` → parent `refresh()`).
- **Docs/comments**: each file opens with a short doc block; reference the design doc and ticket (e.g. `per design/progress/card` or `(#31)`) — matching the style of the existing files.

## Do / Don't

- ✅ Add `app/<route>/page.tsx`; let the layout supply the frame.
- ✅ Keep route entries thin (render the view), and interactivity **plus data fetching** in the `views/` client component.
- ✅ Make leaves pure and reusable.
- ❌ Don't re-wrap in `<Frame>`/`<TopBar>` in the page.
- ❌ Don't fetch data in a route entry — views own their fetches (#87).
- ❌ Don't put state in a leaf, or data-fetching in a component that isn't the view.
- ✅ Session data comes from the typed backend client (`lib/api-client`); `types/api.d.ts` is generated (`npm run generate:types`), never hand-edited.
