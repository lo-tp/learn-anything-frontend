"use client";

import { useEffect, useState } from "react";
import { Check, Eye, Loader2, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { QuizQuestion } from "@/components/session/quiz-question";
import { StatePanel } from "@/components/state-panel";
import {
  answerReviewCard,
  getReviewDue,
  type ReviewCardOut,
  type ReviewConfidence,
} from "@/lib/api-client";

/** The four confidence levels, in FSRS order (harsh → easy). */
const CONFIDENCES: ReviewConfidence[] = ["again", "hard", "good", "easy"];

/**
 * The `/review` surface (#111, reworked in #117): the learner's due
 * spaced-repetition cards, reviewed one at a time. **Client** component —
 * the route is a static shell, so the view owns the initial `getReviewDue`
 * fetch (#87) and the card flow. Each card's options are served in a fresh
 * `displayOrder` (no pinning — review cards carry no "I don't know" option).
 *
 * The flow is **reveal → confidence**: the learner first sees the question
 * and options (the shared QuizQuestion card, non-interactive — no `onSelect`),
 * taps **Reveal** to uncover the correct answer and the
 * explanation, then records a confidence (again / hard / good / easy).
 * Recording the confidence schedules the card via `answerReviewCard`,
 * **awaited** before the deck advances (#132): the four controls are
 * disabled while in flight, and a failed recording keeps the card on
 * screen with a notice so the learner can tap a confidence again — a
 * missed schedule is never lost silently. The shared frame is applied by
 * the root layout.
 */
export function Review() {
  const t = useTranslations("review");
  const [cards, setCards] = useState<ReviewCardOut[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [finished, setFinished] = useState(false);
  /** A confidence recording is in flight (controls disabled). */
  const [submitting, setSubmitting] = useState(false);
  /** The last confidence recording failed — the card stays on screen. */
  const [answerError, setAnswerError] = useState(false);

  /** Fetch the due cards — the initial load and the error state's Retry. */
  const load = () => {
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
  };

  // The initial fetch: the view owns its data (static shell, #87).
  useEffect(load, []);

  const total = cards?.length ?? 0;
  const current = finished ? null : (cards?.[index] ?? null);

  /** Reveal the answer — nothing is recorded until a confidence is. */
  const handleReveal = () => {
    setRevealed(true);
  };

  /**
   * A confidence: record it (awaited, #132) and advance — next card (fresh
   * order, not revealed) or finish the deck. A failed recording keeps the
   * card on screen with a notice; the learner taps a confidence to retry.
   */
  const handleConfidence = async (confidence: ReviewConfidence) => {
    /* v8 ignore next */
    if (!current || submitting) return;
    setSubmitting(true);
    setAnswerError(false);
    try {
      await answerReviewCard(current.id, confidence);
    } catch {
      setSubmitting(false);
      setAnswerError(true);
      return;
    }
    setSubmitting(false);
    if (index < total - 1) {
      setIndex((i) => i + 1);
      setRevealed(false);
    } else {
      setFinished(true);
    }
  };

  /** The friendly states' shared footer action: a link home. */
  const backToSessions = (
    <Link
      href="/"
      className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-fixed"
    >
      {t("backToSessions")}
    </Link>
  );

  // ── Friendly states (loading / error / empty-or-finished) ──────────
  if (!loaded) {
    return (
      <StatePanel
        icon={
          <Loader2 className="size-8 animate-spin text-tertiary" aria-hidden />
        }
        title={t("loading")}
        action={backToSessions}
      />
    );
  }

  if (error) {
    return (
      <StatePanel
        icon={<TriangleAlert className="size-8 text-error" aria-hidden />}
        title={t("error.title")}
        note={t("error.note")}
        action={
          <button
            type="button"
            onClick={load}
            className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-fixed"
          >
            {t("retry")}
          </button>
        }
      />
    );
  }

  if (total === 0 || finished) {
    return (
      <StatePanel
        icon={<Check className="size-8 text-primary" aria-hidden />}
        title={t("emptyTitle")}
        note={t("emptyBody")}
        action={backToSessions}
      />
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <main className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-6">
        {current && (
          <QuizQuestion
            question={current.question}
            selected={null}
            revealed={revealed}
            shuffled
          />
        )}
      </main>

      <footer className="relative flex shrink-0 items-center justify-center gap-3 border-t border-outline-variant bg-surface px-6 py-3">
        {!revealed ? (
          <button
            type="button"
            onClick={handleReveal}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-fixed"
          >
            <Eye className="size-4" aria-hidden />
            {t("reveal")}
          </button>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-on-surface-variant">
              {t("confidence")}
            </p>
            <div className="flex items-center gap-2">
              {CONFIDENCES.map((confidence) => (
                <button
                  key={confidence}
                  type="button"
                  onClick={() => handleConfidence(confidence)}
                  disabled={submitting}
                  className="rounded-lg border border-outline-variant/60 bg-surface-container-low px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:border-outline-variant hover:bg-surface-container disabled:opacity-50"
                >
                  {t(confidence)}
                </button>
              ))}
            </div>
            {answerError && (
              <p className="text-xs text-error" role="alert">
                {t("answerFailed")}
              </p>
            )}
          </div>
        )}
        {/* Progress pill: {index+1}/{total}, pinned to the bar's right. */}
        <div
          className="absolute right-6 flex items-center gap-1.5 rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 py-1.5 font-mono text-xs text-on-surface-variant"
          aria-label={t("progress", {
            current: String(index + 1),
            total: String(total),
          })}
        >
          <span className="font-semibold text-on-surface">{index + 1}</span>
          <span>/</span>
          <span>{total}</span>
        </div>
      </footer>
    </div>
  );
}

