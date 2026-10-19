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
import { NewSessionDialog } from "@/views/mine/new-session-dialog";
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
  Q3,
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
    // The sheet's standing instruction is the core's opening prompt.
    expect(
      screen.getByText(/Tell us what you'd like to explore or learn/),
    ).toBeTruthy();
    // The one thing the form opens with: the goal, asked once, in a field.
    expect(screen.getByLabelText(LABEL)).toBeTruthy();
    expect(
      screen.getByPlaceholderText(/Write it in your own words/),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Send/ }),
    ).toBeTruthy();
    // A single close button (the header's), not the Dialog's built-in one.
    expect(screen.getAllByRole("button", { name: "Close" })).toHaveLength(1);
  });

  it("keeps the sheet's original header — the printed masthead and the rail (#204)", async () => {
    // The owner pinned this part of the surface in #204 ("keep the header").
    // Everything below it is the redesign; the header is not.
    await openDialog();
    const title = screen.getByRole("heading", { name: TITLE });
    expect(title.className).toContain("font-display");
    expect(title.className).toContain("uppercase");
    const masthead = title.closest("header") as HTMLElement;
    expect(masthead.classList.contains("double-rule-b")).toBe(true);

    // The progress device is the four-step bubble rail, closed with its own
    // double rule — not a bar, not a sentence of text under the title.
    const rail = masthead.nextElementSibling as HTMLElement;
    expect(rail.getAttribute("role")).toBe("status");
    expect(rail.classList.contains("double-rule-b")).toBe(true);
    const steps = rail.querySelectorAll("ol > li");
    expect(steps).toHaveLength(4);
    expect(rail.textContent).toContain("Clarifying");
    expect(rail.textContent).toContain("Probing");
    expect(rail.textContent).toContain("Planning");
    expect(rail.textContent).toContain("Generating");

    // Position is stated in one place only: the rail names it for assistive
    // technology and prints a count only while a batch is being answered.
    expect(rail.getAttribute("aria-label")).toBe("3 steps to your lesson");
    expect(rail.textContent).not.toContain("Question");
  });

  it("shows the opening prompt from the zh catalog under the zh locale", async () => {
    await openDialog("", () => {}, "zh");
    expect(
      screen.getByText(
        "告诉我们你想探索或学习什么，我们会为你量身安排一次学习。",
      ),
    ).toBeTruthy();
  });

  it("explains what is running and disables the sheet's one dismissal while the request is in flight", async () => {
    mockCreateSession.mockReturnValue(new Promise(() => {}));
    await openDialog(
      "I want to understand Rust ownership and borrowing rules in depth.",
    );
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    // The open ask's control gives way to a line naming what is happening…
    await screen.findByRole("status", {
      name: /we're working out what you want to learn/i,
    });
    // …and the sheet's only dismissal is disabled, so the intake cannot be
    // closed with a request outstanding.
    expect(
      (screen.getByRole("button", { name: "Close" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("holds the sheet still while the boundary's chained plan generation runs", async () => {
    // Submitting an answer is not over when the answer request resolves: at
    // the boundary the core auto-fires the plan generation. That live
    // request must keep the sheet locked exactly like the answer request
    // did — until now the buttons flickered back to clickable in between.
    mockCreateSession.mockResolvedValue({ session_id: "s-1", phase: "probing" });
    mockStartProbe.mockResolvedValue({ phase: "probing", questions: [Q1] });
    mockAnswerProbe.mockResolvedValue({
      phase: "planning",
      boundary_map: { f_ma_relation: { floor: "scalar F = ma", ceiling: null } },
    });
    mockGeneratePlan.mockReturnValue(new Promise(() => {}));
    await openDialog(GOAL);
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));
    await screen.findByText(Q1.text);

    const options = Array.from(
      screen.getByText(Q1.text).closest("fieldset")!.querySelectorAll("button"),
    ) as HTMLButtonElement[];
    fireEvent.click(
      options.find((button) => (button.textContent ?? "").includes("5 m/s²"))!,
    );

    // The answered card stays on the sheet with its answer and its verdict;
    // the plan-generation request the answer chained is what the sheet now
    // names…
    await screen.findByText("Correct.");
    await screen.findByRole("status", {
      name: /we're drafting your learning plan/i,
    });
    // …and there is nothing left to press while it runs.
    expect(screen.queryByRole("button", { name: /Send/ })).toBeNull();
    expect(
      (screen.getByRole("button", { name: "Close" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("disables Confirm while a backend request is still in flight", async () => {
    // The backend jumps straight to generating at the boundary: the confirm
    // footer appears while the chained request is still running — Confirm
    // must not be clickable (a hand-off mid-request would race the reply).
    mockCreateSession.mockResolvedValue({ session_id: "s-1", phase: "probing" });
    mockStartProbe.mockResolvedValue({ phase: "probing", questions: [Q1] });
    mockAnswerProbe.mockResolvedValue({
      phase: "generating",
      boundary_map: { f_ma_relation: { floor: "scalar F = ma", ceiling: null } },
    });
    mockGeneratePlan.mockReturnValue(new Promise(() => {}));
    await openDialog(GOAL);
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));
    await screen.findByText(Q1.text);

    const options = Array.from(
      screen.getByText(Q1.text).closest("fieldset")!.querySelectorAll("button"),
    ) as HTMLButtonElement[];
    fireEvent.click(
      options.find((button) => (button.textContent ?? "").includes("5 m/s²"))!,
    );

    const confirm = await screen.findByRole("button", { name: /Confirm/ });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
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

  it("shows the final clarify answer while the combined answer is still in flight", async () => {
    // A three-question clarify batch: the first two answers are local, the
    // third fires the combined request — which never resolves here.
    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "clarifying",
      clarifying_questions: [
        "First question?",
        "Second question?",
        "Third question?",
      ],
    });
    mockClarifySession.mockReturnValue(new Promise(() => {}));
    await openDialog(SHORT);
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    await screen.findByText("First question?");
    // Each clarify question is the field it is answered in.
    fireEvent.change(screen.getByLabelText("First question?"), {
      target: { value: "First answer." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));
    await screen.findByText("Second question?");
    fireEvent.change(screen.getByLabelText("Second question?"), {
      target: { value: "Second answer." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));
    await screen.findByText("Third question?");
    fireEvent.change(screen.getByLabelText("Third question?"), {
      target: { value: "Third answer." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    // The request is in flight…
    await screen.findByRole("status", {
      name: /we're working through what you shared/i,
    });
    // …and the learner's third reply is already in the transcript: no answer
    // ever waits for the backend to be shown.
    expect(screen.getByText("Third answer.")).toBeTruthy();
    expect(mockClarifySession).toHaveBeenCalledWith(
      "s-1",
      "First answer.\nSecond answer.\nThird answer.",
    );
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

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
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
    // The final stage: the "on the way" title moves into the header, the
    // completion panel replaces the open ask, and the record the learner
    // filled in stays on the sheet.
    expect(
      screen.getByRole("heading", { name: "Your lesson is on the way" }),
    ).toBeTruthy();
    expect(screen.queryByRole("heading", { name: TITLE })).toBeNull();
    expect(
      screen.getByRole("status", { name: /Your lesson is on the way/i }),
    ).toBeTruthy();
    expect(screen.queryByText("Recent Messages")).toBeNull();
    expect(screen.getAllByText("Your lesson is on the way")).toHaveLength(1);
    expect(screen.getByText(/safely close this window/i)).toBeTruthy();
    // The approval request fired exactly once — no polling for materials.
    expect(mockApprovePlan).toHaveBeenCalledTimes(1);
    // No Send / Cancel / Confirm is left in that state.
    expect(
      screen.getByRole("button", { name: /Back to my sessions/ }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Send/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Cancel/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Confirm/ })).toBeNull();
  });

  it("keeps the earlier plan on the sheet when the learner adjusts it (#223)", async () => {
    const onAccept = vi.fn();
    const review = await reachReview(onAccept);
    mockAdjustPlan.mockResolvedValue(PLAN_OUT_REVISED);
    fireEvent.change(review, { target: { value: "drop the last step" } });
    fireEvent.keyDown(review, { key: "Enter" });

    expect(mockAdjustPlan).toHaveBeenCalledWith("s-1", "drop the last step");
    // The revised plan lands in its own entry, and the earlier plan is not
    // hidden: both versions stay on the sheet, in the order they happened,
    // with the earlier one annotated as the plan before this one (#223).
    const revised = await screen.findByText(
      "A tighter two-step path from scalar F = ma to vectors.",
    );
    expect(
      screen.getByText("Start from scalar F = ma, extend to vectors, then combine forces."),
    ).toBeTruthy();
    // The step the adjustment dropped is still on the sheet, in the old plan.
    expect(screen.getByText("Combining forces")).toBeTruthy();
    // The earlier plan carries the annotation that names it.
    expect(screen.getByText("An earlier plan")).toBeTruthy();
    // And it is set in the pencil tone, not the ink rung of the current one:
    // the record states which plan is the one being approved, by tone.
    const earlier = screen.getByText(
      "Start from scalar F = ma, extend to vectors, then combine forces.",
    );
    expect(earlier.closest("h3")?.className).toContain("text-on-surface-variant");
    expect(revised.closest("h3")?.className).not.toContain("text-on-surface-variant");
    expect(onAccept).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: TITLE })).toBeTruthy();
  });

  it("approves the plan from its control, without a command to type", async () => {
    const onAccept = vi.fn();
    await reachReview(onAccept);

    // The plan is the contract: a numbered list, its steps, and what each
    // one builds on.
    expect(await screen.findByText("Scalar F = ma")).toBeTruthy();
    expect(screen.getByText("Combining forces")).toBeTruthy();
    expect(screen.getAllByText(/Builds on:/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Approve plan/ }));

    // The control carries the approval itself — and the adjustment field,
    // empty or not, is never what gets sent.
    await vi.waitFor(() => expect(mockApprovePlan).toHaveBeenCalledTimes(1));
    expect(mockAdjustPlan).not.toHaveBeenCalled();
    await screen.findByRole("button", { name: /Back to my sessions/ });
    expect(onAccept).not.toHaveBeenCalled();
  });

  it("keeps 'update plan' disabled until the learner says what to change", async () => {
    const onAccept = vi.fn();
    const review = await reachReview(onAccept);

    const updateOf = () =>
      screen.getByRole("button", {
        name: /Update plan/,
      }) as HTMLButtonElement;
    expect(updateOf().disabled).toBe(true);

    fireEvent.change(review, { target: { value: "drop the last step" } });
    await vi.waitFor(() => expect(updateOf().disabled).toBe(false));

    mockAdjustPlan.mockResolvedValue(PLAN_OUT_REVISED);
    fireEvent.click(updateOf());
    await vi.waitFor(() =>
      expect(mockAdjustPlan).toHaveBeenCalledWith("s-1", "drop the last step"),
    );
  });

  it("marks a wrong boundary answer as wrong and keeps the reason on the sheet", async () => {
    mockCreateSession.mockResolvedValue({ session_id: "s-1", phase: "probing" });
    mockStartProbe.mockResolvedValue({ phase: "probing", questions: [Q1] });
    mockAnswerProbe.mockResolvedValue({ phase: "probing", questions: [Q2] });
    await openDialog(GOAL);
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));
    await screen.findByText(Q1.text);

    const buttons = Array.from(
      screen.getByText(Q1.text).closest("fieldset")!.querySelectorAll("button"),
    ) as HTMLButtonElement[];
    fireEvent.click(
      buttons.find((button) => (button.textContent ?? "").includes("10 m/s²"))!,
    );

    // The record states the answer, the verdict, and why — in the reserved
    // correction ink, never in a colour alone.
    expect(await screen.findByText("Not quite.")).toBeTruthy();
    expect(screen.getByText(Q1.explanation)).toBeTruthy();
    expect(screen.getByText("10 m/s²")).toBeTruthy();
  });

  it("renders the end of the probe as a panel that names what the learner did (#204)", async () => {
    mockCreateSession.mockResolvedValue({ session_id: "s-1", phase: "probing" });
    mockStartProbe.mockResolvedValue({ phase: "probing", questions: [Q1] });
    mockAnswerProbe.mockResolvedValue({
      phase: "planning",
      boundary_map: { f_ma_relation: { floor: "scalar F = ma", ceiling: null } },
    });
    mockGeneratePlan.mockResolvedValue(PLAN_OUT);
    await openDialog(GOAL);
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    const question = await screen.findByText(Q1.text);
    const buttons = Array.from(
      question.closest("fieldset")!.querySelectorAll("button"),
    ) as HTMLButtonElement[];
    fireEvent.click(
      buttons.find((button) => (button.textContent ?? "").includes("5 m/s²"))!,
    );

    // The phase end is a block on the record, not spare text between answers:
    // the sheet's filled container, carrying the verified Check.
    const reached = await screen.findByText(/to get here/i);
    const panel = reached.closest("div")!;
    expect(panel.classList.contains("bg-surface-container-lowest")).toBe(true);
    expect(panel.classList.contains("rounded-md")).toBe(true);

    // And it says what happened in the learner's terms — the work they did,
    // not the core's phase name.
    expect(reached.textContent).toContain("You've answered 1 question");
    expect(reached.textContent).toContain("your learning plan is ready");
    expect(screen.queryByText(/Boundary established/i)).toBeNull();
  });

  it("says what the boundary checks are for before the first one lands (#204)", async () => {
    mockCreateSession.mockResolvedValue({ session_id: "s-1", phase: "probing" });
    mockStartProbe.mockResolvedValue({ phase: "probing", questions: [Q1] });
    mockAnswerProbe.mockResolvedValue({ phase: "probing", questions: [Q2] });
    await openDialog(GOAL);
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    // The reason is on the sheet before the question it explains.
    const purpose = await screen.findByText(/find out what you already know/i);
    const question = await screen.findByText(Q1.text);
    expect(purpose.compareDocumentPosition(question) & 0x04).toBeTruthy();

    // It is a statement, not a field: nothing is labelled with it, and the
    // option rows are still the control that answers.
    expect(
      screen.queryByRole("textbox", { name: /find out what you already know/i }),
    ).toBeNull();

    const buttons = Array.from(
      screen.getByText(Q1.text).closest("fieldset")!.querySelectorAll("button"),
    ) as HTMLButtonElement[];
    fireEvent.click(
      buttons.find((button) => (button.textContent ?? "").includes("5 m/s²"))!,
    );

    // The purpose is said once per intake: the follow-up batch that lands now
    // is explained by the line already on the sheet.
    await screen.findByText(Q2.text);
    expect(screen.getAllByText(/find out what you already know/i)).toHaveLength(1);
  });

  it("says what the boundary checks are for under the zh locale", async () => {
    mockCreateSession.mockResolvedValue({ session_id: "s-1", phase: "probing" });
    mockStartProbe.mockResolvedValue({ phase: "probing", questions: [Q1] });
    await openDialog(GOAL, undefined, "zh");
    fireEvent.click(screen.getByRole("button", { name: /发送/ }));

    expect(await screen.findByText(/你已经知道哪些内容/)).toBeTruthy();
  });

  it("closes back to the session list from the 'back to my sessions' control, notifying the parent", async () => {
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
    expect(document.activeElement).toBe(
      screen.getByLabelText("A bit more, please."),
    );
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

  it("renders a multi-line learner answer as a bulleted list in the record", async () => {
    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "clarifying",
      clarifying_questions: ["A bit more, please."],
    });
    await openDialog();
    fireEvent.change(screen.getByLabelText(LABEL), {
      target: { value: "First line of my answer\nSecond line of my answer" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    // The learner's turn splits into per-line items, each its own bullet in
    // the filled answer.
    await screen.findByText("A bit more, please.");
    expect(screen.getByText("First line of my answer")).toBeTruthy();
    expect(screen.getByText("Second line of my answer")).toBeTruthy();
  });

  it("keeps the record scrolled to the item that just landed", async () => {
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

    fireEvent.change(screen.getByLabelText("A bit more, please."), {
      target: { value: "More detail." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));
    await screen.findByText("One more detail, please.");

    expect(setScrollTop).toHaveBeenCalledWith(panel.scrollHeight);
  });

  it("bounds the sheet so the record scrolls instead of overflowing it", async () => {
    // jsdom has no layout engine, so this guards the height contract the
    // scrolling depends on: the sheet is a bounded flex column, the form is
    // allowed to shrink to it, and the record is the flex child that absorbs
    // every height change. (The shared DialogContent is a grid; a grid row
    // only stretches into free space, so a long record would grow the sheet
    // past the viewport and clip the open ask off-screen.)
    await openDialog();
    const sheet = document.querySelector(
      '[data-slot="dialog-content"]',
    ) as HTMLElement;
    expect(sheet.classList.contains("flex")).toBe(true);
    expect(sheet.classList.contains("grid")).toBe(false);

    const form = sheet.querySelector("form") as HTMLElement;
    expect(form.classList.contains("flex-1")).toBe(true);
    expect(form.classList.contains("min-h-0")).toBe(true);

    const panel = document.querySelector(".overflow-y-auto") as HTMLElement;
    expect(panel.classList.contains("flex-1")).toBe(true);
    expect(panel.classList.contains("min-h-0")).toBe(true);

    // The header never shrinks: the record takes every change.
    const header = sheet.querySelector("header") as HTMLElement;
    expect(header.classList.contains("shrink-0")).toBe(true);

    // The sheet keeps the printed chrome it was given (#204): the masthead
    // and the rail are each closed with the double rule. What the redesign
    // removed stays removed — the ruled-paper transcript panel it replaced.
    const rules = sheet.querySelectorAll(".double-rule-b");
    expect(rules).toHaveLength(2);
    expect(sheet.querySelectorAll(".ruled-paper")).toHaveLength(0);

    // The rail is the sheet's only progress device: bubbles and step names,
    // never a bar or a meter.
    const rail = sheet.querySelector('[role="status"]') as HTMLElement;
    expect(rail.classList.contains("double-rule-b")).toBe(true);
    expect(rail.querySelectorAll("ol > li")).toHaveLength(4);
  });

  it("puts every action at the right end of the item it belongs to (#204)", async () => {
    const rowOf = (button: HTMLElement) => button.parentElement!.classList;

    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "clarifying",
      clarifying_questions: ["What do you already know about force?"],
    });
    mockClarifySession.mockResolvedValue({ session_id: "s-1", phase: "probing" });
    mockStartProbe.mockResolvedValue({ phase: "probing", questions: [Q1] });
    mockAnswerProbe.mockResolvedValue({
      phase: "planning",
      boundary_map: { f_ma_relation: { floor: "scalar F = ma", ceiling: null } },
    });
    mockGeneratePlan.mockResolvedValue(PLAN_OUT);
    mockApprovePlan.mockResolvedValue({ phase: "generating", message: "Plan approved." });

    await openDialog(GOAL);
    // The goal field's own action.
    expect(rowOf(screen.getByRole("button", { name: /Send/ })).contains("justify-end")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /Send/ }));
    const field = await screen.findByLabelText("What do you already know about force?");
    fireEvent.change(field, { target: { value: "I remember F = ma from school." } });
    expect(rowOf(screen.getByRole("button", { name: /Send/ })).contains("justify-end")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    const question = await screen.findByText(Q1.text);
    const options = Array.from(
      question.closest("fieldset")!.querySelectorAll("button"),
    ) as HTMLButtonElement[];
    fireEvent.click(
      options.find((button) => (button.textContent ?? "").includes("5 m/s²"))!,
    );

    // The plan pair.
    const update = await screen.findByRole("button", { name: /Update plan/ });
    const approve = screen.getByRole("button", { name: /Approve plan/ });
    expect(rowOf(update).contains("justify-end")).toBe(true);
    expect(rowOf(approve).contains("justify-end")).toBe(true);

    fireEvent.click(approve);
    // The control that files the finished sheet, inside its panel.
    const file = await screen.findByRole("button", { name: /Back to my sessions/ });
    expect(rowOf(file).contains("justify-end")).toBe(true);
  });

  it("measures the whole form once, at the record column (#204)", async () => {
    // jsdom lays nothing out, so this guards the rule directly: the sheet's
    // width lives on the column, and no item carries a measure of its own.
    const measureOf = (el: Element) =>
      [...el.classList].filter((cls) => cls.startsWith("max-w-")).sort();

    const CLARIFY_Q = "What do you already know about force, mass, and acceleration?";
    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "clarifying",
      clarifying_questions: [CLARIFY_Q],
    });
    mockClarifySession.mockResolvedValue({ session_id: "s-1", phase: "probing" });
    mockStartProbe.mockResolvedValue({ phase: "probing", questions: [Q1] });

    await openDialog(GOAL);
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    const sheet = document.querySelector('[data-slot="dialog-content"]')!;
    // The record column is the one place the measure lives.
    const column = sheet.querySelector(".overflow-y-auto > div")!;
    const measure = measureOf(column);
    expect(measure).toHaveLength(1);

    // A recorded answer, the open field it was answered in, and the question
    // the field is labelled with: none of them carries a width.
    expect(measureOf(screen.getByText(GOAL).closest("div")!)).toEqual([]);
    const ask = await screen.findByText(CLARIFY_Q);
    expect(measureOf(ask.closest("label")!)).toEqual([]);
    const field = screen.getByRole("textbox");
    expect(measureOf(field)).toEqual([]);

    // The same for a check answered by a click: its question and its option
    // rows fill the column, so a check being answered is the width of a check
    // already answered.
    fireEvent.change(field, { target: { value: "I remember F = ma from school." } });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));
    const question = await screen.findByText(Q1.text);
    expect(measureOf(question.closest("fieldset")!)).toEqual([]);
    expect(measureOf(question.closest("legend")!)).toEqual([]);
    const rows = Array.from(
      question.closest("fieldset")!.querySelectorAll("button"),
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(measureOf(row)).toEqual([]);
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

  it("returns a failed clarify answer to the textarea instead of the transcript", async () => {
    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "clarifying",
      clarifying_questions: ["A bit more, please."],
    });
    mockClarifySession.mockRejectedValue(new Error("network down"));
    await openDialog(SHORT);
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));
    await screen.findByText("A bit more, please.");

    // The answer is on screen with the request, then rolls back when it fails.
    fireEvent.change(screen.getByLabelText("A bit more, please."), {
      target: { value: "My answer." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));
    await screen.findByText(/went wrong|try again/i);

    // The rolled-back answer is not left in the record (record text is in
    // spans; the textarea itself holds the restored value).
    expect(screen.queryByText("My answer.", { selector: "span" })).toBeNull();
    expect(
      (screen.getByLabelText("A bit more, please.")) as HTMLTextAreaElement,
    ).toHaveProperty("value", "My answer.");
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

  it("states the position in words before the first submit", async () => {
    await openDialog();
    expect(screen.getByRole("status", { name: /3 steps to your lesson/i })).toBeTruthy();
  });

  it("updates the stated position after the first submit", async () => {
    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "clarifying",
      clarifying_questions: ["A bit more, please."],
    });
    await openDialog(SHORT);
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));
    expect(await screen.findByRole("status", { name: /2 steps to your lesson/i })).toBeTruthy();
  });

  it("states the position through probing and into planning", async () => {
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
    // not the textarea. The card is awaited, not assumed: the rail names the
    // Probing step when the phase lands, one request before the question does.
    const question = await screen.findByText(Q1.text);
    const probeButtons = Array.from(
      question.closest("fieldset")!.querySelectorAll("button"),
    ) as HTMLButtonElement[];
    fireEvent.click(
      probeButtons.find((button) =>
        (button.textContent ?? "").includes("5 m/s²"),
      )!,
    );
    expect(await screen.findByRole("status", { name: /Approve to build your lesson/i })).toBeTruthy();
  });

  it("carries the probe position into the next batch: 4 of 6 after a first batch of 3", async () => {
    // The follow-up batch reuses the fixture options but has distinct question
    // text, so every card on screen is addressable.
    const followUps = [Q1, Q2, Q3].map((q) => ({
      ...q,
      id: `${q.id}-follow-up`,
      text: `${q.text} (follow-up)`,
    }));
    const answerCard = (questionText: string, optionText: string) => {
      const buttons = Array.from(
        screen.getByText(questionText).closest("fieldset")!.querySelectorAll("button"),
      ) as HTMLButtonElement[];
      fireEvent.click(
        buttons.find((button) =>
          (button.textContent ?? "").includes(optionText),
        )!,
      );
    };

    mockCreateSession.mockResolvedValue({ session_id: "s-1", phase: "probing" });
    mockStartProbe.mockResolvedValue({ phase: "probing", questions: [Q1, Q2, Q3] });
    mockAnswerProbe
      // The first batch is answered: the backend is not at the boundary yet,
      // it serves another three questions.
      .mockResolvedValueOnce({ phase: "probing", questions: followUps })
      .mockResolvedValueOnce({
        phase: "planning",
        boundary_map: { f_ma_relation: { floor: "scalar F = ma", ceiling: null } },
      });
    mockGeneratePlan.mockResolvedValue(PLAN_OUT);

    await openDialog(GOAL);
    // No position is stated while nothing is being answered.
    expect(screen.queryByText("Question 1 of 3")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));
    expect(await screen.findByText("Question 1 of 3")).toBeTruthy();

    // Each answer click advances the count.
    answerCard(Q1.text, "5 m/s²");
    expect(await screen.findByText("Question 2 of 3")).toBeTruthy();
    answerCard(Q2.text, "doubles");
    expect(await screen.findByText("Question 3 of 3")).toBeTruthy();

    // The follow-up batch continues the count instead of restarting it: the
    // denominator is every question asked, not just the batch on screen (#137).
    answerCard(Q3.text, "mass");
    expect(await screen.findByText("Question 4 of 6")).toBeTruthy();
    answerCard(followUps[0].text, "5 m/s²");
    expect(await screen.findByText("Question 5 of 6")).toBeTruthy();

    // The position is dropped once nothing is being answered (planning).
    answerCard(followUps[1].text, "doubles");
    answerCard(followUps[2].text, "mass");
    await screen.findByRole("status", { name: /Approve to build your lesson/i });
    expect(screen.queryByText(/Question \d+ of \d+/)).toBeNull();
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



describe("NewSessionDialog — the first field", () => {
  it("keeps Send inert until the goal has an answer in it", async () => {
    await openDialog();
    const send = screen.getByRole("button", { name: /Send/ });
    expect(send.hasAttribute("disabled")).toBe(true);
    expect(mockCreateSession).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(LABEL), {
      target: { value: "Newton's second law." },
    });
    expect(send.hasAttribute("disabled")).toBe(false);
  });

  it("does not create a session when the empty field is submitted", async () => {
    await openDialog();
    fireEvent.submit(screen.getByRole("textbox"));
    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(screen.queryByText(/Something went wrong/)).toBeNull();
  });
});
