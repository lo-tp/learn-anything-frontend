import { cn } from "@/lib/utils";

/**
 * The answer bubble — the sole progress device of this world. A bubble is
 * only ever one of three things: empty (not reached), filled (done), or
 * current (being worked, with a breathing ink dot). Filled bubbles ink in
 * with the bubble-fill motion.
 */
export function Bubble({
  state,
  className,
}: {
  state: "empty" | "filled" | "current";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-3.5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors",
        state === "empty" && "border-outline-variant",
        state === "filled" && "animate-bubble-fill border-primary bg-primary",
        state === "current" && "border-primary",
        className,
      )}
    >
      {state === "current" ? (
        <span className="animate-dot-breathe block size-1.5 rounded-full bg-primary" />
      ) : null}
    </span>
  );
}
