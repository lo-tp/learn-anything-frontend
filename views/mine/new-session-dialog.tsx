"use client";

import { Check, Loader2, Send, X } from "lucide-react";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { MathText } from "@/components/math-text";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, displayOrder } from "@/lib/utils";
import type { PlanBody } from "@/lib/api-client";
import type { Bubble, IntakeAsk, ProbeCard } from "./intake";
import { useSessionIntake } from "./use-session-intake";

/**
 * The Session intake (#26) — opened over History at `/mine` and over the
 * public Explore surface at the root (#150). It is a **form**, not a
 * conversation: the record of the intake *is* the sheet.
 *
 * Every question the app asked and every answer the learner gave stays on the
 * sheet in the order it happened — the questions as the quiet line above their
 * answer, the answers in the filled state of a field. Only the thing being
 * asked right now is open: one ask, its own control, its action beside it. A
 * generated plan renders as a numbered list (the current one only — an
 * adjustment replaces the plan, it does not add another), and the learner
 * changes it in one field and approves it with one control.
 *
 * While a request is in flight the open ask's control is replaced by a line
 * saying what is happening; nothing floats over the sheet, and no position is
 * drawn as a bar or a row of markers — the header states it in words.
 *
 * Pure presentation: the intake core (`intake.ts`) derives every decision and
 * the binding (`use-session-intake.ts`) runs the requests; this file only
 * projects the core's state into the record and wires the controls to the
 * binding's intents (`submit`, `pickOption`, `approve`, `confirm`, `close`).
 */

/** One entry of the record — everything already asked and answered. */
type RecordEntry =
  | { kind: "goal"; text: string }
  | { kind: "note"; text: string }
  | { kind: "answer"; asked: string | null; text: string | string[] }
  | { kind: "answeredProbe"; card: ProbeCard; picked: number | undefined }
  | { kind: "plan"; plan: PlanBody };

/**
 * Project the core's bubbles into the record. The first app turn is the
 * sheet's standing instruction (its opening prompt), never a record entry;
 * an app question is held until the learner answers it, so a question and its
 * answer land in the record together; the ask that is still open is held by
 * the core's view-model instead. A plan entry replaces every earlier one: the
 * plan on screen is the whole contract.
 */
function projectRecord(
  bubbles: Bubble[],
  openAsk: IntakeAsk,
): { intro: string[]; entries: RecordEntry[] } {
  const intro: string[] = [];
  const entries: RecordEntry[] = [];
  let asked: string | null = null;

  bubbles.forEach((bubble, index) => {
    if (index === 0 && bubble.kind === "text" && bubble.from === "ai") {
      intro.push(bubble.text);
      return;
    }
    if (bubble.kind === "text" && bubble.from === "ai") {
      if (bubble.highlighted) {
        entries.push({ kind: "goal", text: bubble.text });
        asked = null;
      } else {
        asked = bubble.text;
      }
      return;
    }
    if (bubble.kind === "text" && bubble.from === "you") {
      entries.push({ kind: "answer", asked, text: bubble.text });
      asked = null;
      return;
    }
    if (bubble.kind === "probe") {
      if (bubble.state === "answered") {
        entries.push({
          kind: "answeredProbe",
          card: bubble.card,
          picked: bubble.picked,
        });
        asked = null;
      }
      return;
    }
    for (let i = entries.length - 1; i >= 0; i -= 1) {
      if (entries[i].kind === "plan") entries.splice(i, 1);
    }
    entries.push({ kind: "plan", plan: bubble.plan });
  });

  // An app turn that asked for nothing the learner can give — the boundary is
  // established, the plan is on its way — is a statement, not an ask.
  const openAskText = openAsk !== null && openAsk.kind === "text" ? openAsk.text : null;
  if (asked !== null && asked !== openAskText) entries.push({ kind: "note", text: asked });

  return { intro, entries };
}

/** Text the learner wrote: one block, or a list when they wrote several. */
function WrittenText({ text }: { text: string | string[] }) {
  const lines = Array.isArray(text) ? text : [text];
  if (lines.length > 1) {
    return (
      <ul className="space-y-1.5">
        {lines.map((line, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-current" />
            <span>
              <MathText content={line} />
            </span>
          </li>
        ))}
      </ul>
    );
  }
  return <MathText content={lines[0]} />;
}

