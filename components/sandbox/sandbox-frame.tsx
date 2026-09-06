/**
 * The sandbox iframe — where a Demo executes (ADR 0007, CONTEXT.md).
 *
 * `sandbox="allow-scripts"` with no `allow-same-origin` gives the frame an
 * opaque origin: no shared cookies, storage, or parent DOM. Presentational —
 * no state, no handlers; the browser loads the `src` on its own.
 */
export function SandboxFrame({
  src = "http://localhost:3001/sandbox/sample",
}: {
  src?: string;
}) {
  return (
    <iframe
      src={src}
      title="Sandbox"
      sandbox="allow-scripts"
      className="h-full w-full rounded-xl border border-outline-variant bg-background"
    />
  );
}
