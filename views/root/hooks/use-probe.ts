import {
  answerProbe,
  generatePlan,
  startProbe,
  type Phase,
  type ProbeQuestionOut,
} from "@/lib/api-client";
import type { PhaseContext, ShuffledProbeQuestion } from "./types";
import { withDisplayOrder } from "./types";

/**
 * The Probing phase: runs the batched probe loop against the combined
 * `POST /sessions/{id}/probe` endpoint, but presents questions **one at a
 * time**. The backend serves a whole batch per round (`startProbe` fetches
 * the first; `answerProbe` submits the combined answers for a batch and
 * returns the next batch or the boundary map). The learner, however, is
 * shown one question at a time, rendered as the shared QuizQuestion card,
 * and answers each by **clicking an option** (#113): the click is the
 * answer (no confirm step), the card locks and reveals in place, and the
 * old separate "you" + verdict bubbles are gone. Each question's options
 * are rendered in a shuffled display order (generated once per batch) so
 * the correct answer is never stuck on one letter (#74); a clicked option
 * is mapped back through the question's `order` to the backend index
 * before it is recorded or submitted. Within a batch the next question is
 * drawn from the batch locally (no round-trip); only when the batch's last
 * question is answered are all of its answers combined and sent to the
 * backend in a single call — and a failed submit leaves the card unlocked
 * so the learner re-clicks. Within a batch the questions are independent;
 * adaptivity between batches comes from the backend's updated boundary
 * map. When the boundary is established the plan is auto-generated.
 */
export function useProbePhase(ctx: PhaseContext) {
  const {
    sessionId,
    probeBatch,
    probeAnswers,
    probeCount,
    setStatus,
    setMessage,
    setMessages,
    setPhase,
    setProbeBatch,
    setProbeAnswers,
    setProbeCount,
    t,
    recordProbeBatch,
    recordPlan,
  } = ctx;

  /**
   * Mark the active question's card as answered (with the chosen DISPLAY
   * index — the card's own order) and, when there is one, surface the
   * next question's card.
   */
  function markAnswered(
    question: ShuffledProbeQuestion,
    displayIndex: number,
    next: ShuffledProbeQuestion | null,
  ) {
    setMessages((prev) => {
      const marked = prev.map((entry) =>
        entry.probe === question
          ? { ...entry, probeSelected: displayIndex }
          : entry,
      );
      return next ? [...marked, { role: "ai", probe: next }] : marked;
    });
  }

  /**
   * Unlock a probe card that was revealed on the click but whose combined
   * submit failed: clear its selection so the options are interactive
   * again and the learner re-clicks.
   */
  function unlockAnswered(question: ShuffledProbeQuestion) {
    setMessages((prev) =>
      prev.map((entry) =>
        entry.probe === question ? { ...entry, probeSelected: undefined } : entry,
      ),
    );
  }

  /**
   * Answer the ACTIVE question with a clicked option. `displayIndex` is
   * the position in the question's shuffled display order (the card's own
   * order) — it is mapped back to the backend index through the question's
   * `order` before it is recorded or submitted (#74).
   */
  async function selectOption(displayIndex: number) {
    if (probeBatch === null || sessionId === null) return;
    const activeIndex = probeAnswers.length;
    if (activeIndex >= probeBatch.length) return;
    const question = probeBatch[activeIndex];
    if (displayIndex < 0 || displayIndex >= question.order.length) return;

    // The clicked option is a position in the display order — map it back
    // to the backend index before recording or submitting (#74).
    const selected = question.order[displayIndex];
    const answers = [...probeAnswers, selected];
    const isLast = activeIndex === probeBatch.length - 1;

    if (!isLast) {
      // Local answer — no backend round-trip until the batch is exhausted.
      setProbeAnswers(answers);
      setProbeCount((count) => count + 1);
      markAnswered(question, displayIndex, probeBatch[activeIndex + 1]);
      setStatus("idle");
      return;
    }

    // Last question in the batch: reveal the card INSTANTLY on the click
    // (lock + verdict + explanation) so the learner gets feedback before
    // the backend responds — the combined submit then goes out in the
    // background. A failure unlocks the card again so the learner
    // re-clicks, and the error shows inline (no local state is touched
    // yet, so a re-click retries the submit).
    markAnswered(question, displayIndex, null);
    const payload = probeBatch.map((q, i) => ({
      question_id: q.id,
      selected_index: answers[i],
    }));
    let result: { phase: Phase; questions?: ProbeQuestionOut[] | null };
    try {
      result = await answerProbe(sessionId, payload);
    } catch (err) {
      unlockAnswered(question);
      throw err;
    }

    // The submit succeeded — record the answer and count it.
    setProbeAnswers(answers);
    setProbeCount((count) => count + 1);

    if (result.questions) {
      // Next batch: surface only its FIRST question and reset the collected
      // answers. The rest of the batch is drawn locally as the learner
      // goes. Each question gets a fresh display order, as with the first
      // batch.
      const batch = withDisplayOrder(result.questions);
      const first = batch[0];
      setProbeBatch(batch);
      setProbeAnswers([]);
      setMessages((prev) => [...prev, { role: "ai", probe: first }]);
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
        text: t("boundaryEstablished", { n: total }),
        highlighted: true,
      },
    ]);
    // Keep the status pending so the footer stays disabled while
    // generation is in flight (recordPlan settles it on success; the
    // error path settles it for a retry).
    const generated = await generatePlan(sessionId);
    recordPlan(generated);
  }

  /**
   * Handle a submit during the probing phase with no card on screen:
   * fetch the first batch (or retry a failed fetch). With a card on
   * screen the answer path is the option click, not this submit.
   */
  async function submit() {
    if (probeBatch !== null) return;
    if (sessionId === null) {
      setStatus("error");
      setMessage(t("errorFallback"));
      return;
    }
    const result = await startProbe(sessionId);
    if (!result.questions) {
      setStatus("error");
      setMessage(t("errorNoQuestions"));
      return;
    }
    recordProbeBatch(result.questions);
  }

  return { submit, selectOption };
}
