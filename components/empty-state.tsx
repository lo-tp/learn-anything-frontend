"use client";

import { useTranslations } from "next-intl";

/**
 * The empty History state: a blank sheet waiting for its first entry — the
 * sheet-number slot printed empty ("No. ____"), the title and body copy as
 * the printed instructions at the top of the form, ruled lines running
 * through the empty writing space, and the caller's CTA (`children`, the
 * shared ink block button) at the foot of the sheet. The record header band
 * above it is rendered by the page in this state too, so the first-time
 * visitor still reads the page as a study record.
 */
export function EmptyState({ children }: { children?: React.ReactNode }) {
  const t = useTranslations("mine");
  return (
    <div className="flex flex-col py-4">
      <div className="relative w-full overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest shadow-[var(--shadow-sheet)]">
        {/* Punch-hole margin, matching the filled sheets. */}
        <span aria-hidden className="absolute left-2.5 top-0 bottom-0 flex flex-col justify-center gap-6">
          {[0, 1, 2].map((i) => (
            <span key={i} className="block size-2 rounded-full border border-outline-variant/70 bg-surface" />
          ))}
        </span>

        {/* Sheet header strip: the empty number slot, ruled from where a
            date would sit on a filed sheet. */}
        <div className="flex items-baseline justify-between gap-4 border-b border-outline-variant/60 py-2 pr-6 pl-10">
          <span aria-hidden className="font-mono text-xs font-semibold tracking-[0.14em] text-error">
            No. ____
          </span>
        </div>

        <div className="px-6 pt-6 pb-4 pl-10 md:px-10">
          <h2 className="font-display text-2xl font-bold text-on-surface">
            {t("emptyTitle")}
          </h2>
          <p className="mt-2 max-w-md text-[15px] leading-relaxed text-on-surface-variant">
            {t("emptyBody")}
          </p>
        </div>

        {/* The blank writing area: ruled paper, waiting. */}
        <div aria-hidden className="ruled-paper mx-6 mb-6 h-28 border border-dashed border-outline-variant/60 rounded-md md:mx-10" />

        {children ? <div className="px-6 pb-8 pl-10 md:px-10">{children}</div> : null}
      </div>
    </div>
  );
}
