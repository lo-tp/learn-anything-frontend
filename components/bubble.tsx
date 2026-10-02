import { cn } from "@/lib/utils";

/**
 * The answer bubble — the sole progress device of this world. A bubble is
 * only ever one of four things: empty (not reached), filled (done, printed
 * in ink), current (being worked, an engagement-blue ring with a breathing
 * blue dot), or active (the place you are standing, printed in blue).
 * Filled bubbles ink in with the bubble-fill motion.
 */
export function Bubble({
  state,
  className,
}: {
  state: "empty" | "filled" | "current" | "active";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-3.5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors",
        state === "empty" && "border-outline-variant",
        state === "filled" && "animate-bubble-fill border-primary bg-primary",
        state === "current" && "border-engage",
        state === "active" && "border-engage bg-engage",
        className,
      )}
    >
      {state === "current" ? (
        <span className="animate-dot-breathe block size-1.5 rounded-full bg-engage" />
      ) : null}
    </span>
  );
}
