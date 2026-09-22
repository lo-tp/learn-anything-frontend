"use client";

import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { QuestionItem } from "@/lib/api-client";
import { MathText } from "@/components/math-text";
import { cn, optionLetter } from "@/lib/utils";

/**
 * Project a question's options into a display order (a permutation where
 * `order[i]` is the canonical index of the option rendered at display
 * position `i`), remapping `correct_index` to that display position. The
 * card's `selected` / reveal then work in display coordinates, so a
 * shuffled probe card (#74) and a review card share the same reveal.
 */
export function displayOrderQuestion(
  question: { options: string[]; correct_index: number },
  order: number[],
): Pick<QuestionItem, "options" | "correct_index"> {
  return {
    options: order.map((i) => question.options[i]),
    correct_index: order.indexOf(question.correct_index),
  };
}

/**
 * The shared quiz card (#113): the prompt, lettered option buttons, and —
 * once revealed — the reveal (correct option highlighted, a wrong
 * selection marked, and the explanation shown). It serves all three
 * surfaces:
 * - **session detail** — select → reveal (`onSelect` + `selected`);
 * - **probe** — select → reveal (`onSelect` + `selected`); a click is the
 *   answer (no confirm step);
 * - **review** — reveal → confidence: pass `selected={null}` plus an
 *   explicit `revealed` and omit `onSelect` — the options stay
 *   non-interactive and the card shows the explanation without a
 *   verdict heading.
 *
 * Pure leaf: the owner holds the selection (`selected`) and receives
 * clicks via `onSelect`.
 */
export function QuizQuestion({
  question,
  selected,
  onSelect,
  revealed: revealedProp,
}: {
  question: QuestionItem;
  /** The chosen option (0-based), or null before the learner answers. */
  selected: number | null;
  /**
   * Receives option clicks. When absent the options are non-interactive
   * (the review surface, where Reveal is a separate footer control).
   */
  onSelect?: (index: number) => void;
  /**
   * Reveal the answer without a selection (the review surface). Defaults
   * to `selected !== null`.
   */
  revealed?: boolean;
}) {
  const t = useTranslations("session");
  const interactive = onSelect !== undefined;
  const revealed = revealedProp ?? selected !== null;
  const wasCorrect =
    revealed && selected !== null && selected === question.correct_index;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h2 className="font-display text-xl font-medium text-on-surface">
        <MathText content={question.text} />
      </h2>

      <div className="flex flex-col gap-2">
        {question.options.map((option, i) => {
          const isCorrect = i === question.correct_index;
          const isSelected = i === selected;
          return (
            <button
              key={i}
              type="button"
              disabled={!interactive || revealed}
              onClick={onSelect ? () => onSelect(i) : undefined}
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
                {optionLetter(i)}
              </span>
              <span className="flex-1 text-sm text-on-surface">
                <MathText content={option} />
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
