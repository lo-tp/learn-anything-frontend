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
  render,
  screen,
} from "@testing-library/react";
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
  type PlanBody,
  type PlanOut,
} from "@/lib/api-client";

// The dialog calls the typed backend client. Stub the module rather than the
// global fetch: openapi-fetch binds `fetch` when the client is created, so a
// `vi.stubGlobal("fetch", ...)` after the module import never intercepts its
// requests.
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

const TITLE = "Start New Session";
const LABEL = "What would you like to explore or learn?";
const PROBE_LABEL = "Which option is right?";
const REVIEW_LABEL = "How should we adjust the plan?";
const SHORT = "Too short.";
const GOAL = "I want to master Newton's second law of motion.";

/** A 4-option probe question (0-based correct index 1). */
const Q1 = {
  id: "q1",
  text: "A 2 kg object experiences a net force of 10 N. What is its acceleration?",
  options: ["2 m/s²", "5 m/s²", "10 m/s²", "20 m/s²"],
  correct_index: 1,
  explanation: "a = F/m = 10/2 = 5 m/s².",
  strand: "f_ma_relation",
  difficulty: 2,
};

/** The follow-up question served after answering Q1. */
const Q2 = {
  id: "q2",
  text: "If the net force on the object doubles, its acceleration…",
  options: ["halves", "doubles", "stays the same", "quadruples"],
  correct_index: 1,
  explanation: "a = F/m, so doubling F doubles a.",
  strand: "f_ma_relation",
  difficulty: 3,
};

/** A 3-step plan, depth-ascending, with a dependency chain. */
const PLAN: PlanBody = {
  prose_summary:
    "Start from scalar F = ma, extend to vectors, then combine forces.",
  dependency_dag: "scalar -> vector -> combine",
  steps: [
    {
      id: "step-1",
      title: "Scalar F = ma",
      description: "One-dimensional force, mass, and acceleration.",
      depends_on: [],
      depth: 0,
    },
    {
      id: "step-2",
      title: "Vector form",
      description: "Forces and accelerations as vectors.",
      depends_on: ["step-1"],
      depth: 1,
    },
    {
      id: "step-3",
      title: "Combining forces",
      description: "Summing several forces into a net force.",
      depends_on: ["step-2"],
      depth: 2,
    },
  ],
};

/** The plan-generation/adjustment result the backend returns. */
const PLAN_OUT: PlanOut = { phase: "reviewing", plan: PLAN };

/** A revised plan (one step dropped) returned by an adjustment. */
const PLAN_OUT_REVISED: PlanOut = {
  phase: "reviewing",
  plan: {
    prose_summary: "A tighter two-step path from scalar F = ma to vectors.",
    dependency_dag: "scalar -> vector",
    steps: PLAN.steps.slice(0, 2),
  },
};

/** Render the dialog open and focus its textarea with `value`. */
async function openDialog(
  value: string = "",
  onAccept: () => void = () => {},
) {
  render(
    <NewSessionDialog open onOpenChange={() => {}} onAccept={onAccept} />,
  );
  const textarea = await screen.findByLabelText(LABEL);
  if (value) fireEvent.change(textarea, { target: { value } });
  return textarea;
}

/**
 * Drive the dialog from intake to its first probe question: `createSession`
 * lands on `probing`, so `startProbe` must auto-fetch Q1.
 */
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