/** The field itself, in its filled state: the value the learner gave. A
 *  recorded answer is reading text, so it keeps a readable measure; the open
 *  controls use the full column. */
function FilledField({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-1.5 max-w-[68ch] rounded-md border border-outline-variant bg-surface-container-lowest px-4 py-3 text-[15px] leading-6 text-on-surface">
      {children}
    </div>
  );
}

/** The label that belongs to every entry the learner has filled in. */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 text-[14px] font-semibold text-on-surface-variant">{children}</p>
  );
}

export function NewSessionDialog({
  open,
  onOpenChange,
  onAccept,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after an accepted intake — the parent should refetch the History. */
  onAccept: () => void;
}) {
  const t = useTranslations("dialog");
  const tVerdict = useTranslations("session");
  const {
    paragraph,
    setParagraph,
    view,
    submit,
    pickOption,
    approve,
    confirm,
    close,
    handleOpenChange,
    recordRef,
    attachTextarea,
  } = useSessionIntake({ open, onOpenChange, onAccept });

  const openAskText = view.ask !== null && view.ask.kind === "text" ? view.ask.text : null;
  const { intro, entries } = projectRecord(view.bubbles, view.ask);
  /** The open ask's field: labelled by the question itself. Before a session
   *  exists the sheet asks for the goal, and the core's own label is the
   *  question. */
  const fieldLabel = openAskText ?? view.intake.label;
  const canAdjustPlan = paragraph.trim().length > 0;
  /** A field that is an ask wants an answer: an empty one is not one, so the
   *  sheet never sends one and never answers "something went wrong" to a
   *  learner who pressed Send on a blank field. */
  const canSubmitAnswer =
    view.pending || !view.fieldRequiresText || paragraph.trim().length > 0;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    void submit(paragraph);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit(paragraph);
    }
  }

  /** The line a request in flight puts in the open ask's place. */
  function renderWorking() {
    return (
      <div
        role="status"
        aria-label={view.pendingNote}
        className="flex items-start gap-2.5 text-[14px] leading-6 text-on-surface-variant"
      >
        <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-on-surface" aria-hidden />
        <span>{view.pendingNote}</span>
      </div>
    );
  }

  function renderError() {
    if (view.error === null) return null;
    return (
      <p className="mt-2 text-[14px] leading-6 text-error" aria-live="polite">
        {view.error ?? t("errorFallback")}
      </p>
    );
  }

  /** A text answer: the open question as the field's own label. */
  function renderAnswerField() {
    return (
      <div>
        <label
          htmlFor="intake-answer"
          className="block text-[15px] font-semibold leading-6 text-on-surface"
        >
          <WrittenText text={fieldLabel} />
        </label>
        {view.rail.clarifyPosition !== null && (
          <p className="mt-1 text-[14px] text-on-surface-variant">{view.rail.clarifyPosition}</p>
        )}
        <textarea
          id="intake-answer"
          ref={attachTextarea}
          rows={view.reviewing ? 2 : 4}
          value={paragraph}
          onChange={(event) => setParagraph(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={view.intake.placeholder}
          className="mt-2 w-full resize-none rounded-md border border-outline-variant bg-surface-container-lowest p-4 text-[15px] leading-6 text-on-surface outline-none transition-colors placeholder:text-on-surface-variant focus-visible:border-engage focus-visible:ring-2 focus-visible:ring-engage/25"
        />
        {renderError()}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {view.reviewing ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={view.pending || !canAdjustPlan}
                onClick={() => void submit(paragraph)}
                className="h-auto px-4 py-2.5 text-[15px]"
              >
                {t("updatePlan")}
              </Button>
              <Button
                type="button"
                disabled={view.pending}
                onClick={approve}
                className="h-auto gap-2 px-4 py-2.5 text-[15px]"
              >
                <Check className="size-4" aria-hidden />
                {t("approvePlan")}
              </Button>
            </>
          ) : (
            <Button
              type="submit"
              disabled={!canSubmitAnswer}
              className="h-auto gap-2 px-4 py-2.5 text-[15px]"
            >
              <Send className="size-4" aria-hidden />
              {view.pending ? t("sending") : t("send")}
            </Button>
          )}
        </div>
      </div>
    );
  }

  /** A boundary check: the options are the control — a click is the answer.
   *  The fieldset is the card: its question, its position, its options. */
  function renderChoiceField(card: ProbeCard) {
    return (
      <fieldset>
        <legend className="text-[15px] font-semibold leading-6 text-on-surface">
          <MathText content={card.text} />
        </legend>
        {view.rail.probePosition !== null && (
          <p className="mt-1 text-[14px] text-on-surface-variant">
            {view.rail.probePosition}
          </p>
        )}
        <ProbeOptions card={card} disabled={view.pending} onPick={pickOption} />
        {renderError()}
      </fieldset>
    );
  }

  /** The state a completed intake leaves the sheet in: the plan is approved
   *  and the materials are being made. The record stays on screen — it is the
   *  learner's own record. */
  function renderOnTheWay() {
    return (
      <div
        role="status"
        aria-label={t("railCounterGenerating")}
        className="rounded-md border border-outline-variant bg-surface-container-lowest p-4"
      >
        <p className="flex items-start gap-2.5 text-[15px] leading-6 text-on-surface">
          <Check className="mt-0.5 size-4 shrink-0 text-tertiary" aria-hidden />
          {t("onTheWaySubline")}
        </p>
        <Button
          type="button"
          onClick={close}
          className="mt-3 h-auto px-4 py-2.5 text-[15px]"
        >
          {t("backToSessions")}
        </Button>
      </div>
    );
  }

  /** The lifecycle hand-off the backend can land the intake on: nothing left
   *  to ask, so the only control is the one that files the session. */
  function renderConfirm() {
    return (
      <div>
        {view.showPending && <div className="mb-3">{renderWorking()}</div>}
        <Button
          type="button"
          disabled={view.pending}
          onClick={confirm}
          className="h-auto gap-2 px-4 py-2.5 text-[15px]"
        >
          <Check className="size-4" aria-hidden />
          {t("confirm")}
        </Button>
      </div>
    );
  }

  function renderOpenAsk() {
    if (view.onTheWay) return renderOnTheWay();
    if (view.confirming) return renderConfirm();
    if (view.showPending) return renderWorking();
    if (view.ask !== null && view.ask.kind === "choice")
      return renderChoiceField(view.ask.card);
    return renderAnswerField();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        // Opt out of Radix's open auto-focus (it targets the close button);
        // the binding owns focus and puts it in the field when one is open.
        // Full-screen, and a flex column rather than the shared grid: the
        // record is the child that shrinks and scrolls, so the header and the
        // open ask are never clipped off-screen by a long record.
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="inset-0 flex h-full w-full max-h-none max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-surface p-0 text-on-surface sm:max-w-none"
      >
        <form onSubmit={handleSubmit} className="flex min-h-0 w-full flex-1 flex-col">
          <header className="shrink-0 border-b border-outline-variant bg-surface">
            <div className="mx-auto flex w-full max-w-2xl items-start justify-between gap-4 px-4 py-4 md:px-6">
              <div className="min-w-0">
                <DialogTitle className="text-[20px] font-semibold text-on-surface">
                  {view.onTheWay ? t("railCounterGenerating") : t("title")}
                </DialogTitle>
                {!view.onTheWay && (
                  <p
                    role="status"
                    aria-label={view.rail.counter}
                    className="mt-1 text-[14px] leading-5 text-on-surface-variant"
                  >
                    {view.rail.counter}
                  </p>
                )}
              </div>
              <DialogClose asChild>
                <button
                  type="button"
                  aria-label={t("close")}
                  disabled={view.pending}
                  className="focus-ring flex size-8 shrink-0 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-accent hover:text-on-surface disabled:pointer-events-none disabled:opacity-50"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </DialogClose>
            </div>
          </header>

          <div ref={recordRef} className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6 md:px-6">
              {intro.map((line, i) => (
                <p key={i} className="max-w-[68ch] text-[15px] leading-6 text-on-surface">
                  <MathText content={line} />
                </p>
              ))}

              {entries.map((entry, i) => (
                <RecordEntryView
                  key={i}
                  entry={entry}
                  yourAnswer={t("yourAnswer")}
                  yourGoal={t("yourGoal")}
                  correct={tVerdict("correct")}
                  notQuite={tVerdict("notQuite")}
                  why={t("explanation")}
                  buildsOn={t("planBuildsOn")}
                />
              ))}

              {renderOpenAsk()}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The option rows of a boundary check that is still open. A click answers it;
 *  there is no second "submit the answer" step. */
function ProbeOptions({
  card,
  disabled,
  onPick,
}: {
  card: ProbeCard;
  disabled: boolean;
  onPick: (canonicalIndex: number) => void;
}) {
  // Display order is the surface's concern: a stable permutation per card,
  // with the backend's "I don't know" option kept last. The canonical index
  // is what the owner is given back.
  const order = useMemo(
    () => displayOrder(card.options.length, true),
    [card],
  );
  return (
    <div className="mt-3 flex flex-col gap-2">
      {order.map((canonical) => (
        <button
          key={canonical}
          type="button"
          disabled={disabled}
          onClick={() => onPick(canonical)}
          className="focus-ring w-full rounded-md border border-outline-variant px-4 py-3 text-left text-[15px] leading-6 text-on-surface transition-colors hover:border-engage disabled:opacity-60"
        >
          <MathText content={card.options[canonical]} />
        </button>
      ))}
    </div>
  );
}

/** One thing already asked and answered, kept on the sheet. */
function RecordEntryView({
  entry,
  yourAnswer,
  yourGoal,
  correct,
  notQuite,
  why,
  buildsOn,
}: {
  entry: RecordEntry;
  yourAnswer: string;
  yourGoal: string;
  correct: string;
  notQuite: string;
  why: string;
  buildsOn: string;
}) {
  if (entry.kind === "goal") {
    // The narrowed goal: the one line on the sheet set in the highlighter.
    return (
      <p className="-mx-2 rounded-sm bg-[var(--marker)] px-2 py-1 text-[15px] font-semibold leading-6 text-on-surface">
        <MathText content={entry.text} />
      </p>
    );
  }

  if (entry.kind === "note") {
    return (
      <p className="max-w-[68ch] text-[15px] leading-6 text-on-surface-variant">
        <MathText content={entry.text} />
      </p>
    );
  }

  if (entry.kind === "answer") {
    return (
      <div className="border-t border-outline-variant pt-1">
        {entry.asked !== null && (
          <p className="max-w-[68ch] text-[15px] leading-6 text-on-surface-variant">
            <WrittenText text={entry.asked} />
          </p>
        )}
        <FieldLabel>{entry.asked === null ? yourGoal : yourAnswer}</FieldLabel>
        <FilledField>
          <WrittenText text={entry.text} />
        </FilledField>
      </div>
    );
  }

  if (entry.kind === "answeredProbe") {
    const wasCorrect = entry.picked === entry.card.correct_index;
    return (
      <div className="border-t border-outline-variant pt-1">
        <p className="max-w-[68ch] text-[15px] leading-6 text-on-surface-variant">
          <MathText content={entry.card.text} />
        </p>
        <FieldLabel>{yourAnswer}</FieldLabel>
        <FilledField>
          {entry.picked !== undefined && (
            <MathText content={entry.card.options[entry.picked]} />
          )}
        </FilledField>
        <p
          className={cn(
            "mt-2 text-[14px] font-semibold",
            wasCorrect ? "text-tertiary" : "text-error",
          )}
        >
          {wasCorrect ? correct : notQuite}
        </p>
        <p className="mt-1 text-[14px] leading-6 text-on-surface-variant">
          <span className="font-semibold">{why}: </span>
          <MathText content={entry.card.explanation} />
        </p>
      </div>
    );
  }

  const plan = entry.plan;
  const titleOf = (id: string) =>
    plan.steps.find((step) => step.id === id)?.title ?? id;
  return (
    <div className="border-t border-outline-variant pt-1">
      <h3 className="max-w-[68ch] text-[15px] font-semibold leading-6 text-on-surface">
        <MathText content={plan.prose_summary} />
      </h3>
      <ol className="mt-3 flex flex-col gap-3">
        {plan.steps.map((step, index) => (
          <li key={step.id} className="flex gap-3">
            <span className="w-5 shrink-0 text-right text-[15px] font-semibold text-on-surface-variant [font-variant-numeric:tabular-nums]">
              {index + 1}.
            </span>
            <div className="min-w-0 max-w-[68ch]">
              <p className="text-[15px] font-semibold leading-6 text-on-surface">
                {step.title}
              </p>
              <p className="text-[15px] leading-6 text-on-surface-variant">
                {step.description}
              </p>
              {step.depends_on.length > 0 && (
                <p className="mt-1 text-[14px] leading-5 text-on-surface-variant">
                  {buildsOn}{" "}
                  {step.depends_on.map(titleOf).join(", ")}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
