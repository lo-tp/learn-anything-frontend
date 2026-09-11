import {
  ApiError,
  adjustPlan,
  approvePlan,
  generatePlan,
} from "@/lib/api-client";
import type { PhaseContext } from "./types";

/**
 * The Planning/Reviewing phase: once probing is done (or skipped), the
 * dialog auto-calls `generatePlan` and renders the plan as a highlighted
 * plan bubble. The review step takes free text: any submission adjusts the
 * plan (`adjustPlan`), while the approval command (`approve`) calls
 * `approvePlan` then `onAccept` and closes.
 */
export function usePlanPhase(ctx: PhaseContext) {
  const {
    paragraph,
    sessionId,
    setStatus,
    setMessage,
    setMessages,
    setPhase,
    setParagraph,
    setPlan,
    onAccept,
    close,
    splitAnswer,
    recordPlan,
  } = ctx;

  /**
   * Generate (or retry) the plan. Used when `awaitingPlan` is true — the
   * learner has no input to type; the Send button simply triggers
   * generation.
   */
  async function generate() {
    if (sessionId === null) return;
    setParagraph("");
    const result = await generatePlan(sessionId);
    recordPlan(result);
  }

  /**
   * Handle a submit during the review step: the typed text adjusts the plan,
   * unless it is the approval command (`approve`), which approves the plan
   * and closes the dialog.
   */
  async function submit() {
    const text = paragraph.trim();

    if (text === "") {
      setStatus("error");
      setMessage(
        "Type 'approve' to approve the plan, or describe how to adjust it.",
      );
      return;
    }

    if (sessionId === null) {
      setStatus("error");
      setMessage("Something went wrong with your session. Please try again.");
      return;
    }

    if (text.toLowerCase() === "approve") {
      try {
        await approvePlan(sessionId);
      } catch (err) {
        setStatus("error");
        setMessage(
          err instanceof ApiError
            ? err.message
            : "Something went wrong approving your plan. Please try again.",
        );
        return;
      }
      onAccept();
      close();
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
  }

  return { submit, generate };
}
