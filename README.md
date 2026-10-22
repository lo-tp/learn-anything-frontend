# Learn Anything

An AI conversation-driven learning assistant. Describe the knowledge you want to learn, and it walks you to mastery — one question at a time.

Production is **[learn.lotp.xyz](https://learn.lotp.xyz)** (its backend is `api.lotp.xyz`, its slides `sandbox.lotp.xyz`). Only a merge of `main` into `release` builds the image production runs; the path a change takes to a browser — and the digest rollback — is written out in [AGENTS.md](AGENTS.md).

## How it works

1. **You say what you want to learn.** A free paragraph — e.g. *"I want to learn Newton's second law of motion."* If the target is too broad, the app asks you to narrow it before probing.
2. **The app probes your boundary.** A short run (max 10) of multiple-choice / true-false questions, each with an *I don't know* option, that map where your understanding starts and where it stops. All-correct does not end the run — it means the questions were too easy, so the next batch gets harder, and a wrong answer is probed around before the run concludes: it loops until your boundary is bracketed.
3. **You get a plan.** An ordered list of incrementally small steps from your boundary to mastery — dependencies first (`F`, `m`, `a` before `F=ma`).
4. **You review and adjust it.** In your own words you can add, remove, or change the depth or difficulty of the plan (*"I don't know the definition of gravity — add this"*). Every adjustment regenerates the full plan; nothing is taught until you approve it.
5. **Approval generates the material.** Per plan step: LLM-authored slides and quiz questions plus a summary of the step's key points. Generation runs in the background: you can close the window and the deck is served when it is ready.
6. **You work through the deck.** `/session/{id}` shows one item at a time: the sidebar lists the deck grouped under its steps, the arrow keys and *Go to a slide* move through it, and any slide can be rewritten on request (*"walk it slower, add a worked example"*) while the rest of the deck stays as it is. Slides are LLM code and never run in this app's origin — see [Development → Sandbox](#sandbox-the-slide-demo-surface).
7. **A miss becomes a review card, and the card comes back.** Get a question wrong and the card shows why your choice is wrong and the correct one right; the miss is written once — a review card is unique per (you, source, session, question). `/review` serves those cards when they are due, in scheduled order (FSRS, ADR-0001): reveal the answer, say how confident you were — *again / hard / good / easy* — and the card is rescheduled. This is the part of the app that outlives a session.

### Not built yet

The gaps a reader would otherwise assume away:

- Nothing submits a deck answer to the backend. Walking the deck is the browser's, no step is ever marked passed, and a Session never reaches `complete` — only misses are durable.
- There is no session document to view or download. The deck and the review cards are the artifacts.
- An intake abandoned mid-clarify is not resumable: both lists show only Sessions that have materials.
- Neither list is paginated.

## Surfaces

| Route | What it is |
|---|---|
| `/` | **Explore** — the public feed of every Session that reached materials: goal text, no owner, your language first and newest first within each group (#205) |
| `/mine` | **Study** — your own Sessions |
| `/session/{id}` | a Session's deck. Reads are public, so a Visitor opens and answers it too; their answers stay local to that view and their misses replay into Review if they sign in (#151, #152) |
| `/review` | your due review cards — the writes here ask for a sign-in |
| `/api/health` | the health route the load balancer accepts nothing but an exact 200 from (#158) |

Sign-in is email and password, with an optional display name. Ownership begins at the write, not the read: every read above answers a Visitor exactly as it answers a User (ADR-0004, ADR-0006), and the top bar offers a Visitor Explore or a User Study, never both (ADR-0005). The app is bilingual — English and Chinese (`messages/`, next-intl) — and ships light and dark palettes (`public/palette.css`), which every surface must serve equally.

## Development

### Quickstart

Prereq: a running Learn Anything backend. `generate:types` reads its OpenAPI document at `http://localhost:8001`, so `NEXT_PUBLIC_BACKEND_URL` in `.env` must name the origin that backend actually serves.

```bash
# 1. Create the env file and point NEXT_PUBLIC_BACKEND_URL at the backend
cp .env.example .env

# 2. Install dependencies
npm install

# 3. Start the app
npm run dev     # http://localhost:3000
```

`npm test` runs the unit tests (Vitest) without starting the app; `npm run check` runs lint + typecheck + the coverage-gated suite in one go — the same chain the git `pre-push` hook and CI run.

### Sandbox (the slide demo surface)

Slides are LLM-authored, and LLM code never runs in this app's origin: `/slides/*` belongs to a separate service — [lo-tp/learn-anything-sandbox](https://github.com/lo-tp/learn-anything-sandbox) — on its own origin. The split of work is: the backend asks that service's `POST /api/compile` to validate a slide's JSX and compile it to ESM, stores the bundle, and the sandbox's `/slides/{slide_id}` page fetches the stored bundle server-to-server (`GET /slides/{slide_id}`, `X-Service-Token`) and serves it into an opaque-origin iframe. There is no per-request compile; the browser executes the material only inside that frame.

To develop against it locally, run the sandbox repo beside this one:

```bash
# in a second clone: lo-tp/learn-anything-sandbox
npm install
npm run dev     # http://localhost:3001
```

Four settings decide whether a slide reaches a reader, and only the first of them lives in this repository:

- `NEXT_PUBLIC_SANDBOX_ORIGIN` here is the origin this app frames; `.env.example` defaults it to `http://localhost:3001`.
- The sandbox's own gitignored `.env.local` needs `SANDBOX_SERVICE_TOKEN` — the same secret the backend carries — or every slide 500s.
- Its `ALLOWED_FRAME_ANCESTORS` must name the origin doing the framing (`http://localhost:3000`, or the LAN address you browse from) or the browser refuses the frame while the slide page answers 200.
- The backend needs `SANDBOX_URL` pointed at the compiler (`http://localhost:3001`; its default is `http://localhost:8080`). A backend that cannot reach it fails every slide's compile, and an attempt budget spent on a slide that never compiles leaves a placeholder stand-in in that deck slot.

While developing a slide, `SANDBOX_ALLOW_DIRECT_SLIDE_ACCESS=true` in that same file opens `http://localhost:3001/slides/{slide_id}?theme=light` in a plain tab; without it a top-level tab is 403, which is the point: untrusted slide code runs in a frame.

What crosses between the two origins:

- **The frame.** `components/sandbox/sandbox-frame.tsx` renders the persistent player iframe and the sidebar's scaled-down previews; their URLs come from `sandboxSlideSrc()` (`lib/utils.ts`) as `{origin}/slides/{slide_id}?theme={theme}`, with a `&fresh={n}` nonce when a just-rewritten slide must be re-fetched.
- **The messages.** `postMessage` is the only channel: `DEMO_SET_SLIDE` and `DEMO_SET_THEME` out, `SANDBOX_READY` back as the cue to re-post anything sent before the harness's listener existed. A slide or theme change therefore never re-keys the frame's `src`, which is what keeps the reader's position intact. The message contract is in the sandbox's `core/slides/framework.tsx`.
- **The palette.** The slide page links `palette.css` from this app's origin — the palette belongs to the app, and it is the frame's one cross-origin asset — so slides repaint in the app's light/dark palettes.

In production the origin is `https://sandbox.lotp.xyz`, inlined at image build time like the backend URL (`.github/workflows/build-image.yml`); the sandbox's `frame-ancestors` policy is what lets this app frame it.

### Another device on your network

`npm run dev` binds `0.0.0.0`, so a phone on the same network can open `http://<lan-ip>:3000` — and until you name that origin, the page it shows has nothing on it. Next refuses cross-origin requests for dev-only resources (`/_next/hmr`, the HMR payloads) unless the requesting host is listed in `allowedDevOrigins`. Refused, the client never finishes booting: no hydration, so the fetch a view owns never runs, and the browser keeps displaying the loading panel the server rendered. Nothing is thrown, and the only trace is one line in the dev log:

```text
⚠ Blocked cross-origin request to Next.js dev resource /_next/hmr from "192.168.31.178".
```

Name the host in `.env.local` (gitignored) and restart `npm run dev`; `next.config.ts` reads it through `devAllowedOrigins`:

```bash
# a host, or a comma-separated list — no scheme, no port
DEV_ALLOWED_ORIGINS=192.168.31.178
```

Two ways to write it that fail with that same symptom, so they are worth knowing: `192.168.*`, because the wildcard covers subdomains and not IP prefixes, and `http://192.168.31.178:3000`, because the setting is matched against the host a browser names, not a URL.

On that device you are a Visitor, not a copy of your signed-in session: the sign-in cookie is host-only unless `COOKIE_DOMAIN` names a shared parent (`core/security.cookie_policy` in the backend), so a cookie minted for `localhost` is never sent to a page served from the LAN address. To carry your sessions there too, point `NEXT_PUBLIC_BACKEND_URL` at the same host as the page you browse — `http://192.168.31.178:8001` — and sign in there; the backend's `CORS_ORIGINS` exists to list exactly that kind of origin.

## Backend integration

The frontend talks to the backend directly through one typed client — `lib/api-client.ts`, built on `openapi-fetch` — with no Next.js proxy in front of it. It runs in the browser, which is why the origin it calls is `process.env.NEXT_PUBLIC_BACKEND_URL` exactly and deliberately has no fallback: only `NEXT_PUBLIC_`-prefixed values reach the client bundle, and unset leaves openapi-fetch issuing relative paths against the app's own origin.

`types/api.d.ts` is generated from the backend's OpenAPI spec and is the single source of truth for every request/response type:

```bash
npm run generate:types
# = openapi-typescript http://localhost:8001/openapi.json -o types/api.d.ts
```

Run it whenever the backend spec changes (it needs the backend running at that URL), and never edit `types/api.d.ts` by hand — the next run overwrites it. Auth, sessions, the intake endpoints, materials and slide regeneration, and the review deck all follow from that one file.

## Docs

- [Glossary](CONTEXT.md) — the domain language: what the app is and the terms its code and docs use.
- [Product](PRODUCT.md) — the product contract: users, fixed flow facts, brand commitments.
- [ADRs](docs/adr/) — the decisions that supersede the prior design: FSRS review scheduling (0001), pgvector for the learner map (0002), LangSmith tracing (0003), browsing is public / ownership is not (0004), the chrome's one identity probe (0005), public reads and gated writes (0006), plain-text math on text surfaces (0007).
- [Frontend](docs/frontend.md) — the frontend page-structure guide: routes, views, leaves, and the loading/error rules.
- [Design system](design/DESIGN.md) — the visual language: the press, the tokens, and the rules every surface obeys.
- [AGENTS.md](AGENTS.md) — how an agent works in this repo: issue tracker, priority and triage labels, branch promotion, and how a change reaches a browser.

## License

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)

Released under the [GNU General Public License v3.0](LICENSE).
