// @vitest-environment jsdom
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
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
import {
  GOAL,
  PLAN_OUT,
  Q1,
  Q2,
  Q3,
  PROBE_LABEL,
  REVIEW_LABEL,
  openDialog,
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

/** Type a single option letter and send the active question's answer. */
function answer(letter: string) {
  fireEvent.change(screen.getByLabelText(PROBE_LABEL), {
    target: { value: letter },
  });
  fireEvent.click(screen.getByRole("button", { name: /Send/ }));
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

describe("NewSessionDialog probe loop (one at a time)", () => {
  it("auto-fetches the first batch and shows only its first question", async () => {
    await reachFirstBatch([Q1, Q2]);

    expect(mockStartProbe).toHaveBeenCalledWith("s-1");
    // Only the first question of the batch is shown — never the whole batch.
    expect(screen.getByText(Q1.text)).toBeTruthy();
    expect(screen.queryByText(Q2.text)).toBeNull();
    // One question's lettered options render (4 items).
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    // The single-question intake.
    expect(screen.getByText(PROBE_LABEL)).toBeTruthy();
    expect(
      screen.getByPlaceholderText("Type the option letter (A–D)"),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /Send/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Cancel/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Confirm/ })).toBeNull();
  });

  it("answers questions one at a time and combines them into a single submit", async () => {
    await reachFirstBatch([Q1, Q2]);
    mockAnswerProbe.mockResolvedValue({ phase: "probing", questions: [Q3] });

    // Q1: "B" — only Q1's verdict shows, then Q2 (drawn from the batch).
    // No request goes out until the batch is exhausted.
    answer("B");
    await screen.findByText(
      "Correct — option B (5 m/s²). a = F/m = 10/2 = 5 m/s².",
    );
    expect(await screen.findByText(Q2.text)).toBeTruthy();
    expect(mockAnswerProbe).not.toHaveBeenCalled();
    // The textarea is cleared for the next answer.
    expect(
      (screen.getByLabelText(PROBE_LABEL) as HTMLTextAreaElement).value,
    ).toBe("");

    // Q2: "B" — the batch is now complete, so one combined submit goes out.
    answer("B");
    expect(mockAnswerProbe).toHaveBeenCalledWith("s-1", [
      { question_id: "q1", selected_index: 1 },
      { question_id: "q2", selected_index: 1 },
    ]);
    await screen.findByText(
      "Correct — option B (doubles). a = F/m, so doubling F doubles a.",
    );
    // The next (size-1) batch renders with its own options.
    await screen.findByText(Q3.text);
  });

  it("explains a wrong answer within the batch", async () => {
    await reachFirstBatch([Q1, Q2]);
    mockAnswerProbe.mockResolvedValue({ phase: "probing", questions: [Q3] });

    // Q1 answered "A" is wrong — the verdict names the correct option.
    answer("A");
    await screen.findByText(
      "Not quite — the correct answer is option B (5 m/s²). a = F/m = 10/2 = 5 m/s².",
    );
    // The (wrong) pick is recorded in a "you" bubble, lettered.
    expect(
      screen.getByText("A: 2 m/s²", {
        selector: ".bg-secondary-container span",
      }),
    ).toBeTruthy();
    // Q2 is now shown (drawn from the batch).
    expect(await screen.findByText(Q2.text)).toBeTruthy();

    // Q2 answered "B" is correct; the batch is submitted and Q3 arrives.
    answer("B");
    await screen.findByText(
      "Correct — option B (doubles). a = F/m, so doubling F doubles a.",
    );
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
    answer("B");
    await screen.findByText(Q2.text);
    answer("B");

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

    answer("B");
    await screen.findByText(Q2.text);
    answer("B");

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
    answer("B");
    await screen.findByText(Q2.text);
    answer("B");
    await screen.findByText(Q3.text);

    // Batch 2 ([Q3], size 1): answer Q3 → combined submit → boundary map.
    answer("B");
    await screen.findByText(
      "Boundary established after 3 questions. Your learning plan is ready.",
    );
    // The plan bubble lands and the review step takes over.
    expect(await screen.findByText(PLAN_OUT.plan.prose_summary)).toBeTruthy();
    expect(screen.getByText(REVIEW_LABEL)).toBeTruthy();
  });

  it("validates the answer letter client-side before any request", async () => {
    await reachFirstBatch([Q1, Q2]);
    const textarea = () =>
      screen.getByLabelText(PROBE_LABEL) as HTMLTextAreaElement;
    for (const bad of ["", "E", "0", "ab", "B C"]) {
      fireEvent.change(textarea(), { target: { value: bad } });
      fireEvent.click(screen.getByRole("button", { name: /Send/ }));
      await screen.findByText(
        "Enter the letter of your answer (A–D).",
      );
      // No request goes out for an invalid answer.
      expect(mockAnswerProbe).not.toHaveBeenCalled();
      // The text is preserved for a corrected attempt.
      expect(textarea().value).toBe(bad);
    }
  });

  it("shows a backend error and preserves the text on a failed submit", async () => {
    await reachFirstBatch([Q1, Q2]);
    mockAnswerProbe.mockRejectedValue(
      new ApiError("selected_index out of range", 422),
    );

    // Answer Q1 (valid letter) — no submit yet, just moves to Q2.
    answer("B");
    await screen.findByText(Q2.text);
    expect(mockAnswerProbe).not.toHaveBeenCalled();

    // Answer Q2 (last) — the combined submit hits the 422.
    answer("B");
    await screen.findByText("selected_index out of range");
    // The text is preserved and the batch is still active (Q2 was the
    // active question when the submit failed).
    expect(
      (screen.getByLabelText(PROBE_LABEL) as HTMLTextAreaElement).value,
    ).toBe("B");
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
