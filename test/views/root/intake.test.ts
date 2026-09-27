// Pure-core tests for the Session intake state machine. No React, no DOM: a
// fake `Translator` and hand-built payloads drive every transition through
// `apply`, asserting the next state and the emitted effects. This is the test
// surface of the deep module — the binding is a thin runner over these.

import { describe, expect, it } from "vitest";
import {
  apply,
  deriveViewModel,
  initialState,
  isConfirming,
  splitAnswer,
  type IntakeAction,
  type IntakeState,
  type Translator,
} from "@/views/root/intake";
import type { AnswerIn, PlanOut, ProbeOut } from "@/lib/api-client";
import { PLAN_OUT, Q1, Q2, Q3 } from "./test-fixtures";

/** A translator that echoes its key (params serialized) — the core tests
 *  assert structure and effects, not rendered copy. */
const t: Translator = (key, params) =>
  params ? `${key}:${JSON.stringify(params)}` : key;

/** A constrained state builder (keeps `phase` a `Phase` literal). */
function mk(overrides: Partial<IntakeState> = {}): IntakeState {
  return { ...initialState(t), ...overrides };
}

/** Drive `apply` and return the result. */
function step(s0: IntakeState, action: IntakeAction) {
  return apply(s0, action, t);
}

function probe(questions: typeof Q1[] | null): ProbeOut {
  return { phase: questions ? "probing" : "planning", questions };
}

describe("intake core — splitAnswer", () => {
  it("returns a plain string for a single trimmed line", () => {
    expect(splitAnswer("  one  ")).toBe("one");
  });
  it("returns a list for multiple lines, dropping blank lines", () => {
    expect(splitAnswer("  a  \n\n  b \n")).toEqual(["a", "b"]);
  });
});

describe("intake core — submit (stores the pending you-turn)", () => {
  it("creates the session on the first send, recording the learner's reply", () => {
    const { state, effects } = step(mk(), { type: "submit", text: "goal" });
    expect(effects).toEqual([{ type: "api", call: "createSession", goal: "goal" }]);
    expect(state.inFlight).toBe("clarify");
    // The learner's reply to the opening prompt is recorded (committed as
    // a "you" bubble when the request resolves).
    expect(state.pendingYou).toBe("goal");
    expect(state.pendingClear).toBe(true);
  });

  it("resumes the clarify loop once a session exists, recording the learner's words", () => {
    const s0 = mk({ sessionId: "s-1", phase: "clarifying" });
    const { state, effects } = step(s0, { type: "submit", text: "more" });
    expect(effects).toEqual([
      { type: "api", call: "clarifySession", sessionId: "s-1", answer: "more" },
    ]);
    expect(state.inFlight).toBe("clarify");
    expect(state.pendingYou).toBe("more");
    expect(state.pendingClear).toBe(true);
  });

  it("is a no-op while a request is in flight", () => {
    const s0 = mk({ inFlight: "clarify" });
    const { state, effects } = step(s0, { type: "submit", text: "again" });
    expect(effects).toEqual([]);
    expect(state).toBe(s0);
  });

  it("treats 'approve' (reviewing) as the approval command, not a you-turn", () => {
    const s0 = mk({ sessionId: "s-1", phase: "reviewing", plan: PLAN_OUT.plan });
    const { state, effects } = step(s0, { type: "submit", text: "  APPROVE " });
    expect(effects).toEqual([{ type: "api", call: "approvePlan", sessionId: "s-1" }]);
    expect(state.inFlight).toBe("approve");
    expect(state.pendingYou).toBeNull();
  });

  it("treats other review text as a plan adjustment pending commit", () => {
    const s0 = mk({ sessionId: "s-1", phase: "reviewing", plan: PLAN_OUT.plan });
    const { state, effects } = step(s0, { type: "submit", text: "drop the last step" });
    expect(effects).toEqual([
      { type: "api", call: "adjustPlan", sessionId: "s-1", adjustment: "drop the last step" },
    ]);
    expect(state.inFlight).toBe("adjust");
    expect(state.pendingYou).toBe("drop the last step");
  });

  it("triggers generation when awaiting a plan (text ignored, no you-turn)", () => {
    const s0 = mk({ sessionId: "s-1", phase: "planning" });
    const { state, effects } = step(s0, { type: "submit", text: "go" });
    expect(effects).toEqual([{ type: "api", call: "generatePlan", sessionId: "s-1" }]);
    expect(state.inFlight).toBe("plan");
    expect(state.pendingYou).toBeNull();
  });

  it("re-fetches the probe batch when probing with no batch on screen", () => {
    const s0 = mk({ sessionId: "s-1", phase: "probing" });
    const { state, effects } = step(s0, { type: "submit", text: "again" });
    expect(effects).toEqual([{ type: "api", call: "startProbe", sessionId: "s-1" }]);
    expect(state.inFlight).toBe("start");
    expect(state.pendingYou).toBe("again");
  });

  it("no-ops when a probe card is on screen (the click is the answer)", () => {
    const s0 = mk({ sessionId: "s-1", phase: "probing", batch: [Q1] });
    const { state, effects } = step(s0, { type: "submit", text: "irrelevant" });
    expect(effects).toEqual([]);
    expect(state).toBe(s0);
  });

  it("is a no-op in the legacy confirm step", () => {
    const s0 = mk({ sessionId: "s-1", phase: "generating" });
    const { state, effects } = step(s0, { type: "submit", text: "x" });
    expect(effects).toEqual([]);
    expect(state).toBe(s0);
  });
});

