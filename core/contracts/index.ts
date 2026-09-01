/**
 * `core/contracts` — the LLM's contracts as Zod schemas (pure).
 *
 * Every AI-generated artifact must fit a fixed per-stage contract
 * (ADR 0003): the LLM generates content inside these shapes and signals
 * its judgments ("target specific enough?", "boundary established?") as
 * declared fields of the structured output; the stage machine
 * (`core/session`) acts on them and enforces the invariants — they are
 * never trusted to the model.
 *
 * The same schemas double as the validators for the structured `response`
 * payloads stored in the LLM-turn log (`session_messages.response` JSONB):
 * `responseSchema` is the discriminated union (on `type`) over every
 * stage's response.
 *
 * Stage → response types (docs/schema.md "The turn"):
 *
 * | row type    | response.type                                        |
 * |-------------|------------------------------------------------------|
 * | intake      | `narrow` \| `accept_target`                           |
 * | probing     | `question` (probe) \| `boundary` (+ plan v1)          |
 * | review      | `plan` (new revision) \| `question` (step 1, APPROVE) |
 * | executing   | `advance` \| `retest` \| `complete`                   |
 *
 * Turns that cross a stage boundary bundle their outputs into the single
 * response — no system-initiated calls exist (docs/architecture.md):
 * `boundary` carries plan v1, `retest` carries the explanation + the
 * (different) question, `complete` carries the closing summary.
 */

import { z } from "zod";

/** Non-empty learner-facing text. */
const text = z.string().min(1);

// ---------------------------------------------------------------------------
// Question — the only item format in the app (US-P1, US-E1)
// ---------------------------------------------------------------------------

/** Multiple-choice question: 2–4 options, 0-based index of the right one. */
const mcQuestionSchema = z.object({
  kind: z.literal("mc"),
  text,
  options: z.array(z.object({ text })).min(2).max(4),
  correctIndex: z.number().int().min(0),
});

/** True/false question: a statement plus the correct verdict. */
const tfQuestionSchema = z.object({
  kind: z.literal("tf"),
  text,
  answer: z.boolean(),
});

/**
 * One MC (2–4 options) or TF question. `questionSchema` is a discriminated
 * union (discriminator `kind`) with the cross-field rule
 * `correctIndex < options.length` attached, so it stays usable both as an
 * LLM output contract and as a log-row validator.
 */
export const questionSchema = z
  .discriminatedUnion("kind", [mcQuestionSchema, tfQuestionSchema])
  .refine(
    (q) => q.kind !== "mc" || q.correctIndex < q.options.length,
    { message: "correctIndex out of range for options" },
  );
export type Question = z.infer<typeof questionSchema>;

// ---------------------------------------------------------------------------
// Plan — concepts only (ADR 0002), a prerequisite chain
// ---------------------------------------------------------------------------

/** One LearningStep: a concept plus its one-line outcome (US-N1/AC1). */
export const learningStepSchema = z.object({
  concept: text,
  /** One line — "after this you can …" (US-N1/AC1). */
  outcome: text,
});
export type LearningStep = z.infer<typeof learningStepSchema>;

/**
 * A Plan: ordered concepts only — no quiz questions exist at plan time
 * (ADR 0002). Bounded at the contract level (≤ 20, US-N1/AC5); the
 * explicit-learner-override path (US-N1/AC5) is the session machine's
 * concern (`core/session`), not this shape's.
 */
export const planSchema = z
  .array(learningStepSchema)
  .min(1)
  .max(20);
export type Plan = z.infer<typeof planSchema>;

// ---------------------------------------------------------------------------
// Intake verdict (US-I1) — "is the declared target specific enough?"
// ---------------------------------------------------------------------------

/** Target too vague: the learner must rewrite the intake paragraph. */
export const narrowResponseSchema = z.object({
  type: z.literal("narrow"),
  /** Why the target is too vague; what a rewrite should pin down. */
  feedback: text,
});
export type NarrowResponse = z.infer<typeof narrowResponseSchema>;

/** Target specific enough: it is recorded and the session enters probing. */
export const acceptTargetResponseSchema = z.object({
  type: z.literal("accept_target"),
  /** The recorded knowledge point — short label + canonical copy in the log. */
  knowledgePoint: text,
});
export type AcceptTargetResponse = z.infer<typeof acceptTargetResponseSchema>;

/** Intake-stage contract: the verdict itself is the judgment. */
export const intakeResponseSchema = z.discriminatedUnion("type", [
  narrowResponseSchema,
  acceptTargetResponseSchema,
]);
export type IntakeResponse = z.infer<typeof intakeResponseSchema>;

// ---------------------------------------------------------------------------
// Probing (US-P1, US-P2) — one probe question at a time, ≤ 10 total
// ---------------------------------------------------------------------------

/** A single question — used for probing, the first step (APPROVE), re-tests. */
export const questionResponseSchema = z.object({
  type: z.literal("question"),
  question: questionSchema,
});
export type QuestionResponse = z.infer<typeof questionResponseSchema>;

/**
 * The boundary is established (the judgment is the type itself). Because a
 * boundary turn has no follow-up call, plan v1 is bundled in the same
 * response — "Plan v1" is simply the first plan response in the log.
 */
