import type { ReactEventHandler, Ref } from "react";
import { cn } from "@/lib/utils";

/**
 * The sandbox iframe — where a Demo executes (ADR 0007, CONTEXT.md).
 *
 * `allow-same-origin` keeps the frame's own origin (e.g. http://localhost:3001)
 * rather than an opaque one. Presentational — the browser loads the `src` on
 * its own. `ref`/`onLoad` are optional hooks for the main slide player, which
 * must post the active slide id in without ever changing `src` (#80: a
 * per-slide `src` navigation appends a top-level history entry that swallows
 * the browser Back button).
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
  ref,
  onLoad,
}: {
  src?: string;
  mini?: boolean;
  className?: string;
  ref?: Ref<HTMLIFrameElement>;
  onLoad?: ReactEventHandler<HTMLIFrameElement>;
}) {
  return (
    <iframe
      ref={ref}
      src={src}
      title={mini ? undefined : "Sandbox"}
      aria-hidden={mini || undefined}
      tabIndex={mini ? -1 : undefined}
      loading={mini ? "lazy" : undefined}
      sandbox="allow-scripts allow-same-origin"
      onLoad={onLoad}
      className={cn("h-full w-full rounded-xl bg-background", className)}
    />
  );
}
