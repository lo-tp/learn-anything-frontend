"use client";

import { Check, Loader2, Send, X } from "lucide-react";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { MathText } from "@/components/math-text";
import { ProgressRail } from "@/components/progress-rail";
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
 * answer, the answers in the filled state of a field, and the line that ends a
 * phase as the record's one panel. Only the thing being asked right now is
 * open: one ask, its own control, its action at that item's right end. A
 * generated plan renders as a numbered list, and the learner changes it in
 * one field and approves it with one control. An adjustment does not hide
 * what was there before: the earlier plan stays on the sheet as a record
 * entry, annotated as the plan before this one and set in the pencil tone,
 * so the learner can see what the change changed (#223).
 *
 * The sheet has one measure: the record column is 30rem wide (`SHEET_MEASURE`)
 * and everything in it — a recorded answer, the question above it, an open
 * field, an option row — fills it, so no item on the form is wider than the
 * answer it sits beside (#204: "Equal width"). Its *height* is the viewport's
 * and stays that way on purpose: the room an on-screen keyboard covers is
 * reserved inside the record's own scroll, by the binding, and the record is
 * pinned to the reserved bottom — The Keyboard Room Rule (#230).
 *
 * While a request is in flight the open ask's control is replaced by a line
 * saying what is happening; nothing floats over the sheet.
 *
 * The header and the progress rail are the sheet's original ones — the owner
 * pinned them in #204 (“keep the header”), so the masthead is the printed one
 * and progress is the four-step bubble track, not a substitute device. What
 * the redesign replaced is the body of the sheet: the transcript became the
 * form's own record.
 *
 * Pure presentation: the intake core (`intake.ts`) derives every decision and
 * the binding (`use-session-intake.ts`) runs the requests; this file only
 * projects the core's state into the record and wires the controls to the
 * binding's intents (`submit`, `pickOption`, `approve`, `confirm`, `close`).
 */

/** The sheet's actions sit at the right end of the item they belong to
 *  (#204): one row treatment for `Send`, the plan pair, `Confirm`, and the one
 *  control that files the finished sheet. Still beside the item, still no
 *  floating action bar — the item's own right edge is where an action goes.
 */
const ACTION_ROW = "mt-3 flex flex-wrap items-center justify-end gap-2";

/**
 * The sheet's one measure, stated once, at the record column: a 32rem box
 * padded 16px, so every item inside it is 30rem (480px) wide — a recorded
 * answer, the app's question above it, a plan step, an open field, an option
 * row, the panel the approved sheet ends on. Nothing on the sheet sets a width
 * for itself (#204: "Equal width").
 *
 * It is a length, not a `ch` cap carried item by item, because `ch` resolves
 * against the element's own type metrics: a `<div>` on the 15px rung and a
 * `<textarea>` on it measure `ch` differently, which is exactly how the open
 * field came to be wider than the answers above it. 480px is the 15px body
 * measure DESIGN.md already sets for this sheet (≈69ch), unchanged.
 */
const SHEET_MEASURE = "max-w-[32rem]";

/** One entry of the record — everything already asked and answered. A plan
 *  entry is `superseded` once a later plan has landed on the sheet: it stays
 *  in the record (annotated as the plan before this one) rather than being
 *  hidden (#223). */
type RecordEntry =
  | { kind: "goal"; text: string }
  | { kind: "note"; text: string }
  | { kind: "milestone"; text: string }
  | { kind: "answer"; asked: string | null; text: string | string[] }
  | { kind: "answeredProbe"; card: ProbeCard; picked: number | undefined }
  | { kind: "plan"; plan: PlanBody; superseded: boolean };

/**
 * Project the core's bubbles into the record. The first app turn is the
 * sheet's standing instruction (its opening prompt), never a record entry; an
 * app statement (a line that asks nothing) is a note, and a milestone — the
 * line that ends a phase — is a panel; an app question is held until the
 * learner answers it, so a question and its answer land in the record
 * together; the ask that is still open is held by the core's view-model
 * instead. Every plan the learner has seen stays in the record: an adjustment
 * adds the revised plan and marks the earlier one as superseded, never hides
 * it (#223) — the latest plan is the contract being approved, and the older
 * ones are the record of what it changed.
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
      } else if (bubble.statement) {
        // A statement asks nothing: it is a note in the record, not a question
        // held for an answer, so it holds nothing back.
        entries.push({ kind: "note", text: bubble.text });
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
    if (bubble.kind === "milestone") {
      // A phase end asks nothing, so it holds no question back.
      entries.push({ kind: "milestone", text: bubble.text });
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
    // The new plan is the one being approved; every earlier plan stays in the
    // record as the plan before this one (#223).
    for (let i = entries.length - 1; i >= 0; i -= 1) {
      const entry = entries[i];
      if (entry.kind === "plan") entries[i] = { ...entry, superseded: true };
    }
    entries.push({ kind: "plan", plan: bubble.plan, superseded: false });
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

/** The field itself, in its filled state: the value the learner gave. It takes
 *  the sheet's measure from the column, and so does every open control the
 *  learner will fill in after it. */
function FilledField({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-1.5 rounded-md border border-outline-variant bg-surface-container-lowest px-4 py-3 text-[15px] leading-6 text-on-surface">
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

/** A disabled action on this sheet stays readable. The shared control dims a
 *  whole disabled block to 50%, which drops the ink block's own label to
 *  about 2.4:1 — a primary action on the first viewport that reads as
 *  broken rather than as not yet available. The palette's annotation family
 *  is used instead: a quiet pencil block at ~8:1 on paper and ~9:1 on the
 *  night desk, and an outlined action that keeps its rule and its pencil
 *  label at full strength. */
const DISABLED_INK =
  "disabled:bg-secondary-container disabled:text-on-secondary-container disabled:opacity-100";
const DISABLED_OUTLINE =
  "disabled:border-outline-variant disabled:text-on-surface-variant disabled:opacity-100";

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
    attachRecord,
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
        <div className={ACTION_ROW}>
          {view.reviewing ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={view.pending || !canAdjustPlan}
                onClick={() => void submit(paragraph)}
                className={`h-auto px-4 py-2.5 text-[15px] ${DISABLED_OUTLINE}`}
              >
                {t("updatePlan")}
              </Button>
              <Button
                type="button"
                disabled={view.pending}
                onClick={approve}
                className={`h-auto gap-2 px-4 py-2.5 text-[15px] ${DISABLED_INK}`}
              >
                <Check className="size-4" aria-hidden />
                {t("approvePlan")}
              </Button>
            </>
          ) : (
            <Button
              type="submit"
              disabled={!canSubmitAnswer}
              className={`h-auto gap-2 px-4 py-2.5 text-[15px] ${DISABLED_INK}`}
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
   *  The fieldset is the card: its question and its options, filling the
   *  sheet's measure so a check being answered is the width of a check already
   *  answered. Position belongs to the rail above, which is where the sheet
   *  states it once. */
  function renderChoiceField(card: ProbeCard) {
    return (
      <fieldset>
        <legend className="text-[15px] font-semibold leading-6 text-on-surface">
          <MathText content={card.text} />
        </legend>
        <ProbeOptions card={card} disabled={view.pending} onPick={pickOption} />
        {renderError()}
      </fieldset>
    );
  }

  /** The state a completed intake leaves the sheet in: the plan is approved
   *  and the materials are being made. The record stays on screen — it is the
   *  learner's own record. The panel names nothing: the masthead and the rail
   *  already state the state, and a third copy would only repeat it. */
  function renderOnTheWay() {
    return (
      <div
        role="status"
        className="rounded-md border border-outline-variant bg-surface-container-lowest p-4"
      >
        <p className="flex items-start gap-2.5 text-[15px] leading-6 text-on-surface">
          <Check className="mt-0.5 size-4 shrink-0 text-tertiary" aria-hidden />
          {t("onTheWaySubline")}
        </p>
        <div className={ACTION_ROW}>
          <Button type="button" onClick={close} className="h-auto px-4 py-2.5 text-[15px]">
            {t("backToSessions")}
          </Button>
        </div>
      </div>
    );
  }

  /** The lifecycle hand-off the backend can land the intake on: nothing left
   *  to ask, so the only control is the one that files the session. */
  function renderConfirm() {
    return (
      <div>
        {view.showPending && <div className="mb-3">{renderWorking()}</div>}
        <div className={ACTION_ROW}>
          <Button
            type="button"
            disabled={view.pending}
            onClick={confirm}
            className={`h-auto gap-2 px-4 py-2.5 text-[15px] ${DISABLED_INK}`}
          >
            <Check className="size-4" aria-hidden />
            {t("confirm")}
          </Button>
        </div>
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
          {/* Masthead — the sheet's original header, kept as the owner asked
              (#204): title on the left in the display face, close on the
              right, closed with the printed double rule. The chrome never
              shrinks; the record absorbs every height change. */}
          <header className="flex shrink-0 items-center justify-between gap-4 px-6 py-4 double-rule-b">
            <DialogTitle className="text-left font-display text-xl font-bold uppercase tracking-[0.06em] text-on-surface">
              {view.onTheWay ? t("railCounterGenerating") : t("title")}
            </DialogTitle>
            <div className="flex items-center gap-3">
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

          {/* Progress rail — the four-step bubble track under the masthead,
              also kept (#204). It is the sheet's `status` role: the counter
              it names is never printed as text. */}
          <ProgressRail rail={view.rail} />

          <div ref={attachRecord} className="min-h-0 flex-1 overflow-y-auto">
            <div className={`mx-auto flex w-full ${SHEET_MEASURE} flex-col gap-5 px-4 py-6`}>
              {intro.map((line, i) => (
                <p key={i} className="text-[15px] leading-6 text-on-surface">
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
                  earlierPlan={t("earlierPlan")}
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
  earlierPlan,
}: {
  entry: RecordEntry;
  yourAnswer: string;
  yourGoal: string;
  correct: string;
  notQuite: string;
  why: string;
  buildsOn: string;
  earlierPlan: string;
}) {
  if (entry.kind === "goal") {
    // The narrowed goal: the one line on the sheet set in the highlighter.
    return (
      <p className="rounded-sm bg-[var(--marker)] px-2 py-1 text-[15px] font-semibold leading-6 text-on-surface">
        <MathText content={entry.text} />
      </p>
    );
  }

  if (entry.kind === "note") {
    return (
      <p className="text-[15px] leading-6 text-on-surface-variant">
        <MathText content={entry.text} />
      </p>
    );
  }

  if (entry.kind === "milestone") {
    // The one thing on the record that reads as a block rather than a line:
    // the same panel the approved sheet closes on, verified Check included
    // (#204: a phase the learner worked through should not be printed as
    // spare text between answers).
    return (
      <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-4">
        <p className="flex items-start gap-2.5 text-[15px] leading-6 text-on-surface">
          <Check className="mt-0.5 size-4 shrink-0 text-tertiary" aria-hidden />
          <MathText content={entry.text} />
        </p>
      </div>
    );
  }

  if (entry.kind === "answer") {
    return (
      <div className="border-t border-outline-variant pt-1">
        {entry.asked !== null && (
          <p className="text-[15px] leading-6 text-on-surface-variant">
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
        <p className="text-[15px] leading-6 text-on-surface-variant">
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
  // A superseded plan keeps the same numbered list — the learner reads what
  // the change changed — but drops to the pencil tone: on this sheet tone is
  // what states which plan is the one being approved (#223).
  const planTone = entry.superseded
    ? "text-on-surface-variant"
    : "text-on-surface";
  return (
    <div className="border-t border-outline-variant pt-1">
      {entry.superseded && <FieldLabel>{earlierPlan}</FieldLabel>}
      <h3 className={cn("text-[15px] font-semibold leading-6", planTone)}>
        <MathText content={plan.prose_summary} />
      </h3>
      <ol className="mt-3 flex flex-col gap-3">
        {plan.steps.map((step, index) => (
          <li key={step.id} className="flex gap-3">
            <span className="w-5 shrink-0 text-right text-[15px] font-semibold text-on-surface-variant [font-variant-numeric:tabular-nums]">
              {index + 1}.
            </span>
            <div className="min-w-0">
              <p className={cn("text-[15px] font-semibold leading-6", planTone)}>
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
