"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { padPage } from "@/lib/utils";

/**
 * Bottom-right control bar (map #43), typeset as the footer of the sheet:
 * a monospace slide-counter chip (zero-padded, like a form page number) and
 * square-cut prev/next controls.
 *
 * The counter chip is the go-to affordance (#229): pressing it asks for the
 * page the reader wants, so a deck is walked in one press rather than one
 * per step. The chip's name carries both what it prints (the position) and
 * what it does, because a button that says only "01 / 45" would read as a
 * number, not a way to go somewhere.
 */
export function ControlBar({
  index,
  total,
  onPrev,
  onNext,
  onOpenJump,
}: {
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  /** Opens the go-to-slide dialog for this deck (#229). */
  onOpenJump: () => void;
}) {
  const t = useTranslations("session");
  return (
    <div className="flex items-center gap-3">
      {/* Slide counter chip — pressing it opens the go-to-slide dialog (#229). */}
      <button
        type="button"
        onClick={onOpenJump}
        className="focus-ring flex items-center gap-1.5 rounded-[3px] border border-outline-variant bg-surface-container-lowest px-3 py-1.5 font-mono text-xs text-on-surface-variant transition-colors hover:bg-accent hover:text-on-surface"
        aria-label={t("jump.chip", { n: String(index), total: String(total) })}
      >
        <span className="font-bold text-primary">{padPage(index)}</span>
        <span aria-hidden>/</span>
        <span>{padPage(total)}</span>
      </button>

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
