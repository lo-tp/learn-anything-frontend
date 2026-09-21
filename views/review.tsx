"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Loader2, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { QuizQuestion } from "@/components/session/quiz-question";
import { displayOrder } from "@/lib/utils";
import {
  answerReviewCard,
  getReviewDue,
  type QuestionItem,
  type ReviewCardOut,
} from "@/lib/api-client";

/**
 * The `/review` surface (#111): the learner's due spaced-repetition cards,
 * answered one at a time. **Client** component — the route is a static
 * shell, so the view owns the initial `getReviewDue` fetch (#87) and the
 * card flow. Each card's options are served in a fresh `displayOrder`
 * (no pinning — review cards carry no "I don't know" option); the learner
 * picks an option, the `QuizQuestion` leaf reveals correct/wrong and the
 * explanation, and a Next/Done control advances. A pick records the
 * canonical index via `answerReviewCard` (fire-and-forget, mirroring the
 * material-miss path). The shared frame is applied by the root layout.
 */
export function Review() {
  const t = useTranslations("review");
  const [cards, setCards] = useState<ReviewCardOut[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);

  // The initial fetch: the view owns its data (static shell, #87).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const due = await getReviewDue();
        if (!cancelled) {
          setCards(due);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const total = cards?.length ?? 0;
  const current = finished ? null : (cards?.[index] ?? null);

  /**
   * The current card's display order (no pinning). `order[i]` is the
   * **canonical** index of the option rendered at display position `i` —
   * generated once per card so it is stable across the pick and reveal,
   * and never reshuffles while the card is on screen.
   */
  const order = useMemo<number[]>(() => {
    if (!current) return [];
    return displayOrder(current.question.options.length);
  }, [current]);

  /**
   * The current card's question as a `QuestionItem` for the `QuizQuestion`
   * leaf: options permuted into display order, `correct_index` remapped to
   * that display position (the leaf compares `selected` against it).
   */
  const question = useMemo<QuestionItem | null>(() => {
    if (!current) return null;
    const q = current.question;
    return {
      type: "question",
      id: String(current.id),
      text: q.text,
      options: order.map((i) => q.options[i]),
      correct_index: order.indexOf(q.correct_index),
      explanation: q.explanation,
    };
  }, [current, order]);

  /** A pick: record the canonical index, then reveal the answer. */
  const handlePick = (displayIndex: number) => {
    if (!current) return;
    const canonical = order[displayIndex];
    answerReviewCard(current.id, canonical).catch(() => {});
    setSelected(displayIndex);
  };

  /** Advance: next card (fresh order, no selection) or finish the deck. */
  const handleNext = () => {
    if (index < total - 1) {
      setIndex((i) => i + 1);
      setSelected(null);
    } else {
      setFinished(true);
    }
  };

  // ── Friendly states (loading / error / empty-or-finished) ──────────
  if (!loaded) {
    return (
      <StatePanel
        icon={
          <Loader2 className="size-8 animate-spin text-tertiary" aria-hidden />
        }
        title={t("loading")}
      />
    );
  }

  if (error) {
    return (
      <StatePanel
        icon={<TriangleAlert className="size-8 text-error" aria-hidden />}
        title={t("error")}
      />
    );
  }

  if (total === 0 || finished) {
    return (
      <StatePanel
        icon={<Check className="size-8 text-primary" aria-hidden />}
        title={t("emptyTitle")}
        note={t("emptyBody")}
      />
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-outline-variant bg-surface px-6">
        <h1 className="font-display text-xl font-medium text-on-surface">
          {t("title")}
        </h1>
        {/* Progress pill: {index+1}/{total}. */}
        <div
          className="flex items-center gap-1.5 rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 py-1.5 font-mono text-xs text-on-surface-variant"
          aria-label={t("progress", {
            current: String(index + 1),
            total: String(total),
          })}
        >
          <span className="font-semibold text-on-surface">{index + 1}</span>
          <span>/</span>
          <span>{total}</span>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-6">
        {question && (
          <QuizQuestion
            question={question}
            selected={selected}
            onSelect={handlePick}
          />
        )}
      </main>

      <footer className="flex h-16 shrink-0 items-center justify-end border-t border-outline-variant bg-surface px-6">
        {selected !== null && (
          <button
            type="button"
            onClick={handleNext}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-fixed"
          >
            {index < total - 1 ? t("next") : t("done")}
            <ChevronRight className="size-4" aria-hidden />
          </button>
        )}
      </footer>
    </div>
  );
}

/**
 * The review view's full-bleed friendly states (loading / error /
 * all-clear): a centered icon, title, optional note, and a link home.
 */
function StatePanel({
  icon,
  title,
  note,
}: {
  icon: React.ReactNode;
  title: string;
  note?: string;
}) {
  const t = useTranslations("review");
  return (
    <main className="flex flex-1 items-center justify-center overflow-y-auto">
      <div className="flex flex-col items-center gap-3 p-8 text-center">
        {icon}
        <h1 className="font-display text-2xl font-semibold text-on-surface">
          {title}
        </h1>
        {note && (
          <p className="max-w-md text-sm text-on-surface-variant">{note}</p>
        )}
        <Link
          href="/"
          className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-fixed"
        >
          {t("backToSessions")}
        </Link>
      </div>
    </main>
  );
}
