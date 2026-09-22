"use client";

import {
  Check,
  History,
  Loader2,
  MessageSquareText,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { PhaseIndicator } from "@/components/phase-indicator";
import { MathText } from "@/components/math-text";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { QuizQuestion } from "@/components/session/quiz-question";
import { toCardQuestion } from "@/views/root/hooks";
import {
  useNewSession,
  type RecentMessage,
} from "./use-new-session";

export type { RecentMessage };

/**
 * The new-session popup over the History (#26), per
 * `design/home/new_session/code.html`: a header, a read-only "Recent
 * Messages" preview, an intake textarea, and a footer that adapts to the
 * Clarify loop, the probe loop (probe questions render as lettered option
 * lists inside the message bubbles; the learner answers by typing the
 * option's letter), and the plan review step (the generated plan renders as
 * a highlighted bubble with its numbered steps; the learner adjusts it with
 * free text or types `approve` to approve it).
 *
 * The probe loop renders its questions as the shared QuizQuestion card
 * inside the message bubbles: clicking an option answers (no confirm
 * step) — the card locks and reveals in place (#113). The textarea and
 * Send stay visible but disabled while a probe card is active.
 *
 * All state and business logic lives in `useNewSession`
 * (`./use-new-session.ts`); this component is purely presentational — it
 * renders the header, message bubbles, intake box, and footer, and wires
 * the Send/Cancel/Confirm actions to the hook.
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
    status,
    message,
    messages,
    pending,
    phase,
    probing,
    probeQuestion,
    reviewing,
    awaitingPlan,
    confirming,
    messagesPanelRef,
    attachTextarea,
    submit,
    selectProbeOption,
    close,
    confirm,
    handleOpenChange,
  } = useNewSession({ open, onAccept, onOpenChange });

  /**
   * The note shown in place of the intake box while a request is in flight
   * or the plan is still being generated — one or two sentences explaining
   * what is happening.
   */
  function pendingNote(): string {
    if (awaitingPlan) return t("pendingPlan");
    if (reviewing) return t("pendingReview");
    if (probing) {
      return probeQuestion ? t("pendingProbeAnswer") : t("pendingProbeGenerate");
    }
    if (phase === "clarifying") return t("pendingClarify");
    return t("pendingDefault");
  }

  /**
   * The bubble body: a single line, or a list when there is more than one
   * (the AI's clarifying questions, or a learner's multi-line answer). Each
   * list item is preceded by a big dot marker.
   */
  function renderBody(text: string | string[] | undefined) {
    const lines = Array.isArray(text) ? text : [text ?? ""];
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
    void submit();
  }

  /**
   * While a probe card is active, the learner answers by clicking an
   * option, so the textarea and Send stay visible but disabled.
   */
  const probeCardActive = probing && probeQuestion !== null;

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        // Opt out of Radix's open auto-focus (it targets the close button);
        // useNewSession owns focus and puts it in the textarea when enabled.
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="w-full max-w-3xl max-h-[95vh] flex-col gap-0 overflow-hidden border-outline-variant bg-surface-container p-0 text-on-surface sm:max-w-3xl"
      >
        <form onSubmit={handleSubmit} className="flex w-full flex-col">
          {/* Header — icon tile + title on the left, phase indicator + close on the right. */}
          <div className="flex items-center justify-between gap-4 border-b border-outline-variant/50 bg-surface-container-low px-6 py-5">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                <MessageSquareText className="size-5" aria-hidden />
              </span>
              <DialogTitle className="text-left font-display text-2xl font-semibold text-on-surface">
                {t("title")}
              </DialogTitle>
            </div>
            <div className="flex items-center gap-3">
              <PhaseIndicator phase={phase} pending={pending} />
              <DialogClose asChild>
                <button
                  type="button"
                  aria-label={t("close")}
                  disabled={pending}
                  className="flex size-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-bright hover:text-on-surface disabled:pointer-events-none disabled:opacity-50"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </DialogClose>
            </div>
          </div>

          {/* Body — Recent Messages preview + the intake textarea. */}
          <div className="flex flex-col gap-5 p-6">
            {messages.length > 0 && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-mono text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                    <History className="size-4 text-primary" aria-hidden />
                    {t("recentMessages")}
                  </span>
                  <span className="font-mono text-xs text-on-surface-variant/70">
                    {t("messages", { n: messages.length })}
                  </span>
                </div>

                <div
                  ref={messagesPanelRef}
                  className="flex max-h-[40rem] flex-col gap-3 overflow-y-auto rounded-xl border border-outline-variant/30 bg-surface-container-lowest/50 p-3 pr-2"
                >
                  {messages.map((entry, index) => {
                    if (entry.role === "you") {
                      return (
                        <div key={index} className="flex flex-col items-end gap-1">
                          <span className="font-mono text-xs font-medium text-secondary">
                            {t("you")}
                          </span>
                          <div className="max-w-[85%] whitespace-pre-line rounded-xl rounded-tr-sm border border-outline-variant/30 bg-secondary-container px-3.5 py-2 text-sm text-on-surface">
                            {renderBody(entry.text)}
                          </div>
                        </div>
                      );
                    }
                    const plan = entry.plan;
                    return (
                      <div key={index} className="flex flex-col items-start gap-1">
                        <span className="flex items-center gap-1 font-mono text-xs font-medium text-primary">
                          <Sparkles className="size-3.5 text-primary" aria-hidden />
                          {t("lumina")}
                        </span>
                        <div
                          className={cn(
                            "max-w-[85%] whitespace-pre-line rounded-xl rounded-tl-sm border px-3.5 py-2.5 text-sm text-on-surface",
                            entry.highlighted
                              ? "border-primary/40 bg-primary/10"
                              : "border-outline-variant/40 bg-surface-bright",
                          )}
                        >
                          {entry.probe ? (
                            <QuizQuestion
                              question={toCardQuestion(entry.probe)}
                              selected={entry.probeSelected ?? null}
                              onSelect={
                                entry.probe === probeQuestion &&
                                !pending
                                  ? (index) => void selectProbeOption(index)
                                  : undefined
                              }
                            />
                          ) : entry.highlighted ? (
                            <span className="font-semibold text-primary">
                              {renderBody(entry.text)}
                            </span>
                          ) : (
                            renderBody(entry.text)
                          )}
                          {plan && (
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
                                        .map(
                                          (id) =>
                                            plan.steps.find(
                                              (s) => s.id === id,
                                            )?.title ?? id,
                                        )
                                        .join(", ")}`}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!confirming && (
              <div>
                {pending || awaitingPlan ? (
                  <div
                    role="status"
                    aria-live="polite"
                    aria-label={pendingNote()}
                    className="flex items-start gap-3 rounded-xl border border-outline-variant/40 bg-surface-bright p-4 text-sm text-on-surface-variant"
                  >
                    <Loader2
                      className="mt-0.5 size-4 shrink-0 animate-spin text-primary"
                      aria-hidden
                    />
                    <p>{pendingNote()}</p>
                  </div>
                ) : (
                  <>
                    <label
                      htmlFor="learning-goal"
                      className="mb-2 block text-base font-medium text-on-surface"
                    >
                      {probing
                        ? t("labelProbe")
                        : reviewing
                          ? t("labelReview")
                          : t("labelClarify")}
                    </label>
                    <div className="relative">
                      <textarea
                        id="learning-goal"
                        ref={attachTextarea}
                        rows={3}
                        value={paragraph}
                        onChange={(e) => setParagraph(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={
                          reviewing
                            ? t("placeholderReview")
                            : t("placeholderDefault")
                        }
                        disabled={probeCardActive}
                        className="w-full resize-none rounded-xl border border-outline-variant/40 bg-surface-bright p-4 text-base text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/50 focus:border-primary disabled:bg-surface-container-low disabled:opacity-60"
                      />
                    </div>
                  </>
                )}
                {status === "error" && (
                  <p className="mt-2 text-sm text-error" aria-live="polite">
                    {message ?? t("errorFallback")}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Footer — Cancel + Send, or a single Confirm in the legacy
              confirm step (the review step sends its adjustments and the
              `approve` command through the same Send path). */}
          <div className="flex justify-end gap-3 border-t border-outline-variant/50 bg-surface-container-low px-6 py-4">
            {confirming ? (
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
                  disabled={pending}
                  onClick={close}
                  className="h-auto border border-transparent px-4 py-2 text-on-surface-variant hover:border-outline-variant hover:bg-surface-bright hover:text-on-surface"
                >
                  {t("cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={pending || probeCardActive}
                  className={cn(
                    "gap-2 px-6 py-2.5 text-on-primary-container hover:bg-primary-fixed hover:text-on-primary-container",
                  )}
                >
                  <Send className={cn("transition-transform", !pending && "group-hover:translate-x-0.5")} aria-hidden />
                  {pending ? t("sending") : t("send")}
                </Button>
              </>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
