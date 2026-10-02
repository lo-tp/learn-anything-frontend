"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Bottom-right control bar (map #43), typeset as the footer of the sheet:
 * a monospace slide-counter chip (zero-padded, like a form page number) and
 * square-cut prev/next controls.
 */
export function ControlBar({
  index,
  total,
  onPrev,
  onNext,
}: {
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const t = useTranslations("session");
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div className="flex items-center gap-3">
      {/* Slide counter chip */}
      <div
        className="flex items-center gap-1.5 rounded-[3px] border border-outline-variant bg-surface-container-lowest px-3 py-1.5 font-mono text-xs text-on-surface-variant"
        aria-label={t("slideOf", { n: String(index), total: String(total) })}
      >
        <span className="font-bold text-primary">{pad(index)}</span>
        <span aria-hidden>/</span>
        <span>{pad(total)}</span>
      </div>

      {/* Prev / next navigation */}
      <div className="flex items-center gap-1 rounded-[3px] border border-outline-variant bg-surface-container-lowest p-1">
        <button
          type="button"
          aria-label={t("prevSlide")}
          disabled={index <= 1}
          onClick={onPrev}
          className="focus-ring flex size-8 items-center justify-center rounded-[3px] text-on-surface-variant transition-colors hover:bg-accent hover:text-on-surface disabled:opacity-40"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          aria-label={t("nextSlide")}
          disabled={index >= total}
          onClick={onNext}
          className="focus-ring flex size-8 items-center justify-center rounded-[3px] text-on-surface-variant transition-colors hover:bg-accent hover:text-on-surface disabled:opacity-40"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
