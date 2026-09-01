/**
 * `core/session` — the stage machine (pure, no I/O).
 *
 * Owns the reducer that folds the LLM-turn log into session state
 * (stage, plan + revision, position, progress), the stage transitions,
 * and the invariants from `docs/architecture.md` — exactly one active
 * question, a re-test that differs from the just-failed question, the
 * probing hard cap, plans ≤ 20 concepts, execution only after explicit
 * approval, and completion only when every step has passed.
 *
 * The ≤ 20 plan bound lives in `planSchema`: every row's response is
 * re-validated against the stage contracts here, so the bound holds for
 * any log, however it was written. The explicit-learner-override path
 * (US-N1/AC5) is a widening of that contract at the turn route — the fold
 * only ever sees contract-valid plans.
 *
 * The log is the source of truth (ADR 0004): every learner action is one
 * appended row `{ type, request, response }` where `type` is the stage the
 * session was in when the request was made. `fold` walks the rows in order
 * from the empty state; resume on any device is exactly this fold.
 *
 * Stage vocabulary (CONTEXT.md): intake, probing, planning, review,
 * executing, complete. The fold produces five of the six — `planning` is
 * the transient label "a plan exists, unapproved" and never the stage a
 * request is made in (docs/architecture.md): plan v1 arrives bundled in the
 * boundary row, so the machine is at `review` — where both the free-text
 * adjustment and `APPROVE` rows are made — the moment the plan exists.
 */

import {
  isApproveToken,
  isFreeText,
  parseAnswerToken,
  responseSchema,
  type Plan,
  type Question,
  type Response,
} from "../contracts";

/** Hard cap on probing questions (US-P2/AC1). */
export const PROBE_CAP = 10;

export type Stage =
  | "intake"
  | "probing"
  | "planning"
  | "review"
  | "executing"
  | "complete";

/**
 * The row `type` values that can ever occur in the log (docs/schema.md):
 * `planning` and `complete` never name a stage a request is made in.
 */
export type RowType = "intake" | "probing" | "review" | "executing";

/** One LLM turn: the learner's input plus the LLM's structured reply. */
export interface TurnRow {
  type: RowType;
  /** The learner's input only — free text, `ANSWER:<n>`, or `APPROVE`. */
  request: string;
  /** Raw `session_messages.response` JSONB — re-validated on every fold. */
  response: unknown;
}

/** The folded state of one session — everything the log implies. */
export interface SessionState {
  stage: Stage;
  /** The recorded knowledge point; re-scoped by a review plan response. */
  knowledgePoint: string | null;
  /** The current plan — v1 from the boundary row, replaced on each review `plan`. */
  plan: Plan | null;
  /** Ordinal of plan responses in the log: "Plan vN". 0 before any plan. */
  planRevision: number;
  /** True once the learner sent APPROVE. */
  approved: boolean;
  /** The current step (1-based) while executing; 0 otherwise. */
  position: number;
  /** The one and only active question, or null when none is owed. */
  activeQuestion: Question | null;
  /** How many learning steps have passed (steps 1..stepsPassed). */
  stepsPassed: number;
  /** How many probe questions have been served so far. */
  probeCount: number;
  /** The closing summary, once complete. */
  summary: string | null;
}

export type SessionErrorCode =
  | "invalid-row" // row envelope: empty request, bad `type`, contract failure
  | "stage-mismatch" // row arrived in the wrong stage / after completion
  | "invalid-action" // the request token is not a legal action for the stage
  | "invalid-response" // a contract-valid response of the wrong kind for this stage/action
  | "probe-cap" // an 11th probing question
  | "verdict-mismatch" // advance/complete on a wrong answer, retest on a right one
  | "advance-on-last-step" // `advance` (with a next question) on the final step
  | "complete-early" // `complete` before the final step
  | "retest-identical"; // the re-test question is the just-failed question

/** Thrown by `applyTurn`/`fold` when a row breaks a machine invariant. */
export class SessionError extends Error {
  constructor(
    public readonly code: SessionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SessionError";
  }
}

function fail(code: SessionErrorCode, message: string): never {
  throw new SessionError(code, message);
}

