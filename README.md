# Learn Anything

An AI conversation-driven learning assistant. Describe the knowledge you want to learn, and it walks you to mastery — one question at a time.

Production is **[learn.lotp.xyz](https://learn.lotp.xyz)** (its backend is `api.lotp.xyz`, its slides `sandbox.lotp.xyz`). Only a merge of `main` into `release` builds the image production runs; the path a change takes to a browser — and the digest rollback — is written out in [AGENTS.md](AGENTS.md).

## How it works

1. **You say what you want to learn.** A paragraph in plain words — *"I want to learn Newton's second law of motion."* If the goal is too big to learn in one sitting, the app asks a few questions first and narrows it down with you.
2. **It works out what you already know.** Before teaching anything, it asks a short run of quick multiple-choice questions — never more than ten, each with an honest *I don't know* option — to find where your understanding starts and where it stops. If they feel easy, the next ones get harder until the edge of it is found.
3. **You get a plan built from that.** An ordered list of small steps from where you actually are to real mastery of the thing you asked about, the pieces before the formula — F, m and a before F = ma. It starts at your edge, so it skips what you can already do and spends your time on what you can't.
4. **You shape the plan before you start it.** In your own words you can add something you're missing, drop what you already have, or ask for more depth or more difficulty (*"I don't know the definition of gravity — add that"*). Every round of feedback returns a whole new plan to look at, and nothing is taught until you approve it.
5. **You go through it one thing at a time.** Once you approve, each step of the plan becomes something to read and questions to answer: a slide, then its questions, then the next — never a wall of content. Get one wrong and the explanation is there at once — why your reading doesn't hold, and what does. If a slide isn't landing, say what you want different about it and only that slide is rewritten.
6. **What you missed comes back until it sticks.** Every question you got wrong is kept and brought back at the interval that will actually make it memory — days or weeks later, each review rescheduling it further out as it proves itself. This part keeps working after the lesson ends, and it is what turns a finished session into something you still know.

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

Slides are LLM-authored, and LLM code never runs in this app's origin: `/slides/*` belongs to a separate service — [lo-tp/learn-anything-sandbox](https://github.com/lo-tp/learn-anything-sandbox) — on its own origin. The split of work is: the backend asks that service's `POST /api/compile` to validate a slide's JSX and compile it to ESM, stores the bundle, and the sandbox's `/slides/{slide_id}` page fetches the stored bundle server-to-server (`GET /slides/{slide_id}`, `X-Service-Token`) and serves it into an iframe on that service's own origin. There is no per-request compile; the browser executes the material only inside that frame.

The frame is cross-origin, not opaque: the player's `sandbox` attribute is `allow-scripts allow-same-origin`, which keeps the frame's real origin (`http://localhost:3001`, `https://sandbox.lotp.xyz`) instead of the opaque `null` origin this app used to ask for. The boundary is the origin split itself, and that is the point: slide code runs, but in another origin — never this app's cookies, storage, or DOM.

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

While developing a slide, `SANDBOX_ALLOW_DIRECT_SLIDE_ACCESS=true` in that same file opens `http://localhost:3001/slides/{slide_id}?theme=light` in a plain tab; without it the route 403s anything that is not a frame navigation.

What crosses between the two origins:

- **The frame.** `components/sandbox/sandbox-frame.tsx` renders the persistent player iframe and the sidebar's scaled-down previews; their URLs come from `sandboxSlideSrc()` (`lib/utils.ts`) as `{origin}/slides/{slide_id}?theme={theme}`, with a `&fresh={n}` nonce when a just-rewritten slide must be re-fetched.
- **The messages.** `postMessage` is the only channel: `DEMO_SET_SLIDE` and `DEMO_SET_THEME` out, `SANDBOX_READY` back as the cue to re-post anything sent before the harness's listener existed. A slide or theme change therefore never re-keys the frame's `src`, which is what keeps the reader's position intact. The message contract is in the sandbox's `core/slides/framework.tsx`.
- **The palette.** The slide page links `palette.css` from this app's origin — the palette belongs to the app, and it is the frame's one cross-origin asset — so slides repaint in the app's light/dark palettes.

In production the origin is `https://sandbox.lotp.xyz`, inlined at image build time like the backend URL (`.github/workflows/build-image.yml`); the sandbox's `frame-ancestors` policy is what lets this app frame it.

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
