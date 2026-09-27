// @vitest-environment jsdom
import { useState } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  cleanup,
  fireEvent,
  screen,
} from "@testing-library/react";
import { renderWithLocale } from "@/test/test-utils";
import { NewSessionDialog } from "@/views/root/new-session-dialog";
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
  LABEL,
  PLAN_OUT,
  PLAN_OUT_REVISED,
  Q1,
  Q2,
  REVIEW_LABEL,
  SHORT,
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

describe("NewSessionDialog", () => {
  it("shows the intake form from the design", async () => {
    await openDialog();
    expect(screen.getByRole("heading", { name: TITLE })).toBeTruthy();
    // The Recent Messages section always shows the fixed opening prompt.
    expect(screen.getByText("Recent Messages")).toBeTruthy();
    expect(screen.getByText("1 message")).toBeTruthy();
    expect(
      screen.getByText(/Tell us what you'd like to explore or learn/),
    ).toBeTruthy();
    expect(
      screen.getByPlaceholderText(/Continue the discussion/),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Send/ }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Cancel/ }),
    ).toBeTruthy();
    // A single close button (the header's), not the Dialog's built-in one.
    expect(screen.getAllByRole("button", { name: "Close" })).toHaveLength(1);
  });

  it("shows the opening prompt from the zh catalog under the zh locale", async () => {
    await openDialog("", () => {}, "zh");
    expect(
      screen.getByText(
        "告诉我们你想探索或学习什么，我们会为你量身安排一次学习。",
      ),
    ).toBeTruthy();
  });

  it("shows a pending state and disables the buttons while the request is in flight", async () => {
    mockCreateSession.mockReturnValue(new Promise(() => {}));
    await openDialog(
      "I want to understand Rust ownership and borrowing rules in depth.",
    );
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    const pending = await screen.findByRole("button", { name: /Sending/ });
    expect((pending as HTMLButtonElement).disabled).toBe(true);
    expect(
      (screen.getByRole("button", { name: /Cancel/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    // The header close button is disabled while the request is in flight.
    expect(
      (screen.getByRole("button", { name: "Close" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("hides the intake box and explains what is happening while a request is in flight", async () => {
    mockCreateSession.mockReturnValue(new Promise(() => {}));
    await openDialog(
      "I want to understand Rust ownership and borrowing rules in depth.",
    );
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    // The textarea is hidden while the request is in flight.
    expect(screen.queryByLabelText(LABEL)).toBeNull();
    // A short status note explains what is going on.
    await screen.findByRole("status", {
      name: /we're working out what you want to learn/i,
    });
  });

  it("explains that the plan is being drafted while plan generation is in flight", async () => {
    // The backend skips probing and auto-generates the plan.
    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "planning",
      narrowed_goal: "Newton's second law of motion",
    });
    mockGeneratePlan.mockReturnValue(new Promise(() => {}));
    await openDialog(GOAL);
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    expect(screen.queryByLabelText(LABEL)).toBeNull();
    await screen.findByRole("status", {
      name: /we're drafting your learning plan/i,
    });
  });

  it("resets the form when the dialog is closed and reopened", async () => {
    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "clarifying",
      clarifying_questions: ["A bit more, please."],
    });
    function Harness() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <NewSessionDialog
            open={open}
            onOpenChange={setOpen}
            onAccept={() => {}}
          />
          <button type="button" onClick={() => setOpen(true)}>
            Reopen
          </button>
        </>
      );
    }
    renderWithLocale(<Harness />);
    const textarea = await screen.findByLabelText(LABEL);
    fireEvent.change(textarea, { target: { value: SHORT } });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));
    await screen.findByText("A bit more, please.");

    fireEvent.click(screen.getByRole("button", { name: /Cancel/ }));
    await vi.waitFor(() => {
      const panel = document.querySelector('[role="dialog"]');
      expect(panel === null || panel.getAttribute("data-state") === "closed")
        .toBe(true);
    });

    fireEvent.click(screen.getByRole("button", { name: "Reopen" }));
    expect(
      (await screen.findByLabelText(LABEL)) as HTMLTextAreaElement,
    ).toHaveProperty("value", "");
    expect(screen.queryByText("A bit more, please.")).toBeNull();
  });

  /** Drive the dialog to the review step (the generated plan on screen).
   *  The stateful harness lets `onOpenChange(false)` flip `open` so a close
   *  is observable, and spies `onAccept`. */
  async function reachReview(onAccept: () => void) {
    function Harness({ onAccept }: { onAccept: () => void }) {
      const [open, setOpen] = useState(true);
      return (
        <NewSessionDialog
          open={open}
          onOpenChange={setOpen}
          onAccept={onAccept}
        />
      );
    }
    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "planning",
      narrowed_goal: "Newton's second law of motion",
    });
    mockGeneratePlan.mockResolvedValue(PLAN_OUT);
    mockApprovePlan.mockResolvedValue({ phase: "generating", message: "Plan approved." });
    renderWithLocale(<Harness onAccept={onAccept} />);
    const textarea = await screen.findByLabelText(LABEL);
    fireEvent.change(textarea, { target: { value: GOAL } });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));
    return screen.findByLabelText(REVIEW_LABEL);
  }

  it("stays open in the 'on the way' state when the learner types 'approve'", async () => {
    const onAccept = vi.fn();
    const review = await reachReview(onAccept);
    fireEvent.change(review, { target: { value: "approve" } });
    fireEvent.keyDown(review, { key: "Enter" });

    // The dialog stays open — no hand-off until the learner closes it.
    await screen.findByRole("button", { name: /Back to my sessions/ });
    expect(onAccept).not.toHaveBeenCalled();
    // The final stage: the "on the way" card replaces the rail, transcript,
    // and intake controls — the header stays, and the copy appears once
    // (no rail counter).
    expect(screen.getByRole("heading", { name: TITLE })).toBeTruthy();
    expect(screen.getByText("Your lesson is on the way")).toBeTruthy();
    expect(screen.queryByRole("status", { name: /Your lesson is on the way/i })).toBeNull();
    expect(screen.queryByText("Recent Messages")).toBeNull();
    expect(screen.getAllByText("Your lesson is on the way")).toHaveLength(1);
    expect(screen.getByText(/safely close this window/i)).toBeTruthy();
    // The approval request fired exactly once — no polling for materials.
    expect(mockApprovePlan).toHaveBeenCalledTimes(1);
    // The footer is a single "back" button (no Send / Cancel / Confirm).
    expect(
      screen.getByRole("button", { name: /Back to my sessions/ }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Send/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Cancel/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Confirm/ })).toBeNull();
  });

  it("submits a plan adjustment from the review step (no hand-off)", async () => {
    const onAccept = vi.fn();
    const review = await reachReview(onAccept);
    mockAdjustPlan.mockResolvedValue(PLAN_OUT_REVISED);
    fireEvent.change(review, { target: { value: "drop the last step" } });
    fireEvent.keyDown(review, { key: "Enter" });

    expect(mockAdjustPlan).toHaveBeenCalledWith("s-1", "drop the last step");
    // The revised plan lands in a new plan bubble; the dialog stays open
    // (no hand-off until the learner approves and closes).
    expect(
      await screen.findByText("A tighter two-step path from scalar F = ma to vectors."),
    ).toBeTruthy();
    expect(onAccept).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: TITLE })).toBeTruthy();
  });

  it("closes back to the session list from the footer button, notifying the parent", async () => {
    const onAccept = vi.fn();
    const review = await reachReview(onAccept);
    fireEvent.change(review, { target: { value: "approve" } });
    fireEvent.keyDown(review, { key: "Enter" });
    await screen.findByRole("button", { name: /Back to my sessions/ });

    fireEvent.click(screen.getByRole("button", { name: /Back to my sessions/ }));
    await vi.waitFor(() => expect(onAccept).toHaveBeenCalledTimes(1));
    // Depending on the (never-completing in jsdom) exit animation the panel
    // is either unmounted or left mounted in its closed state.
    await vi.waitFor(() => {
      const panel = document.querySelector('[role="dialog"]');
      expect(panel === null || panel.getAttribute("data-state") === "closed")
        .toBe(true);
    });
  });

  it("closes via the header Close button from the 'on the way' state, notifying the parent", async () => {
    const onAccept = vi.fn();
    const review = await reachReview(onAccept);
    fireEvent.change(review, { target: { value: "approve" } });
    fireEvent.keyDown(review, { key: "Enter" });
    await screen.findByRole("button", { name: /Back to my sessions/ });

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await vi.waitFor(() => expect(onAccept).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => {
      const panel = document.querySelector('[role="dialog"]');
      expect(panel === null || panel.getAttribute("data-state") === "closed")
        .toBe(true);
    });
  });

  it("starts a fresh intake when the dialog is reopened after approval", async () => {
    function Harness({ onAccept }: { onAccept: () => void }) {
      const [open, setOpen] = useState(true);
      return (
        <>
          <NewSessionDialog
            open={open}
            onOpenChange={setOpen}
            onAccept={onAccept}
          />
          <button type="button" onClick={() => setOpen(true)}>
            Reopen
          </button>
        </>
      );
    }
    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "planning",
      narrowed_goal: "Newton's second law of motion",
    });
    mockGeneratePlan.mockResolvedValue(PLAN_OUT);
    mockApprovePlan.mockResolvedValue({ phase: "generating", message: "Plan approved." });
    const onAccept = vi.fn();
    renderWithLocale(<Harness onAccept={onAccept} />);
    const textarea = await screen.findByLabelText(LABEL);
    fireEvent.change(textarea, { target: { value: GOAL } });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));
    const review = await screen.findByLabelText(REVIEW_LABEL);
    fireEvent.change(review, { target: { value: "approve" } });
    fireEvent.keyDown(review, { key: "Enter" });
    await screen.findByRole("button", { name: /Back to my sessions/ });

    // Closing the on-the-way state resets the intake for the next session.
    fireEvent.click(screen.getByRole("button", { name: /Back to my sessions/ }));
    await vi.waitFor(() => {
      const panel = document.querySelector('[role="dialog"]');
      expect(panel === null || panel.getAttribute("data-state") === "closed")
        .toBe(true);
    });

    fireEvent.click(screen.getByRole("button", { name: "Reopen" }));
    // The fresh intake: the opening prompt and the clarify label, no leftover
    // plan or on-the-way copy.
    expect((await screen.findByLabelText(LABEL)) as HTMLTextAreaElement).toHaveProperty("value", "");
    expect(screen.queryByText("Your lesson is on the way")).toBeNull();
    expect(screen.queryByRole("button", { name: /Back to my sessions/ })).toBeNull();
  });

  it("enters the confirm step for later phases, without a goal message when narrowed_goal is absent", async () => {
    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "generating",
    });
    function Harness({ onAccept }: { onAccept: () => void }) {
      const [open, setOpen] = useState(true);
      return (
        <NewSessionDialog
          open={open}
          onOpenChange={setOpen}
          onAccept={onAccept}
        />
      );
    }
    const onAccept = vi.fn();
    renderWithLocale(<Harness onAccept={onAccept} />);
    const textarea = await screen.findByLabelText(LABEL);
    fireEvent.change(textarea, {
      target: {
        value: GOAL + " and I know velocity but mix up force and momentum.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    // A post-plan lifecycle stage is not "clarifying": the legacy confirm
    // step appears (no narrowed-goal message, since the result carries
    // none), and no probe or plan fetch is made for this phase.
    const confirm = await screen.findByRole("button", { name: /Confirm/ });
    expect(screen.queryByText("Your narrowed goal is:")).toBeNull();
    expect(screen.queryByRole("button", { name: /Send/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Cancel/ })).toBeNull();
    expect(mockStartProbe).not.toHaveBeenCalled();
    expect(mockGeneratePlan).not.toHaveBeenCalled();

    // Clicking Confirm hands off.
    fireEvent.click(confirm);
    await vi.waitFor(() => expect(onAccept).toHaveBeenCalledTimes(1));
  });

  it("focuses the textarea when the dialog opens", async () => {
    await openDialog();
    // Radix would otherwise auto-focus the header's close button.
    expect(document.activeElement).toBe(screen.getByLabelText(LABEL));
  });

  it("refocuses the textarea once a pending submit settles", async () => {
    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "clarifying",
      clarifying_questions: ["A bit more, please."],
    });
    await openDialog(SHORT);
    // Move focus away (as clicking Send would), then submit.
    fireEvent.focus(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    await screen.findByText("A bit more, please.");
    // The textarea is enabled again for the next turn, so focus returns to it.
    expect(document.activeElement).toBe(screen.getByLabelText(LABEL));
  });

  it("submits the intake on a bare Enter key", async () => {
    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "probing",
      narrowed_goal: "Newton's second law of motion",
    });
    mockStartProbe.mockResolvedValue({ phase: "probing", questions: [Q1] });
    await openDialog(GOAL);
    // A bare Enter in the textarea triggers the same submit path as Send.
    fireEvent.keyDown(screen.getByLabelText(LABEL), { key: "Enter" });
    expect(mockCreateSession).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(Q1.text)).toBeTruthy();
  });

  it("does not submit on Shift+Enter (multiline answers)", async () => {
    mockCreateSession.mockReturnValue(new Promise(() => {}));
    await openDialog("line one");
    const textarea = screen.getByLabelText(LABEL);
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

    // Shift+Enter is left to the textarea (newline) — no request goes out.
    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Send/ })).toBeTruthy();
  });

  it("scrolls the recent messages to the bottom when a new message arrives", async () => {
    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "clarifying",
      clarifying_questions: ["A bit more, please."],
    });
    mockClarifySession.mockResolvedValue({
      session_id: "s-1",
      phase: "clarifying",
      clarifying_questions: ["One more detail, please."],
    });
    await openDialog(SHORT);
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));
    await screen.findByText("A bit more, please.");

    // jsdom performs no layout, so spy the panel's scrollTop setter and
    // verify the effect pins it to the panel's scrollHeight.
    const panel = document.querySelector(
      ".overflow-y-auto",
    ) as HTMLElement;
    const setScrollTop = vi.fn();
    Object.defineProperty(panel, "scrollTop", {
      set: setScrollTop,
      get: () => 0,
      configurable: true,
    });

    fireEvent.change(screen.getByLabelText(LABEL), {
      target: { value: "More detail." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));
    await screen.findByText("One more detail, please.");

    expect(setScrollTop).toHaveBeenCalledWith(panel.scrollHeight);
  });

  it("shows a transport error and stays open when the request fails", async () => {
    mockCreateSession.mockRejectedValue(new Error("network down"));
    await openDialog(
      GOAL + " and I know velocity but mix up force and momentum.",
    );
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    const error = await screen.findByText(/went wrong|try again/i);
    expect(error).toBeTruthy();
    expect(screen.getByRole("heading", { name: TITLE })).toBeTruthy();
  });

  it("shows the backend's validation message on an ApiError", async () => {
    mockCreateSession.mockRejectedValue(
      new ApiError("Goal must not be empty.", 422),
    );
    await openDialog(SHORT);
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    await screen.findByText("Goal must not be empty.");
    // The modal stays open for another attempt, with the text preserved.
    expect(screen.getByRole("heading", { name: TITLE })).toBeTruthy();
    expect(
      (screen.getByLabelText(LABEL) as HTMLTextAreaElement).value,
    ).toBe(SHORT);
  });

  it("shows the progress rail with the ready counter before the first submit", async () => {
    await openDialog();
    expect(screen.getByRole("status", { name: /3 steps to your lesson/i })).toBeTruthy();
  });

  it("updates the rail counter to Clarifying after the first submit", async () => {
    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "clarifying",
      clarifying_questions: ["A bit more, please."],
    });
    await openDialog(SHORT);
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));
    expect(await screen.findByRole("status", { name: /2 steps to your lesson/i })).toBeTruthy();
  });

  it("tracks the rail through probing and into planning", async () => {
    // Clarify lands on probing and the first question is fetched.
    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "probing",
    });
    mockStartProbe.mockResolvedValue({ phase: "probing", questions: [Q1] });
    await openDialog(GOAL);
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));
    expect(await screen.findByRole("status", { name: /1 step to your lesson/i })).toBeTruthy();

    // Answering to the boundary auto-generates the plan → review step.
    mockAnswerProbe.mockResolvedValue({
      phase: "planning",
      boundary_map: { f_ma_relation: { floor: "scalar F = ma", ceiling: null } },
    });
    mockGeneratePlan.mockResolvedValue(PLAN_OUT);
    // Click the probe card's correct option — the answer path is a click,
    // not the textarea.
    const probeButtons = Array.from(
      screen.getByText(Q1.text).closest("div")!.querySelectorAll("button"),
    ) as HTMLButtonElement[];
    fireEvent.click(
      probeButtons.find((button) =>
        (button.textContent ?? "").includes("5 m/s²"),
      )!,
    );
    expect(await screen.findByRole("status", { name: /Approve to build your lesson/i })).toBeTruthy();
  });

  it("shows a batch-local probe position under the Probing step, updating with each answer", async () => {
    // Clarify lands on probing and a batch of two is fetched.
    mockCreateSession.mockResolvedValue({ session_id: "s-1", phase: "probing" });
    mockStartProbe.mockResolvedValue({ phase: "probing", questions: [Q1, Q2] });
    await openDialog(GOAL);
    // The position is hidden while the rail is not on the Probing step.
    expect(screen.queryByText("Question 1 of 2")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    // The batch-local position appears under the Probing step (denominator =
    // the current batch size, 2 — not a cumulative answered count).
    expect(await screen.findByText("Question 1 of 2")).toBeTruthy();

    // Answering the first card advances the position to the second card.
    const firstOptions = Array.from(
      screen.getByText(Q1.text).closest("div")!.querySelectorAll("button"),
    ) as HTMLButtonElement[];
    fireEvent.click(
      firstOptions.find((button) => (button.textContent ?? "").includes("5 m/s²"))!,
    );
    expect(await screen.findByText("Question 2 of 2")).toBeTruthy();

    // The position is hidden once the rail leaves the Probing step (planning).
    mockAnswerProbe.mockResolvedValue({
      phase: "planning",
      boundary_map: { f_ma_relation: { floor: "scalar F = ma", ceiling: null } },
    });
    mockGeneratePlan.mockResolvedValue(PLAN_OUT);
    const secondOptions = Array.from(
      screen.getByText(Q2.text).closest("div")!.querySelectorAll("button"),
    ) as HTMLButtonElement[];
    fireEvent.click(
      secondOptions.find((button) => (button.textContent ?? "").includes("doubles"))!,
    );
    await screen.findByRole("status", { name: /Approve to build your lesson/i });
    expect(screen.queryByText("Question 2 of 2")).toBeNull();
  });

  it("closes via the header Close button, notifying the parent of the change", async () => {
    const onOpenChange = vi.fn();
    renderWithLocale(
      <NewSessionDialog open onOpenChange={onOpenChange} onAccept={() => {}} />,
    );
    await screen.findByRole("heading", { name: TITLE });

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    // Radix reports the close as `onOpenChange(false)`; the hook's guard
    // routes it to `close()` (the request is idle, so it proceeds).
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});


