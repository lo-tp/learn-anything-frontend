import { describe, expect, it } from "vitest";
import type { Question } from "@/core/contracts";
import {
  fold,
  initialState,
  PROBE_CAP,
  SessionError,
  type TurnRow,
} from "@/core/session";

// ---------------------------------------------------------------------------
// Fixtures — synthetic log rows, per docs/schema.md "The turn"
// ---------------------------------------------------------------------------

const step = (i: number) => ({
  concept: `concept ${i}`,
  outcome: `after this you can do ${i}`,
});

const tf = (text: string, answer: boolean) => ({ kind: "tf" as const, text, answer });

const row = (type: TurnRow["type"], request: string, response: unknown): TurnRow => ({
  type,
  request,
  response,
});

// ---------------------------------------------------------------------------
// The empty log — a fresh session
// ---------------------------------------------------------------------------

describe("fold of the empty log", () => {
  it("is a session in intake with nothing recorded yet", () => {
    expect(fold([])).toEqual(initialState());
    expect(initialState()).toMatchObject({
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
    });
  });
});

// ---------------------------------------------------------------------------
// Probing — ANSWER:<n> → question (probe) | boundary + plan v1 (US-P1, US-P2)
// ---------------------------------------------------------------------------

const acceptTarget = row(
  "intake",
  "I want to learn Newton's second law of motion",
  { type: "accept_target", knowledgePoint: "Newton's second law" },
);

const probe = (i: number) =>
  row("probing", "ANSWER:2", { type: "question", question: tf(`Probe ${i}?`, i % 2 === 0) });

const boundary = (plan: unknown[] = [step(1), step(2)]) =>
  row("probing", "ANSWER:1", { type: "boundary", plan });

describe("probing turns", () => {
  it("serves one probe question at a time, counted up to the cap", () => {
    const state = fold([
      acceptTarget,
      probe(1),
      row("probing", "ANSWER:1", { type: "question", question: tf("Probe 2?", true) }),
    ]);
    expect(state.stage).toBe("probing");
    expect(state.probeCount).toBe(2);
    expect(state.activeQuestion).toEqual({ kind: "tf", text: "Probe 2?", answer: true });
  });

  it("lets the first probing turn in with no question to answer, then ranges every ANSWER against the active question", () => {
    // first probing turn: nothing is active yet, the answer is the go-ahead
    expect(fold([acceptTarget, row("probing", "ANSWER:1", { type: "question", question: tf("Probe 1?", true) })]).probeCount).toBe(1);
    // a TF question offers options 1 and 2 only
    expect(() =>
      fold([acceptTarget, probe(1), row("probing", "ANSWER:3", { type: "question", question: tf("Probe 2?", true) })]),
    ).toThrow(SessionError);
  });

  it("keeps plans at ≤ 20 steps in every log, however written (US-N1/AC5)", () => {
    expect(() =>
      fold([
        acceptTarget,
        row("probing", "ANSWER:1", {
          type: "boundary",
          plan: Array.from({ length: 21 }, (_, i) => step(i + 1)),
        }),
      ]),
    ).toThrow(SessionError);
  });

  it("hard-caps probing at 10 questions — the 10th turn must be the boundary", () => {
    const tenProbes = [acceptTarget, ...Array.from({ length: 10 }, (_, i) => probe(i + 1))];
    const atCap = fold(tenProbes);
    expect(atCap.probeCount).toBe(PROBE_CAP);
    expect(() => fold([...tenProbes, probe(11)])).toThrow(SessionError);
    expect(fold([...tenProbes, boundary()]).stage).toBe("review");
  });

  it("enters review with plan v1 when the boundary is established", () => {
    const state = fold([acceptTarget, probe(1), boundary()]);
    expect(state.stage).toBe("review");
    expect(state.plan).toEqual([step(1), step(2)]);
    expect(state.planRevision).toBe(1);
    expect(state.activeQuestion).toBeNull();
    expect(state.approved).toBe(false);
  });

  it("rejects a free-text or APPROVE action in probing", () => {
    expect(() => fold([acceptTarget, row("probing", "hmm", { type: "question", question: tf("?", true) })])).toThrow(SessionError);
    expect(() => fold([acceptTarget, row("probing", "APPROVE", { type: "question", question: tf("?", true) })])).toThrow(SessionError);
  });
});

// ---------------------------------------------------------------------------
// Review — free text → plan (new revision) | APPROVE → step 1 (US-N2 … US-N7)
// ---------------------------------------------------------------------------

const afterBoundary = (rows: TurnRow[] = []) =>
  fold([acceptTarget, boundary(), ...rows]);

