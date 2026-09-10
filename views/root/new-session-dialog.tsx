"use client";

import { useState } from "react";
import {
  Check,
  History,
  MessageSquareText,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  ApiError,
  clarifySession,
  createSession,
  type Phase,
} from "@/lib/api-client";

/** One turn of the conversation shown above the intake box. */
export type RecentMessage = {
  role: "you" | "ai";
  /**
   * The turn's body. A single string renders as one line; an array with more
   * than one entry renders as a list (e.g. the AI's clarifying questions).
   */
  text: string | string[];
};

type Status = "idle" | "pending" | "error";

/**
 * The new-session popup over the History (#26), per
 * `design/home/new_session/code.html`: a header, a read-only "Recent
 * Messages" preview, an intake textarea, and a footer that adapts to the
 * Clarify loop.
 *
 * The first submit calls `createSession` (`POST /sessions`) and stores the
 * returned `session_id`; while the backend stays in `clarifying`, each
 * further submit calls `clarifySession(session_id, answer)` and both turns
 * are appended to the Recent Messages preview (the questions render as a
 * list when there is more than one) with the textarea cleared. When the
 * phase advances past `clarifying` (e.g. `probing`, or a later lifecycle
 * stage), the dialog enters a confirm step: the learner's answer — and the
 * AI's narrowed goal, when present — are recorded, the textarea is hidden,
 * and the footer offers a single **Confirm** button that calls `onAccept`
 * (so the parent refetches the History) and closes. Errors keep the modal
 * open with the text preserved and an inline message.
 */
