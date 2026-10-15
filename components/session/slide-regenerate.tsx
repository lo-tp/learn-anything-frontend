"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * The one-slide regeneration control (#213) — the reader's "ask for this slide
 * back", pressed into the top-right corner of the slide area the slide is shown
 * in. Where it sits is the deck view's business (`views/session.tsx` overlays
 * it on the player); this leaf owns only what the control *is*, in its two
 * states:
 *
 * | state            | what it is                                  |
 * |------------------|---------------------------------------------|
 * | idle             | an icon button that asks the view for the sheet (#213 never regenerates on the click itself) |
 * | a slide rewrite  | a `role="status"` spinner that cannot be pressed, and names what is happening on hover |
 *
 * **A rewrite is not a disabled button.** A disabled `<button>` is the obvious
 * rendering and the wrong one: browsers suppress pointer events on disabled form
 * controls, so the one state that most needs its explanation would be the one
 * state that never shows it. The in-flight control is the same
 * `role="status"` + `title` treatment the phase stamp already wears
 * (`components/phase-indicator.tsx`): the spinner *is* the message, and its
 * `aria-label` carries the same sentence for a screen reader.
 *
 * **It refuses a second request by having no control to press**, which is the
 * backend's own rule made visible: `POST …/regenerate` answers 409 for a slide
 * already marked, so offering the press again would only earn a refusal.
 *
 * The box is the sheet's compact control language — a 3px-cut square, a 1px
 * rule, `--surface-container-lowest` fill — because it rests on the slide, and
 * a control that floats over content has to be opaque where it lands.
 */
const CONTROL_BOX =
  "flex size-8 items-center justify-center rounded-[3px] border border-outline-variant bg-surface-container-lowest text-on-surface-variant shadow-[var(--shadow-sheet)]";

export function SlideRegenerateControl({
  regenerating,
  onRequest,
}: {
  /** True while *this* slide is being rewritten — the deck read's flag, or the
   *  view's own optimistic mark for a request it just sent. */
  regenerating: boolean;
  /** Ask the view to open the regeneration sheet for this slide. */
  onRequest: () => void;
}) {
  const t = useTranslations("session");

  if (regenerating) {
    return (
      <span
        role="status"
        aria-label={t("regenerate.inProgress.label")}
        title={t("regenerate.inProgress.hint")}
        className={cn(CONTROL_BOX, "text-primary")}
      >
        <Loader2 className="size-4 animate-spin" aria-hidden />
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-label={t("regenerate.label")}
      title={t("regenerate.hint")}
      onClick={onRequest}
      className={cn(
        CONTROL_BOX,
        "focus-ring cursor-pointer transition-colors hover:bg-accent hover:text-on-surface",
      )}
    >
      <RefreshCw className="size-4" aria-hidden />
    </button>
  );
}