describe("review turns", () => {
  it("replaces the plan with a new revision on each adjustment", () => {
    const state = afterBoundary([
      row("review", "please make it shorter", {
        type: "plan",
        plan: [step(1)],
      }),
    ]);
    expect(state.stage).toBe("review");
    expect(state.plan).toEqual([step(1)]);
    expect(state.planRevision).toBe(2);
    expect(state.activeQuestion).toBeNull();
  });

  it("re-records the knowledge point when the learner re-scopes it", () => {
    const state = afterBoundary([
      row("review", "actually I meant all of Newton's laws", {
        type: "plan",
        knowledgePoint: "Newton's laws of motion",
        plan: [step(1)],
      }),
    ]);
    expect(state.knowledgePoint).toBe("Newton's laws of motion");
  });

  it("starts execution on APPROVE — position 1 with the first step's question", () => {
    const q1 = tf("Step 1: what is force?", true);
    const state = afterBoundary([
      row("review", "APPROVE", { type: "question", question: q1 }),
    ]);
    expect(state.stage).toBe("executing");
    expect(state.approved).toBe(true);
    expect(state.position).toBe(1);
    expect(state.activeQuestion).toEqual(q1);
    expect(state.stepsPassed).toBe(0);
  });

  it("cannot start executing without an explicit APPROVE", () => {
    expect(() =>
      afterBoundary([
        row("executing", "ANSWER:1", {
          type: "advance",
          confirmation: "right.",
          question: q2,
        }),
      ]),
    ).toThrow(SessionError);
  });

  it("rejects an ANSWER click, a question reply to APPROVE, and a plan reply to an adjustment", () => {
    expect(() => afterBoundary([row("review", "ANSWER:1", { type: "plan", plan: [step(1)] })])).toThrow(SessionError);
    expect(() =>
      afterBoundary([row("review", "APPROVE", { type: "plan", plan: [step(1)] })]),
    ).toThrow(SessionError);
    expect(() =>
      afterBoundary([
        row("review", "make it shorter", {
          type: "question",
          question: tf("?", true),
        }),
      ]),
    ).toThrow(SessionError);
  });
});

// ---------------------------------------------------------------------------
// Executing — wrong → explain → re-test, correct → advance/complete (US-E1 … US-E4, US-C1/2)
// ---------------------------------------------------------------------------

const q1 = { kind: "mc" as const, text: "What does F equal?", options: [{ text: "m·a" }, { text: "m/a" }], correctIndex: 0 };
const q1Retest = { kind: "mc" as const, text: "F = m·a: double m, keep a — what happens to F?", options: [{ text: "doubles" }, { text: "halves" }], correctIndex: 0 };
const q2 = tf("Does a bigger mass accelerate more at equal force?", false);

/** The log prefix: an approved session sitting on step 1 with `q` active. */
const approvedAtStep1 = (q: Question = q1): TurnRow[] => [
  acceptTarget,
  boundary([step(1), step(2)]),
  row("review", "APPROVE", { type: "question", question: q }),
];

describe("executing turns", () => {
  it("explains and re-tests a wrong answer — same step, a different question", () => {
    const state = fold([
      ...approvedAtStep1(),
      row("executing", "ANSWER:2", {
        type: "retest",
        explanation: { whyWrong: "m/a is not force.", whyCorrect: "F = m·a." },
        question: q1Retest,
      }),
    ]);
    expect(state.stage).toBe("executing");
    expect(state.position).toBe(1);
    expect(state.stepsPassed).toBe(0);
    expect(state.activeQuestion).toEqual(q1Retest);
  });

  it("rejects a re-test that repeats the just-failed question", () => {
    expect(() =>
      fold([
        ...approvedAtStep1(),
        row("executing", "ANSWER:2", {
          type: "retest",
          explanation: { whyWrong: "w", whyCorrect: "c" },
          question: q1,
        }),
      ]),
    ).toThrow(SessionError);
  });

  it("rejects a re-test after a correct answer and an advance after a wrong one", () => {
    expect(() =>
      fold([
        ...approvedAtStep1(),
        row("executing", "ANSWER:1", {
          type: "retest",
          explanation: { whyWrong: "w", whyCorrect: "c" },
          question: q1Retest,
        }),
      ]),
    ).toThrow(SessionError);
    expect(() =>
      fold([
        ...approvedAtStep1(),
        row("executing", "ANSWER:2", {
          type: "advance",
          confirmation: "right.",
          question: q2,
        }),
      ]),
    ).toThrow(SessionError);
  });

  it("passes the step on a correct answer and moves to the next question", () => {
    const state = fold([
      ...approvedAtStep1(),
      row("executing", "ANSWER:1", {
        type: "advance",
        confirmation: "F = m·a — right.",
        question: q2,
      }),
    ]);
    expect(state.position).toBe(2);
    expect(state.stepsPassed).toBe(1);
    expect(state.activeQuestion).toEqual(q2);
  });

  it("rejects an advance on the last step and a completion before it", () => {
    const lastStep = [
      ...approvedAtStep1(),
      row("executing", "ANSWER:1", {
        type: "advance",
        confirmation: "right.",
        question: q2,
      }),
    ];
    expect(() =>
      fold([
        ...lastStep,
        row("executing", "ANSWER:2", {
          type: "advance",
          confirmation: "right.",
          question: tf("?", true),
        }),
      ]),
    ).toThrow(SessionError);
    expect(() =>
      fold([
        ...approvedAtStep1(),
        row("executing", "ANSWER:1", {
          type: "complete",
          confirmation: "done.",
          summary: "s.",
        }),
      ]),
    ).toThrow(SessionError);
  });

  it("completes the session only on a correct answer to the last step", () => {
    const before = approvedAtStep1();
    const state = fold([
      ...before,
      row("executing", "ANSWER:1", {
        type: "advance",
        confirmation: "right.",
        question: q2,
      }),
      row("executing", "ANSWER:2", {
        type: "complete",
        confirmation: "Last step passed.",
        summary: "You now derive F=ma from scratch.",
      }),
    ]);
    expect(state.stage).toBe("complete");
    expect(state.stepsPassed).toBe(2);
    expect(state.activeQuestion).toBeNull();
    expect(state.summary).toBe("You now derive F=ma from scratch.");
  });

  it("rejects an ANSWER naming no option of the active question", () => {
    expect(() =>
      fold([...approvedAtStep1(), row("executing", "ANSWER:3", {
        type: "retest",
        explanation: { whyWrong: "w", whyCorrect: "c" },
        question: q1Retest,
      })]),
    ).toThrow(SessionError);
  });

  it("is terminal — no row may follow completion", () => {
    const done = fold([
      ...approvedAtStep1(),
      row("executing", "ANSWER:1", {
        type: "advance",
        confirmation: "right.",
        question: q2,
      }),
      row("executing", "ANSWER:2", {
        type: "complete",
        confirmation: "done.",
        summary: "s.",
      }),
    ]);
    expect(done.stage).toBe("complete");
    expect(() =>
      fold([
        ...approvedAtStep1(),
        { type: "executing" as const, request: "ANSWER:2", response: { type: "complete", confirmation: "done.", summary: "s." } },
        { type: "review" as const, request: "APPROVE", response: { type: "question", question: q2 } },
      ]),
    ).toThrow(SessionError);
  });
});

