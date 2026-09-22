// @vitest-environment jsdom
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import {
  ApiError,
  adjustPlan,
  answerProbe,
  approvePlan,
  clarifySession,
  createSession,
  generatePlan,
  startProbe,
  type ProbeQuestionOut,
} from "@/lib/api-client";
import { useProbePhase, withDisplayOrder } from "@/views/root/hooks";
import {
  GOAL,
  PLAN_OUT,
  Q1,
  Q2,
  Q3,
  PROBE_LABEL,
  REVIEW_LABEL,
  UNKNOWN_OPTION,
  makePhaseContext,
  openDialog,
  renderPhaseHook,
} from "./test-fixtures";

vi.mock("@/lib/api-client", () => ({
  createSession: vi.fn(),
  clarifySession: vi.fn(),
  startProbe: vi.fn(),
  answerProbe: vi.fn(),
  generatePlan: vi.fn(),
  adjustPlan: vi.fn(),
  approvePlan: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

const mockCreateSession = vi.mocked(createSession);
const mockClarifySession = vi.mocked(clarifySession);
const mockStartProbe = vi.mocked(startProbe);
const mockAnswerProbe = vi.mocked(answerProbe);
const mockGeneratePlan = vi.mocked(generatePlan);
const mockAdjustPlan = vi.mocked(adjustPlan);
const mockApprovePlan = vi.mocked(approvePlan);

// ── Shuffle-agnostic option helpers ─────────────────────────────────────
// Probe questions render as the shared QuizQuestion card: semantic option
// BUTTONS in a per-question shuffled display order (#74). The tests never
// assume which letter an option sits under: they read the displayed order
// from the DOM, pick options by their text, and assert on the BACKEND
// indices the submit carries.

/** The card for one question: the heading's parent (h2 → card root). */
function card(questionText: string) {
  const heading = screen.getByText(questionText);
  const root = heading.closest("div");
  expect(root).toBeTruthy();
  return root as HTMLElement;
}

/** The option texts of one question's card, in displayed order. */
function cardOptions(questionText: string): string[] {
  return Array.from(card(questionText).querySelectorAll("button")).map(
    (button) => (button.textContent ?? "").slice(1).trim(),
  );
}

/** Click the option with the given text in the question's card. */
function clickOption(questionText: string, optionText: string) {
  const buttons = Array.from(
    card(questionText).querySelectorAll("button"),
  ) as HTMLButtonElement[];
  const target = buttons.find((button) =>
    (button.textContent ?? "").trim().includes(optionText),
  );
  expect(target).toBeTruthy();
  expect(target!.disabled).toBe(false);
  fireEvent.click(target!);
}

/**
 * Drive the dialog from intake to its first probe batch. Only the batch's
 * FIRST question is surfaced — the rest are drawn one at a time as the
 * learner answers.
 */
async function reachFirstBatch(
  batch: ProbeQuestionOut[] = [Q1, Q2],
  onAccept: () => void = () => {},
) {
  mockCreateSession.mockResolvedValue({
    session_id: "s-1",
    phase: "probing",
    narrowed_goal: "Newton's second law of motion",
  });
  mockStartProbe.mockResolvedValue({ phase: "probing", questions: batch });
  await openDialog(GOAL, onAccept);
  fireEvent.click(screen.getByRole("button", { name: /Send/ }));
  await screen.findByText(batch[0].text);
  return batch;
}

beforeEach(() => {
  mockCreateSession.mockReset();
  mockClarifySession.mockReset();
  mockStartProbe.mockReset();
  mockAnswerProbe.mockReset();
  mockGeneratePlan.mockReset();
  mockAdjustPlan.mockReset();
  mockApprovePlan.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("withDisplayOrder", () => {
  it("shuffles only the LLM options and pins the unknown option last", () => {
    const n = Q1.options.length;
    // Across many draws, the last display position is always the
    // backend's unknown-option index, and the rest is a permutation of
    // 0..n-2.
    for (let i = 0; i < 50; i++) {
      const [shuffled] = withDisplayOrder([Q1]);
      expect(shuffled.order[shuffled.order.length - 1]).toBe(n - 1);
      expect([...shuffled.order.slice(0, -1)].sort((a, b) => a - b)).toEqual(
        Array.from({ length: n - 1 }, (_, j) => j),
      );
    }
  });

  it("handles a question with only the unknown option", () => {
    const [shuffled] = withDisplayOrder([
      { ...Q1, options: [UNKNOWN_OPTION] },
    ]);
    expect(shuffled.order).toEqual([0]);
  });
});

describe("NewSessionDialog probe loop (one at a time, click to answer)", () => {
  it("auto-fetches the first batch and shows only its first question", async () => {
    await reachFirstBatch([Q1, Q2]);

    expect(mockStartProbe).toHaveBeenCalledWith("s-1");
    // Only the first question of the batch is shown — never the whole batch.
    expect(screen.getByText(Q1.text)).toBeTruthy();
    expect(screen.queryByText(Q2.text)).toBeNull();
    // The options render (5 items) as a shuffled display of the backend
    // options — same set, order left to the client (#74) — with the
    // backend's "I don't know" option pinned last.
    expect(cardOptions(Q1.text)).toHaveLength(5);
    expect([...cardOptions(Q1.text)].sort()).toEqual([...Q1.options].sort());
    expect(cardOptions(Q1.text).at(-1)).toBe(UNKNOWN_OPTION);
    // The single-question intake: the textarea and Send stay visible but
    // disabled while the probe card is active.
    expect(screen.getByText(PROBE_LABEL)).toBeTruthy();
    expect(
      (screen.getByLabelText(PROBE_LABEL) as HTMLTextAreaElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: /Send/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.getByRole("button", { name: /Cancel/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Confirm/ })).toBeNull();
  });

  it("answers questions one at a time and combines them into a single submit", async () => {
    await reachFirstBatch([Q1, Q2]);
    mockAnswerProbe.mockResolvedValue({ phase: "probing", questions: [Q3] });

    // Q1: click its correct option. The card reveals in place (verdict +
    // explanation on the card — no separate "you" bubble), then Q2 (drawn
    // from the batch) appears. No request goes out until the batch is
    // exhausted.
    clickOption(Q1.text, "5 m/s²");
    expect(screen.getByText("Correct.")).toBeTruthy();
    expect(screen.getByText("a = F/m = 10/2 = 5 m/s².")).toBeTruthy();
    expect(await screen.findByText(Q2.text)).toBeTruthy();
    expect(mockAnswerProbe).not.toHaveBeenCalled();
    // The answered card stays locked.
    expect(
      (card(Q1.text).querySelectorAll("button")[0] as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    // Q2: click its correct option — the batch is now complete, so one
    // combined submit goes out. The payload carries the options' BACKEND
    // indices (1, 1), whatever letters they displayed under (#74).
    clickOption(Q2.text, "doubles");
    expect(mockAnswerProbe).toHaveBeenCalledWith("s-1", [
      { question_id: "q1", selected_index: 1 },
      { question_id: "q2", selected_index: 1 },
    ]);
    // The card reveals instantaneously on the click — before the combined
    // submit resolves (MathText splits the explanation into math/prose
    // spans, so match the prose part).
    expect(screen.getByText(/doubling F doubles a/)).toBeTruthy();
    // The next (size-1) batch renders with its own card.
    await screen.findByText(Q3.text);
  });

  it("reveals the last question's card instantaneously on the click, before the submit resolves", async () => {
    await reachFirstBatch([Q1, Q2]);
    // The combined submit never resolves — it stays in flight.
    mockAnswerProbe.mockReturnValue(new Promise(() => {}));

    // Answer Q1 (local — no round-trip); Q2 (the batch's last) appears.
    clickOption(Q1.text, "5 m/s²");
    await screen.findByText(Q2.text);

    // The last question's click must re-render the card INSTANTLY —
    // locked options, verdict, and explanation — without waiting for the
    // backend. The card is revealed even though the submit is pending.
    clickOption(Q2.text, "doubles");
    const q2 = card(Q2.text);
    const q2Buttons = Array.from(q2.querySelectorAll("button")) as HTMLButtonElement[];
    expect(q2Buttons.every((button) => button.disabled)).toBe(true);
    expect(q2.textContent).toContain("Correct.");
    // MathText splits the explanation into math/prose spans, so match the
    // prose part.
    expect(q2.textContent).toContain("doubling F doubles a");
    // The submit went out (and is still pending).
    expect(mockAnswerProbe).toHaveBeenCalledWith("s-1", [
      { question_id: "q1", selected_index: 1 },
      { question_id: "q2", selected_index: 1 },
    ]);
    expect(mockAnswerProbe).toHaveBeenCalledTimes(1);
  });

  it("explains a wrong answer within the batch", async () => {
    await reachFirstBatch([Q1, Q2]);
    mockAnswerProbe.mockResolvedValue({ phase: "probing", questions: [Q3] });

    // Q1 answered with a wrong option (by its text) — the card reveals the
    // verdict and the explanation in place (no "you" + verdict bubbles).
    clickOption(Q1.text, "2 m/s²");
    expect(screen.getByText("Not quite.")).toBeTruthy();
    expect(screen.getByText("a = F/m = 10/2 = 5 m/s².")).toBeTruthy();
    // Q2 is now shown (drawn from the batch).
    expect(await screen.findByText(Q2.text)).toBeTruthy();

    // Q2 answered with its correct option; the batch is submitted and Q3
    // arrives. The payload maps the picks back to backend indices (0, 1).
    clickOption(Q2.text, "doubles");
    expect(mockAnswerProbe).toHaveBeenCalledWith("s-1", [
      { question_id: "q1", selected_index: 0 },
      { question_id: "q2", selected_index: 1 },
    ]);
    // The card reveals instantaneously on the click — before the combined
    // submit resolves (MathText splits the explanation into math/prose
    // spans, so match the prose part).
    expect(screen.getByText(/doubling F doubles a/)).toBeTruthy();
    await screen.findByText(Q3.text);
  });

  it("auto-generates the plan once the boundary map arrives", async () => {
    const onAccept = vi.fn();
    await reachFirstBatch([Q1, Q2], onAccept);
    mockAnswerProbe.mockResolvedValue({
      phase: "planning",
      boundary_map: { f_ma_relation: { floor: "scalar F = ma", ceiling: null } },
    });
    mockGeneratePlan.mockResolvedValue(PLAN_OUT);

    // Answer both questions in the batch; the second (last) triggers the
    // combined submit, which returns the boundary map.
    clickOption(Q1.text, "5 m/s²");
    await screen.findByText(Q2.text);
    clickOption(Q2.text, "doubles");
    expect(mockAnswerProbe).toHaveBeenCalledWith("s-1", [
      { question_id: "q1", selected_index: 1 },
      { question_id: "q2", selected_index: 1 },
    ]);

    // The completion message lands with the total answered (2).
    await screen.findByText(
      "Boundary established after 2 questions. Your learning plan is ready.",
    );
    // The plan auto-generates and lands in a highlighted plan bubble.
    expect(mockGeneratePlan).toHaveBeenCalledWith("s-1");
    const summary = await screen.findByText(PLAN_OUT.plan.prose_summary);
    expect(summary.closest('[class*="bg-primary/10"]')).toBeTruthy();
    expect(screen.getByRole("button", { name: /Cancel/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Send/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Confirm/ })).toBeNull();

    // The typed approval command hands off once.
    mockApprovePlan.mockResolvedValue({
      phase: "generating",
      message: "Plan approved.",
    });
    const review = screen.getByLabelText(REVIEW_LABEL);
    fireEvent.change(review, { target: { value: "approve" } });
    fireEvent.keyDown(review, { key: "Enter" });
    await vi.waitFor(() => expect(onAccept).toHaveBeenCalledTimes(1));
  });

  it("disables the buttons while the boundary-triggered plan generation is in flight", async () => {
    await reachFirstBatch([Q1, Q2]);
    mockAnswerProbe.mockResolvedValue({
      phase: "planning",
      boundary_map: { f_ma_relation: { floor: "scalar F = ma", ceiling: null } },
    });
    mockGeneratePlan.mockReturnValue(new Promise(() => {}));

    clickOption(Q1.text, "5 m/s²");
    await screen.findByText(Q2.text);
    clickOption(Q2.text, "doubles");

    // The completion message lands while generatePlan is still in flight.
    await screen.findByText(
      "Boundary established after 2 questions. Your learning plan is ready.",
    );
    // Send and Cancel stay disabled until the plan arrives.
    expect(
      (screen.getByRole("button", { name: /Send/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: /Cancel/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("completes the loop across multiple batches with a running count", async () => {
    await reachFirstBatch([Q1, Q2]);
    mockAnswerProbe
      .mockResolvedValueOnce({ phase: "probing", questions: [Q3] })
      .mockResolvedValueOnce({
        phase: "planning",
        boundary_map: {
          f_ma_relation: { floor: "scalar F = ma", ceiling: "vector form" },
        },
      });
    mockGeneratePlan.mockResolvedValue(PLAN_OUT);

    // Batch 1 ([Q1, Q2]): answer Q1 then Q2 → one combined submit → [Q3].
    clickOption(Q1.text, "5 m/s²");
    await screen.findByText(Q2.text);
    clickOption(Q2.text, "doubles");
    await screen.findByText(Q3.text);

    // Batch 2 ([Q3], size 1): answer Q3 (its correct option) → combined
    // submit → boundary map. The submit maps back to Q3's backend index.
    clickOption(Q3.text, "mass");
    expect(mockAnswerProbe).toHaveBeenLastCalledWith("s-1", [
      { question_id: "q3", selected_index: 1 },
    ]);
    await screen.findByText(
      "Boundary established after 3 questions. Your learning plan is ready.",
    );
    // The plan bubble lands and the review step takes over.
    expect(await screen.findByText(PLAN_OUT.plan.prose_summary)).toBeTruthy();
    expect(screen.getByText(REVIEW_LABEL)).toBeTruthy();
  });

  it("shows only the first question of a following batch", async () => {
    // First batch is a single question; the second batch has two.
    await reachFirstBatch([Q1]);
    mockAnswerProbe.mockResolvedValue({ phase: "probing", questions: [Q2, Q3] });

    // Answer the only question in batch 1 → the combined submit returns batch 2.
    clickOption(Q1.text, "5 m/s²");
    // Only the FIRST question of batch 2 ([Q2, Q3]) is surfaced — never Q3 yet.
    expect(await screen.findByText(Q2.text)).toBeTruthy();
    expect(screen.queryByText(Q3.text)).toBeNull();
    // Still only one request (the batch-1 submit); stepping to Q3 is local.
    expect(mockAnswerProbe).toHaveBeenCalledTimes(1);

    // Answer Q2 → Q3 is drawn from the batch (no round-trip).
    clickOption(Q2.text, "doubles");
    expect(await screen.findByText(Q3.text)).toBeTruthy();
    expect(mockAnswerProbe).toHaveBeenCalledTimes(1);
  });

  it("keeps the unknown option pinned last on every question", async () => {
    await reachFirstBatch([Q1, Q2]);
    mockAnswerProbe.mockResolvedValue({ phase: "probing", questions: [Q3] });

    // Q1 (first of batch 1).
    expect(cardOptions(Q1.text).at(-1)).toBe(UNKNOWN_OPTION);
    // Q2 (drawn from the batch).
    clickOption(Q1.text, "5 m/s²");
    await screen.findByText(Q2.text);
    expect(cardOptions(Q2.text).at(-1)).toBe(UNKNOWN_OPTION);
    // Q3 (first of the next batch).
    clickOption(Q2.text, "doubles");
    await screen.findByText(Q3.text);
    expect(cardOptions(Q3.text).at(-1)).toBe(UNKNOWN_OPTION);
  });

  it("maps a pick of the unknown option to its last backend index", async () => {
    await reachFirstBatch([Q1, Q2]);
    mockAnswerProbe.mockResolvedValue({ phase: "probing", questions: [Q3] });

    // Pick "I don't know" on Q1 — it always sits last. It is never the
    // correct answer, so the card reveals it as a miss.
    clickOption(Q1.text, UNKNOWN_OPTION);
    expect(screen.getByText("Not quite.")).toBeTruthy();
    expect(screen.getByText("a = F/m = 10/2 = 5 m/s².")).toBeTruthy();

    // Finish the batch — the combined submit carries the unknown pick as
    // Q1's last backend index (4) and Q2's correct index (1).
    clickOption(Q2.text, "doubles");
    expect(mockAnswerProbe).toHaveBeenCalledWith("s-1", [
      { question_id: "q1", selected_index: 4 },
      { question_id: "q2", selected_index: 1 },
    ]);
  });

  it("shows a backend error and leaves the card unlocked on a failed submit", async () => {
    await reachFirstBatch([Q1, Q2]);
    mockAnswerProbe.mockRejectedValue(
      new ApiError("selected_index out of range", 422),
    );

    // Answer Q1 (valid click) — no submit yet, just moves to Q2.
    clickOption(Q1.text, "5 m/s²");
    await screen.findByText(Q2.text);
    expect(mockAnswerProbe).not.toHaveBeenCalled();

    // Answer Q2 (last) — the combined submit hits the 422.
    clickOption(Q2.text, "doubles");
    await screen.findByText("selected_index out of range");
    // The card stays UNLOCKED so the learner re-clicks: Q2's options are
    // still enabled and Q2 is still the active question.
    const options = cardOptions(Q2.text);
    expect(options).toHaveLength(5);
    const q2Buttons = Array.from(
      card(Q2.text).querySelectorAll("button"),
    ) as HTMLButtonElement[];
    expect(q2Buttons.every((button) => !button.disabled)).toBe(true);
    // A re-click retries the submit.
    mockAnswerProbe.mockResolvedValue({ phase: "probing", questions: [Q3] });
    clickOption(Q2.text, "doubles");
    expect(mockAnswerProbe).toHaveBeenCalledTimes(2);
  });

  it("falls back to the generic error when a failed submit is not an ApiError", async () => {
    await reachFirstBatch([Q1, Q2]);
    mockAnswerProbe.mockRejectedValue(new Error("network down"));

    // Answer Q1 (local — no submit), then Q2 (last) → the combined submit
    // rejects with a non-ApiError, so the inline message is the fallback.
    clickOption(Q1.text, "5 m/s²");
    await screen.findByText(Q2.text);
    clickOption(Q2.text, "doubles");

    // The generic dialog fallback (not the raw network message) is shown.
    await screen.findByText(
      "Something went wrong starting your session. Please try again.",
    );
  });

  it("retries the first batch fetch when it fails", async () => {
    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "probing",
      narrowed_goal: "Newton's second law of motion",
    });
    mockStartProbe.mockRejectedValueOnce(new Error("network down"));
    await openDialog(GOAL);
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    // The failed auto-fetch surfaces as an inline error; the dialog stays
    // open with the single-question intake.
    await screen.findByText(/went wrong|try again/i);
    expect(screen.getByText(PROBE_LABEL)).toBeTruthy();

    // An empty submit retries the first fetch.
    mockStartProbe.mockResolvedValue({ phase: "probing", questions: [Q1, Q2] });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));
    await screen.findByText(Q1.text);
    expect(mockStartProbe).toHaveBeenCalledTimes(2);
  });
});

describe("useProbePhase submit guards", () => {
  it("ignores the submit while a probe card is already on screen", async () => {
    const ctx = makePhaseContext({ probeBatch: [Q1], sessionId: "s-1" });
    const { result } = renderPhaseHook(useProbePhase, ctx);

    await act(async () => {
      await result.current.submit();
    });

    expect(mockStartProbe).not.toHaveBeenCalled();
    expect(ctx.setStatus).not.toHaveBeenCalled();
  });

  it("surfaces the fallback error when there is no session", async () => {
    const ctx = makePhaseContext({ probeBatch: null, sessionId: null });
    const { result } = renderPhaseHook(useProbePhase, ctx);

    await act(async () => {
      await result.current.submit();
    });

    expect(ctx.setStatus).toHaveBeenCalledWith("error");
    expect(ctx.setMessage).toHaveBeenCalledWith("errorFallback");
    expect(mockStartProbe).not.toHaveBeenCalled();
  });

  it("surfaces the no-questions error when the start call yields no questions", async () => {
    const ctx = makePhaseContext({ probeBatch: null, sessionId: "s-1" });
    const { result } = renderPhaseHook(useProbePhase, ctx);
    mockStartProbe.mockResolvedValue({ phase: "probing", questions: null });

    await act(async () => {
      await result.current.submit();
    });

    expect(ctx.setStatus).toHaveBeenCalledWith("error");
    expect(ctx.setMessage).toHaveBeenCalledWith("errorNoQuestions");
  });
});

describe("useProbePhase selectOption guards", () => {
  it("ignores a click when there is no batch", async () => {
    const ctx = makePhaseContext({ probeBatch: null, sessionId: "s-1" });
    const { result } = renderPhaseHook(useProbePhase, ctx);

    await act(async () => {
      await result.current.selectOption(0);
    });

    expect(mockAnswerProbe).not.toHaveBeenCalled();
    expect(ctx.setProbeAnswers).not.toHaveBeenCalled();
  });

  it("ignores a click when there is no session", async () => {
    const ctx = makePhaseContext({ probeBatch: withDisplayOrder([Q1]), sessionId: null });
    const { result } = renderPhaseHook(useProbePhase, ctx);

    await act(async () => {
      await result.current.selectOption(0);
    });

    expect(mockAnswerProbe).not.toHaveBeenCalled();
    expect(ctx.setProbeAnswers).not.toHaveBeenCalled();
  });

  it("ignores a click once the batch is fully answered", async () => {
    const ctx = makePhaseContext({
      probeBatch: withDisplayOrder([Q1]),
      sessionId: "s-1",
      probeAnswers: [1],
    });
    const { result } = renderPhaseHook(useProbePhase, ctx);

    await act(async () => {
      await result.current.selectOption(0);
    });

    expect(mockAnswerProbe).not.toHaveBeenCalled();
    expect(ctx.setProbeAnswers).not.toHaveBeenCalled();
  });

  it("ignores out-of-range display indices", async () => {
    const ctx = makePhaseContext({
      probeBatch: withDisplayOrder([Q1]),
      sessionId: "s-1",
    });
    const { result } = renderPhaseHook(useProbePhase, ctx);

    await act(async () => {
      await result.current.selectOption(-1);
      await result.current.selectOption(Q1.options.length);
    });

    expect(mockAnswerProbe).not.toHaveBeenCalled();
    expect(ctx.setProbeAnswers).not.toHaveBeenCalled();
  });
});
