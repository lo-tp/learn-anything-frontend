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

/** Drive the dialog from intake to its first probe batch. */
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
  for (const q of batch) await screen.findByText(q.text);
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

describe("NewSessionDialog probe loop (batched)", () => {
  it("auto-fetches the first batch when clarify lands on probing", async () => {
    await reachFirstBatch();

    expect(mockStartProbe).toHaveBeenCalledWith("s-1");
    // Both questions render, each with its lettered options (4 + 4 items).
    expect(screen.getByText(Q1.text)).toBeTruthy();
    expect(screen.getByText(Q2.text)).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(8);
    // The intake adapts to per-question letter entry.
    expect(screen.getByText(PROBE_LABEL)).toBeTruthy();
    expect(screen.getByPlaceholderText(/per question/)).toBeTruthy();
    // The footer keeps Send/Cancel — no Confirm until the boundary is set.
    expect(screen.getByRole("button", { name: /Send/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Cancel/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Confirm/ })).toBeNull();
  });

  it("sends one 0-based index per question and serves the next batch", async () => {
    await reachFirstBatch();
    mockAnswerProbe.mockResolvedValue({ phase: "probing", questions: [Q3] });
    fireEvent.change(screen.getByLabelText(PROBE_LABEL), {
      target: { value: "B B" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    // "B B" goes to the wire as 0-based indices [1, 1] for [q1, q2].
    expect(mockAnswerProbe).toHaveBeenCalledWith("s-1", [
      { question_id: "q1", selected_index: 1 },
      { question_id: "q2", selected_index: 1 },
    ]);
    // Both picks are correct (Q1 correct = B, Q2 correct = B).
    await screen.findByText(
      "Correct — option B (5 m/s²). a = F/m = 10/2 = 5 m/s².",
    );
    await screen.findByText(
      "Correct — option B (doubles). a = F/m, so doubling F doubles a.",
    );
    // The next (size-1) batch renders with its own options.
    await screen.findByText(Q3.text);
    // The textarea is cleared for the next answer.
    expect(
      (screen.getByLabelText(PROBE_LABEL) as HTMLTextAreaElement).value,
    ).toBe("");
  });

  it("explains a wrong answer within the batch", async () => {
    await reachFirstBatch();
    mockAnswerProbe.mockResolvedValue({ phase: "probing", questions: [Q3] });
    fireEvent.change(screen.getByLabelText(PROBE_LABEL), {
      target: { value: "A B" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    // Q1 answered "A" is wrong — the verdict names the correct option.
    await screen.findByText(
      "Not quite — the correct answer is option B (5 m/s²). a = F/m = 10/2 = 5 m/s².",
    );
    // The (wrong) pick is recorded in a "you" bubble, lettered.
    expect(
      screen.getByText("A: 2 m/s²", {
        selector: ".bg-secondary-container span",
      }),
    ).toBeTruthy();
    // Q2 answered "B" is still correct.
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
    fireEvent.change(screen.getByLabelText(PROBE_LABEL), {
      target: { value: "B B" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    // The completion message lands with a plural count (2 questions answered).
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
    await reachFirstBatch();
    mockAnswerProbe.mockResolvedValue({
      phase: "planning",
      boundary_map: { f_ma_relation: { floor: "scalar F = ma", ceiling: null } },
    });
    mockGeneratePlan.mockReturnValue(new Promise(() => {}));
    fireEvent.change(screen.getByLabelText(PROBE_LABEL), {
      target: { value: "B B" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

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

    // Batch 1 ([Q1, Q2]) → batch 2 ([Q3]).
    mockGeneratePlan.mockResolvedValue(PLAN_OUT);
    fireEvent.change(screen.getByLabelText(PROBE_LABEL), {
      target: { value: "B B" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));
    await screen.findByText(Q3.text);

    // Batch 2 ([Q3], size 1) → boundary map.
    fireEvent.change(screen.getByLabelText(PROBE_LABEL), {
      target: { value: "B" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));
    await screen.findByText(
      "Boundary established after 3 questions. Your learning plan is ready.",
    );
    // The plan bubble lands and the review step takes over.
    expect(await screen.findByText(PLAN_OUT.plan.prose_summary)).toBeTruthy();
    expect(screen.getByText(REVIEW_LABEL)).toBeTruthy();
  });

  it("validates the batch client-side before any request", async () => {
    await reachFirstBatch();
    const textarea = () =>
      screen.getByLabelText(PROBE_LABEL) as HTMLTextAreaElement;
    // Too few, too many, and out-of-range letters are all rejected.
    for (const bad of ["", "B", "B B C", "E F", "B 5"]) {
      fireEvent.change(textarea(), { target: { value: bad } });
      fireEvent.click(screen.getByRole("button", { name: /Send/ }));
      await screen.findByText(
        "Type one letter per question, in order — 2 total.",
      );
      // No request goes out for an invalid batch.
      expect(mockAnswerProbe).not.toHaveBeenCalled();
      // The text is preserved for a corrected attempt.
      expect(textarea().value).toBe(bad);
    }
  });

  it("shows a backend error and preserves the text on a failed answer", async () => {
    await reachFirstBatch();
    mockAnswerProbe.mockRejectedValue(
      new ApiError("selected_index out of range", 422),
    );
    // "B B" passes client-side validation, so the 422 comes from the backend.
    fireEvent.change(screen.getByLabelText(PROBE_LABEL), {
      target: { value: "B B" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    await screen.findByText("selected_index out of range");
    // The text is preserved and the batch is still active.
    expect(
      (screen.getByLabelText(PROBE_LABEL) as HTMLTextAreaElement).value,
    ).toBe("B B");
    expect(screen.getByText(Q1.text)).toBeTruthy();
    expect(screen.getByText(Q2.text)).toBeTruthy();
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
    // open with the intake adapted to per-question entry.
    await screen.findByText(/went wrong|try again/i);
    expect(screen.getByText(PROBE_LABEL)).toBeTruthy();

    // An empty submit retries the first fetch.
    mockStartProbe.mockResolvedValue({ phase: "probing", questions: [Q1, Q2] });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));
    await screen.findByText(Q1.text);
    await screen.findByText(Q2.text);
    expect(mockStartProbe).toHaveBeenCalledTimes(2);
  });
});
