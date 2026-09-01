/**
 * `core/llm` — thin Vercel AI SDK client (I/O seam).
 *
 * One OpenAI-compatible client configured purely by env
 * (`LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`) — hot-swappable by
 * configuration, not code. Sits behind a small interface so the full
 * loop is testable with a deterministic fake LLM.
 *
 * Empty by design — the scaffold ticket (#13) only creates the layer.
 */
export {};
