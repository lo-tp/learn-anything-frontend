"use client";

import * as React from "react";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * Tooltips — a clipped line printed in full.
 *
 * A `truncate` line is the only case where the app knows it is showing less
 * than it has: a session goal in a deck header band, a step summary in the
 * item rail. The full text stays in the DOM (screen readers read all of it);
 * the tooltip is what makes it visible to the reader who is looking at the
 * clipped line, and it is the ellipsis that says the rest is there to find.
 *
 * **It is only raised for a line that is actually clipping** (`isClipped`
 * below): a tooltip that repeats text the surface already showed is noise,
 * not an annotation.
 *
 * **The tooltip is a printed slip, not browser chrome**: paper-white fill, a
 * 1px rule, 3px corners (the same cut stamps and chips wear), and the sheet's
 * contact shadow — `--shadow-sheet`, a rule line plus a tight drop. Depth is
 * paper resting on the surface it annotates; no glow, no glass, no arrow. It
 * carries no type voice of its own — the surface supplies it, because a
 * tooltip must be set in the voice of the line it completes.
 *
 * The trigger is the clipped line itself (`asChild`): the affordance adds no
 * element and no control to the line's layout, so the surface reads exactly as
 * it did until the pointer rests on the line.
 *
 * **The tooltip is up exactly while the pointer rests on the clipped line.**
 * Radix's default lets a pointer travel from the trigger into the content and
 * keeps it open while a grace-area polygon tracks `pointermove` on *our*
 * document. That tracking is the weak link here: every slip in this app hangs
 * over the deck's slide, which is a cross-origin *iframe*, and a pointer inside
 * a frame dispatches to the frame's document, never ours — so nothing ever
 * closes the slip and it stays stuck over the learner's work. So the content is
 * not hoverable (`disableHoverableContent`): dismissal is the trigger's own
 * `pointerleave`, an event the parent document always receives. The content
 * takes no pointer events at all, so a slip never swallows a click meant for
 * the surface under it.
 *
 * `Root` requires a `Provider`, so `Tooltip` mounts its own — a leaf cannot be
 * rendered without one, and a surface cannot forget to supply it. One provider
 * per tooltip does mean Radix's `skipDelayDuration` (which would make the
 * second of two lines open instantly) is not shared between a surface's lines:
 * every line waits the full hover-intent delay. At 150ms that is not a cost
 * worth the alternative — a provider mounted in shared chrome that every
 * tooltip user then depends on and can silently forget.
 *
 * The delay is 150ms, not Radix's 700ms: a slip answers a line the reader has
 * stopped on, and 700ms reads as nothing happening.
 */

/** The hover-intent delay the app's tooltips wait for. */
const HOVER_INTENT_MS = 150;

/**
 * Is this line hiding text? A `truncate` line clips exactly when its content
 * is wider than the box it was given — and the clipped glyphs are still in the
 * DOM, so the widths are the only way to know. Measured when a tooltip is
 * asked for, not at render time: whether a line clips depends on the width the
 * surface happens to have at that moment.
 */
function isClipped(el: HTMLElement | null): boolean {
  return el !== null && el.scrollWidth > el.offsetWidth + 1;
}

/**
 * Which element a tooltip's clipped line turned out to be. `TooltipTrigger`
 * publishes it (Radix's `Slot` composes refs onto the element `asChild`
 * replaces) so `Tooltip` can ask it whether it is clipping.
 */
const TriggerAnnouncer = React.createContext<
  ((el: HTMLElement | null) => void) | undefined
>(undefined);

function TooltipProvider({
  delayDuration = HOVER_INTENT_MS,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      // See the dismissal rule in the file header.
      disableHoverableContent
      delayDuration={delayDuration}
      {...props}
    />
  );
}

function Tooltip({
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  const clippedLine = React.useRef<HTMLElement | null>(null);
  const [open, setOpen] = React.useState(false);
  const announceTrigger = React.useCallback((el: HTMLElement | null) => {
    clippedLine.current = el;
  }, []);
  /** Radix asks; this answers, and a line showing all of its text is refused. */
  const openChange = React.useCallback(
    (next: boolean) => setOpen(next && isClipped(clippedLine.current)),
    [],
  );
  return (
    <TriggerAnnouncer.Provider value={announceTrigger}>
      <TooltipProvider>
        <TooltipPrimitive.Root
          data-slot="tooltip"
          {...props}
          open={open}
          onOpenChange={openChange}
        >
          {children}
        </TooltipPrimitive.Root>
      </TooltipProvider>
    </TriggerAnnouncer.Provider>
  );
}

function TooltipTrigger({
  ref,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  const announce = React.useContext(TriggerAnnouncer);
  if (!announce) {
    throw new Error("`TooltipTrigger` must be used within `Tooltip`");
  }
  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      {...props}
      ref={(el) => {
        // The surface keeps its own handle on the line if it passed one; the
        // gate needs one too.
        announce(el);
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      }}
    />
  );
}

/**
 * The slip's content, portalled to the document: clipped lines live inside
 * panes that clip their own overflow (the `overflow-hidden` frame, the rail's
 * scroll container), so a slip cannot live where its line does.
 *
 * It sits centred under the line it annotates, and its measure is bounded
 * three ways: by that line (a slip is never wider than the thing it
 * completes), by 36rem (the widest column the press sets copy at is 65–75ch),
 * and by the space the line actually has on screen — so a long title wraps
 * into a column instead of pushing off the page.
 *
 * `side="bottom"` is the default because every line this primitive exists for
 * is at the top of its pane — a deck header band, a rail divider — where a
 * slip above it would collide with the top bar. Radix reports its open states
 * as `delayed-open`/`instant-open`, never plain `open`, so the entrance is
 * keyed off *not closed*.
 */
function TooltipContent({
  className,
  side = "bottom",
  align = "center",
  sideOffset = 8,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        side={side}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn(
          "z-50 pointer-events-none max-w-[min(var(--radix-tooltip-content-available-width),var(--radix-tooltip-trigger-width),36rem)] origin-(--radix-tooltip-content-transform-origin) rounded-[3px] border border-outline-variant bg-surface-container-lowest px-3 py-2 leading-relaxed text-on-surface shadow-[var(--shadow-sheet)] not-data-[state=closed]:animate-in not-data-[state=closed]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-100",
          className,
        )}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent };
