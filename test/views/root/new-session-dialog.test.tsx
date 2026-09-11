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
} from "@/lib/api-client";
import {
  GOAL,
  LABEL,
  PLAN_OUT,
  PROBE_LABEL,
  Q1,
  SHORT,
  TITLE,
  openDialog,
} from "./hooks/test-fixtures";

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

  it("notifies the parent and closes when the learner types 'approve'", async () => {
    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "planning",
      narrowed_goal: "Newton's second law of motion",
    });
    mockGeneratePlan.mockResolvedValue({
      phase: "reviewing",
      plan: {
        prose_summary: "Start from scalar F = ma, extend to vectors.",
        dependency_dag: "scalar -> vector",
        steps: [
          {
            id: "step-1",
            title: "Scalar F = ma",
            description: "One-dimensional force, mass, and acceleration.",
            depends_on: [],
            depth: 0,
          },
        ],
      },
    });
    mockApprovePlan.mockResolvedValue({
      phase: "generating",
      message: "Plan approved.",
    });
    // Stateful harness: the dialog's onOpenChange(false) must be able to flip
    // `open` for the close to be observable.
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
    const view = render(<Harness onAccept={onAccept} />);
    const textarea = await screen.findByLabelText(LABEL);
    fireEvent.change(textarea, {
      target: {
        value: GOAL + " and I know velocity but mix up force and momentum.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    // The plan lands in the review step; the typed approval command hands
    // off (there is no Approve button).
    const review = await screen.findByLabelText(
      "How should we adjust the plan?",
    );
    fireEvent.change(review, { target: { value: "approve" } });
    fireEvent.keyDown(review, { key: "Enter" });

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
        <NewSessionDialog
          open={open}
          onOpenChange={setOpen}
          onAccept={onAccept}
        />
      );
    }
    const onAccept = vi.fn();
    render(<Harness onAccept={onAccept} />);
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
    mockStartProbe.mockResolvedValue({ phase: "probing", question: Q1 });
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

  it("shows a Ready phase indicator before the first submit", async () => {
    await openDialog();
    expect(screen.getByRole("status", { name: /ready/i })).toBeTruthy();
  });

  it("updates the phase indicator to Clarifying after the first submit", async () => {
    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "clarifying",
      clarifying_questions: ["A bit more, please."],
    });
    await openDialog(SHORT);
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));
    expect(await screen.findByRole("status", { name: /clarifying/i })).toBeTruthy();
  });

  it("tracks the phase through probing and into review", async () => {
    // Clarify lands on probing and the first question is fetched.
    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "probing",
    });
    mockStartProbe.mockResolvedValue({ phase: "probing", question: Q1 });
    await openDialog(GOAL);
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));
    expect(await screen.findByRole("status", { name: /probing/i })).toBeTruthy();

    // Answering to the boundary auto-generates the plan → review step.
    mockAnswerProbe.mockResolvedValue({
      phase: "planning",
      boundary_map: { f_ma_relation: { floor: "scalar F = ma", ceiling: null } },
    });
    mockGeneratePlan.mockResolvedValue(PLAN_OUT);
    fireEvent.change(screen.getByLabelText(PROBE_LABEL), {
      target: { value: "B" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));
    expect(await screen.findByRole("status", { name: /reviewing/i })).toBeTruthy();
  });
});