describe("intake core — clarifyResolved (commits the you-turn on success)", () => {
  it("records the learner's words then the first clarifying question (one at a time)", () => {
    const s0 = mk({ sessionId: "s-1", phase: "clarifying", pendingYou: "more", pendingClear: true });
    const { state, effects } = step(s0, {
      type: "clarifyResolved",
      result: { session_id: "s-1", phase: "clarifying", clarifying_questions: ["a?"] },
    });
    expect(effects).toEqual([]);
    expect(state.inFlight).toBe(null);
    expect(state.pendingYou).toBeNull();
    expect(state.pendingClear).toBe(false);
    expect(state.bubbles.at(-2)).toEqual({ kind: "text", from: "you", text: "more" });
    // The question is presented one at a time — a single string, not a list.
    expect(state.bubbles.at(-1)).toEqual({ kind: "text", from: "ai", text: "a?" });
    expect(state.clarifyBatch).toEqual(["a?"]);
    expect(state.clarifyPicks).toEqual([]);
  });

  it("surfaces all the clarifying questions at the front (one at a time) when several arrive", () => {
    const s0 = mk({ sessionId: "s-1", phase: "clarifying" });
    const { state } = step(s0, {
      type: "clarifyResolved",
      result: { session_id: "s-1", phase: "clarifying", clarifying_questions: ["a?", "b?", "c?"] },
    });
    expect(state.clarifyBatch).toEqual(["a?", "b?", "c?"]);
    expect(state.clarifyPicks).toEqual([]);
    expect(state.bubbles.at(-1)).toEqual({ kind: "text", from: "ai", text: "a?" });
  });

  it("shows thin feedback when the phase is clarifying with no questions", () => {
    const s0 = mk({ sessionId: "s-1", phase: "clarifying" });
    const { state } = step(s0, {
      type: "clarifyResolved",
      result: { session_id: "s-1", phase: "clarifying", clarifying_questions: null },
    });
    expect(state.clarifyBatch).toBeNull();
    expect(state.bubbles.at(-1)).toEqual({ kind: "text", from: "ai", text: t("thinFeedback") });
  });

  it("starts the probe loop when the phase advances to probing", () => {
    const s0 = mk({ sessionId: "s-1" });
    const { state, effects } = step(s0, {
      type: "clarifyResolved",
      result: { session_id: "s-1", phase: "probing", narrowed_goal: "Newton" },
    });
    expect(effects).toEqual([{ type: "api", call: "startProbe", sessionId: "s-1" }]);
    expect(state.phase).toBe("probing");
    expect(state.inFlight).toBe("start");
    // The narrowed goal lands in a highlighted ai bubble.
    expect(state.bubbles.at(-1)).toEqual({
      kind: "text",
      from: "ai",
      text: t("yourNarrowedGoal", { goal: "Newton" }),
      highlighted: true,
    });
  });

  it("auto-generates the plan when the phase advances to planning", () => {
    const s0 = mk({ sessionId: "s-1" });
    const { state, effects } = step(s0, {
      type: "clarifyResolved",
      result: { session_id: "s-1", phase: "planning" },
    });
    expect(effects).toEqual([{ type: "api", call: "generatePlan", sessionId: "s-1" }]);
    expect(state.phase).toBe("planning");
    expect(state.inFlight).toBe("plan");
  });

  it("clears the clarify batch when the phase advances", () => {
    const s0 = mk({ sessionId: "s-1", phase: "clarifying", clarifyBatch: ["a?", "b?"], clarifyPicks: ["a"] });
    const { state } = step(s0, {
      type: "clarifyResolved",
      result: { session_id: "s-1", phase: "probing" },
    });
    expect(state.clarifyBatch).toBeNull();
    expect(state.clarifyPicks).toEqual([]);
  });
});

