import { useEffect, useRef, useState } from "react";
import {
  ApiError,
  type Phase,
  type PlanBody,
  type PlanOut,
  type ProbeQuestionOut,
} from "@/lib/api-client";
import {
  useClarifyPhase,
  useConfirmPhase,
  usePlanPhase,
  useProbePhase,
  type PhaseContext,
  type Status,
} from "./hooks";

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
   * Probe-question options rendered as a numbered list under the bubble
   * body (the active question the learner must answer by typing its
   * option's number).
   */
  options?: string[];
  /**
   * Marks the AI's narrowed-goal and probe-completion turns so they stand
   * out against the other bubbles.
   */
  highlighted?: boolean;
  /**
   * When set, the bubble is a plan bubble: `text` carries the plan's prose
   * summary and the bubble renders the plan's numbered steps (with inline
   * "builds on" notes for dependencies) beneath it.
   */
  plan?: PlanBody;
};

/**
 * All the state and orchestration behind the new-session intake dialog.
 *
 * The hook is split into four **phase hooks** (see `./phases/`):
 * - `useClarifyPhase` — session creation + clarifying loop
 * - `useProbePhase` — the probe question loop
 * - `usePlanPhase` — plan generation, adjustment, and approval
 * - `useConfirmPhase` — the legacy confirm step
 *
 * This orchestrator owns all shared state, defines the cross-phase record
 * functions, builds the `PhaseContext`, and routes each submit to the
 * active phase. The public API is unchanged from the original monolithic
 * hook.
 */
export function useNewSession({
  open,
  onAccept,
  onOpenChange,
  recentMessages = [],
}: {
  /** Whether the dialog is open. */
  open: boolean;
  /** Called after an accepted intake — the parent should refetch the History. */
  onAccept: () => void;
  /** Propagates the dialog's open/closed state to the parent. */
  onOpenChange: (open: boolean) => void;
  /** The initial conversation previewed above the intake box. */
  recentMessages?: RecentMessage[];
}) {
  // ── Shared state ─────────────────────────────────────────────────────────
  const [paragraph, setParagraph] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [messages, setMessages] = useState<RecentMessage[]>(recentMessages);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase | null>(null);
  const [probeQuestion, setProbeQuestion] =
    useState<ProbeQuestionOut | null>(null);
  const [probeCount, setProbeCount] = useState(0);
  const [plan, setPlan] = useState<PlanBody | null>(null);

  // ── Derived booleans ─────────────────────────────────────────────────────
  const pending = status === "pending";
  const probing = phase === "probing";
  const reviewing = plan !== null;
  const awaitingPlan =
    sessionId !== null &&
    plan === null &&
    (phase === "planning" || phase === "reviewing");
  const confirming =
    phase === "generating" || phase === "executing" || phase === "complete";

  // ── Refs ─────────────────────────────────────────────────────────────────
  const messagesPanelRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [textareaMounted, setTextareaMounted] = useState(false);

  function attachTextarea(element: HTMLTextAreaElement | null) {
    textareaRef.current = element;
    setTextareaMounted(element !== null);
  }

  // ── Effects ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const panel = messagesPanelRef.current;
    if (panel) panel.scrollTop = panel.scrollHeight;
  }, [messages.length]);

  useEffect(() => {
    if (
      open &&
      textareaMounted &&
      !pending &&
      !confirming &&
      !awaitingPlan
    ) {
      textareaRef.current?.focus({ preventScroll: true });
    }
  }, [open, textareaMounted, pending, confirming, awaitingPlan]);

  // ── Shared helpers ───────────────────────────────────────────────────────
  function splitAnswer(text: string): string | string[] {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    return lines.length > 1 ? lines : lines[0] ?? text;
  }

  function optionLetter(index: number): string {
    return String.fromCharCode("A".charCodeAt(0) + index - 1);
  }

  // ── Cross-phase record functions ────────────────────────────────────────
  /**
   * Record a freshly served probe question: append its bubble (text +
   * numbered options), track the count, and clear the textarea.
   */
  function recordProbeQuestion(question: ProbeQuestionOut) {
    setStatus("idle");
    setPhase("probing");
    setProbeQuestion(question);
    setProbeCount((count) => count + 1);
    setParagraph("");
    setMessages((prev) => [
      ...prev,
      { role: "ai", text: question.text, options: question.options },
    ]);
  }

  /**
   * Record a generated or adjusted plan: append the highlighted plan bubble
   * (prose summary + structured steps) and move into the review step.
   */
  function recordPlan(result: PlanOut) {
    setStatus("idle");
    setPhase(result.phase);
    setPlan(result.plan);
    setMessages((prev) => [
      ...prev,
      {
        role: "ai",
        text: result.plan.prose_summary,
        highlighted: true,
        plan: result.plan,
      },
    ]);
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────
  /** Close the dialog, always leaving it pristine for the next opening. */
  function close() {
    setParagraph("");
    setStatus("idle");
    setMessage(null);
    setMessages(recentMessages);
    setSessionId(null);
    setPhase(null);
    setProbeQuestion(null);
    setProbeCount(0);
    setPlan(null);
    onOpenChange(false);
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      onOpenChange(true);
    } else if (!pending) {
      close();
    }
  }

  // ── Build the PhaseContext ───────────────────────────────────────────────
  const ctx: PhaseContext = {
    paragraph,
    sessionId,
    phase,
    probeQuestion,
    probeCount,
    plan,
    setParagraph,
    setStatus,
    setMessage,
    setMessages,
    setSessionId,
    setPhase,
    setProbeQuestion,
    setProbeCount,
    setPlan,
    onAccept,
    close,
    splitAnswer,
    optionLetter,
    recordProbeQuestion,
    recordPlan,
  };

  // ── Phase hooks ──────────────────────────────────────────────────────────
  const clarify = useClarifyPhase(ctx);
  const probe = useProbePhase(ctx);
  const planPhase = usePlanPhase(ctx);
  const confirmPhase = useConfirmPhase(ctx);

  // ── Submit routing ───────────────────────────────────────────────────────
  /**
   * The single submit path: the Send button (form submit) and a bare Enter
   * key both funnel here. Shift+Enter is left to the textarea so answers can
   * span multiple lines. Routes to the active phase's handler.
   */
  async function submit() {
    if (pending || confirming) return;
    setStatus("pending");
    setMessage(null);
    try {
      if (reviewing) {
        await planPhase.submit();
        return;
      }
      if (awaitingPlan && sessionId !== null) {
        await planPhase.generate();
        return;
      }
      if (phase === "probing") {
        await probe.submit();
        return;
      }
      // Clarify phase (create or clarify) — may transition into probing
      // or planning internally.
      await clarify.submit();
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
    probing,
    probeQuestion,
    plan,
    reviewing,
    awaitingPlan,
    confirming,
    messagesPanelRef,
    attachTextarea,
    submit,
    close,
    confirm: confirmPhase.confirm,
    handleOpenChange,
  };
}
