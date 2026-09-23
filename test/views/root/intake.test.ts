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
import { PLAN_OUT, Q1, Q2 } from "./test-fixtures";

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
  it("creates the session on the first send (no session yet), clearing input on success", () => {
    const { state, effects } = step(mk(), { type: "submit", text: "goal" });
    expect(effects).toEqual([{ type: "api", call: "createSession", goal: "goal" }]);
    expect(state.inFlight).toBe("clarify");
    expect(state.pendingYou).toBeNull(); // the first send carries no you-bubble
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
  it("records the learner's words then the clarifying questions", () => {
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
    expect(state.bubbles.at(-1)).toEqual({ kind: "text", from: "ai", text: ["a?"] });
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

  it("sets rail.pending to true while a request is in flight", () => {
    const vm = deriveViewModel(mk({ sessionId: "s-1", phase: "clarifying", inFlight: "clarify" }), t);
    expect(vm.rail.pending).toBe(true);
  });

  it("sets rail.pending to false when idle", () => {
    const vm = deriveViewModel(mk({ sessionId: "s-1", phase: "probing" }), t);
    expect(vm.rail.pending).toBe(false);
  });
});