describe("intake core — clarifying questions one at a time", () => {
  /** A clarifying state with a two-question batch on screen (first active). */
  function clarifying(): IntakeState {
    return mk({
      sessionId: "s-1",
      phase: "clarifying",
      clarifyBatch: ["What topic?", "What depth?"],
      clarifyPicks: [],
    });
  }

  it("commits the answer locally and surfaces the next question for a non-final one", () => {
    const { state, effects, clearInput } = step(clarifying(), { type: "submit", text: "physics" });
    expect(effects).toEqual([]);
    expect(clearInput).toBe(true);
    expect(state.inFlight).toBe(null);
    expect(state.clarifyPicks).toEqual(["physics"]);
    // The answer commits as a you-turn; the next question is now active.
    expect(state.bubbles.at(-2)).toEqual({ kind: "text", from: "you", text: "physics" });
    expect(state.bubbles.at(-1)).toEqual({ kind: "text", from: "ai", text: "What depth?" });
  });

  it("sends the combined answer to the backend for the final question", () => {
    const afterFirst = step(clarifying(), { type: "submit", text: "physics" }).state;
    const { state, effects, clearInput } = step(afterFirst, { type: "submit", text: "an overview" });
    expect(state.inFlight).toBe("clarify");
    expect(clearInput).toBe(false);
    expect(effects).toEqual([
      {
        type: "api",
        call: "clarifySession",
        sessionId: "s-1",
        answer: "physics\nan overview",
      },
    ]);
    // The final answer is a pending you-turn (committed on success).
    expect(state.pendingYou).toBe("an overview");
    expect(state.pendingClear).toBe(true);
  });

  it("is a no-op once the batch is exhausted", () => {
    const exhausted = mk({
      sessionId: "s-1",
      phase: "clarifying",
      clarifyBatch: ["What topic?"],
      clarifyPicks: ["physics"],
    });
    const { state, effects } = step(exhausted, { type: "submit", text: "again" });
    expect(effects).toEqual([]);
    expect(state).toBe(exhausted);
  });

  it("ignores a blank answer (stays on the same question, no bubble)", () => {
    const s0 = clarifying();
    const { state, effects, clearInput } = step(s0, { type: "submit", text: "   " });
    expect(effects).toEqual([]);
    expect(clearInput).toBe(false);
    // No pick recorded and no new bubble — the question is unchanged.
    expect(state.clarifyPicks).toEqual([]);
    expect(state.bubbles).toEqual(s0.bubbles);
  });

  it("re-arms the final question on a failed combined submit (discards the answer)", () => {
    const afterFirst = step(clarifying(), { type: "submit", text: "physics" }).state;
    const afterSecond = step(afterFirst, { type: "submit", text: "an overview" }).state;
    const { state } = step(afterSecond, { type: "apiFailed", message: "boom" });
    expect(state.inFlight).toBe(null);
    expect(state.error).toBe("boom");
    // The final pick is dropped so the last question is answerable again.
    expect(state.clarifyPicks).toEqual(["physics"]);
    expect(state.clarifyBatch).toEqual(["What topic?", "What depth?"]);
    // The final answer was never committed as a you-turn.
    expect(state.bubbles.at(-1)).toEqual({ kind: "text", from: "ai", text: "What depth?" });
  });
});

