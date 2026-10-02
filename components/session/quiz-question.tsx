"use client";

import { useMemo } from "react";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { MathText } from "@/components/math-text";
import { cn, optionLetter, displayOrder } from "@/lib/utils";

/** The red-pen cross — authored as two hand-drawn strokes that ink in
 *  sequentially (pen-stroke / pen-stroke-2), never an icon with a dash
 *  trick. */
function PenCross() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-4 shrink-0 text-error"
      fill="none"
      aria-hidden
    >
      <path
        d="M2.6 2.9 L13.1 13.4"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        pathLength={1}
        className="pen-stroke"
      />
      <path
        d="M13.2 2.7 L2.9 13.2"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        pathLength={1}
        className="pen-stroke pen-stroke-2"
      />
    </svg>
  );
}

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
 * The shared quiz card (#113): the answer-sheet form. The prompt, lettered
 * option boxes exactly like a printed question, and — once revealed — the
 * red-pen correction: the wrong pick struck with a drawn red X, the correct
 * option marked in verified green, and the explanation set below a colored
 * top rule. It serves all three surfaces:
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
  const wasWrong = revealed && selected !== null && !wasCorrect;

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
      <h2 className="font-display text-xl font-semibold text-on-surface">
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
                "focus-ring flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left transition-colors",
                revealed
                  ? isCorrect
                    ? "border-tertiary/60 bg-tertiary-container/50"
                    : isSelected
                      ? "border-error/60 bg-error-container/40"
                      : "border-outline-variant/50 opacity-45"
                  : interactive
                    ? "border-outline-variant bg-surface-container-lowest hover:border-primary"
                    : "border-outline-variant bg-surface-container-lowest",
              )}
            >
              {/* The option box — a printed letter square, inked when the
                  answer is marked. */}
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-[3px] border font-mono text-xs font-bold",
                  revealed && isCorrect
                    ? "border-tertiary bg-tertiary text-on-tertiary"
                    : revealed && isSelected
                      ? "border-error bg-error text-on-error"
                      : revealed
                        ? "border-outline-variant/60 text-on-surface-variant"
                        : "border-outline-variant text-on-surface-variant",
                )}
              >
                {optionLetter(displayIndex)}
              </span>
              <span className="flex-1 text-[15px] text-on-surface">
                <MathText content={question.options[canonical]} />
              </span>
              {revealed && isCorrect && (
                <Check className="size-4 shrink-0 text-tertiary" aria-hidden />
              )}
              {revealed && isSelected && !isCorrect && <PenCross />}
            </button>
          );
        })}
      </div>

      {revealed && (
        <div
          className={cn(
            "rounded-md border border-outline-variant bg-surface-container-lowest p-4",
            wasWrong
              ? "border-t-2 border-t-error"
              : wasCorrect
                ? "border-t-2 border-t-tertiary"
                : "border-t-2 border-t-outline",
          )}
        >
          {selected !== null && (
            <p
              className={cn(
                "mb-1 font-mono text-xs font-bold uppercase tracking-[0.14em]",
                wasCorrect ? "text-tertiary" : "text-error",
              )}
            >
              {wasCorrect ? t("correct") : t("notQuite")}
            </p>
          )}
          <p className="text-sm leading-relaxed text-on-surface-variant">
            <MathText content={question.explanation} />
          </p>
        </div>
      )}
    </div>
  );
}