export const boundaryResponseSchema = z.object({
  type: z.literal("boundary"),
  plan: planSchema,
});
export type BoundaryResponse = z.infer<typeof boundaryResponseSchema>;

/** Probing-stage contract: keep probing, or establish the boundary + plan. */
export const probingResponseSchema = z.discriminatedUnion("type", [
  questionResponseSchema,
  boundaryResponseSchema,
]);
export type ProbingResponse = z.infer<typeof probingResponseSchema>;

// ---------------------------------------------------------------------------
// Review (US-N2 … US-N7) — conversational plan adjustment, then approval
// ---------------------------------------------------------------------------

/**
 * Any learner adjustment (add / remove / depth / difficulty) triggers a
 * FULL plan regeneration (US-N6) — a new revision; "Plan vN" is the ordinal
 * of plan responses in the log.
 */
export const planResponseSchema = z.object({
  type: z.literal("plan"),
  /** Present when the learner re-scoped the knowledge point (US-N2/AC3). */
  knowledgePoint: text.optional(),
  plan: planSchema,
});
export type PlanResponse = z.infer<typeof planResponseSchema>;

/**
 * Review-stage contract: an adjustment yields a new plan revision;
 * `APPROVE` yields the first step question (execution-time generation,
 * ADR 0002).
 */
export const reviewResponseSchema = z.discriminatedUnion("type", [
  planResponseSchema,
  questionResponseSchema,
]);
export type ReviewResponse = z.infer<typeof reviewResponseSchema>;

// ---------------------------------------------------------------------------
// Executing (US-E1 … US-E4, US-C1/2) — one question at a time
// ---------------------------------------------------------------------------

/** Correct answer: the step passes (US-E4/AC1). */
export const advanceResponseSchema = z.object({
  type: z.literal("advance"),
  /** Short explanation of why the answer is right (US-E4/AC1). */
  confirmation: text,
  /** The next step's question (step 1's question arrives as `question`). */
  question: questionSchema,
});
export type AdvanceResponse = z.infer<typeof advanceResponseSchema>;

/**
 * Wrong answer (US-E2/AC1): names why the learner's chosen option is wrong
 * and why the correct option is right.
 */
export const explanationSchema = z.object({
  whyWrong: text,
  whyCorrect: text,
});
export type Explanation = z.infer<typeof explanationSchema>;

/**
 * Wrong → explain → re-test (US-E3): the re-test is a *different* question
 * on the same step. The contract fixes the shape; the "differs from the
 * just-failed question" rule is enforced in `core/session`, where both rows
 * are visible.
 */
export const retestResponseSchema = z.object({
  type: z.literal("retest"),
  explanation: explanationSchema,
  question: questionSchema,
});
export type RetestResponse = z.infer<typeof retestResponseSchema>;

/**
 * Final turn (US-C1, US-C2): the last step's confirmation plus the closing
 * summary, bundled — nothing is input after completion.
 */
export const completeResponseSchema = z.object({
  type: z.literal("complete"),
  confirmation: text,
  /** The closing summary appended to the progress markdown (US-C2/AC1). */
  summary: text,
});
export type CompleteResponse = z.infer<typeof completeResponseSchema>;

/** Executing-stage contract. */
export const executingResponseSchema = z.discriminatedUnion("type", [
  advanceResponseSchema,
  retestResponseSchema,
  completeResponseSchema,
]);
export type ExecutingResponse = z.infer<typeof executingResponseSchema>;

// ---------------------------------------------------------------------------
// The log-row union — validates `session_messages.response` JSONB
// ---------------------------------------------------------------------------

/**
 * Every LLM reply, in every stage: the discriminated union (on `type`)
 * over all stage responses. Validated against stored rows on read and
 * against LLM output on write, before the row is appended.
 */
export const responseSchema = z.discriminatedUnion("type", [
  narrowResponseSchema,
  acceptTargetResponseSchema,
  questionResponseSchema,
  boundaryResponseSchema,
  planResponseSchema,
  advanceResponseSchema,
  retestResponseSchema,
  completeResponseSchema,
]);
export type Response = z.infer<typeof responseSchema>;

// ---------------------------------------------------------------------------
// Request-token grammar — `session_messages.request`
// ---------------------------------------------------------------------------
//
// `request` holds only the learner's input (docs/schema.md): free text —
// the two free-text interactions of the session, intake/refinement
// (US-I1) and plan review (US-N2) — or a canonical action token for a
// click:
//
//   ANSWER:<n>   the learner picked option <n> (1-based, matches the
//                option numbers shown in the UI)
//   APPROVE      the learner explicitly approved the plan (US-N7)

export const APPROVE_TOKEN = "APPROVE";
const ANSWER_TOKEN_RE = /^ANSWER:([1-9][0-9]*)$/;

export function isApproveToken(request: string): boolean {
  return request === APPROVE_TOKEN;
}

/** 1-based option number, or null if the request is not an ANSWER token. */
export function parseAnswerToken(request: string): number | null {
  const m = ANSWER_TOKEN_RE.exec(request);
  return m ? Number(m[1]) : null;
}

/** True for the free-text requests (intake, refinement, plan adjustments). */
export function isFreeText(request: string): boolean {
  return !isApproveToken(request) && parseAnswerToken(request) === null;
}