describe("intake core — probe loop", () => {
  it("commits the you-turn then surfaces the first card (probe resubmit)", () => {
    const s0 = mk({ sessionId: "s-1", phase: "probing", pendingYou: "again", pendingClear: true });
    const { state, clearInput } = step(s0, { type: "probeStarted", probe: probe([Q1, Q2]) });
    expect(state.batch).toHaveLength(2);
    expect(state.bubbles.at(-2)).toEqual({ kind: "text", from: "you", text: "again" });
    expect(state.bubbles.at(-1)).toMatchObject({ kind: "probe", state: "active" });
    expect(clearInput).toBe(true);
  });

  it("surfaces the no-questions error when the batch is empty", () => {
    const s0 = mk({ sessionId: "s-1", phase: "probing" });
    const { state } = step(s0, { type: "probeStarted", probe: probe(null) });
    expect(state.inFlight).toBe(null);
    expect(state.error).toBe(t("errorNoQuestions"));
    expect(state.batch).toBeNull();
  });

  it("advances locally (no effect) when answering a non-final card", () => {
    const afterStart = step(
      mk({ sessionId: "s-1", phase: "probing" }),
      { type: "probeStarted", probe: probe([Q1, Q2]) },
    ).state;
    const { state, effects } = step(afterStart, { type: "pickOption", canonicalIndex: 1 });
    expect(effects).toEqual([]);
    expect(state.picks).toEqual([1]);
    expect(state.answered).toBe(1);
    // The first card is revealed; the second becomes the active card.
    expect(state.bubbles.at(-2)).toMatchObject({ kind: "probe", state: "answered", picked: 1 });
    expect(state.bubbles.at(-1)).toMatchObject({ kind: "probe", state: "active" });
  });

  it("submits the combined batch when answering the final card", () => {
    const afterStart = step(
      mk({ sessionId: "s-1", phase: "probing" }),
      { type: "probeStarted", probe: probe([Q1, Q2]) },
    ).state;
    const afterFirst = step(afterStart, { type: "pickOption", canonicalIndex: 1 }).state;
    const { state, effects } = step(afterFirst, { type: "pickOption", canonicalIndex: 2 });
    expect(state.inFlight).toBe("batch");
    expect(effects).toEqual([
      {
        type: "api",
        call: "answerProbe",
        sessionId: "s-1",
        answers: [
          { question_id: Q1.id, selected_index: 1 },
          { question_id: Q2.id, selected_index: 2 },
        ] satisfies AnswerIn[],
      },
    ]);
  });

  it("auto-generates the plan at the boundary", () => {
    const s0 = mk({ sessionId: "s-1", phase: "probing", picks: [1, 1], answered: 2 });
    const { state, effects } = step(s0, { type: "batchResolved", probe: probe(null) });
    expect(effects).toEqual([{ type: "api", call: "generatePlan", sessionId: "s-1" }]);
    expect(state.phase).toBe("planning");
    expect(state.batch).toBeNull();
    expect(state.bubbles.at(-1)).toEqual({
      kind: "text",
      from: "ai",
      text: t("boundaryEstablished", { n: 2 }),
    });
  });
});

