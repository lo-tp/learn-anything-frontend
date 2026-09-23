/**
 * Pure core of the Session intake state machine.
 *
 * This module is framework-free: it knows about the backend's typed payloads
 * (ClarifyResult, ProbeOut, PlanOut, …) and nothing else — no React, no API
 * client, no DOM. Every transition is a pure `apply(state, action, t)` that
 * returns the next state plus a list of *effects* (the API calls to make, or
 * the "accept" hand-off). The React binding (`use-session-intake`) runs those
 * effects and feeds the results back in as feedback events. Because the core
 * is pure, its entire surface is the test surface: a fake `SessionApi` drives
 * every transition without rendering a single component.
 */
import type {
  AnswerIn,
  ClarifyResult,
  Phase,
  PlanBody,
  PlanOut,
  ProbeOut,
  ProbeQuestionOut,
} from "@/lib/api-client";

/** The canonical shape of a quiz card (no display ordering — the card owns
 *  projection, see `components/session/quiz-question.tsx`). */
export type ProbeCard = {
  id: string;
  text: string;
  options: string[];
  correct_index: number;
  explanation: string;
};

/** A render-ready unit of the "Recent Messages" history. The dialog renders
 *  each `kind` and does no per-entry branching on hidden state. */
export type Bubble =
  | { kind: "text"; from: "you" | "ai"; text: string | string[]; highlighted?: boolean }
  | { kind: "probe"; card: ProbeCard; state: "active" | "answered"; picked?: number }
  | { kind: "plan"; plan: PlanBody };

/** Which request is in flight (at most one at a time). */
export type InFlight = "clarify" | "start" | "batch" | "plan" | "adjust" | "approve" | null;

/** The intake state. `bubbles` are render-ready; `batch` is canonical. */
export type IntakeState = {
  bubbles: Bubble[];
  batch: ProbeCard[] | null;
  picks: number[]; // canonical picks for the current batch, in batch order
  answered: number; // running total of answered probe questions
  sessionId: string | null;
  phase: Phase | null;
  plan: PlanBody | null;
  inFlight: InFlight;
  error: string | null;
  /**
   * The user's submitted text, committed as a "you" bubble when the
   * request RESOLVES (so a failure preserves the textarea — the user's
   * words are only recorded in the transcript once the turn succeeds).
   */
  pendingYou: string | string[] | null;
  /** Clear the textarea on the resolving event (true for text submits). */
  pendingClear: boolean;
};

/** The user's intents (what the dialog's controls dispatch). */
export type Action =
  | { type: "submit"; text: string }
  | { type: "pickOption"; canonicalIndex: number }
  | { type: "confirm" }
  | { type: "close" };

/** Feedback events the binding dispatches when an effect settles. */
export type Feedback =
  | { type: "clarifyResolved"; result: ClarifyResult }
  | { type: "probeStarted"; probe: ProbeOut }
  | { type: "batchResolved"; probe: ProbeOut }
  | { type: "planResolved"; plan: PlanOut }
  | { type: "planAdjusted"; plan: PlanOut }
  | { type: "approveDone" }
  | { type: "apiFailed"; message: string | null };

type ApiCall =
  | { type: "api"; call: "createSession"; goal: string }
  | { type: "api"; call: "clarifySession"; sessionId: string; answer: string }
  | { type: "api"; call: "startProbe"; sessionId: string }
  | { type: "api"; call: "answerProbe"; sessionId: string; answers: AnswerIn[] }
  | { type: "api"; call: "generatePlan"; sessionId: string }
  | { type: "api"; call: "adjustPlan"; sessionId: string; adjustment: string }
  | { type: "api"; call: "approvePlan"; sessionId: string };

/** The effects `apply` emits: fire the API call (or hand off to the parent). */
export type Effect = ApiCall | { type: "accept" };

export type IntakeAction = Action | Feedback;

/** The `dialog`-namespace translator, narrowed to what the core needs. */
export type Translator = (key: string, params?: Record<string, unknown>) => string;

export type ApplyResult = {
  state: IntakeState;
  effects: Effect[];
  /** True when a "you" bubble was appended (the binding clears the textarea). */
  clearInput: boolean;
};

const CONFIRMING_PHASES: Phase[] = ["generating", "executing", "complete"];

export function isConfirming(phase: Phase | null): boolean {
  return phase !== null && CONFIRMING_PHASES.includes(phase);
}

