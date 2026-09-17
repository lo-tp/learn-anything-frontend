import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
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
  type ShuffledProbeQuestion,
  type Status,
  withDisplayOrder,
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
   * Probe-question options rendered as a lettered list under the bubble
   * body (the active question the learner must answer by typing its
   * option's letter). Probe questions carry their options in a
   * per-question shuffled display order, so the correct answer is never
   * stuck on one letter (#74).
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
}: {
  /** Whether the dialog is open. */
  open: boolean;
  /** Called after an accepted intake — the parent should refetch the History. */
  onAccept: () => void;
  /** Propagates the dialog's open/closed state to the parent. */
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("dialog");

  // ── Shared state ─────────────────────────────────────────────────────────
  /**
   * The fixed opening prompt that always starts a new-session conversation,
   * asking the learner to describe what they want to learn.
   */
  const openingPrompt: RecentMessage = {
    role: "ai",
    text: t("openingPrompt"),
  };
  const [paragraph, setParagraph] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [messages, setMessages] = useState<RecentMessage[]>([openingPrompt]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase | null>(null);
  const [probeBatch, setProbeBatch] = useState<ShuffledProbeQuestion[] | null>(
    null,
  );
  const [probeAnswers, setProbeAnswers] = useState<number[]>([]);
  const [probeCount, setProbeCount] = useState(0);
  const [plan, setPlan] = useState<PlanBody | null>(null);

  // ── Derived values ───────────────────────────────────────────────────────
  /**
   * The active question the learner must answer next: the first question in
   * the current batch not yet answered, or null while the batch is exhausted
   * (its combined answers are being submitted) or no batch is active.
   */
  const probeQuestion =
    probeBatch && probeAnswers.length < probeBatch.length
      ? probeBatch[probeAnswers.length]
      : null;

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
   * Start a fresh batch of probe questions: surface only its FIRST question
   * (the learner answers the rest of the batch one at a time, locally),
   * reset the collected answers, and clear the textarea. Questions are
   * counted as they are answered, not when the batch is served.
   */
  function recordProbeBatch(questions: ProbeQuestionOut[]) {
    // Each question gets a fresh display order (shuffled option indices),
    // generated once here so it is stable for the rest of the session.
    const batch = withDisplayOrder(questions);
    setStatus("idle");
    setPhase("probing");
    setProbeBatch(batch);
    setProbeAnswers([]);
    setParagraph("");
    setMessages((prev) => [
      ...prev,
      {
        role: "ai",
        text: batch[0].text,
        options: batch[0].order.map((i) => batch[0].options[i]),
      },
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
    setMessages([openingPrompt]);
    setSessionId(null);
    setPhase(null);
    setProbeBatch(null);
    setProbeAnswers([]);
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
    probeBatch,
    probeAnswers,
    probeCount,
    plan,
    setParagraph,
    setStatus,
    setMessage,
    setMessages,
    setSessionId,
    setPhase,
    setProbeBatch,
    setProbeAnswers,
    setProbeCount,
    setPlan,
    onAccept,
    close,
    splitAnswer,
    optionLetter,
    t,
    recordProbeBatch,
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
      // Raw backend errors (`ApiError.message`) pass through untouched;
      // anything else gets the localized generic fallback in the dialog.
      setMessage(err instanceof ApiError ? err.message : null);
    }
  }

  return {
    paragraph,
    setParagraph,
    status,
    message,
    messages,
    pending,
    phase,
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