describe("intake core — plan", () => {
  it("commits the you-turn then lands the adjusted plan", () => {
    const s0 = mk({ sessionId: "s-1", phase: "reviewing", plan: PLAN_OUT.plan, pendingYou: "drop", pendingClear: true });
    const revised: PlanOut = { phase: "reviewing", plan: { ...PLAN_OUT.plan, prose_summary: "v2" } };
    const { state, clearInput } = step(s0, { type: "planAdjusted", plan: revised });
    expect(state.bubbles.at(-2)).toEqual({ kind: "text", from: "you", text: "drop" });
    expect(state.bubbles.at(-1)).toMatchObject({ kind: "plan", plan: revised.plan });
    expect(clearInput).toBe(true);
  });

  it("lands the generated plan in a plan bubble (no you-turn)", () => {
    const s0 = mk({ sessionId: "s-1", phase: "planning" });
    const { state } = step(s0, { type: "planResolved", plan: PLAN_OUT });
    expect(state.phase).toBe("reviewing");
    expect(state.plan).toEqual(PLAN_OUT.plan);
    expect(state.bubbles.at(-1)).toMatchObject({ kind: "plan", plan: PLAN_OUT.plan });
  });
});

describe("intake core — approve (the post-approval 'on the way' state)", () => {
  it("enters the on-the-way state after approval: generating phase, idle, no accept effect", () => {
    const s0 = mk({ sessionId: "s-1", phase: "reviewing", plan: PLAN_OUT.plan, inFlight: "approve" });
    const { state, effects, clearInput } = step(s0, { type: "approveDone" });
    // The approval request settles and no further request is in flight — the
    // dialog does not poll for materials.
    expect(effects).toEqual([]);
    expect(clearInput).toBe(false);
    expect(state.inFlight).toBeNull();
    expect(state.onTheWay).toBe(true);
    // The generating phase lights the Generating rail step.
    expect(state.phase).toBe("generating");
    // The review artifacts are cleared; the conversation history is kept.
    expect(state.plan).toBeNull();
    expect(state.batch).toBeNull();
    expect(state.picks).toEqual([]);
  });

  it("closes the on-the-way state back to a fresh intake", () => {
    const s0 = mk({ sessionId: "s-1", phase: "generating", onTheWay: true });
    const { state } = step(s0, { type: "close" });
    expect(state.onTheWay).toBe(false);
    expect(state.sessionId).toBeNull();
    expect(state.bubbles).toHaveLength(1);
  });
});

describe("intake core — failures (discard the pending you-turn, preserve input)", () => {
  it("records the transport fallback and clears nothing", () => {
    const s0 = mk({ inFlight: "clarify", pendingYou: "goal", pendingClear: true });
    const { state, clearInput } = step(s0, { type: "apiFailed", message: "Something went wrong." });
    expect(state.inFlight).toBe(null);
    expect(state.error).toBe("Something went wrong.");
    expect(state.pendingYou).toBeNull();
    expect(state.pendingClear).toBe(false);
    expect(clearInput).toBe(false);
    // The user's words were never committed as a bubble.
    expect(state.bubbles).toHaveLength(1);
  });

  it("unlocks the active probe card and reverts the last pick on a batch failure", () => {
    const afterStart = step(
      mk({ sessionId: "s-1", phase: "probing" }),
      { type: "probeStarted", probe: probe([Q1, Q2]) },
    ).state;
    const afterFirst = step(afterStart, { type: "pickOption", canonicalIndex: 1 }).state;
    const afterSecond = step(afterFirst, { type: "pickOption", canonicalIndex: 2 }).state;
    const { state } = step(afterSecond, { type: "apiFailed", message: "boom" });
    expect(state.picks).toEqual([1]);
    const last = state.bubbles.at(-1);
    expect(last).toMatchObject({ kind: "probe", state: "active" });
    expect((last as { picked?: number }).picked).toBeUndefined();
  });
});

describe("intake core — close / view-model / confirming", () => {
  it("resets to the initial state on close", () => {
    const s0 = mk({ sessionId: "s-1", phase: "clarifying" });
    const { state } = step(s0, { type: "close" });
    expect(state.sessionId).toBeNull();
    expect(state.bubbles).toHaveLength(1);
  });

  it("flags the post-plan lifecycle phases as confirming", () => {
    expect(isConfirming("generating")).toBe(true);
    expect(isConfirming("reviewing")).toBe(false);
  });

  it("reports Ready and the clarify label before the first submit", () => {
    const vm = deriveViewModel(mk(), t);
    expect(vm.pending).toBe(false);
    expect(vm.confirming).toBe(false);
    expect(vm.intake.label).toBe(t("labelClarify"));
    expect(vm.intake.disabled).toBe(false);
  });

  it("disables the intake while a probe card is answerable", () => {
    const vm = deriveViewModel(mk({ sessionId: "s-1", phase: "probing", batch: [Q1], picks: [] }), t);
    expect(vm.intake.disabled).toBe(true);
    expect(vm.pendingNote).toBe(t("pendingProbeAnswer"));
  });

  it("flags the post-approval on-the-way state (idle, no pending)", () => {
    const vm = deriveViewModel(mk({ sessionId: "s-1", phase: "generating", onTheWay: true }), t);
    expect(vm.onTheWay).toBe(true);
    expect(vm.pending).toBe(false);
    expect(vm.showPending).toBe(false);
  });
});