/** The fixed opening "ai" bubble. */
export function initialState(t: Translator): IntakeState {
  return {
    bubbles: [{ kind: "text", from: "ai", text: t("openingPrompt") }],
    batch: null,
    picks: [],
    answered: 0,
    sessionId: null,
    phase: null,
    plan: null,
    inFlight: null,
    error: null,
    pendingYou: null,
    pendingClear: false,
  };
}

/** Split the learner's typed answer into per-line items for the "you" bubble.
 *  A single line is a plain string; several lines render as a list. The raw
 *  text is what the API receives — this only shapes the display. */
export function splitAnswer(text: string): string | string[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 1) return lines[0];
  return lines;
}

function toProbeCard(question: ProbeQuestionOut): ProbeCard {
  return {
    id: question.id,
    text: question.text,
    options: question.options,
    correct_index: question.correct_index,
    explanation: question.explanation,
  };
}

/** Mark the most recent active probe bubble as answered (reveal). */
function markLastProbeAnswered(bubbles: Bubble[], picked: number): Bubble[] {
  let last = -1;
  for (let i = 0; i < bubbles.length; i++) {
    if (bubbles[i].kind === "probe") last = i;
  }
  return bubbles.map((bubble, i) =>
    i === last && bubble.kind === "probe"
      ? { ...bubble, state: "answered", picked }
      : bubble,
  );
}

/**
 * Commit the pending you-turn at the moment a request RESOLVES: append the
 * "you" bubble (if any) before the resolving content and report whether the
 * binding should clear the textarea. A failure path discards these instead.
 */
function commitYou(state: IntakeState): { base: Bubble[]; clearInput: boolean } {
  const you = state.pendingYou;
  const base =
    you !== null
      ? [...state.bubbles, { kind: "text", from: "you", text: you } as Bubble]
      : state.bubbles;
  return { base, clearInput: state.pendingClear };
}

/** Revert the most recent probe bubble to active (unlock after a failure). */
function markLastProbeActive(bubbles: Bubble[]): Bubble[] {
  let last = -1;
  for (let i = 0; i < bubbles.length; i++) {
    if (bubbles[i].kind === "probe") last = i;
  }
  return bubbles.map((bubble, i) =>
    i === last && bubble.kind === "probe" ? { ...bubble, state: "active", picked: undefined } : bubble,
  );
}

