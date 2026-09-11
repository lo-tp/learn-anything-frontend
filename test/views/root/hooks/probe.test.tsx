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
} from "@/lib/api-client";
import {
  GOAL,
  PLAN_OUT,
  Q1,
  Q2,
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

/** Drive the dialog from intake to its first probe question. */
async function reachFirstQuestion(
  paragraph: string = GOAL,
  onAccept: () => void = () => {},
) {
  mockCreateSession.mockResolvedValue({
    session_id: "s-1",
    phase: "probing",
    narrowed_goal: "Newton's second law of motion",
  });
  mockStartProbe.mockResolvedValue({ phase: "probing", question: Q1 });
  await openDialog(paragraph, onAccept);
  fireEvent.click(screen.getByRole("button", { name: /Send/ }));
  return screen.findByText(Q1.text);
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

describe("NewSessionDialog probe loop", () => {
  it("auto-fetches the first question when clarify lands on probing", async () => {
    await reachFirstQuestion();

    expect(mockStartProbe).toHaveBeenCalledWith("s-1");
    // The question bubble carries the numbered options (1..4).
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items[1].textContent).toContain("5 m/s²");
    // The intake adapts to index entry.
    expect(screen.getByText(PROBE_LABEL)).toBeTruthy();
    expect(
      screen.getByPlaceholderText("Type the option letter (A–D)"),
    ).toBeTruthy();
    // The footer keeps Send/Cancel — no Confirm until the boundary is set.
    expect(screen.getByRole("button", { name: /Send/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Cancel/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Confirm/ })).toBeNull();
  });

  it("sends the 0-based index, records the pick and verdict, and serves the next question", async () => {
    await reachFirstQuestion();
    mockAnswerProbe.mockResolvedValue({ phase: "probing", question: Q2 });
    fireEvent.change(screen.getByLabelText(PROBE_LABEL), {
      target: { value: "B" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    // "B" goes to the wire as 0-based index 1.
    expect(mockAnswerProbe).toHaveBeenCalledWith("s-1", "q1", 1);
    // The pick renders as a "you" bubble with the selected option's text.
    expect(
      await screen.findByText("5 m/s²", {
        selector: ".bg-secondary-container",
      }),
    ).toBeTruthy();
    // The verdict names the picked option and carries the explanation.
    await screen.findByText(
      "Correct — option B (5 m/s²). a = F/m = 10/2 = 5 m/s².",
    );
    // The next question renders with its own numbered options.
    await screen.findByText(Q2.text);
    // The textarea is cleared for the next answer.
    expect(
      (screen.getByLabelText(PROBE_LABEL) as HTMLTextAreaElement).value,
    ).toBe("");
  });

  it("explains a wrong answer with the correct option", async () => {
    await reachFirstQuestion();
    mockAnswerProbe.mockResolvedValue({ phase: "probing", question: Q2 });
    fireEvent.change(screen.getByLabelText(PROBE_LABEL), {
      target: { value: "A" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    await screen.findByText(
      "Not quite — the correct answer is option B (5 m/s²). a = F/m = 10/2 = 5 m/s².",
    );
    // The (wrong) pick is recorded in a "you" bubble.
    expect(
      screen.getByText("2 m/s²", {
        selector: ".bg-secondary-container",
      }),
    ).toBeTruthy();
    await screen.findByText(Q2.text);
  });

  it("auto-generates the plan once the boundary map arrives", async () => {
    const onAccept = vi.fn();
    await reachFirstQuestion(GOAL, onAccept);
    mockAnswerProbe.mockResolvedValue({
      phase: "planning",
      boundary_map: { f_ma_relation: { floor: "scalar F = ma", ceiling: null } },
    });
    mockGeneratePlan.mockResolvedValue(PLAN_OUT);
    fireEvent.change(screen.getByLabelText(PROBE_LABEL), {
      target: { value: "B" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    // The verdict lands, plus a highlighted completion message.
    await screen.findByText(
      "Boundary established after 1 question. Your learning plan is ready.",
    );
    // The plan auto-generates and lands in a highlighted plan bubble; the
    // review step keeps Cancel + Send (no Confirm) — approval is a typed
    // command, not a button.
    expect(mockGeneratePlan).toHaveBeenCalledWith("s-1");
    const summary = await screen.findByText(PLAN_OUT.plan.prose_summary);
    expect(summary.parentElement?.classList).toContain("bg-primary/10");
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

  it("completes the loop after the final question with a plural count", async () => {
    await reachFirstQuestion();
    mockAnswerProbe
      .mockResolvedValueOnce({ phase: "probing", question: Q2 })
      .mockResolvedValueOnce({
        phase: "planning",
        boundary_map: {
          f_ma_relation: { floor: "scalar F = ma", ceiling: "vector form" },
        },
      });

    // Q1 → Q2.
    fireEvent.change(screen.getByLabelText(PROBE_LABEL), {
      target: { value: "B" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));
    await screen.findByText(Q2.text);

    // Q2 → boundary map.
    mockGeneratePlan.mockResolvedValue(PLAN_OUT);
    fireEvent.change(screen.getByLabelText(PROBE_LABEL), {
      target: { value: "B" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));
    await screen.findByText(
      "Boundary established after 2 questions. Your learning plan is ready.",
    );
    // The plan bubble lands and the review step takes over.
    expect(await screen.findByText(PLAN_OUT.plan.prose_summary)).toBeTruthy();
    expect(screen.getByText(REVIEW_LABEL)).toBeTruthy();
  });

  it("validates the answer index client-side before any request", async () => {
    await reachFirstQuestion();
    const textarea = () =>
      screen.getByLabelText(PROBE_LABEL) as HTMLTextAreaElement;
    for (const bad of ["", "E", "0", "ab"]) {
      fireEvent.change(textarea(), { target: { value: bad } });
      fireEvent.click(screen.getByRole("button", { name: /Send/ }));
      await screen.findByText("Enter the letter of your answer (A–D).");
      // No request goes out for an invalid index.
      expect(mockAnswerProbe).not.toHaveBeenCalled();
      // The text is preserved for a corrected attempt.
      expect(textarea().value).toBe(bad);
    }
  });

  it("shows a backend error and preserves the text on a failed answer", async () => {
    await reachFirstQuestion();
    mockAnswerProbe.mockRejectedValue(
      new ApiError("selected_index out of range", 422),
    );
    // "B" passes client-side validation, so the 422 comes from the backend.
    fireEvent.change(screen.getByLabelText(PROBE_LABEL), {
      target: { value: "B" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    await screen.findByText("selected_index out of range");
    // The text is preserved and the question is still active.
    expect(
      (screen.getByLabelText(PROBE_LABEL) as HTMLTextAreaElement).value,
    ).toBe("B");
    expect(screen.getByText(Q1.text)).toBeTruthy();
  });

  it("retries the first question fetch when it fails", async () => {
    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "probing",
      narrowed_goal: "Newton's second law of motion",
    });
    mockStartProbe.mockRejectedValueOnce(new Error("network down"));
    await openDialog(GOAL);
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    // The failed auto-fetch surfaces as an inline error; the dialog stays
    // open with the intake adapted to index entry.
    await screen.findByText(/went wrong|try again/i);
    expect(screen.getByText(PROBE_LABEL)).toBeTruthy();

    // An empty submit retries the first fetch.
    mockStartProbe.mockResolvedValue({ phase: "probing", question: Q1 });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));
    await screen.findByText(Q1.text);
    expect(mockStartProbe).toHaveBeenCalledTimes(2);
  });
});
