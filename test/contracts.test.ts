import { describe, expect, it } from "vitest";
import {
  APPROVE_TOKEN,
  advanceResponseSchema,
  acceptTargetResponseSchema,
  boundaryResponseSchema,
  completeResponseSchema,
  executingResponseSchema,
  isApproveToken,
  isFreeText,
  learningStepSchema,
  narrowResponseSchema,
  planSchema,
  planResponseSchema,
  questionResponseSchema,
  questionSchema,
  retestResponseSchema,
  responseSchema,
  parseAnswerToken,
} from "../core/contracts";

// ---------------------------------------------------------------------------
// Fixtures — the happy path, per contract
// ---------------------------------------------------------------------------

const step = (i: number) => ({ concept: `concept ${i}`, outcome: `after this you can do ${i}` });

const mc2 = {
  kind: "mc" as const,
  text: "What does F equal?",
  options: [{ text: "m·a" }, { text: "m/a" }],
  correctIndex: 0,
};
const mc4 = {
  kind: "mc" as const,
  text: "Which quantity is mass?",
  options: [{ text: "F" }, { text: "m" }, { text: "a" }, { text: "v" }],
  correctIndex: 1,
};
const tf = { kind: "tf" as const, text: "Mass measures inertia.", answer: true };

const plan = [step(1), step(2)];

// ---------------------------------------------------------------------------
// Question — MC (2–4 options) / TF shape
// ---------------------------------------------------------------------------

