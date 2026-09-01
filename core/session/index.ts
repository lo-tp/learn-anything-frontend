/**
 * `core/session` — the stage machine (pure, no I/O).
 *
 * Owns the reducer that folds the LLM-turn log into session state
 * (stage, plan + revision, position, progress), the stage transitions,
 * and the invariants from `docs/architecture.md` (one active question,
 * re-test differs from the just-failed question, probing cap, plan size
 * bound, explicit approval before execution, completion).
 *
 * Empty by design — the scaffold ticket (#13) only creates the layer.
 */
export {};