// ---------------------------------------------------------------------------
// A whole session — intake → probing → review → executing → complete
// ---------------------------------------------------------------------------

describe("a full session log folds to completion", () => {
  it("walks every stage and ends complete with every step passed", () => {
    const log: TurnRow[] = [
      row("intake", "physics", { type: "narrow", feedback: "Which law?" }),
      acceptTarget,
      probe(1),
      row("probing", "ANSWER:1", { type: "boundary", plan: [step(1), step(2)] }),
      row("review", "make it shorter", { type: "plan", plan: [step(1), step(2)] }),
      row("review", "APPROVE", { type: "question", question: q1 }),
      row("executing", "ANSWER:2", {
        type: "retest",
        explanation: { whyWrong: "w", whyCorrect: "c" },
        question: q1Retest,
      }),
      row("executing", "ANSWER:1", {
        type: "advance",
        confirmation: "F = m·a.",
        question: q2,
      }),
      row("executing", "ANSWER:2", {
        type: "complete",
        confirmation: "Last step passed.",
        summary: "You now derive F=ma from scratch.",
      }),
    ];
    const state = fold(log);
    expect(state).toEqual({
      stage: "complete",
      knowledgePoint: "Newton's second law",
      plan: [step(1), step(2)],
      planRevision: 2,
      approved: true,
      position: 2,
      activeQuestion: null,
      stepsPassed: 2,
      probeCount: 1,
      summary: "You now derive F=ma from scratch.",
    });
  });
});

// ---------------------------------------------------------------------------
// Intake — free text → narrow | accept_target (US-I1)
// ---------------------------------------------------------------------------

describe("intake turns", () => {
  it("stays in intake on a narrow verdict, unbounded rounds", () => {
    const state = fold([
      row("intake", "physics", { type: "narrow", feedback: "Which branch of physics?" }),
      row("intake", "mechanics", { type: "narrow", feedback: "Classical or quantum?" }),
    ]);
    expect(state.stage).toBe("intake");
    expect(state.knowledgePoint).toBeNull();
  });

  it("enters probing when the target is accepted, recording the knowledge point", () => {
    const state = fold([
      row(
        "intake",
        "I want to learn Newton's second law of motion",
        { type: "accept_target", knowledgePoint: "Newton's second law of motion" },
      ),
    ]);
    expect(state.stage).toBe("probing");
    expect(state.knowledgePoint).toBe("Newton's second law of motion");
    expect(state.activeQuestion).toBeNull();
  });

  it("rejects a click where free text is due (intake is a free-text stage)", () => {
    expect(() =>
      fold([
        row("intake", "ANSWER:1", { type: "narrow", feedback: "…" }),
        row("intake", "APPROVE", { type: "narrow", feedback: "…" }),
      ]),
    ).toThrow(SessionError);
  });

  it("rejects a probing/review response where an intake verdict is due", () => {
    expect(() =>
      fold([
        row("intake", "I want to learn F=ma", { type: "question", question: tf("…", true) }),
      ]),
    ).toThrow(SessionError);
  });

  it("rejects a response that fails the intake contract", () => {
    expect(() =>
      fold([row("intake", "I want to learn F=ma", { type: "accept_target" })]),
    ).toThrow(SessionError);
  });

  it("rejects a row whose type does not name the stage the session is in", () => {
    expect(() => fold([row("probing", "ANSWER:1", { type: "narrow", feedback: "…" })])).toThrow(
      SessionError,
    );
  });
});
