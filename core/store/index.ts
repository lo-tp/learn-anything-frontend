/**
 * `core/store` — Postgres access (I/O seam).
 *
 * The seeded Learner (incl. current-Learner resolution), the sessions
 * row, the append-only LLM-turn log, and the `raw_messages` UI
 * projection. Every row reachable via `sessions.user_id`.
 *
 * Empty by design — the scaffold ticket (#13) only creates the layer.
 */
export {};
