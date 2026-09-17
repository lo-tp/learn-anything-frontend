import {
  clarifySession,
  createSession,
  generatePlan,
  startProbe,
} from "@/lib/api-client";
import type { PhaseContext } from "./types";
import type { RecentMessage } from "../use-new-session";

/**
 * The Clarify phase: the first submit creates the session (`createSession`);
 * subsequent submits while the backend is in `clarifying` call
 * `clarifySession`. On completion the phase may transition into probing
 * (fetches the first probe question) or planning (auto-generates the plan),
 * or land in a post-plan phase (legacy confirm step).
 */
export function useClarifyPhase(ctx: PhaseContext) {
  const {
    paragraph,
    sessionId,
    setStatus,
    setMessage,
    setMessages,
    setSessionId,
    setPhase,
    setParagraph,
    splitAnswer,
    t,
    recordProbeBatch,
    recordPlan,
  } = ctx;

  /**
   * Handle a submit during the clarify phase (sessionId is null → create,
   * non-null → clarify). Records both turns in the message history and
   * transitions to the next phase as dictated by the backend response.
   */
  async function submit() {
    const result = sessionId
      ? await clarifySession(sessionId, paragraph)
      : await createSession(paragraph);
    setSessionId(result.session_id);

    if (result.phase === "clarifying") {
      const questions = result.clarifying_questions?.length
        ? result.clarifying_questions
        : [t("thinFeedback")];
      setStatus("idle");
      setPhase("clarifying");
      setParagraph("");
      setMessages((prev) => [
        ...prev,
        { role: "you", text: splitAnswer(paragraph) },
        { role: "ai", text: questions },
      ]);
      return;
    }

    // Build the common "you" + optional narrowed-goal additions.
    const additions: RecentMessage[] = [
      { role: "you", text: splitAnswer(paragraph) },
    ];
    if (result.narrowed_goal) {
      additions.push({
        role: "ai",
        text: t("yourNarrowedGoal", { goal: result.narrowed_goal }),
        highlighted: true,
      });
    }

    if (result.phase === "probing") {
      // Transition into the probe loop: fetch the first question.
      setMessages((prev) => [...prev, ...additions]);
      setParagraph("");
      setPhase("probing");
      const probe = await startProbe(result.session_id);
      if (!probe.questions) {
        setStatus("error");
        setMessage(t("errorNoQuestions"));
        return;
      }
      recordProbeBatch(probe.questions);
      return;
    }

    if (result.phase === "planning" || result.phase === "reviewing") {
      // Backend skipped probing — auto-generate the plan.
      setMessages((prev) => [...prev, ...additions]);
      setParagraph("");
      setPhase(result.phase);
      const generated = await generatePlan(result.session_id);
      recordPlan(generated);
      return;
    }

    // Post-plan phase: enter the legacy confirm step.
    setStatus("idle");
    setPhase(result.phase);
    setMessages((prev) => [...prev, ...additions]);
  }

  return { submit };
}
