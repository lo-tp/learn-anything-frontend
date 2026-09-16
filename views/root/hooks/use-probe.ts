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
 * The Probing phase: runs the batched probe loop against the combined
 * `POST /sessions/{id}/probe` endpoint. Each round the backend serves a
 * **batch** of questions (`startProbe` fetches the first; `answerProbe`
 * submits the answers for the current batch and returns the next batch or
 * the boundary map). The learner answers by typing one option letter per
 * question, in batch order, which is client-validated and sent as a list of
 * 0-based `selected_index` values. Within a batch the questions are
 * independent; adaptivity between batches comes from the backend's updated
 * boundary map. When the boundary is established the plan is auto-generated.
 */
export function useProbePhase(ctx: PhaseContext) {
  const {
    paragraph,
    sessionId,
    probeBatch,
    probeCount,
    setStatus,
    setMessage,
    setMessages,
    setPhase,
    setParagraph,
    setProbeBatch,
    setProbeCount,
    optionLetter,
    recordPlan,
    recordProbeBatch,
  } = ctx;

  /**
   * Parse the learner's input into one 0-based index per question in the
   * current batch. The learner types one option letter per question, in
   * order, separated by whitespace (e.g. "B C A" for a 3-question batch).
   * Returns null when the token count or any letter is out of range for its
   * question — partial answers are rejected here, before any request.
   */
  function parseBatchAnswers(
    text: string,
    batch: ProbeQuestionOut[],
  ): number[] | null {
    const tokens = text.split(/\s+/).filter((t) => t.length > 0);
    if (tokens.length !== batch.length) return null;
    const indices: number[] = [];
    for (let i = 0; i < batch.length; i += 1) {
      const token = tokens[i].toUpperCase();
      const index = token.charCodeAt(0) - "A".charCodeAt(0) + 1;
      if (token.length !== 1 || index < 1 || index > batch[i].options.length) {
        return null;
      }
      indices.push(index - 1);
    }
    return indices;
  }

  /**
   * Record the outcome of an answered batch: a "you" pick and an AI verdict
   * per question, then either the next batch of questions or the highlighted
   * completion message (which leaves the status pending so the buttons stay
   * disabled while the plan auto-generates).
   */
  function recordResult(
    indices: number[],
    result: { phase: Phase; questions?: ProbeQuestionOut[] | null },
  ) {
    if (!probeBatch) return;

    const additions: RecentMessage[] = [];
    probeBatch.forEach((q, i) => {
      const selected = indices[i];
      const isCorrect = selected === q.correct_index;
      additions.push({
        role: "you",
        text: `${optionLetter(selected + 1)}: ${q.options[selected]}`,
      });
      additions.push({
        role: "ai",
        text: isCorrect
          ? `Correct — option ${optionLetter(selected + 1)} (${q.options[selected]}). ${q.explanation}`
          : `Not quite — the correct answer is option ${optionLetter(
              q.correct_index + 1,
            )} (${q.options[q.correct_index]}). ${q.explanation}`,
      });
    });

    if (result.questions) {
      const next = result.questions;
      additions.push({
        role: "ai",
        text:
          next.length === 1
            ? "Here's your next question:"
            : `Here are your next ${next.length} questions:`,
      });
      setProbeBatch(next);
      setProbeCount((count) => count + next.length);
      const bubbles: RecentMessage[] = next.map((q) => ({
        role: "ai",
        text: q.text,
        options: q.options,
      }));
      setMessages((prev) => [...prev, ...additions, ...bubbles]);
      setPhase(result.phase);
      setParagraph("");
      // A next batch is owed answers — reopen the intake.
      setStatus("idle");
      return;
    }

    additions.push({
      role: "ai",
      text: `Boundary established after ${probeCount} question${
        probeCount === 1 ? "" : "s"
      }. Your learning plan is ready.`,
      highlighted: true,
    });
    setProbeBatch(null);
    // No next batch: the boundary is set and the plan auto-generates right
    // after this. Keep the status pending so Send/Cancel stay disabled while
    // that generation is in flight (recordPlan settles it on success; the
    // error path settles it for a retry).
    setPhase(result.phase);
    setParagraph("");
    setMessages((prev) => [...prev, ...additions]);
  }

  /**
   * Handle a submit during the probing phase: retry a failed first fetch, or
   * answer the current batch with one typed letter per question.
   */
  async function submit() {
    if (sessionId === null) {
      setStatus("error");
      setMessage(
        "Something went wrong starting your session. Please try again.",
      );
      return;
    }

    if (probeBatch === null) {
      // First fetch (or its retry) — no batch is owed answers yet.
      const result = await startProbe(sessionId);
      if (!result.questions) {
        setStatus("error");
        setMessage("No questions were received — please try again.");
        return;
      }
      recordProbeBatch(result.questions);
      return;
    }

    const indices = parseBatchAnswers(paragraph, probeBatch);
    if (indices === null) {
      setStatus("error");
      setMessage(
        `Type one letter per question, in order — ${probeBatch.length} total.`,
      );
      return;
    }

    const answers = probeBatch.map((q, i) => ({
      question_id: q.id,
      selected_index: indices[i],
    }));
    const result = await answerProbe(sessionId, answers);
    recordResult(indices, result);

    if (!result.questions) {
      // Boundary established — auto-generate the plan.
      const generated = await generatePlan(sessionId);
      recordPlan(generated);
    }
  }

  return { submit };
}
