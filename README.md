# Learn Anything

An AI conversation-driven learning assistant. Describe the knowledge you want to learn, and it walks you to mastery — one quiz question at a time.

> Status: under construction. The app shell (chat sidebar + document pane) runs on Next.js; the learning flow is being built against the spec below.

## How it works

1. **You say what you want to learn.** A free paragraph — e.g. *"I want to learn Newton's second law of motion."* If the target is too broad, the AI asks you to narrow it before probing.
2. **The AI probes your boundary.** A short run (max 10) of multiple-choice / true-false self-assessment questions that map what you already know and what you don't.
3. **The AI generates a plan.** An ordered list of incrementally small learning steps from your current boundary to mastery — dependencies first (understand `F`, `m`, `a` before `F=ma`).
4. **You review and adjust it.** In your own words you can add, remove, or change the depth or difficulty of the plan (*"I don't know the definition of gravity — add this"*). Every adjustment regenerates the full plan; execution starts when you approve.
5. **You get drilled.** From this point on, everything asked of you is a multiple-choice or true/false question — one at a time, generated for the current step. Answer wrong and the AI explains why yours is wrong and why the correct one is right, then re-tests you with a *different* question on the same step, until you pass.
6. **One markdown tracks it all.** A single live-updated markdown document per session — plan checklist, per-question outcomes, explanations — viewable and downloadable at any time.
7. **You finish when you've mastered it.** The session ends when every plan step has been passed, with a closing summary.

## Also

- **Your account, your progress** — sign up with email and password; sessions are private to your account.
- **Pick up on any device** — all state lives in a server-side database; resuming continues exactly where you left off.
- **Learn several things at once** — sessions for different knowledge points run independently.

## Development quickstart

Prereqs: a running Learn Anything backend (see the "Backend integration" section below).

```bash
# 1. Create the env file and point NEXT_PUBLIC_BACKEND_URL at the backend
cp .env.example .env

# 2. Install dependencies
npm install

# 3. Start the app
npm run dev     # http://localhost:3000
```

`npm test` runs the unit tests (Vitest) without starting the app; `npm run check` runs lint + typecheck + tests in one go (also run automatically by the git `pre-push` hook).

## Backend integration

The frontend talks to the backend's session API directly through a typed client — `lib/api-client.ts` (built on `openapi-fetch`) — instead of a Next.js proxy. New-session creation in the dialog and the Home History (`GET /sessions`, all phases, newest first) both go through it.

**Endpoint origin.** The client's `baseUrl` is exactly `process.env.BACKEND_URL` from `.env` — there is deliberately no fallback. When the variable is unset, requests are issued as relative paths (`/sessions` → same origin as the app), so the backend must be served there.

**Schema regeneration.** `types/api.d.ts` is generated from the backend's OpenAPI spec and is the single source of truth for every request/response type:

```bash
npm run generate:types
# = openapi-typescript http://localhost:8001/openapi.json -o types/api.d.ts
```

Run it whenever the backend spec changes (it needs the backend running at that URL), and never edit `types/api.d.ts` by hand — the next run overwrites it. After a regeneration, the client's types (paths, params, bodies, responses) follow automatically.

## Docs

- [Architecture revamp](ArchitectureRevamp.md) — the three-service restructure (FE/BFF + Sandbox + LangGraph LLM): topology, contracts, state ownership, demo flow, deployment, and the decisions that supersede the prior design.
- [Frontend](docs/frontend.md) — the frontend page-structure guide.
