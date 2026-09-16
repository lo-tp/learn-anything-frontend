import type {
  Phase,
  PlanBody,
  PlanOut,
  ProbeQuestionOut,
} from "@/lib/api-client";
import type { RecentMessage } from "../use-new-session";

export type Status = "idle" | "pending" | "error";

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
  /** The current batch of probe questions being worked through. */
  probeBatch: ProbeQuestionOut[] | null;
  /**
   * The 0-based selected indices collected so far for the current batch, in
   * batch order. Its length is the index of the active (next-to-answer)
   * question: `probeBatch[probeAnswers.length]`.
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
  setProbeBatch: (q: ProbeQuestionOut[] | null) => void;
  setProbeAnswers: (n: number[] | ((prev: number[]) => number[])) => void;
  setProbeCount: (n: number | ((prev: number) => number)) => void;
  setPlan: (p: PlanBody | null) => void;

  // ── Lifecycle callbacks ───────────────────────────────────────────
  onAccept: () => void;
  close: () => void;

  // ── Shared helpers ────────────────────────────────────────────────
  splitAnswer: (text: string) => string | string[];
  optionLetter: (index: number) => string;

  // ── Cross-phase record functions (owned by the orchestrator) ──────
  recordProbeBatch: (questions: ProbeQuestionOut[]) => void;
  recordPlan: (result: PlanOut) => void;
}
