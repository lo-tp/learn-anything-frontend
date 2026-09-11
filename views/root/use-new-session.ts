import { useEffect, useRef, useState } from "react";
import {
  ApiError,
  adjustPlan,
  answerProbe,
  approvePlan,
  clarifySession,
  createSession,
  generatePlan,
  startProbe,
  type Phase,
  type PlanBody,
  type PlanOut,
  type ProbeQuestionOut,
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

type Status = "idle" | "pending" | "error";

/**
 * All the state and business logic behind the new-session intake dialog.
 *
 * The first submit calls `createSession` (`POST /sessions`) and stores the
 * returned `session_id`; while the backend stays in `clarifying`, each
 * further submit calls `clarifySession(session_id, answer)` and both turns
 * are appended to the Recent Messages preview (the questions render as a
 * list when there is more than one) with the textarea cleared.
 *
 * When the phase advances to `probing`, the dialog runs the probe loop
 * against the combined `POST /sessions/{id}/probe` endpoint: the first
 * question is fetched automatically (`startProbe`); the learner answers by
 * typing the option's letter (A, B, C, …), which is client-validated and
 * sent as a 0-based `selected_index` (`answerProbe`). Every turn appends the
 * learner's pick, the verdict + explanation, and either the next question
 * or — once the backend returns the `boundary_map` (phase `planning`) — a
 * completion message.
 *
 * Once probing is done (or when the backend skips straight to `planning` /
 * `reviewing`), the dialog auto-calls `generatePlan` and renders the plan as
 * a highlighted plan bubble (prose summary + numbered steps). The review
 * step then offers the learner two actions: adjust the plan with free text
 * — each submit calls `adjustPlan` and appends a regenerated plan bubble
 * (the previous one stays in the history) — or approve it. `approve` calls
 * `approvePlan`, then `onAccept` (so the parent refetches the History), and
 * closes. While a plan is owed (`awaitingPlan`), the intake is disabled and
 * the Send button generates (or retries a failed generation of) the plan.
 *
 * When the backend reports a post-plan phase (`generating` / `executing` /
 * `complete`) at create/clarify time, the dialog instead enters the legacy
 * confirm step: the textarea is hidden and the footer offers a single
 * **Confirm** button that calls `onAccept` and closes. Errors keep the modal
 * open with the text preserved and an inline message.
 *
 * `messagesPanelRef` is exposed so the component can pin its Recent
 * Messages panel to the bottom whenever a new turn lands, and
 * `attachTextarea` so the component can attach the intake textarea — which
 * is focused whenever it is visible and enabled. Closing always resets the
 * state so the dialog is pristine on the next opening, and a close
 * mid-request is ignored (a submit is still in flight).
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
  const [paragraph, setParagraph] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  // Seeded from the prop; grows as the intake conversation unfolds.
  const [messages, setMessages] = useState<RecentMessage[]>(recentMessages);
  // The session id from the first result; null until the session is created.
  const [sessionId, setSessionId] = useState<string | null>(null);
  // The backend phase after the latest result; null until then.
  const [phase, setPhase] = useState<Phase | null>(null);
  // The active probe question; null outside probing (or mid re-fetch).
  const [probeQuestion, setProbeQuestion] = useState<ProbeQuestionOut | null>(
    null,
  );
  // How many probe questions have been served so far.
  const [probeCount, setProbeCount] = useState(0);
  // The latest generated/adjusted plan; null until one arrives.
  const [plan, setPlan] = useState<PlanBody | null>(null);

  const pending = status === "pending";
  // The probe loop is live: one question is owed an answer.
  const probing = phase === "probing";
  // A plan has landed — the learner is adjusting or approving it.
  const reviewing = plan !== null;
  // Probing is done (or was skipped) and no plan has landed yet: generation
  // is owed, or being retried after a failed generation.
  const awaitingPlan =
    sessionId !== null &&
    plan === null &&
    (phase === "planning" || phase === "reviewing");
  // A post-plan phase reported by the backend: the legacy confirm step
  // (the session is already progressing — there is no plan to review).
  const confirming =
    phase === "generating" || phase === "executing" || phase === "complete";

  // The scrollable Recent Messages panel — pinned to the bottom as turns land.
  const messagesPanelRef = useRef<HTMLDivElement | null>(null);
  // The intake textarea, focused whenever it is visible and enabled. The
  // ref callback also tracks whether it is mounted: Radix mounts the dialog
  // content a commit after `open` flips, so the mount-time effect would
  // otherwise run against a null ref and never re-run.
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [textareaMounted, setTextareaMounted] = useState(false);

  function attachTextarea(element: HTMLTextAreaElement | null) {
    textareaRef.current = element;
    setTextareaMounted(element !== null);
  }

  useEffect(() => {
    const panel = messagesPanelRef.current;
    if (panel) panel.scrollTop = panel.scrollHeight;
  }, [messages.length]);

  // Focus the textarea once it is enabled: on open (Radix would otherwise
  // auto-focus the header's close button), and again whenever a pending
  // submit settles (clarifying round, probe turn, plan landing, or error) so
  // the next answer can be typed immediately. Skipped while a plan is being
  // generated (the textarea is disabled) and in the confirm step, where it
  // is hidden.
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

  /** The letter shown for a 1-based option index: A, B, C, … */
  function optionLetter(index: number): string {
    return String.fromCharCode("A".charCodeAt(0) + index - 1);
  }

  /**
   * The 1-based option index for the learner's typed letter (A, B, C, …,
   * matching the letters shown in the question bubble), or null when the
   * text is not a single letter within range.
   */
  function parseOptionIndex(text: string, count: number): number | null {
    const trimmed = text.trim().toUpperCase();
    const index = trimmed.charCodeAt(0) - "A".charCodeAt(0) + 1;
    if (
      trimmed.length !== 1 ||
      index < 1 ||
      index > count
    ) {
      return null;
    }
    return index;
  }

  /**
   * Record a freshly served probe question: append its bubble (text +
   * numbered options), track the count, and clear the textarea for the next
   * answer.
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
   * Record the outcome of an answered probe question: the learner's pick,
   * the verdict + explanation, then either the next question or — when the
   * backend has established the boundary (no next question) — the
   * highlighted completion message.
   */
  function recordProbeResult(
    selected: number,
    result: { phase: Phase; question?: ProbeQuestionOut | null },
  ) {
    const answered = probeQuestion;
    if (!answered) return;
    const isCorrect = selected - 1 === answered.correct_index;
    const feedback = isCorrect
      ? `Correct — option ${optionLetter(selected)} (${answered.options[selected - 1]}). ${answered.explanation}`
      : `Not quite — the correct answer is option ${optionLetter(answered.correct_index + 1)} (${answered.options[answered.correct_index]}). ${answered.explanation}`;
    const additions: RecentMessage[] = [
      { role: "you", text: answered.options[selected - 1] },
      { role: "ai", text: feedback },
    ];
    if (result.question) {
      additions.push({
        role: "ai",
        text: result.question.text,
        options: result.question.options,
      });
      setProbeQuestion(result.question);
      setProbeCount((count) => count + 1);
    } else {
      additions.push({
        role: "ai",
        text: `Boundary established after ${probeCount} question${probeCount === 1 ? "" : "s"}. Your learning plan is ready.`,
        highlighted: true,
      });
      setProbeQuestion(null);
    }
    setStatus("idle");
    setPhase(result.phase);
    setParagraph("");
    setMessages((prev) => [...prev, ...additions]);
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

  /** The confirm step's single button: hand off, then close. */
  function confirm() {
    onAccept();
    close();
  }

  /**
   * The review step's Approve button: approve the plan on the backend, hand
   * off (so the parent refetches the History), and close. A failure keeps
   * the dialog open in the review step with an inline error.
   */
  async function approve() {
    if (pending || sessionId === null) return;
    setStatus("pending");
    setMessage(null);
    try {
      await approvePlan(sessionId);
      onAccept();
      close();
    } catch (err) {
      setStatus("error");
      setMessage(
        err instanceof ApiError
          ? err.message
          : "Something went wrong approving your plan. Please try again.",
      );
    }
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
      // The review step: adjust the plan with free text. An empty
      // adjustment is rejected client-side — no request goes out.
      if (reviewing) {
        const text = paragraph.trim();
        if (text === "") {
          setStatus("error");
          setMessage("Describe how you'd like to adjust the plan.");
          return;
        }
        if (sessionId === null) {
          setStatus("error");
          setMessage(
            "Something went wrong with your session. Please try again.",
          );
          return;
        }
        const result = await adjustPlan(sessionId, text);
        setMessages((prev) => [
          ...prev,
          { role: "you", text: splitAnswer(paragraph) },
          {
            role: "ai",
            text: result.plan.prose_summary,
            highlighted: true,
            plan: result.plan,
          },
        ]);
        setPlan(result.plan);
        setPhase(result.phase);
        setParagraph("");
        setStatus("idle");
        return;
      }

      // The awaiting-plan step: generate (or retry) the plan. Any typed
      // text is ignored — the learner only reviews the generated plan.
      if (awaitingPlan && sessionId !== null) {
        setParagraph("");
        const result = await generatePlan(sessionId);
        recordPlan(result);
        return;
      }

      // The probe loop: retry a failed first fetch, or answer the active
      // question with the typed option number.
      if (phase === "probing") {
        if (sessionId === null) {
          setStatus("error");
          setMessage(
            "Something went wrong starting your session. Please try again.",
          );
          return;
        }
        if (probeQuestion === null) {
          // First fetch (or its retry) — no question is owed an answer yet.
          const result = await startProbe(sessionId);
          if (!result.question) {
            setStatus("error");
            setMessage("No question was received — please try again.");
            return;
          }
          recordProbeQuestion(result.question);
          return;
        }
        const index = parseOptionIndex(
          paragraph,
          probeQuestion.options.length,
        );
        if (index === null) {
          // Client-side validation: the text must name one of the shown
          // options (A, B, C, …). No request goes out.
          setStatus("error");
          setMessage(
            `Enter the letter of your answer (A–${optionLetter(probeQuestion.options.length)}).`,
          );
          return;
        }
        const result = await answerProbe(sessionId, probeQuestion.id, index - 1);
        recordProbeResult(index, result);
        if (!result.question) {
          // The boundary is established — auto-generate the plan and render
          // it as the highlighted plan bubble (instead of the legacy
          // confirm step).
          const generated = await generatePlan(sessionId);
          recordPlan(generated);
        }
        return;
      }

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
      } else if (result.phase === "probing") {
        // The goal is narrowed — start the probe loop: record the turn (plus
        // the narrowed goal, when present) and fetch the first question.
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
        setMessages((prev) => [...prev, ...additions]);
        setParagraph("");
        setPhase("probing");
        const probe = await startProbe(result.session_id);
        if (!probe.question) {
          setStatus("error");
          setMessage("No question was received — please try again.");
          return;
        }
        recordProbeQuestion(probe.question);
      } else if (result.phase === "planning" || result.phase === "reviewing") {
        // The backend skipped probing — record the turn (plus the narrowed
        // goal, when present) and auto-generate the plan (instead of the
        // legacy confirm step).
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
        setMessages((prev) => [...prev, ...additions]);
        setParagraph("");
        setPhase(result.phase);
        const generated = await generatePlan(result.session_id);
        recordPlan(generated);
      } else {
        // The session is already in a post-plan phase — enter the legacy
        // confirm step: record the turn (plus the narrowed goal, when
        // present), hide the textarea, and wait for the Confirm click.
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
    confirm,
    approve,
    handleOpenChange,
  };
}
