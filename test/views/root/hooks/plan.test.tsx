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
  PLAN,
  PLAN_OUT,
  PLAN_OUT_REVISED,
  REVIEW_LABEL,
  TITLE,
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

/** Drive the dialog from intake to the review step. */
async function reachReviewStep(onAccept: () => void = () => {}) {
  mockCreateSession.mockResolvedValue({
    session_id: "s-1",
    phase: "planning",
    narrowed_goal: null,
  });
  mockGeneratePlan.mockResolvedValue(PLAN_OUT);
  await openDialog(GOAL, onAccept);
  fireEvent.click(screen.getByRole("button", { name: /Send/ }));
  return screen.findByText(PLAN.prose_summary);
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

describe("NewSessionDialog plan review", () => {
  it("renders the plan bubble with its numbered steps and builds-on notes", async () => {
    await reachReviewStep();

    // The prose summary is the bubble body (highlighted).
    const summary = screen.getByText(PLAN.prose_summary);
    expect(summary.closest('[class*="bg-primary/10"]')).toBeTruthy();
    // Three numbered steps render in backend order, each
    // "title — description", with dependencies resolved to titles.
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(
      screen.getByText(
        "Scalar F = ma — One-dimensional force, mass, and acceleration.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Vector form — Forces and accelerations as vectors. · builds on: Scalar F = ma",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Combining forces — Summing several forces into a net force. · builds on: Vector form",
      ),
    ).toBeTruthy();
    // Each step carries its number marker (1., 2., 3.).
    expect(
      screen.getAllByText(/^\d+\.$/).map((marker) => marker.textContent),
    ).toEqual(["1.", "2.", "3."]);
  });

  it("adjusts the plan with free text: Enter sends adjustPlan and appends a new plan bubble", async () => {
    mockAdjustPlan.mockResolvedValue(PLAN_OUT_REVISED);
    await reachReviewStep();

    // The review chrome: the adjusted label and placeholder (the Send
    // button stays — it also sends the `approve` command).
    expect(screen.getByText(REVIEW_LABEL)).toBeTruthy();
    expect(
      screen.getByPlaceholderText(
        "Type 'approve' to approve, or describe how to adjust — press Enter to send",
      ),
    ).toBeTruthy();

    // Enter in the textarea submits the adjustment.
    fireEvent.change(screen.getByLabelText(REVIEW_LABEL), {
      target: {
        value: "Drop the last step — I already know how to combine forces.",
      },
    });
    fireEvent.keyDown(screen.getByLabelText(REVIEW_LABEL), { key: "Enter" });

    expect(mockAdjustPlan).toHaveBeenCalledTimes(1);
    expect(mockAdjustPlan).toHaveBeenCalledWith(
      "s-1",
      "Drop the last step — I already know how to combine forces.",
    );
    // The "you" bubble records the adjustment text.
    expect(
      (await screen.findByText(
        "Drop the last step — I already know how to combine forces.",
      )).closest(".bg-secondary-container"),
    ).toBeTruthy();
    // The regenerated plan lands in a new highlighted plan bubble.
    const revised = await screen.findByText(
      PLAN_OUT_REVISED.plan.prose_summary,
    );
    expect(revised.closest('[class*="bg-primary/10"]')).toBeTruthy();
    // The previous plan bubble stays in the history.
    expect(screen.getByText(PLAN.prose_summary)).toBeTruthy();
    // The textarea is cleared for the next adjustment.
    expect(
      (screen.getByLabelText(REVIEW_LABEL) as HTMLTextAreaElement).value,
    ).toBe("");
  });

  it("rejects an empty submission client-side, without a request", async () => {
    await reachReviewStep();

    fireEvent.keyDown(screen.getByLabelText(REVIEW_LABEL), { key: "Enter" });

    await screen.findByText(
      "Type 'approve' to approve the plan, or describe how to adjust it.",
    );
    expect(mockAdjustPlan).not.toHaveBeenCalled();
    expect(mockApprovePlan).not.toHaveBeenCalled();
    // The review step is still active.
    expect(screen.getByText(REVIEW_LABEL)).toBeTruthy();
  });

  it("treats the approval command case-insensitively, without an adjust request", async () => {
    const onAccept = vi.fn();
    mockApprovePlan.mockResolvedValue({
      phase: "generating",
      message: "Plan approved.",
    });
    await reachReviewStep(onAccept);

    fireEvent.change(screen.getByLabelText(REVIEW_LABEL), {
      target: { value: "Approve" },
    });
    fireEvent.keyDown(screen.getByLabelText(REVIEW_LABEL), { key: "Enter" });

    await vi.waitFor(() => expect(onAccept).toHaveBeenCalledTimes(1));
    expect(mockApprovePlan).toHaveBeenCalledTimes(1);
    expect(mockAdjustPlan).not.toHaveBeenCalled();
  });

  it("keeps the review step open with an inline error when the approval command fails", async () => {
    const onAccept = vi.fn();
    mockApprovePlan.mockRejectedValue(
      new ApiError("Plan not ready for approval.", 409),
    );
    await reachReviewStep(onAccept);

    const review = screen.getByLabelText(REVIEW_LABEL);
    fireEvent.change(review, { target: { value: "approve" } });
    fireEvent.keyDown(review, { key: "Enter" });

    await screen.findByText("Plan not ready for approval.");
    // Still in the review step — the dialog is open, the plan bubble is
    // still rendered, and the command can be sent again.
    expect(onAccept).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: TITLE })).toBeTruthy();
    expect(screen.getByText(PLAN.prose_summary)).toBeTruthy();
    expect(screen.getByText(REVIEW_LABEL)).toBeTruthy();
  });

  it("shows an inline error when plan generation fails, and Send retries", async () => {
    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "planning",
      narrowed_goal: null,
    });
    mockGeneratePlan.mockRejectedValueOnce(new Error("network down"));
    await openDialog(GOAL);
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    // The failed auto-generation surfaces as an inline error; the intake
    // box stays hidden while the plan is awaited (status note in its place).
    await screen.findByText(/went wrong|try again/i);
    expect(
      screen.getByText(
        "We're drafting your learning plan. This takes a few seconds — hang tight.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();

    // A second Send click retries the generation.
    mockGeneratePlan.mockResolvedValue(PLAN_OUT);
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));
    expect(await screen.findByText(PLAN.prose_summary)).toBeTruthy();
    expect(mockGeneratePlan).toHaveBeenCalledTimes(2);
  });

  it("refocuses the textarea once the plan lands (review step)", async () => {
    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "planning",
      narrowed_goal: null,
    });
    mockGeneratePlan.mockResolvedValue(PLAN_OUT);
    await openDialog(GOAL);
    // Move focus away (as clicking Send would), then submit.
    fireEvent.focus(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    await screen.findByText(PLAN.prose_summary);
    // The review step's textarea is visible + enabled, so focus returns.
    expect(document.activeElement).toBe(screen.getByLabelText(REVIEW_LABEL));
  });
});
