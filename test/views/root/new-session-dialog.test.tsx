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
import { ApiError, clarifySession, createSession } from "@/lib/api-client";

// The dialog calls the typed backend client. Stub the module rather than the
// global fetch: openapi-fetch binds `fetch` when the client is created, so a
// `vi.stubGlobal("fetch", ...)` after the module import never intercepts its
// requests.
vi.mock("@/lib/api-client", () => ({
  createSession: vi.fn(),
  clarifySession: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

const mockCreateSession = vi.mocked(createSession);
const mockClarifySession = vi.mocked(clarifySession);

const TITLE = "Start New Session";
const LABEL = "What would you like to explore or learn?";
const SHORT = "Too short.";

/** Render the dialog open and focus its textarea with `value`. */
async function openDialog(
  value: string = "",
  onAccept: () => void = () => {},
) {
  const view = render(
    <NewSessionDialog open onOpenChange={() => {}} onAccept={onAccept} />,
  );
  const textarea = await screen.findByLabelText(LABEL);
  if (value) fireEvent.change(textarea, { target: { value } });
  return view;
}

beforeEach(() => {
  mockCreateSession.mockReset();
  mockClarifySession.mockReset();
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
    const ANSWER = "Focus on how F=ma applies to collisions.";
    await openDialog("I want to learn Newton's laws of motion.");
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    // The clarifying round records both turns and clears the textarea.
    await screen.findByText("A bit more, please.");
    fireEvent.change(screen.getByLabelText(LABEL), {
      target: { value: ANSWER },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    // The session was created once; the follow-up went to clarifySession.
    expect(mockCreateSession).toHaveBeenCalledTimes(1);
    expect(mockClarifySession).toHaveBeenCalledWith("s-1", ANSWER);
    // The history grows: you goal → ai questions → you answer → ai goal.
    await screen.findByText("4 messages");
    expect(
      screen.getByText(
        "Your narrowed goal is: Newton's second law of motion",
        { selector: "div" },
      ),
    ).toBeTruthy();
  });

  it("shows the confirm step with the narrowed goal when the phase advances", async () => {
    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "probing",
      narrowed_goal: "Newton's second law of motion",
    });
    await openDialog("I want to master Newton's second law of motion.");
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    // The narrowed goal renders in an AI bubble.
    expect(
      await screen.findByText(
        "Your narrowed goal is: Newton's second law of motion",
        { selector: "div" },
      ),
    ).toBeTruthy();
    // The intake (label + textarea) is hidden.
    expect(screen.queryByLabelText(LABEL)).toBeNull();
    // Only the Confirm button remains — no Send, no Cancel.
    expect(screen.getByRole("button", { name: /Confirm/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Send/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Cancel/ })).toBeNull();
  });

  it("clears the textarea and hands off once when Confirm is clicked", async () => {
    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "probing",
      narrowed_goal: "Newton's second law of motion",
    });
    const onAccept = vi.fn();
    await openDialog("I want to master Newton's second law of motion.", onAccept);
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    const confirm = await screen.findByRole("button", { name: /Confirm/ });
    fireEvent.click(confirm);

    await vi.waitFor(() => expect(onAccept).toHaveBeenCalledTimes(1));
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

    // More than one question renders as a list inside the AI bubble.
    const items = await screen.findAllByRole("listitem");
    expect(items.map((el) => el.textContent)).toEqual([
      "What is the scope?",
      "What is the target audience?",
    ]);
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

  it("notifies the parent and closes when Confirm is clicked", async () => {
    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "probing",
      narrowed_goal: "Newton's second law of motion",
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
      target: { value: "I want to master Newton's second law of motion and I know velocity but mix up force and momentum." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    // The confirm step replaces Send/Cancel; only Confirm hands off.
    const confirm = await screen.findByRole("button", { name: /Confirm/ });
    fireEvent.click(confirm);

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
      phase: "planning",
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
      target: { value: "I want to master Newton's second law of motion and I know velocity but mix up force and momentum." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    // A later lifecycle stage is not "clarifying": the confirm step appears
    // (no narrowed-goal message, since the result carries none).
    const confirm = await screen.findByRole("button", { name: /Confirm/ });
    expect(screen.queryByText("Your narrowed goal is:")).toBeNull();
    expect(screen.queryByRole("button", { name: /Send/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Cancel/ })).toBeNull();

    // Clicking Confirm hands off.
    fireEvent.click(confirm);
    await vi.waitFor(() => expect(onAccept).toHaveBeenCalledTimes(1));
  });

  it("shows a transport error and stays open when the request fails", async () => {
    mockCreateSession.mockRejectedValue(new Error("network down"));
    await openDialog(
      "I want to master Newton's second law of motion and I know velocity but mix up force and momentum.",
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
    expect((screen.getByLabelText(LABEL) as HTMLTextAreaElement).value).toBe(SHORT);
  });
});
