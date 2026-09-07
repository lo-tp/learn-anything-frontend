# Plan: Restructure Learn Anything into three services (FE/BFF + Sandbox + LangGraph LLM)

## Summary
Split the app into three independently deployable parts and move the session driver into a new **Python/LangGraph** service:

- **FE/BFF** = this repo (`learn-anything`, Next.js/TS, :3000): UI + a thin BFF that proxies learner actions to the LLM service and renders the state it reads back.
- **Sandbox** = `learn-anything-sandbox` (Next.js/TS, :3001): serves LLM-authored demos on its own origin; now fetches LearningMaterial TSX from the LLM service and compiles it with esbuild at serve time.
- **LLM** = new repo `learn-anything-llm` (Python, LangGraph, FastAPI, :8000): the **agentic session driver** — a structured LangGraph graph owns the session lifecycle and state (Postgres checkpointer), makes the per-turn LLM calls, and owns the canonical session state + LearningMaterial TSX.

The product invariants (one active question; re-test differs from the just-failed one; ≤10 probes; concepts-only plans ≤ 20; execution only after `APPROVE`; completion only when every step passed) are **preserved** — their enforcement moves from the BFF's TS reducer into the LangGraph graph + Pydantic validation.

## Topology & responsibilities
```
 Learner (browser)
   │
   ▼
 FE/BFF  (learn-anything, :3000) ──thin proxy (internal)──▶ LLM service (learn-anything-llm, :8000)
   │  renders chat + progress markdown + demo iframe   │  owns: LangGraph checkpoint state (Postgres),
   │  (NEXT_PUBLIC_SANDBOX_ORIGIN)                     │  sessions, demos(slug→tsx,parts)
   │                                                   ▼ (internal route, NOT public)
   └──▶ <iframe src="{sandbox}/demos/{slug}"> ──▶ Sandbox (learn-anything-sandbox, :3001)
                              fetches TSX by slug ─▶ LLM service internal API
                              compiles (esbuild, react-only) → serves page + bundle
```
- **BFF** owns: UI, identity (`users`, one static learner), the FE render contract (Zod), progress-markdown render, and a thin HTTP client to the LLM service. It no longer owns the turn log or the stage machine.
- **LLM service** owns: the LangGraph session graph, per-stage Pydantic contracts, the session state (checkpoint) in its own Postgres, and the LearningMaterial TSX store. It is the source of truth for a session.
- **Sandbox** owns: cross-origin demo delivery (page + bundle + harness/vendor build), esbuild compile at serve time, and the React-only import allowlist. It reads LearningMaterial TSX only from the LLM service's internal API.
- **Public/internal boundary:** the BFF is the only public surface (it serves the browser). Every service-to-service call — BFF→LLM and sandbox→LLM — is internal and never routed publicly; the LLM service exposes **no public API**.

## LLM service (new repo `learn-anything-llm`) — behavior