describe("intake core — progress rail", () => {
  it("shows all steps as future with the ready counter before the first submit", () => {
    const vm = deriveViewModel(mk(), t);
    expect(vm.rail.steps).toHaveLength(4);
    expect(vm.rail.steps.map((s) => s.state)).toEqual(["future", "future", "future", "future"]);
    expect(vm.rail.counter).toBe(t("railCounterReady"));
    expect(vm.rail.pending).toBe(false);
  });

  it("marks step 0 as current during clarifying", () => {
    const vm = deriveViewModel(mk({ sessionId: "s-1", phase: "clarifying" }), t);
    expect(vm.rail.steps.map((s) => s.state)).toEqual(["current", "future", "future", "future"]);
    expect(vm.rail.counter).toBe(t("railCounterClarifying"));
  });

  it("marks step 0 done and step 1 current during probing", () => {
    const vm = deriveViewModel(mk({ sessionId: "s-1", phase: "probing" }), t);
    expect(vm.rail.steps.map((s) => s.state)).toEqual(["done", "current", "future", "future"]);
    expect(vm.rail.counter).toBe(t("railCounterProbing"));
  });

  it("marks steps 0-1 done and step 2 current during planning", () => {
    const vm = deriveViewModel(mk({ sessionId: "s-1", phase: "planning" }), t);
    expect(vm.rail.steps.map((s) => s.state)).toEqual(["done", "done", "current", "future"]);
    expect(vm.rail.counter).toBe(t("railCounterPlanning"));
  });

  it("folds reviewing into the planning step (step 2 current)", () => {
    const vm = deriveViewModel(mk({ sessionId: "s-1", phase: "reviewing", plan: PLAN_OUT.plan }), t);
    expect(vm.rail.steps.map((s) => s.state)).toEqual(["done", "done", "current", "future"]);
    expect(vm.rail.counter).toBe(t("railCounterPlanning"));
  });

  it("marks steps 0-2 done and step 3 current during generating", () => {
    const vm = deriveViewModel(mk({ sessionId: "s-1", phase: "generating" }), t);
    expect(vm.rail.steps.map((s) => s.state)).toEqual(["done", "done", "done", "current"]);
    expect(vm.rail.counter).toBe(t("railCounterGenerating"));
  });

  it("marks all steps done for executing/complete phases", () => {
    const vm = deriveViewModel(mk({ sessionId: "s-1", phase: "complete" }), t);
    expect(vm.rail.steps.map((s) => s.state)).toEqual(["done", "done", "done", "done"]);
  });

  it("keeps the Generating step active in the on-the-way state (idle, not pulsing)", () => {
    const vm = deriveViewModel(mk({ sessionId: "s-1", phase: "generating", onTheWay: true }), t);
    expect(vm.rail.steps.map((s) => s.state)).toEqual(["done", "done", "done", "current"]);
    expect(vm.rail.counter).toBe(t("railCounterGenerating"));
    expect(vm.rail.pending).toBe(false);
  });

  it("sets rail.pending to true while a request is in flight", () => {
    const vm = deriveViewModel(mk({ sessionId: "s-1", phase: "clarifying", inFlight: "clarify" }), t);
    expect(vm.rail.pending).toBe(true);
  });

  it("sets rail.pending to false when idle", () => {
    const vm = deriveViewModel(mk({ sessionId: "s-1", phase: "probing" }), t);
    expect(vm.rail.pending).toBe(false);
  });
});

