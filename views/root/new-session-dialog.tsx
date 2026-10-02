"use client";

import {
  Check,
  History,
  Loader2,
  Send,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ProgressRail } from "@/components/progress-rail";
import { MathText } from "@/components/math-text";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { PlanBody } from "@/lib/api-client";
import { QuizQuestion } from "@/components/session/quiz-question";
import { useSessionIntake } from "./use-session-intake";

/**
 * The new-session intake sheet over the History (#26): a full-screen
 * printed form — a masthead, the progress rail as a row of answer bubbles,
 * the transcript of the conversation (the learner's entries marked with a
 * print-ink margin rule, Lumina's with a pencil rule, the narrowed goal
 * highlighted with a marker wash), and a footer that adapts to the Clarify
 * loop, the probe loop (probe questions render as lettered option boxes
 * inside the transcript; the learner answers by clicking an option), and the
 * plan review step (the generated plan renders as a boxed answer key with
 * its lettered steps; the learner adjusts it with free text or types
 * `approve` to approve it). Approving stamps the sheet.
 *
 * Pure presentation: the intake core derives every decision (which request
 * is in flight, which bubble is answerable, what the footer shows) and the
 * dialog renders render-ready bubbles and wires the controls to the
 * binding's intents (`submit`, `pickOption`, `close`, `confirm`).
 */
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
  const {
    paragraph,
    setParagraph,
    view,
    submit,
    pickOption,
    close,
    confirm,
    handleOpenChange,
    messagesPanelRef,
    attachTextarea,
  } = useSessionIntake({ open, onAccept, onOpenChange });

  /**
   * The bubble body: a single line, or a list when there is more than one
   * (the AI's clarifying questions, or a learner's multi-line answer). Each
   * list item is marked like a lettered line on a form.
   */
  function renderBody(text: string | string[]) {
    const lines = Array.isArray(text) ? text : [text];
    return lines.length > 1 ? (
      <ul className="space-y-1.5">
        {lines.map((line, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span
              aria-hidden
              className="mt-[0.45rem] size-1.5 shrink-0 rotate-45 bg-current"
            />
            <span>
              <MathText content={line} />
            </span>
          </li>
        ))}
      </ul>
    ) : (
      <MathText content={lines[0]} />
    );
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    void submit(paragraph);
  }

  /** While a probe card is active, the learner answers by clicking an
   *  option, so the textarea and Send stay visible but disabled. */
  const probeCardActive = view.intake.disabled;

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit(paragraph);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        // Opt out of Radix's open auto-focus (it targets the close button);
        // the binding owns focus and puts it in the textarea when enabled.
        onOpenAutoFocus={(event) => event.preventDefault()}
        // Full-screen: override the centered, max-width default content
        // (`fixed top-1/2 left-1/2 -translate-* max-w-*`) with inset + full
        // dimensions so the sheet fills the viewport.
        className="inset-0 flex-col gap-0 h-full w-full max-h-none max-w-none sm:max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-none border-0 bg-surface p-0 text-on-surface"
      >
        <form onSubmit={handleSubmit} className="flex w-full flex-col">
          {/* Masthead — title on the left, close on the right; closed with
              the printed double rule. */}
          <div className="flex items-center justify-between gap-4 px-6 py-4 double-rule-b">
            <DialogTitle className="text-left font-display text-xl font-bold uppercase tracking-[0.06em] text-on-surface">
              {view.onTheWay ? t("railCounterGenerating") : t("title")}
            </DialogTitle>
            <div className="flex items-center gap-3">
              <DialogClose asChild>
                <button
                  type="button"
                  aria-label={t("close")}
                  disabled={view.pending}
                  className="focus-ring flex size-8 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-accent hover:text-on-surface disabled:pointer-events-none disabled:opacity-50"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </DialogClose>
            </div>
          </div>

          {/* Progress rail — four bubbles, kept at the final "on the way"
              stage (the Generating step is active). */}
          <ProgressRail rail={view.rail} />

          {/* Body — the transcript + the intake textarea. In the final "on
              the way" stage the stamp replaces the whole intake UI.
              Constrained to a reading width and centered so the content
              doesn't span the full screen; flex-1 pushes the footer to the
              bottom. */}
          <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-5 p-6">
            {view.onTheWay ? (
              /* Final stage: the pressed APPROVED stamp replaces the intake
                 UI — the masthead carries the "on the way" title. */
              <div className="flex flex-1 flex-col items-center justify-center">
                <div className="flex flex-col items-center gap-5 text-center">
                  <span
                    aria-hidden
                    className="animate-stamp-press flex size-24 -rotate-3 items-center justify-center rounded-[5px] border-[2px] border-tertiary text-tertiary shadow-[inset_0_0_0_2px_color-mix(in_oklab,currentColor_35%,transparent)]"
                  >
                    <Check className="size-12" strokeWidth={2.5} />
                  </span>
                  <p className="text-sm text-on-surface-variant">
                    {t("onTheWaySubline")}
                  </p>
                </div>
              </div>
            ) : (
            <>
            {view.bubbles.length > 0 && (
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                    <History className="size-4 text-primary" aria-hidden />
                    {t("recentMessages")}
                  </span>
                  <span className="font-mono text-xs text-on-surface-variant">
                    {t("messages", { n: view.bubbles.length })}
                  </span>
                </div>

                <div
                  ref={messagesPanelRef}
                  className="ruled-paper flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-md border border-outline-variant bg-surface-container-lowest p-3 pr-2"
                >
                  {view.bubbles.map((bubble, index) => {
                    if (bubble.kind === "text" && bubble.from === "you") {
                      return (
                        <div key={index} className="flex flex-col items-end gap-1">
                          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                            {t("you")}
                          </span>
                          {/* The learner's entry: a print-ink margin rule. */}
                          <div className="max-w-[85%] whitespace-pre-line border-l-2 border-primary bg-surface-container-lowest/90 px-3.5 py-2 text-[15px] text-on-surface">
                            {renderBody(bubble.text)}
                          </div>
                        </div>
                      );
                    }
                    const highlightedText =
                      bubble.kind === "text" && bubble.from === "ai"
                        ? bubble.text
                        : null;
                    const isProbe = bubble.kind === "probe";
                    return (
                      <div key={index} className="flex flex-col items-start gap-1">
                        <span className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                          <span aria-hidden className="size-1.5 rotate-45 bg-on-surface-variant" />
                          {t("lumina")}
                        </span>
                        <div
                          className={cn(
                            "max-w-[85%] whitespace-pre-line border-l-2 px-3.5 py-2.5 text-[15px] text-on-surface",
                            bubble.kind === "text" && bubble.from === "ai" && bubble.highlighted
                              // The narrowed goal: a highlighter wash.
                              ? "border-primary bg-[var(--marker)]"
                              : "border-outline-variant bg-surface-container-lowest/90",
                          )}
                        >
                          {isProbe ? (
                            <QuizQuestion
                              question={bubble.card}
                              selected={bubble.state === "answered" ? bubble.picked ?? null : null}
                              revealed={bubble.state === "answered"}
                              onSelect={
                                bubble.state === "active" && !view.pending
                                  ? pickOption
                                  : undefined
                              }
                              shuffled
                              pinUnknown
                            />
                          ) : bubble.kind === "plan" ? (
                            <>
                              <span className="font-semibold text-on-surface">
                                <MathText content={bubble.plan.prose_summary} />
                              </span>
                              {planSteps(bubble.plan)}
                            </>
                          ) : bubble.highlighted ? (
                            <span className="font-semibold">
                              {renderBody(highlightedText ?? "")}
                            </span>
                          ) : (
                            <span className="text-on-surface-variant">
                              {renderBody(highlightedText ?? "")}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

              <div className="mt-auto">
                {view.showPending ? (
                  <div
                    role="status"
                    aria-live="polite"
                    aria-label={view.pendingNote}
                    className="flex items-start gap-3 rounded-md border border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant"
                  >
                    <Loader2
                      className="mt-0.5 size-4 shrink-0 animate-spin text-primary"
                      aria-hidden />
                    <p>{view.pendingNote}</p>
                  </div>
                ) : (
                  <>
                    <label
                      htmlFor="learning-goal"
                      className="mb-2 block font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface"
                    >
                      {view.intake.label}
                    </label>
                    <div className="relative">
                      <textarea
                        id="learning-goal"
                        ref={attachTextarea}
                        rows={3}
                        value={paragraph}
                        onChange={(e) => setParagraph(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={view.intake.placeholder}
                        disabled={probeCardActive}
                        className="w-full resize-none rounded-md border border-primary bg-surface-container-lowest p-4 text-[15px] leading-6 text-on-surface outline-none transition-colors placeholder:text-on-surface-variant focus-visible:ring-2 focus-visible:ring-primary/25 disabled:bg-surface-container-low disabled:opacity-60"
                      />
                    </div>
                  </>
                )}
                {view.error !== null && (
                  <p className="mt-2 font-mono text-xs font-semibold text-error" aria-live="polite">
                    {view.error ?? t("errorFallback")}
                  </p>
                )}
              </div>
            </>
            )}
          </div>

          {/* Footer — Cancel + Send, or a single Confirm in the legacy
              confirm step (the review step sends its adjustments and the
              `approve` command through the same Send path). */}
          <div className="border-t border-outline-variant bg-surface-container-low py-4">
            <div className="mx-auto flex w-full max-w-3xl justify-end gap-3 px-6">
            {view.onTheWay ? (
              <Button
                type="button"
                onClick={close}
                className="gap-2 rounded-[3px] border-2 border-primary px-5 py-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-primary hover:bg-primary hover:text-primary-foreground"
              >
                <History className="size-4" aria-hidden />
                {t("backToSessions")}
              </Button>
            ) : view.confirming ? (
              <Button
                type="button"
                onClick={confirm}
                className={cn(
                  "gap-2 rounded-md bg-tertiary px-5 py-2.5 font-semibold text-on-tertiary hover:bg-tertiary-container hover:text-on-tertiary-container",
                )}
              >
                <Check className="size-4" aria-hidden />
                {t("confirm")}
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={view.pending}
                  onClick={close}
                  className="h-auto rounded-md border border-transparent px-4 py-2 text-on-surface-variant hover:border-outline-variant hover:bg-surface-bright hover:text-on-surface"
                >
                  {t("cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={view.pending || probeCardActive}
                  className={cn(
                    "gap-2 rounded-md bg-primary px-5 py-2.5 font-semibold text-primary-foreground shadow-[var(--shadow-sheet)] hover:-translate-y-px hover:shadow-[var(--shadow-sheet-raised)]",
                  )}
                >
                  <Send className={cn("transition-transform", !view.pending && "group-hover:translate-x-0.5")} aria-hidden />
                  {view.pending ? t("sending") : t("send")}
                </Button>
              </>
            )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The plan's lettered steps, set like an answer key. */
function planSteps(plan: PlanBody) {
  return (
    <ul className="mt-3 flex flex-col divide-y divide-outline-variant/40 border-t border-outline-variant/40">
      {plan.steps.map((step) => (
        <li key={step.id} className="flex items-start gap-2.5 py-2">
          <span
            aria-hidden
            className="mt-0.5 font-mono text-xs font-bold text-engage"
          >
            {step.letter}.
          </span>
          <span className="text-sm">
            {step.title} — {step.description}
            {step.depends_on.length > 0 &&
              <span className="text-on-surface-variant">
                {` · builds on: ${step.depends_on
                  .map((id) => plan.steps.find((s) => s.id === id)?.title ?? id)
                  .join(", ")}`}
              </span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
