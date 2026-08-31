# Session state is the LLM-turn log; everything else is a projection

A session's state is not stored as normalized columns. It is the append-only `session_messages` log — one row per LLM turn, where `request` is the learner's input and `response` is the LLM's structured reply. Stage, plan + revision, position, progress, and the resume state are all folded out of the log; the live view, the progress markdown (ADR 0001), and any other representation render from the same fold.

**Why:** every learner action in every stage triggers exactly one LLM call, so the turn log is a complete history by construction, and "resume on any device" (US-R1) reduces to: fold. A normalized schema (plan revisions, steps, questions, answers as tables) expresses the same history relationally, but the log is simpler, has a single source of truth, and makes the markdown — which is already a rendering of the history — a first-class projection.

**Considered options:** the normalized multi-table schema (rejected: a second mutable surface, pointer bookkeeping, and cyclic FKs, for the same information); making the SDK's `UIMessage[]` the stored truth (rejected: a third-party view-layer type would become the domain's source of truth).

**Consequences:**

- The prompt for any turn is `system contract(stage) + transcript of prior rows + new input` — reproducible from the log alone. No system-initiated calls exist, so stage-crossing turns bundle their outputs (boundary + plan v1; final confirm + summary).
- Invariants the database used to backstop (one answer per question, unique revision numbers) move fully to the write side, where ADR 0003 already puts the rest.
- `raw_messages` — a persisted `UIMessage[]` cache for chat rehydration — is a sanctioned interim projection: rebuildable from the log, dual-written per turn, removable (`DROP TABLE`) once rehydration is proven to work without it.
