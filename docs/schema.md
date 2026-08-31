# Schema — Learn Anything

Canonical DDL: [`db/schema.sql`](../db/schema.sql) (run it, then [`db/seed.sql`](../db/seed.sql)). This doc records why each table has the shape it does and which invariants the database enforces versus the stage machine. Terminology per [`CONTEXT.md`](../CONTEXT.md).

## Model

A session's state **is the LLM-turn log**: `session_messages`. Stage, current plan + revision, position, and progress are all folded out of the log by the reducer (`core/session`) — none of them are stored as columns. Every learner action in every stage triggers exactly one LLM call, so nothing in a session ever happens outside a log row; resume is a fold (US-R1).

| Table | Role | Mutability |
|---|---|---|
| `users` | Learner accounts (one seeded stand-in for MVP; real auth lands post-MVP) | rows added, never mutated |
| `sessions` | Identity: which learner, plus the short knowledge-point label shown on home | `knowledge_point` updated on re-scope; nothing else changes |
| `session_messages` | **The log — the source of truth.** One row per LLM turn: learner input + structured reply | append-only |
| `raw_messages` | Interim UI cache: the SDK's `UIMessage[]` for chat rehydration | replaced per turn; rebuildable, droppable |

## The turn

`request` holds **only the learner's input** — their typed text, or a canonical action token (`ANSWER:<n>`, `APPROVE`) for clicks; `response` is the LLM's structured reply, a typed union validated by the Zod schemas that double as the LLM contracts (`core/contracts`).

| Learner input (`request`) | LLM reply (`response.type`) | Row `type` |
|---|---|---|
| intake / refinement text | `narrow` \| `accept_target` (+ knowledge-point summary) | `intake` |
| probing answer | `question` (probe) \| **`boundary` + plan v1** | `probing` |
| review adjustment | `plan` (new revision) | `review` |
| `APPROVE` | `question` (step 1) | `review` |
| executing answer | `confirm` + next `question` \| `explanation` + `question` (retest) \| final: `confirm` + `summary` | `executing` |

`type` is the stage the session was in **when the request was made** — a filter and sectioning aid (it is what makes the progress markdown's per-stage sections a group-by). Under the flow above, `planning` and `complete` never occur as row types: plan v1 arrives inside a `probing` row, and nothing is input after completion. The current stage is always the fold, never a stored value.

## Prompt reconstruction

`prompt(turn) = system contract(stage) + serialized transcript of all prior (request, response) rows + the new request`. Nothing else is stored; any LLM call is reproducible from the log alone.

The input-only rule has a corollary: **no system-initiated calls exist** — a call with no learner input has no honest `request`. So the boundary response bundles plan v1, and the final confirmation bundles the closing summary. One LLM call per learner turn, never a system turn.

## `raw_messages` — the interim UI projection

Stores the `@ai-sdk` `UIMessage[]` (one row per session, whole array, replaced per turn) so a new device can rehydrate the chat view. Status, recorded per ADR 0004:

1. **Rebuildable projection** of `session_messages`, produced by the view-layer serializer (the same one that seeds `useChat`). If it ever disagrees with the log, the log wins and the row is rebuilt from scratch.
2. **It stores a third-party view-layer type** — an AI SDK upgrade touches this table only, never `session_messages`.
3. **Deliberate interim** — removal path: stop the dual-write, verify resume works off the reducer + view model alone, `DROP TABLE`.
4. **Dual-written on each turn**; safe to drop and re-seed at any time.

## Who enforces what

**The database:**

- the `type` value domain (the six stages); non-null `request`/`response`
- one `raw_messages` row per session; referential integrity; cascade — deleting a learner takes their sessions and full history

**`core/session` (ADR 0003 — the code owns the flow):**

- exactly one active question
- a re-test question differs from the just-failed question
- probing ≤ 10 questions
- plans are concepts-only, ≤ 20 steps (US-N1) — validated against the LLM contract before the row is written
- stage transitions are forward-only: intake → probing → planning → review → executing → complete
- no execution before approval; completion only when every step of the approved plan has a correct answer
- action durability: a learner action becomes durable when its turn's row is written; a crash mid-turn loses the action and the learner repeats it (AI failure modes are deferred)

**The view layer:**

- serializes reduced state → `UIMessage[]` — the only place SDK types appear

## Story → schema

| Story | Served by |
|---|---|
| US-A4 privacy | `sessions.user_id`; UUID ids are unguessable |
| US-R1 resume | fold the log: stage, plan + revision, position, full Q&A history; identical markdown on every device |
| US-E5 markdown | a pure read over the log, grouped by row `type`, never written back (ADR 0001) |
| US-P2 probing cap | `question` (probe) responses |
| US-E3/AC1, US-E2/AC1 re-test & explanation | `explanation` + next `question` (retest) response |
| US-N6 regeneration | a new `plan` response; revision number = ordinal of plan responses |
| US-C2 closing summary | the final `confirm` + `summary` response |
| UI chat rehydration | `raw_messages` (interim) |

## What is not in the schema

- No stage column on `sessions` (it is the fold); the only mutable value besides log appends is `sessions.knowledge_point` (home label; canonical copy in the log)
- No `deleted_at` (deletion is deferred); no password columns until real auth
- No counters — steps passed, re-test counts, probing length are all derivable from the log