describe("intake core — probe position (batch-local)", () => {
  it("is hidden when the rail is not on the Probing step", () => {
    expect(deriveViewModel(mk(), t).rail.probePosition).toBeNull();
    expect(
      deriveViewModel(mk({ sessionId: "s-1", phase: "clarifying" }), t).rail
        .probePosition,
    ).toBeNull();
    expect(
      deriveViewModel(mk({ sessionId: "s-1", phase: "planning" }), t).rail
        .probePosition,
    ).toBeNull();
    expect(
      deriveViewModel(mk({ sessionId: "s-1", phase: "generating" }), t).rail
        .probePosition,
    ).toBeNull();
  });

  it("is hidden while probing with no batch on screen (a refetch)", () => {
    const vm = deriveViewModel(
      mk({ sessionId: "s-1", phase: "probing", inFlight: "start" }),
      t,
    );
    expect(vm.rail.probePosition).toBeNull();
  });

  it("shows the batch-local position for the first card", () => {
    const vm = deriveViewModel(
      mk({ sessionId: "s-1", phase: "probing", batch: [Q1, Q2], picks: [] }),
      t,
    );
    expect(vm.rail.probePosition).toBe(
      t("railProbePosition", { n: 1, total: 2 }),
    );
  });

  it("advances with each answer, using the batch size as the denominator", () => {
    const batch = [Q1, Q2, Q3, Q1];
    const positionAt = (picks: number) =>
      deriveViewModel(
        mk({
          sessionId: "s-1",
          phase: "probing",
          batch,
          picks: Array(picks).fill(1),
          answered: picks,
        }),
        t,
      ).rail.probePosition;
    expect(positionAt(0)).toBe(t("railProbePosition", { n: 1, total: 4 }));
    expect(positionAt(1)).toBe(t("railProbePosition", { n: 2, total: 4 }));
  });

  it("clamps to the batch size once the last card is answered (no overshoot)", () => {
    const vm = deriveViewModel(
      mk({
        sessionId: "s-1",
        phase: "probing",
        batch: [Q1, Q2],
        picks: [1, 2],
        answered: 2,
        inFlight: "batch",
      }),
      t,
    );
    expect(vm.rail.probePosition).toBe(
      t("railProbePosition", { n: 2, total: 2 }),
    );
  });
});

describe("intake core — clarify position (batch-local)", () => {
  it("is hidden when no clarify batch is on screen", () => {
    expect(deriveViewModel(mk(), t).rail.clarifyPosition).toBeNull();
    // Clarifying with no batch (e.g. the first submit is in flight) is hidden.
    expect(
      deriveViewModel(
        mk({ sessionId: "s-1", phase: "clarifying", inFlight: "clarify" }),
        t,
      ).rail.clarifyPosition,
    ).toBeNull();
    // Non-clarifying phases are always hidden.
    expect(
      deriveViewModel(mk({ sessionId: "s-1", phase: "probing" }), t).rail
        .clarifyPosition,
    ).toBeNull();
  });

  it("shows the batch-local position for the first question", () => {
    const vm = deriveViewModel(
      mk({
        sessionId: "s-1",
        phase: "clarifying",
        clarifyBatch: ["What topic?", "What depth?"],
        clarifyPicks: [],
      }),
      t,
    );
    expect(vm.rail.clarifyPosition).toBe(t("railProbePosition", { n: 1, total: 2 }));
  });

  it("advances with each answer and is hidden once the batch is exhausted", () => {
    const positionAt = (picks: string) =>
      deriveViewModel(
        mk({
          sessionId: "s-1",
          phase: "clarifying",
          clarifyBatch: ["What topic?", "What depth?"],
          clarifyPicks: picks ? [picks] : [],
        }),
        t,
      ).rail.clarifyPosition;
    expect(positionAt("")).toBe(t("railProbePosition", { n: 1, total: 2 }));
    expect(positionAt("physics")).toBe(t("railProbePosition", { n: 2, total: 2 }));
  });
});
