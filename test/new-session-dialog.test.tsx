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
import { NewSessionDialog } from "../views/root/new-session-dialog";
import { ApiError, createSession } from "../lib/api-client";

// The dialog calls the typed backend client. Stub the module rather than the
// global fetch: openapi-fetch binds `fetch` when the client is created, so a
// `vi.stubGlobal("fetch", ...)` after the module import never intercepts its
// requests.
vi.mock("../lib/api-client", () => ({
  createSession: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

const mockCreateSession = vi.mocked(createSession);

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
  });

  it("keeps the dialog open and shows the clarifying questions when the goal is too thin", async () => {
    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "clarifying",
      clarifying_questions: ["A bit more, please."],
    });
    await openDialog(SHORT);
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    await screen.findByText("A bit more, please.");
    // The modal stays open with the learner's text preserved.
    expect(screen.getByRole("heading", { name: TITLE })).toBeTruthy();
    expect((screen.getByLabelText(LABEL) as HTMLTextAreaElement).value).toBe(SHORT);
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

  it("notifies the parent and closes on an accepted intake", async () => {
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
    // The modal stays open for another attempt.
    expect(screen.getByRole("heading", { name: TITLE })).toBeTruthy();
  });
});
