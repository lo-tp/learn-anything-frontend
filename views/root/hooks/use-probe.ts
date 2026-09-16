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
 * `POST /sessions/{id}/probe` endpoint, but presents questions **one at a
 * time**. The backend serves a whole batch per round (`startProbe` fetches
 * the first; `answerProbe` submits the combined answers for a batch and
 * returns the next batch or the boundary map). The learner, however, is
 * shown one question at a time and answers each by typing its option's
 * letter (A, B, C, …), which is client-validated. Within a batch the next
 * question is drawn from the batch locally (no round-trip); only when the
 * batch's last question is answered are all of its answers combined and
 * sent to the backend in a single call. Within a batch the questions are
 * independent; adaptivity between batches comes from the backend's updated
 * boundary map. When the boundary is established the plan is auto-generated.
 */
export function useProbePhase(ctx: PhaseContext) {
  const {
    paragraph,
    sessionId,
    probeBatch,
    probeAnswers,
    probeCount,
    setStatus,
    setMessage,
    setMessages,
    setPhase,
    setParagraph,
    setProbeBatch,
    setProbeAnswers,
    setProbeCount,
    optionLetter,
    recordPlan,
    recordProbeBatch,
  } = ctx;

  /**
   * The 0-based option index for the learner's typed letter (A, B, C, …),
   * matching the backend's `correct_index` / `selected_index` convention
   * (the UI shows 1-based option letters). Returns null when the text is not
   * a single letter within range.
   */
  function parseOptionIndex(text: string, count: number): number | null {
    const trimmed = text.trim().toUpperCase();
    if (trimmed.length !== 1) return null;
    const index = trimmed.charCodeAt(0) - "A".charCodeAt(0);
    if (index < 0 || index >= count) return null;
    return index;
  }

  /**
   * The "you" pick and the AI verdict for one answered question, computed
   * client-side from the question's known `correct_index` + `explanation`.
   */
  function pickAndVerdict(
    question: ProbeQuestionOut,
    selected: number,
  ): RecentMessage[] {
    const isCorrect = selected === question.correct_index;
    return [
      {
        role: "you",
        text: `${optionLetter(selected + 1)}: ${question.options[selected]}`,
      },
      {
        role: "ai",
        text: isCorrect
          ? `Correct — option ${optionLetter(selected + 1)} (${question.options[selected]}). ${question.explanation}`
          : `Not quite — the correct answer is option ${optionLetter(
              question.correct_index + 1,
            )} (${question.options[question.correct_index]}). ${question.explanation}`,
      },
    ];
  }

  /**
   * Handle a submit during the probing phase:
   * - fetch the first batch (or retry a failed fetch) when none is active;
   * - otherwise answer the ACTIVE question (one at a time). When that was
   *   the batch's last question, all of its answers are combined and
   *   submitted to the backend in a single call.
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
      // First fetch (or its retry) — no batch is active yet.
      const result = await startProbe(sessionId);
      if (!result.questions) {
        setStatus("error");
        setMessage("No questions were received — please try again.");
        return;
      }
      recordProbeBatch(result.questions);
      return;
    }

    // The active question is the first one in the batch not yet answered.
    const activeIndex = probeAnswers.length;
    if (activeIndex >= probeBatch.length) return; // exhausted — no active q
    const question = probeBatch[activeIndex];

    const selected = parseOptionIndex(paragraph, question.options.length);
    if (selected === null) {
      setStatus("error");
      setMessage(
        `Enter the letter of your answer (A–${optionLetter(
          question.options.length,
        )}).`,
      );
      return;
    }

    // Combine this answer with the ones collected earlier in the batch.
    const answers = [...probeAnswers, selected];
    const isLast = activeIndex === probeBatch.length - 1;

    // Record the pick + verdict for this question and count it.
    setProbeAnswers(answers);
    setProbeCount((count) => count + 1);
    setMessages((prev) => [...prev, ...pickAndVerdict(question, selected)]);

    if (!isLast) {
      // Surface the next question from the batch — no backend round-trip.
      const next = probeBatch[activeIndex + 1];
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: next.text, options: next.options },
      ]);
      setParagraph("");
      setStatus("idle");
      return;
    }

    // Last question in the batch: submit the combined answers to the backend.
    const payload = probeBatch.map((q, i) => ({
      question_id: q.id,
      selected_index: answers[i],
    }));
    const result: { phase: Phase; questions?: ProbeQuestionOut[] | null } =
      await answerProbe(sessionId, payload);
    // The submit succeeded — clear the text now (a failure preserves it for
    // a retry).
    setParagraph("");

    if (result.questions) {
      // Next batch: surface its first question and reset the collected
      // answers. The rest of the batch is drawn locally as the learner goes.
      const bubbles: RecentMessage[] = result.questions.map((q) => ({
        role: "ai",
        text: q.text,
        options: q.options,
      }));
      setProbeBatch(result.questions);
      setProbeAnswers([]);
      setMessages((prev) => [...prev, ...bubbles]);
      setPhase(result.phase);
      setStatus("idle");
      return;
    }

    // Boundary established — the whole probe is done. Auto-generate the plan.
    setProbeBatch(null);
    setProbeAnswers([]);
    setPhase(result.phase);
    const total = probeCount + 1;
    setMessages((prev) => [
      ...prev,
      {
        role: "ai",
        text: `Boundary established after ${total} question${
          total === 1 ? "" : "s"
        }. Your learning plan is ready.`,
        highlighted: true,
      },
    ]);
    // Keep the status pending so Send/Cancel stay disabled while generation is
    // in flight (recordPlan settles it on success; the error path settles it
    // for a retry).
    const generated = await generatePlan(sessionId);
    recordPlan(generated);
  }

  return { submit };
}