/** The state before the first learner action. */
export function initialState(): SessionState {
  return {
    stage: "intake",
    knowledgePoint: null,
    plan: null,
    planRevision: 0,
    approved: false,
    position: 0,
    activeQuestion: null,
    stepsPassed: 0,
    probeCount: 0,
    summary: null,
  };
}

/**
 * Append one validated turn to the folded state. Pure; throws
 * `SessionError` when the row breaks a machine invariant.
 */
export function applyTurn(state: SessionState, rowIn: TurnRow): SessionState {
  if (typeof rowIn.request !== "string" || rowIn.request.length === 0) {
    fail("invalid-row", "every turn row carries the learner's non-empty request");
  }
  if (!isRowType(rowIn.type)) {
    fail(
      "invalid-row",
      `row type must be intake|probing|review|executing, got "${String(rowIn.type)}"`,
    );
  }
  const parsed = responseSchema.safeParse(rowIn.response);
  if (!parsed.success) {
    fail("invalid-row", `response fails its stage contract: ${parsed.error.message}`);
  }
  const response = parsed.data;

  switch (state.stage) {
    case "intake":
      return intakeTurn(state, rowIn.type, rowIn.request, response);
    case "probing":
      return probingTurn(state, rowIn.type, rowIn.request, response);
    case "review":
      return reviewTurn(state, rowIn.type, rowIn.request, response);
    case "executing":
      return executingTurn(state, rowIn.type, rowIn.request, response);
    case "planning":
      fail(
        "stage-mismatch",
        `"planning" is the label for "a plan exists, unapproved" — the fold lands at "review"; no request is ever made in planning`,
      );
    case "complete":
      fail("stage-mismatch", "complete is terminal — nothing is input after completion");
  }
}

/**
 * Fold the whole log into session state. Pure, no I/O — resume is this
 * exact call (US-R1).
 */
export function fold(rows: readonly TurnRow[]): SessionState {
  return rows.reduce(applyTurn, initialState());
}

// ---------------------------------------------------------------------------
// Per-stage transition/validation functions
// ---------------------------------------------------------------------------

function isRowType(value: unknown): value is RowType {
  return value === "intake" || value === "probing" || value === "review" || value === "executing";
}

/** Intake — free text → `narrow` (rewrite) | `accept_target` (→ probing). */
function intakeTurn(
  state: SessionState,
  rowType: RowType,
  request: string,
  response: Response,
): SessionState {
  if (rowType !== "intake") {
    fail("stage-mismatch", `row type "${rowType}" but the session is in intake`);
  }
  if (!isFreeText(request)) {
    fail(
      "invalid-action",
      `intake takes the learner's free-text target, not "${request}"`,
    );
  }
  switch (response.type) {
    case "narrow":
      return { ...state };
    case "accept_target":
      return { ...state, stage: "probing", knowledgePoint: response.knowledgePoint };
    default:
      fail(
        "invalid-response",
        `intake expects an intake verdict (narrow | accept_target), got "${response.type}"`,
      );
  }
}

/**
 * Probing — `ANSWER:<n>` → `question` (probe k, k ≤ 10) | `boundary`
 * (+ plan v1 → review).
 */
function probingTurn(
  state: SessionState,
  rowType: RowType,
  request: string,
  response: Response,
): SessionState {
  if (rowType !== "probing") {
    fail("stage-mismatch", `row type "${rowType}" but the session is in probing`);
  }
  const option = parseAnswerToken(request);
  if (option === null) {
    fail("invalid-action", `probing takes an ANSWER:<n> token, not "${request}"`);
  }
  const active = state.activeQuestion;
  if (active && !answerInRange(active, option)) {
    fail(
      "invalid-action",
      `ANSWER:${option} names no option of the active question`,
    );
  }

  switch (response.type) {
    case "question":
      if (state.probeCount >= PROBE_CAP) {
        fail(
          "probe-cap",
          `probing is hard-capped at ${PROBE_CAP} questions — the ${PROBE_CAP}th turn must end in a boundary`,
        );
      }
      return {
        ...state,
        activeQuestion: response.question,
        probeCount: state.probeCount + 1,
      };
    case "boundary":
      return {
        ...state,
        stage: "review",
        plan: response.plan,
        planRevision: 1,
        activeQuestion: null,
      };
    default:
      fail(
        "invalid-response",
        `probing expects a probe question or the boundary, got "${response.type}"`,
      );
  }
}