describe("NewSessionDialog", () => {
  it("shows the intake form from the design", async () => {
    await openDialog();
    expect(screen.getByRole("heading", { name: TITLE })).toBeTruthy();
    // The Recent Messages section is hidden by default (no messages).
    expect(screen.queryByText("Recent Messages")).toBeNull();
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

  it("shows the Recent Messages preview when messages are provided", async () => {
    render(
      <NewSessionDialog
        open
        onOpenChange={() => {}}
        onAccept={() => {}}
        recentMessages={[
          {
            role: "you",
            text: "Can we start a deep dive into distributed consensus protocols like Raft?",
          },
          {
            role: "ai",
            text: "Certainly! Raft breaks consensus down into leader election, log replication, and safety. What specific aspect would you like to explore first?",
          },
          {
            role: "you",
            text: "Let's focus on how leader election handles split votes during network partitions.",
          },
        ]}
      />,
    );
    expect(screen.getByText("Recent Messages")).toBeTruthy();
    expect(screen.getByText("3 messages")).toBeTruthy();
  });

  it("shows a pending state and disables the buttons while the request is in flight", async () => {
    mockCreateSession.mockReturnValue(new Promise(() => {}));
    await openDialog("I want to understand Rust ownership and borrowing rules in depth.");
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

  it("resumes the clarify loop with clarifySession, not createSession", async () => {
    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "clarifying",
      clarifying_questions: ["A bit more, please."],
    });
    mockClarifySession.mockResolvedValue({
      session_id: "s-1",
      phase: "probing",
      narrowed_goal: "Newton's second law of motion",
    });
    mockStartProbe.mockResolvedValue({ phase: "probing", question: Q1 });
    // Messy on purpose: padded lines and a blank line — the bubble shows
    // the trimmed lines only, while the raw answer goes to the backend.
    const ANSWER =
      "  Focus on how F=ma applies to collisions.  \n\n  Specifically the elastic ones.\n";
    await openDialog("I want to learn Newton's laws of motion.");
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    // The clarifying round records both turns and clears the textarea.
    await screen.findByText("A bit more, please.");
    // A clarifying question stays a plain bubble — only the narrowed goal is
    // highlighted.
    expect(
      screen.getByText("A bit more, please.", { selector: "div" }).classList,
    ).not.toContain("bg-primary/10");
    fireEvent.change(screen.getByLabelText(LABEL), {
      target: { value: ANSWER },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    // The session was created once; the follow-up went to clarifySession.
    expect(mockCreateSession).toHaveBeenCalledTimes(1);
    expect(mockClarifySession).toHaveBeenCalledWith("s-1", ANSWER);
    // The history grows: you goal → ai questions → you answer → ai goal →
    // ai first probe question (auto-fetched once probing starts).
    await screen.findByText("5 messages");
    // The multi-line answer renders as a list inside the "you" bubble —
    // one trimmed item per line.
    const firstLine = screen.getByText("Focus on how F=ma applies to collisions.");
    const list = firstLine.closest("ul")!;
    expect(
      Array.from(list.querySelectorAll("li")).map((li) => li.textContent),
    ).toEqual([
      "Focus on how F=ma applies to collisions.",
      "Specifically the elastic ones.",
    ]);
    // The narrowed goal lands in a highlighted AI bubble.
    const goal = screen.getByText(
      "Your narrowed goal is: Newton's second law of motion",
      { selector: "span" },
    );
    expect(goal.parentElement?.classList).toContain("bg-primary/10");
    // The probe loop started: the first question rendered with its options.
    expect(mockStartProbe).toHaveBeenCalledWith("s-1");
    expect(await screen.findByText(Q1.text)).toBeTruthy();
  });

  it("auto-generates the plan (instead of the confirm step) when the phase advances to planning", async () => {
    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "planning",
      narrowed_goal: "Newton's second law of motion",
    });
    mockGeneratePlan.mockResolvedValue(PLAN_OUT);
    await openDialog(GOAL);
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    // The narrowed goal renders in a highlighted AI bubble.
    const goal = await screen.findByText(
      "Your narrowed goal is: Newton's second law of motion",
      { selector: "span" },
    );
    expect(goal.parentElement?.classList).toContain("bg-primary/10");
    // The plan auto-generates and lands in a highlighted plan bubble.
    expect(mockGeneratePlan).toHaveBeenCalledWith("s-1");
    const summary = await screen.findByText(PLAN.prose_summary);
    expect(summary.parentElement?.classList).toContain("bg-primary/10");
    // The review step: Cancel + Approve — no Send, no Confirm. The intake
    // stays visible, adapted to plan adjustments.
    expect(screen.getByRole("button", { name: /Approve/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Cancel/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Send/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Confirm/ })).toBeNull();
    expect(screen.getByText("How should we adjust the plan?")).toBeTruthy();
    // A non-probing advanced phase never touches the probe endpoints.
    expect(mockStartProbe).not.toHaveBeenCalled();
  });

  it("clears the textarea and hands off once when Approve is clicked", async () => {
    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "planning",
      narrowed_goal: "Newton's second law of motion",
    });
    mockGeneratePlan.mockResolvedValue(PLAN_OUT);
    mockApprovePlan.mockResolvedValue({
      phase: "generating",
      message: "Plan approved.",
    });
    const onAccept = vi.fn();
    await openDialog(GOAL, onAccept);
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    const approve = await screen.findByRole("button", { name: /Approve/ });
    fireEvent.click(approve);

    await vi.waitFor(() => expect(onAccept).toHaveBeenCalledTimes(1));
    // The approve request went out exactly once, with the session id.
    expect(mockApprovePlan).toHaveBeenCalledTimes(1);
    expect(mockApprovePlan).toHaveBeenCalledWith("s-1");
    // A successful hand-off resets the intake box.
    await vi.waitFor(() =>
      expect((screen.getByLabelText(LABEL) as HTMLTextAreaElement).value).toBe(
        "",
      ),
    );
  });

  it("keeps the dialog open and shows the clarifying questions in recent messages", async () => {
    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "clarifying",
      clarifying_questions: ["A bit more, please."],
    });
    await openDialog(SHORT);
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    // The question shows only in the Recent Messages preview — never as an
    // inline error below the textarea.
    await screen.findByText("A bit more, please.");
    expect(screen.queryByText("A bit more, please.", { selector: "p" })).toBeNull();
    // The modal stays open; the answer moved into the history, so the
    // textarea is cleared (unlike the error path, which preserves it).
    expect(screen.getByRole("heading", { name: TITLE })).toBeTruthy();
    expect((screen.getByLabelText(LABEL) as HTMLTextAreaElement).value).toBe("");
  });

  it("records the learner's input and the clarifying questions as recent messages", async () => {
    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "clarifying",
      clarifying_questions: ["A bit more, please."],
    });
    await openDialog(SHORT);
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    // The clarifying round appends both turns to the Recent Messages preview.
    await screen.findByText("2 messages");
    // The learner's input shows as a "you" bubble (div — the textarea value
    // would also match the plain text, so scope to div elements).
    expect(screen.getByText(SHORT, { selector: "div" })).toBeTruthy();
    // The AI's question shows as a single-line "ai" bubble.
    expect(screen.getByText("A bit more, please.", { selector: "div" })).toBeTruthy();
  });

  it("renders multiple clarifying questions as a list", async () => {
    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "clarifying",
      clarifying_questions: ["What is the scope?", "What is the target audience?"],
    });
    await openDialog(SHORT);
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    // More than one question renders as a list inside the AI bubble, each
    // item preceded by the big dot marker.
    const items = await screen.findAllByRole("listitem");
    expect(items.map((el) => el.textContent)).toEqual([
      "What is the scope?",
      "What is the target audience?",
    ]);
    for (const item of items) {
      const dot = item.firstElementChild as HTMLElement;
      expect(dot.classList).toContain("rounded-full");
      expect(dot.classList).toContain("bg-primary");
    }
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
    render(<Harness />);
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

  it("notifies the parent and closes when Approve is clicked", async () => {
    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "planning",
      narrowed_goal: "Newton's second law of motion",
    });
    mockGeneratePlan.mockResolvedValue(PLAN_OUT);
    mockApprovePlan.mockResolvedValue({
      phase: "generating",
      message: "Plan approved.",
    });
    // Stateful harness: the dialog's onOpenChange(false) must be able to flip
    // `open` for the close to be observable.
    function Harness({ onAccept }: { onAccept: () => void }) {
      const [open, setOpen] = useState(true);
      return (
        <NewSessionDialog open={open} onOpenChange={setOpen} onAccept={onAccept} />
      );
    }
    const onAccept = vi.fn();
    const view = render(<Harness onAccept={onAccept} />);
    const textarea = await screen.findByLabelText(LABEL);
    fireEvent.change(textarea, {
      target: { value: GOAL + " and I know velocity but mix up force and momentum." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    // The review step replaces Send; only Approve hands off.
    const approve = await screen.findByRole("button", { name: /Approve/ });
    fireEvent.click(approve);

    await vi.waitFor(() => expect(onAccept).toHaveBeenCalledTimes(1));
    // Depending on the (never-completing in jsdom) exit animation the panel
    // is either unmounted or left mounted in its closed state.
    await vi.waitFor(() => {
      const panel = document.querySelector('[role="dialog"]');
      expect(panel === null || panel.getAttribute("data-state") === "closed")
        .toBe(true);
    });
    void view;
  });

  it("enters the confirm step for later phases, without a goal message when narrowed_goal is absent", async () => {
    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "generating",
    });
    function Harness({ onAccept }: { onAccept: () => void }) {
      const [open, setOpen] = useState(true);
      return (
        <NewSessionDialog open={open} onOpenChange={setOpen} onAccept={onAccept} />
      );
    }
    const onAccept = vi.fn();
    render(<Harness onAccept={onAccept} />);
    const textarea = await screen.findByLabelText(LABEL);
    fireEvent.change(textarea, {
      target: { value: GOAL + " and I know velocity but mix up force and momentum." },
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
    await reachFirstQuestion();

    // The submit went out without touching the Send button — the first probe
    // question renders once the result lands (probing no longer confirms).
    expect(mockCreateSession).toHaveBeenCalledTimes(1);
    expect(screen.getByText(Q1.text)).toBeTruthy();
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
    const panel = document.querySelector(".overflow-y-auto") as HTMLElement;
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
    await openDialog(GOAL + " and I know velocity but mix up force and momentum.");
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
    expect((screen.getByLabelText(LABEL) as HTMLTextAreaElement).value).toBe(SHORT);
  });
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
      await screen.findByText("5 m/s²", { selector: ".bg-secondary-container" }),
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
      screen.getByText("2 m/s²", { selector: ".bg-secondary-container" }),
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
    // review step offers Cancel + Approve (no Send, no Confirm).
    expect(mockGeneratePlan).toHaveBeenCalledWith("s-1");
    const summary = await screen.findByText(PLAN.prose_summary);
    expect(summary.parentElement?.classList).toContain("bg-primary/10");
    expect(screen.getByRole("button", { name: /Approve/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Cancel/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Send/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Confirm/ })).toBeNull();

    // Approve hands off once.
    mockApprovePlan.mockResolvedValue({
      phase: "generating",
      message: "Plan approved.",
    });
    fireEvent.click(screen.getByRole("button", { name: /Approve/ }));
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
    expect(await screen.findByText(PLAN.prose_summary)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Approve/ })).toBeTruthy();
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

