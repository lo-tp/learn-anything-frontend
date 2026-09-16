"use client";

import { ChevronLeft, ChevronRight, Presentation } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Bottom-right control bar (map #43).
 *
 * Presentational — a slide-counter pill ("index / total") and prev/next
 * buttons that call the provided handlers.
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
  return (
    <div className="flex items-center gap-4">
      {/* Slide counter pill */}
      <div
        className="flex items-center gap-1.5 rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 py-1.5 font-mono text-xs text-on-surface-variant"
        aria-label={t("slideOf", { n: String(index), total: String(total) })}
      >
        <Presentation className="size-4 text-primary" />
        <span className="font-semibold text-on-surface">{index}</span>
        <span>/</span>
        <span>{total}</span>
      </div>

      {/* Prev / next navigation */}
      <div className="flex items-center gap-1 rounded-lg border border-outline-variant/50 bg-surface-container-low p-1">
        <button
          type="button"
          aria-label={t("prevSlide")}
          disabled={index <= 1}
          onClick={onPrev}
          className="flex size-7 items-center justify-center rounded text-on-surface-variant disabled:opacity-40"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          aria-label={t("nextSlide")}
          disabled={index >= total}
          onClick={onNext}
          className="flex size-7 items-center justify-center rounded text-on-surface-variant disabled:opacity-40"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