/**
 * Review — free text → `plan` (new revision) | APPROVE → `question`
 * (step 1 → executing).
 */
function reviewTurn(
  state: SessionState,
  rowType: RowType,
  request: string,
  response: Response,
): SessionState {
  if (rowType !== "review") {
    fail("stage-mismatch", `row type "${rowType}" but the session is in review`);
  }
  if (isApproveToken(request)) {
    if (response.type !== "question") {
      fail(
        "invalid-response",
        `APPROVE expects the first step's question, got "${response.type}"`,
      );
    }
    return {
      ...state,
      stage: "executing",
      approved: true,
      position: 1,
      activeQuestion: response.question,
    };
  }
  if (!isFreeText(request)) {
    fail("invalid-action", `review takes free text or APPROVE, not "${request}"`);
  }
  if (response.type !== "plan") {
    fail(
      "invalid-response",
      `a plan adjustment expects a regenerated plan, got "${response.type}"`,
    );
  }
  return {
    ...state,
    knowledgePoint: response.knowledgePoint ?? state.knowledgePoint,
    plan: response.plan,
    planRevision: state.planRevision + 1,
  };
}

/**
 * Executing — `ANSWER:<n>` on the active step question → `advance`
 * (correct, not the last step) | `retest` (wrong) | `complete`
 * (correct, on the last step).
 */
function executingTurn(
  state: SessionState,
  rowType: RowType,
  request: string,
  response: Response,
): SessionState {
  if (rowType !== "executing") {
    fail("stage-mismatch", `row type "${rowType}" but the session is in executing`);
  }
  const plan = state.plan;
  const active = state.activeQuestion;
  if (!plan || !active) {
    fail("invalid-row", "executing always has an approved plan and one active question");
  }
  const option = parseAnswerToken(request);
  if (option === null || !answerInRange(active, option)) {
    fail("invalid-action", `executing takes an ANSWER:<n> naming an option of the active question, got "${request}"`);
  }
  const correct = answerIsCorrect(active, option);
  const isLastStep = state.position === plan.length;

  switch (response.type) {
    case "advance":
      if (!correct) {
        fail("verdict-mismatch", `ANSWER:${option} is wrong — the step must be re-tested, not advanced`);
      }
      if (isLastStep) {
        fail("advance-on-last-step", "the last step completes the session; it cannot advance to a next question");
      }
      return {
        ...state,
        stepsPassed: state.position,
        position: state.position + 1,
        activeQuestion: response.question,
      };
    case "retest":
      if (correct) {
        fail("verdict-mismatch", `ANSWER:${option} is right — no re-test is owed`);
      }
      if (sameQuestion(active, response.question)) {
        fail("retest-identical", "the re-test must be a different question on the same step");
      }
      return { ...state, activeQuestion: response.question };
    case "complete":
      if (!correct) {
        fail("verdict-mismatch", `ANSWER:${option} is wrong — completion requires passing the last step`);
      }
      if (!isLastStep) {
        fail("complete-early", "completion requires every learning step to have passed");
      }
      return {
        ...state,
        stage: "complete",
        stepsPassed: plan.length,
        activeQuestion: null,
        summary: response.summary,
      };
    default:
      fail(
        "invalid-response",
        `executing expects advance | retest | complete, got "${response.type}"`,
      );
  }
}

// ---------------------------------------------------------------------------
// Question helpers — the code's own read of the learner's click
// ---------------------------------------------------------------------------

/** Option numbers are 1-based, matching the numbers shown in the UI. */
function answerOptionsCount(question: Question): number {
  return question.kind === "mc" ? question.options.length : 2;
}

function answerInRange(question: Question, option: number): boolean {
  return option >= 1 && option <= answerOptionsCount(question);
}

/** The machine's own verdict on `ANSWER:<n>` — never trusted to the model. */
function answerIsCorrect(question: Question, option: number): boolean {
  if (question.kind === "mc") {
    return option - 1 === question.correctIndex;
  }
  return (option === 1) === question.answer; // 1 = True, 2 = False
}

/** Whole-question identity (text, options, correct answer) — stable order after Zod. */
function sameQuestion(a: Question, b: Question): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