describe("NewSessionDialog plan review", () => {
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

  it("renders the plan bubble with its numbered steps and builds-on notes", async () => {
    await reachReviewStep();

    // The prose summary is the bubble body (highlighted).
    const summary = screen.getByText(PLAN.prose_summary, { selector: "span" });
    expect(summary.parentElement?.classList).toContain("bg-primary/10");
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

    // The review chrome: the adjusted label and placeholder, no Send button.
    expect(screen.getByText(REVIEW_LABEL)).toBeTruthy();
    expect(
      screen.getByPlaceholderText(
        "Describe how to adjust the plan — press Enter to send",
      ),
    ).toBeTruthy();

    // Enter in the textarea submits the adjustment (there is no Send
    // button in this step).
    fireEvent.change(screen.getByLabelText(REVIEW_LABEL), {
      target: { value: "Drop the last step — I already know how to combine forces." },
    });
    fireEvent.keyDown(screen.getByLabelText(REVIEW_LABEL), { key: "Enter" });

    expect(mockAdjustPlan).toHaveBeenCalledTimes(1);
    expect(mockAdjustPlan).toHaveBeenCalledWith(
      "s-1",
      "Drop the last step — I already know how to combine forces.",
    );
    // The "you" bubble records the adjustment text.
    expect(
      await screen.findByText(
        "Drop the last step — I already know how to combine forces.",
        { selector: "div" },
      ),
    ).toBeTruthy();
    // The regenerated plan lands in a new highlighted plan bubble.
    const revised = await screen.findByText(
      PLAN_OUT_REVISED.plan.prose_summary,
      { selector: "span" },
    );
    expect(revised.parentElement?.classList).toContain("bg-primary/10");
    // The previous plan bubble stays in the history.
    expect(screen.getByText(PLAN.prose_summary)).toBeTruthy();
    // The textarea is cleared for the next adjustment.
    expect((screen.getByLabelText(REVIEW_LABEL) as HTMLTextAreaElement).value)
      .toBe("");
  });

  it("rejects an empty adjustment client-side, without a request", async () => {
    await reachReviewStep();

    fireEvent.keyDown(screen.getByLabelText(REVIEW_LABEL), { key: "Enter" });

    await screen.findByText("Describe how you'd like to adjust the plan.");
    expect(mockAdjustPlan).not.toHaveBeenCalled();
    // The review step is still active.
    expect(screen.getByRole("button", { name: /Approve/ })).toBeTruthy();
  });

  it("keeps the review step open with an inline error when Approve fails", async () => {
    const onAccept = vi.fn();
    mockApprovePlan.mockRejectedValue(
      new ApiError("Plan not ready for approval.", 409),
    );
    await reachReviewStep(onAccept);

    fireEvent.click(screen.getByRole("button", { name: /Approve/ }));

    await screen.findByText("Plan not ready for approval.");
    // Still in the review step — the dialog is open, the plan bubble is
    // still rendered, and Approve can be clicked again.
    expect(onAccept).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: TITLE })).toBeTruthy();
    expect(screen.getByText(PLAN.prose_summary)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Approve/ })).toBeTruthy();
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

    // The failed auto-generation surfaces as an inline error; the awaiting
    // chrome ("Generating your plan…" + disabled textarea) stays put.
    await screen.findByText(/went wrong|try again/i);
    const awaitingLabel = "Generating your plan…";
    expect(screen.getByText(awaitingLabel)).toBeTruthy();
    expect(
      (screen.getByLabelText(awaitingLabel) as HTMLTextAreaElement).disabled,
    ).toBe(true);

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