describe("questionSchema", () => {
  it("accepts MC questions with 2, 3 and 4 options", () => {
    expect(questionSchema.safeParse(mc2).success).toBe(true);
    expect(
      questionSchema.safeParse({ ...mc2, options: [...mc2.options, { text: "a·m" }] }).success,
    ).toBe(true);
    expect(questionSchema.safeParse(mc4).success).toBe(true);
  });

  it("rejects MC questions with 1 or 5 options", () => {
    expect(questionSchema.safeParse({ ...mc2, options: [mc2.options[0]] }).success).toBe(false);
    expect(
      questionSchema.safeParse({ ...mc4, options: [...mc4.options, { text: "x" }] }).success,
    ).toBe(false);
  });

  it("rejects an out-of-range correctIndex (cross-field rule)", () => {
    expect(questionSchema.safeParse({ ...mc2, correctIndex: 2 }).success).toBe(false);
    expect(questionSchema.safeParse({ ...mc2, correctIndex: -1 }).success).toBe(false);
    expect(questionSchema.safeParse({ ...mc2, correctIndex: 1 }).success).toBe(true);
  });

  it("accepts the TF shape and rejects a TF without its answer field", () => {
    expect(questionSchema.safeParse(tf).success).toBe(true);
    expect(questionSchema.safeParse({ kind: "tf", text: tf.text }).success).toBe(false);
    expect(questionSchema.safeParse({ ...tf, answer: "true" }).success).toBe(false);
  });

  it("rejects unknown kinds", () => {
    expect(questionSchema.safeParse({ kind: "essay", text: "Write a paragraph." }).success).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// Intake verdict — narrow | accept_target
// ---------------------------------------------------------------------------

describe("intake verdict", () => {
  it("accepts a narrow verdict with feedback", () => {
    expect(narrowResponseSchema.safeParse({ type: "narrow", feedback: "Which law — F=ma or F=Gm₁m₂/r²?" }).success).toBe(
      true,
    );
  });

  it("rejects a narrow verdict missing its feedback", () => {
    expect(narrowResponseSchema.safeParse({ type: "narrow" }).success).toBe(false);
    expect(narrowResponseSchema.safeParse({ type: "narrow", feedback: "" }).success).toBe(false);
  });

  it("accepts accept_target with the recorded knowledge point", () => {
    expect(
      acceptTargetResponseSchema.safeParse({
        type: "accept_target",
        knowledgePoint: "Newton's second law of motion",
      }).success,
    ).toBe(true);
  });

  it("rejects accept_target without a knowledge point", () => {
    expect(acceptTargetResponseSchema.safeParse({ type: "accept_target" }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Question responses — probing probe, step 1
// ---------------------------------------------------------------------------

describe("questionResponseSchema", () => {
  it("accepts a response wrapping a single question", () => {
    expect(questionResponseSchema.safeParse({ type: "question", question: mc2 }).success).toBe(
      true,
    );
    expect(questionResponseSchema.safeParse({ type: "question", question: tf }).success).toBe(
      true,
    );
  });

  it("rejects a question response without its question", () => {
    expect(questionResponseSchema.safeParse({ type: "question" }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Boundary — judgment + plan v1 bundled
// ---------------------------------------------------------------------------

describe("boundaryResponseSchema", () => {
  it("bundles plan v1 in the boundary judgment", () => {
    expect(boundaryResponseSchema.safeParse({ type: "boundary", plan }).success).toBe(true);
  });

  it("rejects a boundary without a plan (probing cannot end with nothing)", () => {
    expect(boundaryResponseSchema.safeParse({ type: "boundary" }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Plan — concepts only, ≤ 20 steps
// ---------------------------------------------------------------------------

describe("planSchema", () => {
  it("accepts a plan of 1 and of 20 steps", () => {
    expect(planSchema.safeParse([step(1)]).success).toBe(true);
    expect(planSchema.safeParse(Array.from({ length: 20 }, (_, i) => step(i + 1))).success).toBe(
      true,
    );
  });

  it("rejects an empty plan and a plan of 21 steps", () => {
    expect(planSchema.safeParse([]).success).toBe(false);
    expect(planSchema.safeParse(Array.from({ length: 21 }, (_, i) => step(i + 1))).success).toBe(
      false,
    );
  });

  it("rejects a step missing its concept or one-line outcome", () => {
    expect(learningStepSchema.safeParse({ concept: "what F is" }).success).toBe(false);
    expect(learningStepSchema.safeParse({ outcome: "you can name it" }).success).toBe(false);
  });
});

describe("planResponseSchema", () => {
  it("accepts a regenerated plan, with an optional re-scoped knowledge point", () => {
    expect(planResponseSchema.safeParse({ type: "plan", plan }).success).toBe(true);
    expect(
      planResponseSchema.safeParse({
        type: "plan",
        knowledgePoint: "Newton's laws (mechanics)",
        plan,
      }).success,
    ).toBe(true);
  });

  it("rejects a plan response without a plan", () => {
    expect(planResponseSchema.safeParse({ type: "plan" }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Executing — confirm+next, explanation+re-test, confirm+summary
// ---------------------------------------------------------------------------

describe("advanceResponseSchema", () => {
  it("carries the confirmation plus the next step's question", () => {
    expect(
      advanceResponseSchema.safeParse({
        type: "advance",
        confirmation: "Right — F = m·a, force equals mass times acceleration.",
        question: tf,
      }).success,
    ).toBe(true);
  });

  it("rejects a confirmation without the next question (or without a confirmation)", () => {
    expect(advanceResponseSchema.safeParse({ type: "advance", confirmation: "Right." }).success).toBe(
      false,
    );
    expect(advanceResponseSchema.safeParse({ type: "advance", question: tf }).success).toBe(false);
  });
});

describe("retestResponseSchema", () => {
  it("carries the explanation (why wrong, why right) plus the re-test question", () => {
    expect(
      retestResponseSchema.safeParse({
        type: "retest",
        explanation: {
          whyWrong: "m/a is not a quantity in F=ma — force is mass times acceleration.",
          whyCorrect: "F = m·a: doubling the mass at equal acceleration doubles the force.",
        },
        question: mc2,
      }).success,
    ).toBe(true);
  });

  it("rejects an explanation missing either judgment field", () => {
    expect(
      retestResponseSchema.safeParse({
        type: "retest",
        explanation: { whyWrong: "…" },
        question: mc2,
      }).success,
    ).toBe(false);
    expect(
      retestResponseSchema.safeParse({ type: "retest", explanation: {}, question: mc2 }).success,
    ).toBe(false);
    expect(retestResponseSchema.safeParse({ type: "retest", question: mc2 }).success).toBe(false);
  });
});

describe("completeResponseSchema", () => {
  it("bundles the final confirmation and the closing summary", () => {
    expect(
      completeResponseSchema.safeParse({
        type: "complete",
        confirmation: "Last step passed — F=ma, earned.",
        summary: "You started from 'what is force' and now derive F=ma from scratch.",
      }).success,
    ).toBe(true);
  });

  it("rejects a completion without the closing summary", () => {
    expect(completeResponseSchema.safeParse({ type: "complete", confirmation: "Done." }).success).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// Per-stage unions + the log-row union
// ---------------------------------------------------------------------------

describe("executingResponseSchema", () => {
  it("accepts exactly the executing types and rejects the rest", () => {
    expect(executingResponseSchema.safeParse({ type: "advance", confirmation: "ok", question: mc2 }).success).toBe(
      true,
    );
    expect(
      executingResponseSchema.safeParse({
        type: "retest",
        explanation: { whyWrong: "w", whyCorrect: "c" },
        question: tf,
      }).success,
    ).toBe(true);
    expect(
      executingResponseSchema.safeParse({
        type: "complete",
        confirmation: "c",
        summary: "s",
      }).success,
    ).toBe(true);
    // probing/review types are not executing responses
    expect(executingResponseSchema.safeParse({ type: "question", question: mc2 }).success).toBe(
      false,
    );
    expect(executingResponseSchema.safeParse({ type: "plan", plan }).success).toBe(false);
  });
});

describe("responseSchema (session_messages.response)", () => {
  const validRows: Array<Record<string, unknown>> = [
    { type: "narrow", feedback: "Which Newton's law?" },
    { type: "accept_target", knowledgePoint: "Newton's second law of motion" },
    { type: "question", question: mc2 },
    { type: "boundary", plan },
    { type: "plan", plan },
    { type: "advance", confirmation: "Right.", question: tf },
    { type: "retest", explanation: { whyWrong: "w", whyCorrect: "c" }, question: mc4 },
    { type: "complete", confirmation: "Done.", summary: "You did it." },
  ];

  it("accepts every stage's response type", () => {
    for (const row of validRows) {
      expect(responseSchema.safeParse(row).success, JSON.stringify(row)).toBe(true);
    }
  });

  it("rejects unknown types and empty payloads", () => {
    expect(responseSchema.safeParse({ type: "planning" }).success).toBe(false);
    expect(responseSchema.safeParse({}).success).toBe(false);
    expect(responseSchema.safeParse(null).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Request-token grammar — ANSWER:<n>, APPROVE, free text
// ---------------------------------------------------------------------------

describe("request-token grammar", () => {
  it("classifies APPROVE", () => {
    expect(isApproveToken("APPROVE")).toBe(true);
    expect(isApproveToken("Approve")).toBe(false);
    expect(isApproveToken("APPROVE!")).toBe(false);
  });

  it("parses ANSWER tokens as 1-based option numbers", () => {
    expect(parseAnswerToken("ANSWER:1")).toBe(1);
    expect(parseAnswerToken("ANSWER:4")).toBe(4);
  });

  it("rejects malformed ANSWER tokens", () => {
    expect(parseAnswerToken("ANSWER:0")).toBeNull();
    expect(parseAnswerToken("ANSWER:")).toBeNull();
    expect(parseAnswerToken("ANSWER:x")).toBeNull();
    expect(parseAnswerToken("answer:1")).toBeNull();
    expect(parseAnswerToken("ANSWER: 1")).toBeNull();
  });

  it("classifies everything else as free text", () => {
    expect(isFreeText("I want to learn Newton's second law of motion")).toBe(true);
    expect(isFreeText("please add the definition of gravity to the plan")).toBe(true);
    expect(isFreeText("ANSWER:1")).toBe(false);
    expect(isFreeText(APPROVE_TOKEN)).toBe(false);
  });
});