export function apply(
  state: IntakeState,
  action: IntakeAction,
  t: Translator,
): ApplyResult {
  switch (action.type) {
    case "close":
      return { state: initialState(t), effects: [], clearInput: false };

    case "confirm":
      return { state: initialState(t), effects: [], clearInput: false };

    case "submit": {
      if (state.inFlight) return { state, effects: [], clearInput: false };
      if (isConfirming(state.phase))
        return { state, effects: [], clearInput: false };
      const clear = { ...state, error: null };
      const text = splitAnswer(action.text);

      // Reviewing: the typed command is either "approve" (hand-off) or a
      // free-text plan adjustment.
      if (state.plan !== null && state.sessionId !== null) {
        if (action.text.trim().toLowerCase() === "approve") {
          return {
            state: { ...clear, inFlight: "approve" },
            effects: [{ type: "api", call: "approvePlan", sessionId: state.sessionId }],
            clearInput: false,
          };
        }
        return {
          state: { ...clear, inFlight: "adjust", pendingYou: text, pendingClear: true },
          effects: [
            { type: "api", call: "adjustPlan", sessionId: state.sessionId, adjustment: action.text },
          ],
          clearInput: false,
        };
      }

      // Awaiting plan: the auto-generation (or a retry) is triggered — the
      // typed text is ignored.
      if (
        state.sessionId !== null &&
        state.plan === null &&
        (state.phase === "planning" || state.phase === "reviewing")
      ) {
        return {
          state: { ...clear, inFlight: "plan" },
          effects: [{ type: "api", call: "generatePlan", sessionId: state.sessionId }],
          clearInput: false,
        };
      }

      // Probing: with a card on screen the answer is a click (no-op); with
      // no batch (e.g. after a start failure) the textarea re-fetches.
      if (state.phase === "probing") {
        if (state.batch !== null || state.sessionId === null) {
          return { state, effects: [], clearInput: false };
        }
        return {
          state: { ...clear, inFlight: "start", pendingYou: text, pendingClear: true },
          effects: [{ type: "api", call: "startProbe", sessionId: state.sessionId }],
          clearInput: false,
        };
      }

      // Clarifying / initial: create the session on the first send, then
      // resume the clarify loop. The first send carries no you-bubble (it
      // only clears the input on success); subsequent sends record the
      // learner's words.
      if (state.sessionId === null) {
        return {
          state: { ...clear, inFlight: "clarify", pendingYou: null, pendingClear: true },
          effects: [{ type: "api", call: "createSession", goal: action.text }],
          clearInput: false,
        };
      }
      return {
        state: { ...clear, inFlight: "clarify", pendingYou: text, pendingClear: true },
        effects: [
          { type: "api", call: "clarifySession", sessionId: state.sessionId, answer: action.text },
        ],
        clearInput: false,
      };
    }

    case "pickOption": {
      if (state.batch === null || state.sessionId === null)
        return { state, effects: [], clearInput: false };
      const cursor = state.picks.length;
      if (cursor >= state.batch.length)
        return { state, effects: [], clearInput: false };

      const picks = [...state.picks, action.canonicalIndex];
      const bubbles = markLastProbeAnswered(state.bubbles, action.canonicalIndex);
      if (picks.length === state.batch.length) {
        return {
          state: {
            ...state,
            picks,
            answered: state.answered + 1,
            inFlight: "batch",
            bubbles,
          },
          effects: [
            {
              type: "api",
              call: "answerProbe",
              sessionId: state.sessionId,
              answers: state.batch.map((q, i) => ({
                question_id: q.id,
                selected_index: picks[i],
              })),
            },
          ],
          clearInput: false,
        };
      }
      const nextCard = state.batch[picks.length];
      return {
        state: {
          ...state,
          picks,
          answered: state.answered + 1,
          bubbles: [...bubbles, { kind: "probe", card: nextCard, state: "active" }],
        },
        effects: [],
        clearInput: false,
      };
    }

    case "clarifyResolved": {
      const { base, clearInput } = commitYou(state);
      const result = action.result;
      const additions: Bubble[] = [];
      if (result.narrowed_goal) {
        additions.push({
          kind: "text",
          from: "ai",
          text: t("yourNarrowedGoal", { goal: result.narrowed_goal }),
          highlighted: true,
        });
      }
      let effects: Effect[] = [];
      let inFlight: InFlight = null;
      let phase = state.phase;
      if (result.phase === "clarifying") {
        phase = "clarifying";
        const questions = result.clarifying_questions ?? [];
        additions.push({
          kind: "text",
          from: "ai",
          text: questions.length ? questions : [t("thinFeedback")],
        });
      } else if (result.phase === "probing") {
        phase = "probing";
        inFlight = "start";
        effects = [{ type: "api", call: "startProbe", sessionId: result.session_id }];
      } else if (result.phase === "planning" || result.phase === "reviewing") {
        phase = result.phase;
        inFlight = "plan";
        effects = [{ type: "api", call: "generatePlan", sessionId: result.session_id }];
      } else {
        phase = result.phase; // legacy confirm step — no fetch
      }
      return {
        state: {
          ...state,
          sessionId: result.session_id,
          phase,
          inFlight,
          error: null,
          pendingYou: null,
          pendingClear: false,
          bubbles: [...base, ...additions],
        },
        effects,
        clearInput,
      };
    }

    case "probeStarted": {
      const { base, clearInput } = commitYou(state);
      const questions = action.probe.questions;
      if (!questions) {
        return {
          state: { ...state, inFlight: null, pendingYou: null, pendingClear: false, error: t("errorNoQuestions") },
          effects: [],
          clearInput,
        };
      }
      const cards = questions.map(toProbeCard);
      return {
        state: {
          ...state,
          inFlight: null,
          pendingYou: null,
          pendingClear: false,
          batch: cards,
          picks: [],
          phase: "probing",
          bubbles: [...base, { kind: "probe", card: cards[0], state: "active" }],
        },
        effects: [],
        clearInput,
      };
    }

    case "batchResolved": {
      const questions = action.probe.questions;
      if (state.sessionId === null)
        return { state: { ...state, inFlight: null }, effects: [], clearInput: false };
      if (!questions) {
        return {
          state: {
            ...state,
            inFlight: null,
            batch: null,
            picks: [],
            phase: action.probe.phase,
            bubbles: [
              ...state.bubbles,
              { kind: "text", from: "ai", text: t("boundaryEstablished", { n: state.answered }) },
            ],
          },
          effects: [{ type: "api", call: "generatePlan", sessionId: state.sessionId }],
          clearInput: false,
        };
      }
      const cards = questions.map(toProbeCard);
      return {
        state: {
          ...state,
          inFlight: null,
          batch: cards,
          picks: [],
          phase: action.probe.phase,
          bubbles: [...state.bubbles, { kind: "probe", card: cards[0], state: "active" }],
        },
        effects: [],
        clearInput: false,
      };
    }

    case "planResolved":
    case "planAdjusted": {
      const { base, clearInput } = commitYou(state);
      const plan = action.plan;
      return {
        state: {
          ...state,
          inFlight: null,
          pendingYou: null,
          pendingClear: false,
          phase: plan.phase,
          plan: plan.plan,
          bubbles: [...base, { kind: "plan", plan: plan.plan }],
        },
        effects: [],
        clearInput,
      };
    }

    case "approveDone":
      return {
        state: initialState(t),
        effects: [{ type: "accept" }],
        clearInput: false,
      };

    case "apiFailed": {
      let picks = state.picks;
      let bubbles = state.bubbles;
      if (state.inFlight === "batch") {
        picks = picks.slice(0, -1);
        bubbles = markLastProbeActive(bubbles);
      }
      return {
        state: {
          ...state,
          inFlight: null,
          pendingYou: null,
          pendingClear: false,
          error: action.message,
          picks,
          bubbles,
        },
        effects: [],
        clearInput: false,
      };
    }
  }
}

