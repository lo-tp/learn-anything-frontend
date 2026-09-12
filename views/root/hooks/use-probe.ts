import {
  answerProbe,
  generatePlan,
  startProbe,
  type Phase,
  type ProbeQuestionOut,
} from "@/lib/api-client";
import type { PhaseContext } from "./types";
import type { RecentMessage } from "../use-new-session";

/**
 * The Probing phase: runs the probe loop against the combined
 * `POST /sessions/{id}/probe` endpoint. The first question is fetched
 * automatically (`startProbe`); the learner answers by typing the option's
 * letter (A, B, C, …), which is client-validated and sent as a 0-based
 * `selected_index` (`answerProbe`). When the boundary is established the
 * plan is auto-generated.
 */
export function useProbePhase(ctx: PhaseContext) {
  const {
    paragraph,
    sessionId,
    probeQuestion,
    probeCount,
    setStatus,
    setMessage,
    setMessages,
    setPhase,
    setParagraph,
    setProbeQuestion,
    setProbeCount,
    optionLetter,
    recordPlan,
    recordProbeQuestion,
  } = ctx;

  /**
   * The 1-based option index for the learner's typed letter (A, B, C, …),
   * or null when the text is not a single letter within range.
   */
  function parseOptionIndex(text: string, count: number): number | null {
    const trimmed = text.trim().toUpperCase();
    const index = trimmed.charCodeAt(0) - "A".charCodeAt(0) + 1;
    if (trimmed.length !== 1 || index < 1 || index > count) {
      return null;
    }
    return index;
  }

  /**
   * Record the outcome of an answered probe question: the learner's pick,
   * the verdict + explanation, then either the next question or the
   * highlighted completion message.
   */
  function recordResult(
    selected: number,
    result: { phase: Phase; question?: ProbeQuestionOut | null },
  ) {
    if (!probeQuestion) return;
    const isCorrect = selected - 1 === probeQuestion.correct_index;
    const feedback = isCorrect
      ? `Correct — option ${optionLetter(selected)} (${probeQuestion.options[selected - 1]}). ${probeQuestion.explanation}`
      : `Not quite — the correct answer is option ${optionLetter(
          probeQuestion.correct_index + 1,
        )} (${probeQuestion.options[probeQuestion.correct_index]}). ${probeQuestion.explanation}`;

    const additions: RecentMessage[] = [
      { role: "you", text: probeQuestion.options[selected - 1] },
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
      // A next question is owed an answer — reopen the intake.
      setStatus("idle");
    } else {
      additions.push({
        role: "ai",
        text: `Boundary established after ${probeCount} question${
          probeCount === 1 ? "" : "s"
        }. Your learning plan is ready.`,
        highlighted: true,
      });
      setProbeQuestion(null);
      // No next question: the boundary is set and the plan auto-generates
      // right after this. Keep the status pending so Send/Cancel stay
      // disabled while that generation is in flight (recordPlan settles it
      // on success; the error path settles it for a retry).
    }

    setPhase(result.phase);
    setParagraph("");
    setMessages((prev) => [...prev, ...additions]);
  }

  /**
   * Handle a submit during the probing phase: retry a failed first fetch,
   * or answer the active question with the typed option letter.
   */
  async function submit() {
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

    const index = parseOptionIndex(paragraph, probeQuestion.options.length);
    if (index === null) {
      setStatus("error");
      setMessage(
        `Enter the letter of your answer (A–${optionLetter(
          probeQuestion.options.length,
        )}).`,
      );
      return;
    }

    const result = await answerProbe(sessionId, probeQuestion.id, index - 1);
    recordResult(index, result);

    if (!result.question) {
      // Boundary established — auto-generate the plan.
      const generated = await generatePlan(sessionId);
      recordPlan(generated);
    }
  }

  return { submit };
}
