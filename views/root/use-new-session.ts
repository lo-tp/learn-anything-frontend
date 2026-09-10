import { useEffect, useRef, useState } from "react";
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
   * than one entry renders as a list (e.g. the AI's clarifying questions, or
   * a learner's multi-line answer split into its lines).
   */
  text: string | string[];
  /**
   * Marks the AI's narrowed-goal turn so the confirm step can highlight it
   * against the other bubbles.
   */
  highlighted?: boolean;
};

type Status = "idle" | "pending" | "error";

/**
 * All the state and business logic behind the new-session intake dialog.
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
 *
 * `messagesPanelRef` is exposed so the component can pin its Recent
 * Messages panel to the bottom whenever a new turn lands. Closing always
 * resets the state so the dialog is pristine on the next opening, and a
 * close mid-request is ignored (a submit is still in flight).
 */
export function useNewSession({
  onAccept,
  onOpenChange,
  recentMessages = [],
}: {
  /** Called after an accepted intake — the parent should refetch the History. */
  onAccept: () => void;
  /** Propagates the dialog's open/closed state to the parent. */
  onOpenChange: (open: boolean) => void;
  /** The initial conversation previewed above the intake box. */
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

  // The scrollable Recent Messages panel — pinned to the bottom as turns land.
  const messagesPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const panel = messagesPanelRef.current;
    if (panel) panel.scrollTop = panel.scrollHeight;
  }, [messages.length]);

  /**
   * Break a learner's answer into its trimmed lines so a multi-line answer
   * (Shift+Enter) renders as a list inside the bubble — the same shape as
   * the AI's clarifying questions.
   */
  function splitAnswer(text: string): string | string[] {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    return lines.length > 1 ? lines : lines[0] ?? text;
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
  function confirm() {
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

  /**
   * The single submit path: the Send button (form submit) and a bare Enter
   * key both funnel here. Shift+Enter is left to the textarea so answers can
   * span multiple lines.
   */
  async function submit() {
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
          { role: "you", text: splitAnswer(paragraph) },
          { role: "ai", text: questions },
        ]);
      } else {
        // The goal is narrowed (or the session is already progressing) —
        // enter the confirm step: record the turn (plus the narrowed goal,
        // when present), hide the textarea, and wait for the Confirm click.
        const additions: RecentMessage[] = [
          { role: "you", text: splitAnswer(paragraph) },
        ];
        if (result.narrowed_goal) {
          additions.push({
            role: "ai",
            text: `Your narrowed goal is: ${result.narrowed_goal}`,
            highlighted: true,
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

  return {
    paragraph,
    setParagraph,
    status,
    message,
    messages,
    pending,
    confirming,
    messagesPanelRef,
    submit,
    close,
    confirm,
    handleOpenChange,
  };
}
