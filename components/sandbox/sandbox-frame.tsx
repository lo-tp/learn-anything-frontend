/**
 * The sandbox iframe — where a Demo executes (ADR 0007, CONTEXT.md).
 *
 * `allow-same-origin` keeps the frame's own origin (e.g. http://localhost:3001)
 * rather than an opaque one. Presentational —
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
      sandbox="allow-scripts allow-same-origin"
      className="h-full w-full rounded-xl border border-outline-variant bg-background"
    />
  );
}
