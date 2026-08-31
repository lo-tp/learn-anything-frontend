# Architecture — Learn Anything

Status: design phase. Depth is components, process boundaries, and data flow — the schema lives in [Schema](schema.md); API routes remain an implementation-time decision.

Terminology per [`CONTEXT.md`](../CONTEXT.md).

## Principles

1. **The LLM-turn log is the source of truth.** Session state is the append-only log of LLM turns — one row per learner action — and everything else (stage, plan + revision, position, the progress markdown, the live view) is folded or rendered from it (ADR 0001, ADR 0004).
2. **Quizzes are generated at execution time**, not plan time (ADR 0002).
3. **The stage machine is deterministic.** The LLM generates content inside fixed contracts; it does not drive the flow (ADR 0003).
4. **One LLM call per learner turn, and never a system call.** No call exists without learner input — so a turn that crosses a stage boundary bundles its outputs (boundary + plan v1; final confirm + closing summary).

## Components

One Next.js (TypeScript) monolith. One container. One Postgres. No workers, queues, caches, or websockets — every learner action is a single HTTP turn.

| Component | Responsibility | Purity |
|---|---|---|
| `app/` (Next.js routes) | Home, per-session view, the turn action(s), progress-markdown download. Thin: parse the action, wire the layers, render. | — |
| `core/session` | The stage machine: the reducer (log → stage, plan + revision, position, progress), transitions, invariants. | Pure — no I/O |
| `core/contracts` | Per-stage Zod schemas — the LLM's contracts: intake verdict, probing question, plan, step question, explanation, re-test, closing summary. The same schemas validate the log's `response` payloads. | Pure |
| `core/llm` | Thin Vercel AI SDK client, configured by env; the swap point for a fake LLM in tests. | I/O seam |
| `core/store` | Postgres access: the seeded Learner (incl. current-Learner resolution), the sessions row, the LLM-turn log, and the `raw_messages` UI projection. Every row reachable via `sessions.user_id`. | I/O seam |
| `core/markdown` | Stored state → progress markdown. | Pure — output never read back |

## Stages and invariants

A session moves **intake → probing → planning → review → executing → complete**. Transitions are code. The LLM signals judgments ("is the target specific enough?", "is the boundary established?") as declared fields of its structured output; the code acts on them.

Invariants enforced in `core/session`, never trusted to the model:

- Exactly one active question at a time
- A re-test question differs from the just-failed question
- Probing ends when the AI judges the boundary established, hard cap 10 questions
- Plans are concepts only, ≤ 20 steps unless the learner explicitly overrides
- Execution cannot start before explicit approval
- A session is complete only when every learning step has passed

## The turn

One learner action, end to end:

1. The route handler receives the action — free text (intake or plan adjustment), an MC/TF answer, or an approval.
2. `core/session` folds the log to the current stage and validates the action against it.
3. The prompt is **reconstructed**: the system contract for the stage + the serialized transcript of all prior log rows + the learner's new input. The call is one structured generation against the stage's Zod contract.
4. The `(request, response)` pair is appended to the log via `core/store`, and the `raw_messages` projection is updated in the same turn. There are no pointers to advance — the next fold over the log *is* the new state.
5. The view and the progress markdown re-render from the fold.

Because calls never happen without learner input, a turn that crosses a stage boundary bundles its outputs into the single response: boundary + plan v1, explanation + re-test question, final confirm + closing summary.

## Persistence rules

- **The log is the only truth.** `session_messages` is append-only: one row per LLM turn (learner input + structured reply). A resumed session never changes what already happened — resume is a fold, and "Plan v3" is simply the ordinal of plan responses.
- **Everything else is a projection.** Stage, plan + revision, position, and progress are folded by the reducer; the progress markdown renders from the fold (ADR 0001); `raw_messages` caches the SDK's `UIMessage[]` for chat rehydration — an interim, rebuildable, droppable projection (ADR 0004).
- The one mutable column: `sessions.knowledge_point` — the short home label, updated on re-scope; the canonical copy lives in the log.
- Every row is reachable via `sessions.user_id`, so per-account privacy is structural — even though the MVP runs one static learner.

## Identity (MVP)

- One static learner, seeded by [`db/seed.sql`](../db/seed.sql).
- Current-Learner resolution lives in the db layer (`core/store`): in the MVP it returns the seeded row for every request; post-MVP it becomes a session-cookie → real-learner lookup. No separate identity module.
- Real auth (email + password, reset) is post-MVP.

## LLM access

- Vercel AI SDK; one OpenAI-compatible client configured by env — **hot-swappable by configuration, not code**:

  ```
  LLM_BASE_URL   http://localhost:11434/v1 (local Ollama) | https://api.deepseek.com/v1 (online)
  LLM_API_KEY    anything for Ollama; the real key online
  LLM_MODEL      a local llama model id | a DeepSeek model id
  ```

- All model output is a structured object validated against a `core/contracts` Zod schema.
- `core/llm` sits behind a small interface so the full loop is testable with a fake LLM: no API keys, deterministic.
- The local model must support structured output. Local is the flow-testing box; DeepSeek is the quality bar.

## Deployment

- One Docker container (the Next.js app) + one Postgres instance.
- The concrete host (VPS / PaaS) is decided at deploy time; nothing in this design depends on the choice.

## Testing seams

- `core/session` and `core/markdown` are pure → unit-tested without I/O.
- The `core/llm` interface takes a fake → an integration test can walk a whole session, probing → planning → review → executing → complete, fully offline.

## Deferred (explicitly out of scope for this design)

- Migrations beyond [`db/schema.sql`](../db/schema.sql), API routes
- Real auth, password reset, email
- AI failure modes (timeouts, provider errors, malformed output) — deferred per user stories; the seam for them is contract validation + a bounded retry at the call site
- Deleting/abandoning sessions, concurrent writes to one session, duplicate knowledge points
