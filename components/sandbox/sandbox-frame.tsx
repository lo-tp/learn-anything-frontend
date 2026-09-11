import { cn } from "@/lib/utils";

/**
 * The sandbox iframe — where a Demo executes (ADR 0007, CONTEXT.md).
 *
 * `allow-same-origin` keeps the frame's own origin (e.g. http://localhost:3001)
 * rather than an opaque one. Presentational —
 * no state, no handlers; the browser loads the `src` on its own.
 *
 * With `mini` the frame becomes a decorative preview (the session sidebar's
 * scaled-down cards, #47): untitled, a11y-hidden, unfocusable, and
 * lazy-loaded. `className` is merged after the base sizing, so callers can
 * override the geometry (e.g. an absolute, scaled preview).
 */
export function SandboxFrame({
  src = `${process.env.NEXT_PUBLIC_SANDBOX_ORIGIN}/sandbox/sample_1`,
  mini = false,
  className,
}: {
  src?: string;
  mini?: boolean;
  className?: string;
}) {
  return (
    <iframe
      src={src}
      title={mini ? undefined : "Sandbox"}
      aria-hidden={mini || undefined}
      tabIndex={mini ? -1 : undefined}
      loading={mini ? "lazy" : undefined}
      sandbox="allow-scripts allow-same-origin"
      className={cn("h-full w-full rounded-xl bg-background", className)}
    />
  );
}
