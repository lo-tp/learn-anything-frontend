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

// ── Shuffle-agnostic option helpers ─────────────────────────────────────
// Probe questions render their options in a per-question shuffled display
// order (#74), so the tests never assume which letter an option sits under:
// they read the displayed order from the DOM, pick options by their text,
// and assert on the BACKEND indices the submit carries.

/** The active question's option texts, in the order they render. */
function visibleOptions(): string[] {
  const lists = screen.getAllByRole("list");
  const activeList = lists[lists.length - 1];
  // Each item's text is its letter badge followed by the option text.
  return Array.from(activeList.children).map((li) =>
    (li.textContent ?? "").slice(1).trim(),
  );
}

/** The letter currently displayed next to an option text. */
function letterFor(optionText: string): string {
  const index = visibleOptions().indexOf(optionText);
  expect(index).toBeGreaterThanOrEqual(0);
  return String.fromCharCode("A".charCodeAt(0) + index);
}

/** Type the letter of the given option text and send the answer. */
function answerOption(optionText: string) {
  fireEvent.change(screen.getByLabelText(PROBE_LABEL), {
    target: { value: letterFor(optionText) },
  });
  fireEvent.click(screen.getByRole("button", { name: /Send/ }));
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

describe("NewSessionDialog probe loop (one at a time)", () => {
  it("auto-fetches the first batch and shows only its first question", async () => {
    await reachFirstBatch([Q1, Q2]);

    expect(mockStartProbe).toHaveBeenCalledWith("s-1");
    // Only the first question of the batch is shown — never the whole batch.
    expect(screen.getByText(Q1.text)).toBeTruthy();
    expect(screen.queryByText(Q2.text)).toBeNull();
    // The options render (4 items) as a shuffled display of the backend
    // options — same set, order left to the client (#74).
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect([...visibleOptions()].sort()).toEqual([...Q1.options].sort());
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

    // Q1: pick the correct option by its text. Only Q1's verdict shows, then
    // Q2 (drawn from the batch). No request goes out until the batch is
    // exhausted.
    const q1CorrectLetter = letterFor("5 m/s²");
    answerOption("5 m/s²");
    await screen.findByText(
      `Correct — option ${q1CorrectLetter} (5 m/s²). a = F/m = 10/2 = 5 m/s².`,
    );
    expect(await screen.findByText(Q2.text)).toBeTruthy();
    expect(mockAnswerProbe).not.toHaveBeenCalled();
    // The textarea is cleared for the next answer.
    expect(
      (screen.getByLabelText(PROBE_LABEL) as HTMLTextAreaElement).value,
    ).toBe("");

    // Q2: pick its correct option — the batch is now complete, so one
    // combined submit goes out. The payload carries the options' BACKEND
    // indices (1, 1), whatever letters they displayed under (#74).
    const q2CorrectLetter = letterFor("doubles");
    answerOption("doubles");
    expect(mockAnswerProbe).toHaveBeenCalledWith("s-1", [
      { question_id: "q1", selected_index: 1 },
      { question_id: "q2", selected_index: 1 },
    ]);
    await screen.findByText(
      `Correct — option ${q2CorrectLetter} (doubles). a = F/m, so doubling F doubles a.`,
    );
    // The next (size-1) batch renders with its own options.
    await screen.findByText(Q3.text);
  });

  it("explains a wrong answer within the batch", async () => {
    await reachFirstBatch([Q1, Q2]);
    mockAnswerProbe.mockResolvedValue({ phase: "probing", questions: [Q3] });

    // Q1 answered with a wrong option (by its text) — the verdict names the
    // correct option by its displayed letter.
    const q1WrongLetter = letterFor("2 m/s²");
    const q1CorrectLetter = letterFor("5 m/s²");
    answerOption("2 m/s²");
    await screen.findByText(
      `Not quite — the correct answer is option ${q1CorrectLetter} (5 m/s²). a = F/m = 10/2 = 5 m/s².`,
    );
    // The (wrong) pick is recorded in a "you" bubble, lettered by its
    // display position.
    expect(
      screen.getByText(`${q1WrongLetter}: 2 m/s²`, {
        selector: ".bg-secondary-container span",
      }),
    ).toBeTruthy();
    // Q2 is now shown (drawn from the batch).
    expect(await screen.findByText(Q2.text)).toBeTruthy();

    // Q2 answered with its correct option; the batch is submitted and Q3
    // arrives. The payload maps the picks back to backend indices (0, 1).
    const q2CorrectLetter = letterFor("doubles");
    answerOption("doubles");
    expect(mockAnswerProbe).toHaveBeenCalledWith("s-1", [
      { question_id: "q1", selected_index: 0 },
      { question_id: "q2", selected_index: 1 },
    ]);
    await screen.findByText(
      `Correct — option ${q2CorrectLetter} (doubles). a = F/m, so doubling F doubles a.`,
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
    answerOption("5 m/s²");
    await screen.findByText(Q2.text);
    answerOption("doubles");
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

    answerOption("5 m/s²");
    await screen.findByText(Q2.text);
    answerOption("doubles");

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
    answerOption("5 m/s²");
    await screen.findByText(Q2.text);
    answerOption("doubles");
    await screen.findByText(Q3.text);

    // Batch 2 ([Q3], size 1): answer Q3 (its correct option) → combined
    // submit → boundary map. The submit maps back to Q3's backend index.
    answerOption("mass");
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
    answerOption("5 m/s²");
    // Only the FIRST question of batch 2 ([Q2, Q3]) is surfaced — never Q3 yet.
    expect(await screen.findByText(Q2.text)).toBeTruthy();
    expect(screen.queryByText(Q3.text)).toBeNull();
    // Still only one request (the batch-1 submit); stepping to Q3 is local.
    expect(mockAnswerProbe).toHaveBeenCalledTimes(1);

    // Answer Q2 → Q3 is drawn from the batch (no round-trip).
    answerOption("doubles");
    expect(await screen.findByText(Q3.text)).toBeTruthy();
    expect(mockAnswerProbe).toHaveBeenCalledTimes(1);
  });

  it("keeps each question's display order stable across renders", async () => {
    await reachFirstBatch([Q1, Q2]);

    // The displayed order does not reshuffle between re-renders: reading it
    // again (after forcing an update through the textarea) yields the same
    // order, so a typed letter keeps meaning the same option.
    const firstRead = visibleOptions();
    fireEvent.change(screen.getByLabelText(PROBE_LABEL), {
      target: { value: "x" },
    });
    expect(visibleOptions()).toEqual(firstRead);
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
    answerOption("5 m/s²");
    await screen.findByText(Q2.text);
    expect(mockAnswerProbe).not.toHaveBeenCalled();

    // Answer Q2 (last) — the combined submit hits the 422.
    const letter = letterFor("doubles");
    answerOption("doubles");
    await screen.findByText("selected_index out of range");
    // The typed letter is preserved and the batch is still active (Q2 was
    // the active question when the submit failed).
    expect(
      (screen.getByLabelText(PROBE_LABEL) as HTMLTextAreaElement).value,
    ).toBe(letter);
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
