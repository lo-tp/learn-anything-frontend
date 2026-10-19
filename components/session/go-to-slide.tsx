"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { padPage } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * The go-to-slide dialog (#229) — the ask behind the footer's counter chip.
 * One deck read, one reader position, one answer: which page to land on.
 *
 * **Two roads to the same landing.** The page grid is the browse road —
 * every page of the deck, zero-padded in the counter's own mono voice, one
 * press away; the number box is the type road, for a deck long enough that
 * its grid would be a scroll. Both roads end the same way: `onGoTo` is
 * handed the 1-based page and the dialog closes itself — the view only sets
 * the deck's position, so the ask and the answer cannot drift apart.
 *
 * **The typed page is clamped, not refused.** `0` lands on the first page,
 * past the end lands on the last one: the deck's own stepping clamps at both
 * ends, and a jump that silently walked the wrong way is a worse answer than
 * one that walked to the end. The one thing clamping cannot fix — a box that
 * holds no whole page, empty or fractional — is said in the dialog, in the
 * `role="alert"` line the other asks use, and it stays until the reader types
 * again.
 *
 * **The form does not validate for us.** `noValidate`: the browser's own range
 * tooltip would answer for a page number this deck does not have, in the
 * browser's voice rather than the dialog's. The `min`/`max`/`step` attributes
 * still shape the spinner's walks.
 *
 * **The view mounts it per ask.** A fresh open is a fresh mount (the view
 * renders it only while it is open, as it does the regeneration sheet), so
 * the box starts on the page the reader is on by construction — a stale
 * draft from the last open can never be the answer this one starts with,
 * because there is no last open to be stale from.
 *
 * **It is the app's own dialog, not a new surface.** Same paper fill, ring
 * and header structure as the regeneration sheet and the sign-in modal
 * (`components/ui/dialog.tsx` is that shape): a centred card at the dialog's
 * own cut, not a second small-form invention.
 */
export function GoToSlideDialog({
  open,
  onOpenChange,
  index,
  total,
  onGoTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The page the reader is on, 1-based. */
  index: number;
  /** The deck's page count. */
  total: number;
  /** The landing, 1-based. The view clamps it against the deck. */
  onGoTo: (index: number) => void;
}) {
  const t = useTranslations("session");
  // The typed draft, as the reader holds it — the input is their box, and
  // the dialog does not reformat what is in it. It starts on the page the
  // reader is on: the view mounts a fresh dialog per ask, so the initializer
  // is the whole reset (see the component's note).
  const [draft, setDraft] = useState(String(index));
  // The box holds no page: said once, cleared by the next stroke.
  const [noPage, setNoPage] = useState(false);

  const go = (event: React.FormEvent) => {
    event.preventDefault();
    // The box must hold a whole page. The emptiness check precedes the parse:
    // `Number("")` is 0, and 0 is an integer the clamp would quietly walk to
    // page 1 — a refusal the reader never got.
    const raw = draft.trim();
    const page = raw === "" ? NaN : Number(raw);
    if (!Number.isInteger(page)) {
      setNoPage(true);
      return;
    }
    setNoPage(false);
    onGoTo(Math.min(total, Math.max(1, page)));
    onOpenChange(false);
  };

  const goFromGrid = (page: number) => {
    onGoTo(page);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("jump.title")}</DialogTitle>
          <DialogDescription>{t("jump.note")}</DialogDescription>
        </DialogHeader>

        {/* noValidate: the clamp and the refusal are the dialog's, not the
            browser's — see the component's note. */}
        <form noValidate onSubmit={go} className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="go-to-slide-page"
              className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface"
            >
              {t("jump.label")}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="go-to-slide-page"
                type="number"
                inputMode="numeric"
                min={1}
                max={total}
                step={1}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setNoPage(false);
                }}
                className="w-20 rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-1.5 font-mono text-sm text-on-surface outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25"
              />
              <Button type="submit">{t("jump.go")}</Button>
            </div>
            {noPage && (
              <p className="text-sm text-error" role="alert">
                {t("jump.invalid", { total: String(total) })}
              </p>
            )}
          </div>

          {/* The page grid: one button per page, in the counter's own voice.
              The grid scrolls — a long deck is a long list, and the box
              above is the road that does not scroll. */}
          <div className="max-h-64 overflow-y-auto rounded-md">
            <div className="grid grid-cols-6 gap-1.5">
              {Array.from({ length: total }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => goFromGrid(page)}
                  aria-label={t("jump.page", { n: String(page) })}
                  aria-current={page === index ? "true" : undefined}
                  className={cn(
                    "focus-ring rounded-[3px] border px-1 py-1.5 font-mono text-xs transition-colors",
                    page === index
                      ? "border-primary bg-primary text-primary-foreground font-bold"
                      : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-accent hover:text-on-surface",
                  )}
                >
                  {padPage(page)}
                </button>
              ))}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
