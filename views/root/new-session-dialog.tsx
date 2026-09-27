"use client";

import {
  Check,
  History,
  Loader2,
  PartyPopper,
  Send,
  Sparkles,
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
 * The new-session popup over the History (#26), per
 * `design/home/new_session/code.html`: a header, a read-only "Recent
 * Messages" preview, an intake textarea, and a footer that adapts to the
 * Clarify loop, the probe loop (probe questions render as lettered option
 * lists inside the message bubbles; the learner answers by clicking an
 * option), and the plan review step (the generated plan renders as a
 * highlighted bubble with its lettered steps; the learner adjusts it with
 * free text or types `approve` to approve it).
 *
 * Pure presentation: the intake core derives every decision (which request
 * is in flight, which bubble is answerable, what the footer shows) and the
 * dialog renders render-ready bubbles and wires the controls to the binding's
 * intents (`submit`, `pickOption`, `close`, `confirm`).
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
   * list item is preceded by a big dot marker.
   */
  function renderBody(text: string | string[]) {
    const lines = Array.isArray(text) ? text : [text];
    return lines.length > 1 ? (
      <ul className="space-y-1.5">
        {lines.map((line, i) => (
          <li key={i} className="flex items-start gap-2">
            <span
              aria-hidden
              className="mt-1 size-2 shrink-0 rounded-full bg-primary"
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
        className="w-full max-w-4xl max-h-[98vh] flex-col gap-0 overflow-hidden border-outline-variant bg-surface-container p-0 text-on-surface sm:max-w-4xl"
      >
        <form onSubmit={handleSubmit} className="flex w-full flex-col">
          {/* Header — title on the left, close on the right. */}
          <div className="flex items-center justify-between gap-4 px-6 py-5">
            <DialogTitle className="text-left font-display text-2xl font-semibold text-on-surface">
              {view.onTheWay ? t("railCounterGenerating") : t("title")}
            </DialogTitle>
            <div className="flex items-center gap-3">
              <DialogClose asChild>
                <button
                  type="button"
                  aria-label={t("close")}
                  disabled={view.pending}
                  className="flex size-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-bright hover:text-on-surface disabled:pointer-events-none disabled:opacity-50"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </DialogClose>
            </div>
          </div>

          {/* Progress rail — four steps, kept at the final "on the way"
              stage (the Generating step is active). */}
          <ProgressRail rail={view.rail} />

          {/* Body — Recent Messages preview + the intake textarea. In the
              final "on the way" stage the card below replaces the whole
              intake UI. */}
          <div className="flex flex-col gap-5 p-6">
            {view.onTheWay ? (
              /* Final stage: the encouraging icon replaces the intake UI —
                 the header carries the "on the way" title. */
              <div className="flex flex-1 flex-col items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-center">
                  <PartyPopper className="size-16 text-primary" aria-hidden />
                  <p className="text-sm text-on-surface-variant">
                    {t("onTheWaySubline")}
                  </p>
                </div>
              </div>
            ) : (
            <>
            {view.bubbles.length > 0 && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-mono text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                    <History className="size-4 text-primary" aria-hidden />
                    {t("recentMessages")}
                  </span>
                  <span className="font-mono text-xs text-on-surface-variant/70">
                    {t("messages", { n: view.bubbles.length })}
                  </span>
                </div>

                <div
                  ref={messagesPanelRef}
                  className="flex max-h-[40rem] flex-col gap-3 overflow-y-auto rounded-xl border border-outline-variant/30 bg-surface-container-lowest/50 p-3 pr-2"
                >
                  {view.bubbles.map((bubble, index) => {
                    if (bubble.kind === "text" && bubble.from === "you") {
                      return (
                        <div key={index} className="flex flex-col items-end gap-1">
                          <span className="font-mono text-xs font-medium text-secondary">
                            {t("you")}
                          </span>
                          <div className="max-w-[85%] whitespace-pre-line rounded-xl rounded-tr-sm border border-outline-variant/30 bg-secondary-container px-3.5 py-2 text-sm text-on-surface">
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
                        <span className="flex items-center gap-1 font-mono text-xs font-medium text-primary">
                          <Sparkles className="size-3.5 text-primary" aria-hidden />
                          {t("lumina")}
                        </span>
                        <div
                          className={cn(
                            "max-w-[85%] whitespace-pre-line rounded-xl rounded-tl-sm border px-3.5 py-2.5 text-sm text-on-surface",
                            bubble.kind === "text" && bubble.from === "ai" && bubble.highlighted
                              ? "border-primary/40 bg-primary/10"
                              : "border-outline-variant/40 bg-surface-bright",
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
                              <span className="font-semibold text-primary">
                                <MathText content={bubble.plan.prose_summary} />
                              </span>
                              {planSteps(bubble.plan)}
                            </>
                          ) : (
                            bubble.highlighted ? (
                              <span className="font-semibold text-primary">
                                {renderBody(highlightedText ?? "")}
                              </span>
                            ) : (
                              renderBody(highlightedText ?? "")
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

              <div>
                {view.showPending ? (
                  <div
                    role="status"
                    aria-live="polite"
                    aria-label={view.pendingNote}
                    className="flex items-start gap-3 rounded-xl border border-outline-variant/40 bg-surface-bright p-4 text-sm text-on-surface-variant"
                  >
                    <Loader2
                      className="mt-0.5 size-4 shrink-0 animate-spin text-primary"
                      aria-hidden
                    />
                    <p>{view.pendingNote}</p>
                  </div>
                ) : (
                  <>
                    <label
                      htmlFor="learning-goal"
                      className="mb-2 block text-base font-medium text-on-surface"
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
                        className="w-full resize-none rounded-xl border border-outline-variant/40 bg-surface-bright p-4 text-base text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/50 focus:border-primary disabled:bg-surface-container-low disabled:opacity-60"
                      />
                    </div>
                  </>
                )}
                {view.error !== null && (
                  <p className="mt-2 text-sm text-error" aria-live="polite">
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
          <div className="flex justify-end gap-3 border-t border-outline-variant/50 bg-surface-container-low px-6 py-4">
            {view.onTheWay ? (
              <Button
                type="button"
                onClick={close}
                className="gap-2 px-6 py-2.5 text-on-primary-container hover:bg-primary-fixed hover:text-on-primary-container"
              >
                <History className="size-4" aria-hidden />
                {t("backToSessions")}
              </Button>
            ) : view.confirming ? (
              <Button
                type="button"
                onClick={confirm}
                className={cn(
                  "gap-2 px-6 py-2.5 text-on-primary-container hover:bg-primary-fixed hover:text-on-primary-container",
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
                  className="h-auto border border-transparent px-4 py-2 text-on-surface-variant hover:border-outline-variant hover:bg-surface-bright hover:text-on-surface"
                >
                  {t("cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={view.pending || probeCardActive}
                  className={cn(
                    "gap-2 px-6 py-2.5 text-on-primary-container hover:bg-primary-fixed hover:text-on-primary-container",
                  )}
                >
                  <Send className={cn("transition-transform", !view.pending && "group-hover:translate-x-0.5")} aria-hidden />
                  {view.pending ? t("sending") : t("send")}
                </Button>
              </>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The plan's lettered steps with dependency notes. */
function planSteps(plan: PlanBody) {
  return (
    <ul className="mt-2.5 space-y-1.5">
      {plan.steps.map((step) => (
        <li key={step.id} className="flex items-start gap-2">
          <span
            aria-hidden
            className="mt-0.5 font-mono text-xs font-semibold text-primary"
          >
            {step.letter}.
          </span>
          <span>
            {step.title} — {step.description}
            {step.depends_on.length > 0 &&
              ` · builds on: ${step.depends_on
                .map((id) => plan.steps.find((s) => s.id === id)?.title ?? id)
                .join(", ")}`}
          </span>
        </li>
      ))}
    </ul>
  );
}
