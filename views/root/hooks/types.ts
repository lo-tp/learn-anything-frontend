import { useTranslations } from "next-intl";
import type {
  Phase,
  PlanBody,
  PlanOut,
  ProbeQuestionOut,
} from "@/lib/api-client";
import { displayOrder } from "@/lib/utils";
import type { RecentMessage } from "../use-new-session";

export type Status = "idle" | "pending" | "error";

/**
 * A probe question as the client holds it: the backend payload plus its
 * display order. `order` is a permutation of the option indices where
 * `order[i]` is the **backend** index of the option rendered at display
 * position `i`. It is generated once when the batch is served — so the
 * correct answer is never stuck on one letter (#74) — and stays stable for
 * the rest of the session; a typed answer letter is mapped through it back
 * to a backend index before submission.
 *
 * The backend appends a localized "I don't know" option at the **last**
 * index of every question's `options` (and it is never `correct_index`);
 * the display order preserves that invariant by always rendering it last.
 */
export type ShuffledProbeQuestion = ProbeQuestionOut & { order: number[] };

/**
 * Attach a fresh per-question display order to a batch of raw questions.
 * Only the LLM-generated options (all but the last index) are shuffled; the
 * backend's unknown option — always at the last index — is pinned to the
 * last display position so it is never shuffled away from the end.
 */
export function withDisplayOrder(
  questions: ProbeQuestionOut[],
): ShuffledProbeQuestion[] {
  return questions.map((question) => ({
    ...question,
    order: displayOrder(question.options.length, true),
  }));
}

/**
 * The shared state, dispatchers, and cross-phase callbacks every phase
 * hook receives. The orchestrator (`useNewSession`) owns all state and
 * wires the cross-phase record functions; each phase hook reads from and
 * writes to this context to drive its own submit branch.
 */
export interface PhaseContext {
  // ── Read state ────────────────────────────────────────────────────
  paragraph: string;
  sessionId: string | null;
  phase: Phase | null;
  /** The current batch of probe questions, with their display orders. */
  probeBatch: ShuffledProbeQuestion[] | null;
  /**
   * The 0-based **backend** selected indices collected so far for the
   * current batch, in batch order (display letters are mapped back through
   * each question's `order`). Its length is the index of the active
   * (next-to-answer) question: `probeBatch[probeAnswers.length]`.
   */
  probeAnswers: number[];
  probeCount: number;
  plan: PlanBody | null;

  // ── Dispatchers ───────────────────────────────────────────────────
  setParagraph: (v: string) => void;
  setStatus: (s: Status) => void;
  setMessage: (m: string | null) => void;
  setMessages: (fn: (prev: RecentMessage[]) => RecentMessage[]) => void;
  setSessionId: (id: string | null) => void;
  setPhase: (p: Phase | null) => void;
  setProbeBatch: (q: ShuffledProbeQuestion[] | null) => void;
  setProbeAnswers: (n: number[] | ((prev: number[]) => number[])) => void;
  setProbeCount: (n: number | ((prev: number) => number)) => void;
  setPlan: (p: PlanBody | null) => void;

  // ── Lifecycle callbacks ───────────────────────────────────────────
  onAccept: () => void;
  close: () => void;

  // ── Shared helpers ────────────────────────────────────────────────
  splitAnswer: (text: string) => string | string[];
  optionLetter: (index: number) => string;
  /**
   * The `dialog`-namespace translator (ICU message formatting), so the
   * phase hooks can build their AI-bubble and error strings through i18n.
   */
  t: ReturnType<typeof useTranslations<"dialog">>;

  // ── Cross-phase record functions (owned by the orchestrator) ──────
  recordProbeBatch: (questions: ProbeQuestionOut[]) => void;
  recordPlan: (result: PlanOut) => void;
}
