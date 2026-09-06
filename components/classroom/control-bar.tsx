import { ChevronLeft, ChevronRight, Presentation } from "lucide-react";

/**
 * Bottom-right control bar for `/classroom` (map #43).
 *
 * Pure and presentational — a slide-counter pill ("index / total") and
 * prev/next buttons rendered as static visuals. No props beyond the counter
 * values and no event handlers (the prev/next buttons intentionally do
 * nothing until navigation lands on a later ticket).
 */
export function ControlBar({ index, total }: { index: number; total: number }) {
  return (
    <div className="flex items-center gap-4">
      {/* Slide counter pill */}
      <div
        className="flex items-center gap-1.5 rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 py-1.5 font-mono text-xs text-on-surface-variant"
        aria-label={`Slide ${index} of ${total}`}
      >
        <Presentation className="size-4 text-primary" />
        <span className="font-semibold text-on-surface">{index}</span>
        <span>/</span>
        <span>{total}</span>
      </div>

      {/* Prev / next — static visuals, no handlers */}
      <div className="flex items-center gap-1 rounded-lg border border-outline-variant/50 bg-surface-container-low p-1">
        <button
          type="button"
          aria-label="Previous slide"
          className="flex size-7 items-center justify-center rounded text-on-surface-variant"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Next slide"
          className="flex size-7 items-center justify-center rounded text-on-surface-variant"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
