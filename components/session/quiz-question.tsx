"use client";

import { useMemo } from "react";
import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { MathText } from "@/components/math-text";
import { cn, optionLetter, displayOrder } from "@/lib/utils";

/** The canonical question shape the card projects. Display ordering is the
 *  card's concern: it stores the canonical `correct_index` and projects the
 *  options into a (stable) display order. */
export type QuizQuestionInput = {
  text: string;
  options: string[];
  correct_index: number;
  explanation: string;
};

/**
 * The shared quiz card (#113): the prompt, lettered option buttons, and —
 * once revealed — the reveal (correct option highlighted, a wrong selection
 * marked, and the explanation shown). It serves all three surfaces:
 * - **session detail** — select → reveal (`onSelect` + `selected`), canonical
 *   order (`shuffled` false);
 * - **probe** — select → reveal; a click is the answer (no confirm step).
 *   `shuffled` + `pinUnknown` keep the display order stable and the backend's
 *   "I don't know" option pinned last;
 * - **review** — reveal → confidence: pass `selected={null}` plus an explicit
 *   `revealed` and `shuffled`, omit `onSelect` — the options stay
 *   non-interactive and the card shows the explanation without a verdict.
 *
 * Pure leaf: the owner holds the selection (in **canonical** indices) and
 * receives clicks via `onSelect(canonicalIndex)`.
 */
export function QuizQuestion({
  question,
  selected,
  onSelect,
  revealed: revealedProp,
  shuffled = false,
  pinUnknown = false,
}: {
  question: QuizQuestionInput;
  /** The chosen option's canonical index, or null before the learner answers. */
  selected: number | null;
  /**
   * Receives option clicks with the option's **canonical** index. When absent
   * the options are non-interactive (the review surface, where Reveal is a
   * separate footer control).
   */
  onSelect?: (canonicalIndex: number) => void;
  /**
   * Reveal the answer without a selection (the review surface). Defaults to
   * `selected !== null`.
   */
  revealed?: boolean;
  /** Shuffle the option order (stable per question). */
  shuffled?: boolean;
  /** Pin the last (canonical) option to the end of the display order. */
  pinUnknown?: boolean;
}) {
  const t = useTranslations("session");
  const interactive = onSelect !== undefined;
  const revealed = revealedProp ?? selected !== null;
  const wasCorrect =
    revealed && selected !== null && selected === question.correct_index;

  // The display order is a permutation where `order[i]` is the canonical
  // index of the option rendered at display position `i`. Stable per question
  // (keyed on `question`), so a shuffled card never re-shuffles on re-render.
  const order = useMemo(
    () =>
      shuffled
        ? displayOrder(question.options.length, pinUnknown)
        : question.options.map((_, i) => i),
    [question, shuffled, pinUnknown],
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h2 className="font-display text-xl font-medium text-on-surface">
        <MathText content={question.text} />
      </h2>

      <div className="flex flex-col gap-2">
        {order.map((canonical, displayIndex) => {
          const isCorrect = canonical === question.correct_index;
          const isSelected = canonical === selected;
          return (
            <button
              key={displayIndex}
              type="button"
              disabled={!interactive || revealed}
              onClick={onSelect ? () => onSelect(canonical) : undefined}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                revealed
                  ? isCorrect
                    ? "border-primary/60 bg-primary/10"
                    : isSelected
                      ? "border-error/60 bg-error/10"
                      : "border-outline-variant/30 bg-surface-container-low/50 opacity-60"
                  : interactive
                    ? "border-outline-variant/50 bg-surface-container-low hover:border-outline-variant"
                    : "border-outline-variant/50 bg-surface-container-low",
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold",
                  revealed && isCorrect
                    ? "bg-primary text-on-primary"
                    : revealed && isSelected
                      ? "bg-error text-on-error"
                      : "border border-outline-variant/60 text-on-surface-variant",
                )}
              >
                {optionLetter(displayIndex)}
              </span>
              <span className="flex-1 text-sm text-on-surface">
                <MathText content={question.options[canonical]} />
              </span>
              {revealed && isCorrect && (
                <Check className="size-4 shrink-0 text-primary" aria-hidden />
              )}
              {revealed && isSelected && !isCorrect && (
                <X className="size-4 shrink-0 text-error" aria-hidden />
              )}
            </button>
          );
        })}
      </div>

      {revealed && (
        <div className="rounded-xl border border-outline-variant/50 bg-surface-container p-4">
          {selected !== null && (
            <p
              className={cn(
                "mb-1 text-sm font-semibold",
                wasCorrect ? "text-primary" : "text-error",
              )}
            >
              {wasCorrect ? t("correct") : t("notQuite")}
            </p>
          )}
          <p className="text-sm text-on-surface-variant">
            <MathText content={question.explanation} />
          </p>
        </div>
      )}
    </div>
  );
}
