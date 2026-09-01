/**
 * `core/markdown` — fold state → progress markdown (pure).
 *
 * Turns the folded session state into the progress markdown rendered
 * in the document pane. Runs in the FE (SSR for first paint); the BE
 * never emits a markdown string, and the output is never read back.
 *
 * Empty by design — the scaffold ticket (#13) only creates the layer.
 */
export {};
