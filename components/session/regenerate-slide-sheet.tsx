"use client";

import { Loader2, Send } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * The regeneration sheet (#213) — the small form behind the deck's "ask for
 * this slide back" control. One question, one textarea, and the text it holds is
 * the whole content of the request: the backend's
 * `POST /sessions/{id}/slides/{slide_id}/regenerate` takes it as `feedback` and
 * writes the slide from it (#197).
 *
 * **Asking is not doing.** The sheet submits; the view sends. `onSubmit` is
 * handed a trimmed string, or `null` when the learner left the box empty — which
 * is a real request, “write this slide again”, and is stated as `null` rather
 * than as an empty string the backend would have to reinterpret. The note belongs
 * to one slide and one ask: the view mounts a sheet per slide it is open for
 * (#213), so what was typed for one slide is never sent for another.
 *
 * **It is a sheet, not the intake form.** The intake fills the viewport because
 * it carries a conversation; this one carries a single note, so it is a
 * viewport-centred card at the same square-cut 6px the app's other small
 * surfaces wear, with the label above the textarea and the actions below it.
 * The textarea is multi-line on purpose: an instruction like "walk it slower,
 * and show the arithmetic" is more than one line, so Enter inserts a line break
 * and the button is the way to send.
 *
 * **A refusal is shown as its reason.** A 409 can mean "already generating",
 * "the deck is generating", or "this slide predates stored content specs" — the
 * last two are dead ends the learner has to be told about, in the sheet that
 * asked, so the backend's own sentence is printed as a `role="alert"` line. A
 * refusal that came with no text at all gets the app's own fallback, so the
 * learner is never left with a form that simply did nothing.
 */
export function RegenerateSlideSheet({
  open,
  onOpenChange,
  onSubmit,
  pending,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The trimmed note, or `null` for a plain "write it again". */
  onSubmit: (feedback: string | null) => void;
  /** True while the request is in flight — the sheet cannot be pressed twice. */
  pending: boolean;
  /** A refusal's text, `""` when the backend gave none, `null` when nothing failed. */
  error: string | null;
}) {
  const t = useTranslations("session");
  const [feedback, setFeedback] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const text = feedback.trim();
    onSubmit(text === "" ? null : text);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="rounded-lg bg-surface p-5 text-on-surface ring-0 border border-outline-variant shadow-[var(--shadow-sheet)] sm:max-w-md"
      >
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="font-display text-base font-semibold uppercase tracking-[0.06em] text-on-surface">
              {t("regenerate.sheet.title")}
            </DialogTitle>
            <DialogDescription className="text-on-surface-variant">
              {t("regenerate.sheet.note")}
            </DialogDescription>
          </DialogHeader>

          <div>
            <label
              htmlFor="slide-regeneration-feedback"
              className="mb-2 block font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface"
            >
              {t("regenerate.sheet.label")}
            </label>
            <textarea
              id="slide-regeneration-feedback"
              name="feedback"
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder={t("regenerate.sheet.placeholder")}
              disabled={pending}
              className="w-full resize-none rounded-md border border-primary bg-surface-container-lowest p-3 text-[15px] leading-6 text-on-surface outline-none transition-colors placeholder:text-on-surface-variant focus-visible:ring-2 focus-visible:ring-primary/25 disabled:bg-surface-container-low disabled:opacity-60"
            />
          </div>

          {error !== null && (
            <p
              role="alert"
              className="font-mono text-xs font-semibold text-error"
            >
              {error.trim() === "" ? t("regenerate.sheet.errorFallback") : error}
            </p>
          )}

          <div className="flex justify-end gap-3 border-t border-outline-variant pt-4">
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => onOpenChange(false)}
              className="h-auto rounded-md border border-transparent px-4 py-2 text-on-surface-variant hover:border-outline-variant hover:bg-surface-bright hover:text-on-surface"
            >
              {t("regenerate.sheet.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={pending}
              className={cn(
                "gap-2 rounded-md bg-primary px-5 py-2.5 font-semibold text-primary-foreground shadow-[var(--shadow-sheet)] hover:-translate-y-px hover:shadow-[var(--shadow-sheet-raised)]",
              )}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Send className="size-4" aria-hidden />
              )}
              {pending
                ? t("regenerate.sheet.submitting")
                : t("regenerate.sheet.submit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
