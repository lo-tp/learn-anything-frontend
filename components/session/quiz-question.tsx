"use client";

import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { QuestionItem } from "@/lib/api-client";
import { MathText } from "@/components/math-text";
import { cn } from "@/lib/utils";

/** The letter badge shown next to each option (A, B, C, …). */
const optionLetter = (index: number) =>
  String.fromCharCode("A".charCodeAt(0) + index);

/**
 * One material quiz question (#47): the prompt, lettered options, and —
 * once an option is chosen — the reveal (correct option highlighted, a
 * wrong selection marked, and the explanation shown).
 *
 * Pure leaf: the session view owns the selection (`selected`) and receives
 * clicks via `onSelect`. Choosing an option locks the question for the
 * rest of the session (v1 is client-side only — the backend has no
 * endpoint to submit material-question answers).
 */
export function QuizQuestion({
  question,
  selected,
  onSelect,
}: {
  question: QuestionItem;
  /** The chosen option (0-based), or null before the learner answers. */
  selected: number | null;
  onSelect: (index: number) => void;
}) {
  const t = useTranslations("session");
  const revealed = selected !== null;
  const wasCorrect = revealed && selected === question.correct_index;

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
              disabled={revealed}
              onClick={() => onSelect(i)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                revealed
                  ? isCorrect
                    ? "border-primary/60 bg-primary/10"
                    : isSelected
                      ? "border-error/60 bg-error/10"
                      : "border-outline-variant/30 bg-surface-container-low/50 opacity-60"
                  : "border-outline-variant/50 bg-surface-container-low hover:border-outline-variant",
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
          <p
            className={cn(
              "mb-1 text-sm font-semibold",
              wasCorrect ? "text-primary" : "text-error",
            )}
          >
            {wasCorrect ? t("correct") : t("notQuite")}
          </p>
          <p className="text-sm text-on-surface-variant">
            <MathText content={question.explanation} />
          </p>
        </div>
      )}
    </div>
  );
}
