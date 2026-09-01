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

Prereqs: podman (with the `compose` plugin — the Docker daemon stays off) and a local `psql` client.

```bash
# 1. Start the dev Postgres (single service; the app itself is never containerized)
podman compose up -d

# 2. Create the env file and point the LLM_* vars at your local
#    OpenAI-compatible server (e.g. llama.cpp)
cp .env.example .env

# 3. Install dependencies (needed by the db script: drizzle-kit)
npm install

# 4. Rebuild the databases (each run WIPES its database — that is the point)
scripts/setup-db.sh dev     # learn_anything — schema + seed
scripts/setup-db.sh test    # learn_anything_test — schema only

# 5. Start the app
npm run dev     # http://localhost:3000 — the design shell (placeholder content)
```

`npm test` runs the unit tests (Vitest) without starting the app; `npm run check` runs lint + typecheck + tests in one go (also run automatically by the git `pre-push` hook).

`scripts/setup-db.sh <dev|test>` rebuilds one database from scratch: drop + create, apply the schema from `db/schema.ts` via `drizzle-kit push`, and (for `dev`) apply `db/seed.sql`. Re-running it **wipes that database** — dev data is disposable pre-MVP. It requires the compose Postgres to be running first (`podman compose up -d db` — step 1) and fails fast with a hint otherwise. `podman compose down` stops the db (`podman compose down -v` also wipes its volume).

## Docs

- [User stories](docs/user-stories.md) — what the app does, story by story, with acceptance criteria
- [Architecture](docs/architecture.md) — components, the per-turn data flow, and what is deliberately deferred
- [Schema](docs/schema.md) — the Postgres tables, and which invariants the database enforces versus the stage machine
- [Glossary](CONTEXT.md) — the app's exact terminology
- [ADR 0001](docs/adr/0001-database-is-source-of-truth.md) — the database is the source of truth; the progress markdown is a projection
- [ADR 0002](docs/adr/0002-execution-time-quiz-generation.md) — quizzes are generated at execution time, not plan time
- [ADR 0003](docs/adr/0003-deterministic-stage-machine.md) — the stage machine is deterministic; the LLM generates content, it does not drive the session
- [ADR 0004](docs/adr/0004-session-state-is-the-llm-turn-log.md) — session state is the LLM-turn log; everything else is a projection