export function NewSessionDialog({
  open,
  onOpenChange,
  onAccept,
  recentMessages = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after an accepted intake — the parent should refetch the History. */
  onAccept: () => void;
  /**
   * The initial conversation previewed above the intake box. Defaults to
   * empty, which hides the section; each clarifying round appends the
   * learner's input and the AI's questions to it.
   */
  recentMessages?: RecentMessage[];
}) {
  const [paragraph, setParagraph] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  // Seeded from the prop; grows as the intake conversation unfolds.
  const [messages, setMessages] = useState<RecentMessage[]>(recentMessages);
  // The session id from the first result; null until the session is created.
  const [sessionId, setSessionId] = useState<string | null>(null);
  // The backend phase after the latest result; null until then.
  const [phase, setPhase] = useState<Phase | null>(null);

  const pending = status === "pending";
  // A non-clarifying phase means intake is done — show the confirm step.
  const confirming = phase !== null && phase !== "clarifying";

  /**
   * The bubble body: a single line, or a list when there is more than one
   * (the AI's clarifying questions).
   */
  function renderBody(text: string | string[]) {
    const lines = Array.isArray(text) ? text : [text];
    return lines.length > 1 ? (
      <ul className="ml-4 list-disc space-y-1">
        {lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    ) : (
      <>{lines[0]}</>
    );
  }

  /** Close the dialog, always leaving it pristine for the next opening. */
  function close() {
    setParagraph("");
    setStatus("idle");
    setMessage(null);
    setMessages(recentMessages);
    setSessionId(null);
    setPhase(null);
    onOpenChange(false);
  }

  /** The confirm step's single button: hand off, then close. */
  function handleConfirm() {
    onAccept();
    close();
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      onOpenChange(true);
    } else if (!pending) {
      // Don't dismiss mid-request — a submit is still in flight.
      close();
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending || confirming) return;
    setStatus("pending");
    setMessage(null);
    try {
      // The first submit creates the session; later submits while the backend
      // is still clarifying resume the Clarify loop against that session.
      const result = sessionId
        ? await clarifySession(sessionId, paragraph)
        : await createSession(paragraph);
      setSessionId(result.session_id);
      if (result.phase === "clarifying") {
        // The backend wants to probe further: keep the modal open, record
        // both turns in the Recent Messages preview (the questions live there
        // only — not as an inline error — and render as a list when there is
        // more than one), and clear the textarea (the answer is in history).
        const questions = result.clarifying_questions?.length
          ? result.clarifying_questions
          : ["That's a bit thin — add a little more detail."];
        // Back to idle so the Send/Cancel buttons re-enable for the next turn.
        setStatus("idle");
        setPhase("clarifying");
        setParagraph("");
        setMessages((prev) => [
          ...prev,
          { role: "you", text: paragraph },
          { role: "ai", text: questions },
        ]);
      } else {
        // The goal is narrowed (or the session is already progressing) —
        // enter the confirm step: record the turn (plus the narrowed goal,
        // when present), hide the textarea, and wait for the Confirm click.
        const additions: RecentMessage[] = [{ role: "you", text: paragraph }];
        if (result.narrowed_goal) {
          additions.push({
            role: "ai",
            text: `Your narrowed goal is: ${result.narrowed_goal}`,
          });
        }
        setStatus("idle");
        setPhase(result.phase);
        setMessages((prev) => [...prev, ...additions]);
      }
    } catch (err) {
      setStatus("error");
      setMessage(
        err instanceof ApiError
          ? err.message
          : "Something went wrong starting your session. Please try again.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-full max-w-2xl max-h-[90vh] flex-col gap-0 overflow-hidden border-outline-variant bg-surface-container p-0 text-on-surface sm:max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="flex w-full flex-col">
          {/* Header — icon tile + title on the left, close at the right. */}
          <div className="flex items-center justify-between gap-4 border-b border-outline-variant/50 bg-surface-container-low px-6 py-5">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                <MessageSquareText className="size-5" aria-hidden />
              </span>
              <DialogTitle className="text-left font-display text-2xl font-semibold text-on-surface">
                Start New Session
              </DialogTitle>
            </div>
            <DialogClose asChild>
              <button
                type="button"
                aria-label="Close"
                disabled={pending}
                className="flex size-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-bright hover:text-on-surface disabled:pointer-events-none disabled:opacity-50"
              >
                <X className="size-5" aria-hidden />
              </button>
            </DialogClose>
          </div>

          {/* Body — Recent Messages preview + the intake textarea. */}
          <div className="flex flex-col gap-5 p-6">
            {messages.length > 0 && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-mono text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                    <History className="size-4 text-primary" aria-hidden />
                    Recent Messages
                  </span>
                  <span className="font-mono text-xs text-on-surface-variant/70">
                    {messages.length}{" "}
                    {messages.length === 1 ? "message" : "messages"}
                  </span>
                </div>

                <div className="flex max-h-80 flex-col gap-3 overflow-y-auto rounded-xl border border-outline-variant/30 bg-surface-container-lowest/50 p-3 pr-2">
                  {messages.map((entry, index) =>
                    entry.role === "you" ? (
                      <div key={index} className="flex flex-col items-end gap-1">
                        <span className="font-mono text-xs font-medium text-secondary">
                          You
                        </span>
                        <div className="max-w-[85%] rounded-xl rounded-tr-sm border border-outline-variant/30 bg-secondary-container px-3.5 py-2 text-sm text-on-surface">
                          {renderBody(entry.text)}
                        </div>
                      </div>
                    ) : (
                      <div key={index} className="flex flex-col items-start gap-1">
                        <span className="flex items-center gap-1 font-mono text-xs font-medium text-primary">
                          <Sparkles className="size-3.5 text-primary" aria-hidden />
                          Lumina AI
                        </span>
                        <div className="max-w-[85%] rounded-xl rounded-tl-sm border border-outline-variant/40 bg-surface-bright px-3.5 py-2.5 text-sm text-on-surface">
                          {renderBody(entry.text)}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}

            {!confirming && (
              <div>
                <label
                  htmlFor="learning-goal"
                  className="mb-2 block text-base font-medium text-on-surface"
                >
                  What would you like to explore or learn?
                </label>
                <div className="relative">
                  <textarea
                    id="learning-goal"
                    rows={3}
                    value={paragraph}
                    onChange={(e) => setParagraph(e.target.value)}
                    disabled={pending}
                    placeholder="Continue the discussion or describe the next query..."
                    className="w-full resize-none rounded-xl border border-outline-variant/40 bg-surface-bright p-4 text-base text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/50 focus:border-primary disabled:opacity-60"
                  />
                </div>
                {status === "error" && (
                  <p className="mt-2 text-sm text-error" aria-live="polite">
                    {message}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Footer — Cancel + Send, or a single Confirm in the confirm step. */}
          <div className="flex justify-end gap-3 border-t border-outline-variant/50 bg-surface-container-low px-6 py-4">
            {confirming ? (
              <Button
                type="button"
                onClick={handleConfirm}
                className={cn(
                  "gap-2 px-6 py-2.5 text-on-primary-container hover:bg-primary-fixed hover:text-on-primary-container",
                )}
              >
                <Check className="size-4" aria-hidden />
                Confirm
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
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={pending}
                  className={cn(
                    "gap-2 px-6 py-2.5 text-on-primary-container hover:bg-primary-fixed hover:text-on-primary-container",
                  )}
                >
                  <Send className={cn("transition-transform", !pending && "group-hover:translate-x-0.5")} aria-hidden />
                  {pending ? "Sending…" : "Send"}
                </Button>
              </>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