/** The visual state of a single progress rail step. */
export type RailStepState = "done" | "current" | "future";

/** One step in the progress rail (render-ready). */
export type RailStep = {
  label: string;
  state: RailStepState;
};

/** The progress rail data (render-ready). */
export type RailData = {
  steps: RailStep[];
  counter: string;
  /** True while a request is in flight — the current step animates. */
  pending: boolean;
};

/** The dialog's render-ready view-model, derived from the core state. */
export type IntakeViewModel = {
  bubbles: Bubble[];
  phase: Phase | null;
  pending: boolean;
  confirming: boolean;
  showPending: boolean;
  pendingNote: string;
  error: string | null;
  intake: {
    label: string;
    placeholder: string;
    disabled: boolean; // a probe card is answerable — the textarea is locked
    pending: boolean;
    awaitingPlan: boolean;
  };
  rail: RailData;
};

export function deriveViewModel(state: IntakeState, t: Translator): IntakeViewModel {
  const reviewing = state.plan !== null;
  const probing = state.phase === "probing";
  const confirming = isConfirming(state.phase);
  const awaitingPlan =
    state.sessionId !== null &&
    state.plan === null &&
    (state.phase === "planning" || state.phase === "reviewing");
  const pending = state.inFlight !== null;
  const activeProbe =
    probing && state.batch !== null && state.picks.length < state.batch.length;

  let pendingNote: string;
  if (awaitingPlan) pendingNote = t("pendingPlan");
  else if (reviewing) pendingNote = t("pendingReview");
  else if (probing) pendingNote = activeProbe ? t("pendingProbeAnswer") : t("pendingProbeGenerate");
  else if (state.phase === "clarifying") pendingNote = t("pendingClarify");
  else pendingNote = t("pendingDefault");

  // Progress rail: map the current phase to step states.
  // reviewing folds into Planning (step 2).
  let currentStep = -1; // -1 = ready (no step active)
  if (state.phase === "clarifying") currentStep = 0;
  else if (state.phase === "probing") currentStep = 1;
  else if (state.phase === "planning" || state.phase === "reviewing") currentStep = 2;
  else if (state.phase === "generating") currentStep = 3;
  else if (state.phase === "executing" || state.phase === "complete" || state.phase === "error") currentStep = 4; // all done

  const stepLabels = [t("railStep0"), t("railStep1"), t("railStep2"), t("railStep3")];
  const railSteps: RailStep[] = stepLabels.map((label, i) => ({
    label,
    state: i < currentStep ? "done" : i === currentStep ? "current" : "future",
  }));

  // Counter text by state
  let counter: string;
  if (currentStep === -1) counter = t("railCounterReady");
  else if (currentStep === 0) counter = t("railCounterClarifying");
  else if (currentStep === 1) counter = t("railCounterProbing");
  else if (currentStep === 2) counter = t("railCounterPlanning");
  else if (currentStep === 3) counter = t("railCounterGenerating");
  else counter = t("railCounterGenerating"); // all done

  const rail: RailData = {
    steps: railSteps,
    counter,
    pending,
  };

  return {
    bubbles: state.bubbles,
    phase: state.phase,
    pending,
    confirming,
    showPending: pending || awaitingPlan,
    pendingNote,
    error: state.error,
    intake: {
      label: probing ? t("labelProbe") : reviewing ? t("labelReview") : t("labelClarify"),
      placeholder: reviewing ? t("placeholderReview") : t("placeholderDefault"),
      disabled: activeProbe,
      pending,
      awaitingPlan,
    },
    rail,
  };
}