**Two layers, one process.** FastAPI is the *edge* (how it's reached — HTTP in/out); LangGraph is the *engine* (what it does — the session graph). The engine runs **inside** the FastAPI process: route handlers call the graph in-process (`await graph.ainvoke(...)`). The only external dependencies are Postgres (state + demos) and the LLM endpoint (the model).

```
┌─────────────────────────────────────────────────────┐
│  ONE process  (uvicorn → FastAPI app)               │
│   HTTP request ─▶ FastAPI route handler             │
│                          │                          │
│                          ▼  (in-process call)       │
│                     LangGraph graph                 │
│                     (LLM nodes → ChatOpenAI)        │
│                          │                          │
│   HTTP response ◀────────┘                          │
└──────────────┬──────────────────────┬───────────────┘
               │ SQL                  │ HTTPS (model)
               ▼                      ▼
        Postgres (external)      LLM endpoint (external)
     state/checkpoint + demos   Ollama / DeepSeek / …
```

- **Stateless per invocation:** each turn loads state from Postgres (checkpointer), runs, saves back — so the process can restart or scale horizontally without losing sessions.
- **No separate worker or queue:** a turn is a synchronous request/response (one graph invocation per learner action) — no background job to track.
- **Stack:** Python 3.12, FastAPI + Uvicorn (:8000), `langgraph`, `langchain-openai` (`ChatOpenAI`), `langgraph-checkpoint-postgres`, `pydantic`. The LLM endpoint is OpenAI-compatible, configured by env (`LLM_BASE_URL`/`LLM_API_KEY`/`LLM_MODEL`) — hot-swappable (local Ollama/llama.cpp ↔ DeepSeek), as today.
- **The graph:** a **structured** LangGraph graph (nodes = stages, conditional edges = transitions: intake → probing → planning/review → executing → complete), *not* an unbounded tool-loop. One learner action ⇒ one graph invocation; state is loaded from the checkpointer, updated, saved. A turn may chain multiple LLM calls internally (e.g. plan + demo).
- **Contracts:** Pydantic models mirroring the current Zod contracts (question, learning step, plan, and per-stage responses `narrow`/`accept_target`/`question`/`boundary`/`plan`/`advance`/`retest`/`complete`). Authoritative for generation.
- **Invariants enforced in the graph:** exactly one active question; re-test differs from the just-failed question; probing hard cap 10; concepts-only plans ≤ 20 (schema); execution only after explicit `APPROVE`; completion only when every step passed. The LLM signals judgments as declared output fields; the graph acts on them.
- **State store:** its own Postgres database `learn_anything_llm` (same podman instance). LangGraph `PostgresSaver` checkpoint tables + `sessions(learner_id, id, knowledge_point, created_at)` + `demos(slug UNIQUE, session_id, tsx, parts)`. Schema created by a startup setup step (dev data disposable — no alembic pre-MVP, matching the app's push-from-scratch posture).
- **Session API (internal only — consumed by the BFF, never public):**
  - `POST /sessions` `{learnerId, paragraph}` → `{verdict: narrow|accept_target, sessionId?, knowledgePoint?, stateSummary}`.
  - `POST /sessions/{id}/turns` `{action: free text | "ANSWER:<n>" | "APPROVE"}` → `{response: <stage response>, stateSummary}`.
  - `GET /sessions?learnerId=` → history `[{id, knowledgePoint, createdAt, stage}]`.
  - `GET /sessions/{id}` → `{stateSummary, messages:[{role, content}]}` (resume / first paint + chat rehydration).
- **Demo API (internal only — consumed by the sandbox, never public):** `GET /internal/demos/{slug}` → `{tsx, parts}` (404 if unknown).
- **Demo generation:** when a turn's content benefits from a demo, the graph mints an unguessable 128-bit slug, stores the TSX in `demos`, and records `{slug, parts}` in the session state. Demos stay optional garnish; a turn with no demo is valid.
- **State summary** (returned to the BFF on every turn + read): `{stage, knowledgePoint, plan, planRevision, position, activeQuestion, demo:{slug,parts}|null, passedSteps, isComplete, closingSummary?}`.

## FE/BFF (this repo) — behavior
- **`core/llm` becomes the thin BFF→LLM HTTP client** (replaces the in-process Vercel AI SDK idea). Env: `LLM_SERVICE_URL` (default `http://localhost:8000`).
- **Turn route** `POST /api/sessions/[id]/turns` + **start route** `POST /api/sessions` forward to the LLM service and return the response (optionally re-validated against the retained Zod envelope). The existing dummy-store route is replaced.
- **Read routes** `GET /api/sessions` + `GET /api/sessions/[id]` proxy the LLM service's read APIs (History + state for first paint).
- **`core/session` (TS stage-machine reducer) is removed** — the driver now lives in the graph; its invariants are reimplemented there.
- **`core/contracts` (Zod) retained** as the FE render contract / thin guard for the LLM service's responses; kept in sync with the LLM service's Pydantic (documented as a maintenance note).
- **`core/store` + `db/schema.ts`** drop `sessions`/`session_messages`/`raw_messages`; the BFF keeps only `users` (one static seeded learner) + its drizzle config for that.
- **FE render (v1, non-streaming):** plain request/response — one structured reply per learner action (no `ai`/`useChat` dependency required). Chat rehydrates from the read API's `messages`; the document pane + progress markdown (`core/markdown`, FE/SSR) render from `stateSummary`; the demo iframe renders when `stateSummary.demo` is set, `src={NEXT_PUBLIC_SANDBOX_ORIGIN}/demos/{slug}`. Token streaming is a later enhancement.
- **Cleanup:** remove `esbuild` from BFF deps + `serverExternalPackages`; `LLM_BASE_URL/API_KEY/MODEL` leave the BFF `.env` (now the LLM service's).

## Sandbox (`learn-anything-sandbox`) — behavior
- **`core/store.ts getDemoBySlug(slug)`** calls the LLM service internal API (`GET /internal/demos/{slug}` → `{tsx, parts}`); 404 when unknown.
- **Bundle route** `GET /demos/{slug}/bundle.js`: fetch TSX by slug → `esbuild` (format esm, `react`/`react/jsx-runtime` external, React-only resolve allowlist) → return the ESM bundle (in-memory cache). esbuild stays a sandbox dependency.
- **Page route** `GET /demos/{slug}`: server-rendered document we own byte-for-byte (import map → `harness.js`; `window.DEMO={slug,parts,appOrigin}`), `Cache-Control: immutable`, and **403 unless `Sec-Fetch-Dest: iframe`**.
- **Harness/vendor build** (`scripts/build-sandbox.mjs`) unchanged.
- **Env:** add `LLM_SERVICE_URL` (internal); keep its own origin (`:3001`).

## Env & deployment (dev-oriented)
- **Postgres:** one podman instance (`:5434`) with two databases: `learn_anything` (BFF `users`) and `learn_anything_llm` (LLM service). `scripts/setup-db.sh` extended to create the LLM database.
- **Processes:** `next dev` (BFF :3000) · `next dev -p 3001` (sandbox) · `uvicorn` (LLM :8000). A dev runbook section documents bring-up order.
- **Env moves:** BFF gains `LLM_SERVICE_URL`; sandbox gains `LLM_SERVICE_URL`; LLM service gains `LLM_BASE_URL/LLM_API_KEY/LLM_MODEL` + `DATABASE_URL`; BFF drops the `LLM_*` model vars.
- Production containerization is deferred (consistent with the current "the app is never containerized" stance); noted as a follow-up.

## Decision record
This document is the single architecture source of record. The prior design docs (`docs/architecture.md`, `docs/schema.md`, `docs/demos.md`, `docs/user-stories.md`, `CONTEXT.md`) and the `docs/adr/` set have been **removed**; decisions that still apply are folded in here, and superseded ones are called out inline:
- **Superseded:** app-owned deterministic stage machine (ex-ADR 0003) → the LangGraph graph in the LLM service drives the session; session state as the app's LLM-turn log (ex-ADR 0004) → the LLM service's Postgres checkpointer; "the app's DB is the source of truth" (ex-ADR 0001) → the LLM service's state store is.
- **Amended:** demos compile at write time in the BE (ex-ADR 0007) → the sandbox compiles at serve time, sourcing TSX from the LLM service's internal API.

## Testing & verification
- **LLM service:** a fake-LLM (LangGraph-injected stub) integration test walks a full session offline — intake → probing → review(approve) → executing → complete — asserting every invariant (probe cap, re-test differs, ≤20 steps, approval gate, completion) plus the `stateSummary`/`response` shapes.
- **Sandbox:** test the internal-fetch → esbuild path (mock the LLM service; assert the react-only allowlist rejects a non-React import; assert the page 403s without `Sec-Fetch-Dest: iframe`).
- **BFF:** thin-client test with a mocked LLM service (start + turn + read routes return the pass-through shape; the Zod guard rejects a malformed response).
- **Contract cross-check (optional):** a script asserting the Pydantic (LLM) and Zod (BFF) envelope shapes agree field-for-field.
- **End-to-end (manual):** bring up db + all three services; start a session, answer a probe, approve, drill to completion with a demo; confirm the iframe renders cross-origin, auto-heights, and posts errors non-blockingly.

## Assumptions & defaults (chosen, low-risk, reversible)
- LLM service = FastAPI + Uvicorn on :8000; Python 3.12; `langchain-openai` for the OpenAI-compatible call; `langgraph-checkpoint-postgres` for state.
- One podman Postgres instance, two databases (`learn_anything`, `learn_anything_llm`).
- The BFF keeps `users` (identity) in its own Postgres; the LLM service owns `sessions` + checkpoint + `demos`.
- The graph is a **structured** agentic graph (nodes = stages, conditional edges = transitions), not an unbounded tool-loop — this is what keeps the product invariants enforceable.
- BFF retains a Zod schema for the turn-response envelope it serves to the FE; the LLM service's Pydantic models are authoritative and the two are kept in sync.
- LearningMaterial TSX is stored in the LLM service's `demos` table; the checkpoint holds only the slug + parts reference.
- v1 turns are non-streaming (one structured response per action); token streaming is a later enhancement.
- Dev-only deployment (local processes + podman db); production containerization deferred.
- Per-stage prompt engineering ships as a functional first cut (correct contracts/flow), not tuned.
- Existing deferrals carry over: demo generation-time failure policy (retry/degrade), full sandbox error UX, AI failure modes (timeouts/malformed output) — the seam is contract validation + bounded retry in the graph.

## Out of scope (deferred)
- Real auth (email+password, reset); concurrent writes to one session; session delete/abandon; duplicate knowledge points.
- Production containerization / host choice.
- Demo failure/retry UX beyond the banner.
