"use client";

import { Loader2, Send } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * The regeneration sheet (#213) — the small form behind the deck's "ask for
 * this slide back" control. One question, one textarea, and the text it holds is
 * the whole content of the request: the backend's
 * `POST /sessions/{id}/slides/{slide_id}/regenerate` takes it as `feedback` and
 * writes the slide from it (#197).
 *
 * **Asking is not doing.** The sheet submits; the view sends. `onSubmit` is
 * handed a trimmed string, or `null` when the learner left the box empty — which
 * is a real request, "write this slide again", and is stated as `null` rather
 * than as an empty string the backend would have to reinterpret. The note belongs
 * to one slide and one ask: the view mounts a sheet per slide it is open for, so
 * what was written about one slide is never sent for another.
 *
 * **It is the app's own dialog, not a new surface.** Same paper fill, ring and
 * header/footer structure as the sign-in modal and the account-name dialog
 * (`components/ui/dialog.tsx` is that shape, and those two use it unchanged): a
 * centred card at the dialog's own cut, not a second small-form invention. The
 * textarea is multi-line on purpose — an instruction like "walk it slower, and
 * show the arithmetic" is more than one line — so Enter inserts a line break and
 * the button is the way to send.
 *
 * **A refusal is shown as its reason.** A 409 can mean "the deck is generating",
 * "this slide is already being regenerated", or "this slide predates stored
 * content specs" — the last is a dead end the learner has to be told about, and
 * it is said in the sheet that asked, in the same `role="alert"` error line the
 * account dialog uses. What the view hands here is either the backend's own
 * sentence or `""`, and `""` is answered with the app's words, so the learner is
 * never left with a form that simply did nothing, and never shown an internal
 * message that is not one.
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
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t("regenerate.sheet.title")}</DialogTitle>
            <DialogDescription>{t("regenerate.sheet.note")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="slide-regeneration-feedback"
              className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface"
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
              className="w-full resize-none rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm leading-6 text-on-surface outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 disabled:opacity-60"
            />
          </div>

          {error !== null && (
            <p className="text-sm text-error" role="alert">
              {error.trim() === "" ? t("regenerate.sheet.errorFallback") : error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {t("regenerate.sheet.cancel")}
            </Button>
            <Button type="submit" disabled={pending} className="gap-2">
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Send className="size-4" aria-hidden />
              )}
              {pending
                ? t("regenerate.sheet.submitting")
                : t("regenerate.sheet.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
