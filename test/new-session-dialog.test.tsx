// @vitest-environment jsdom
import { useState } from "react";
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { NewSessionDialog } from "../components/new-session-dialog";

const TITLE = "Start a New Learning Journey";
const LABEL = "What are we focusing on today?";
const SHORT = "Too short.";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function stubFetch(impl: () => unknown) {
  const fetchMock = vi.fn(impl) as Mock;
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("NewSessionDialog", () => {
  it("shows the intake form from the design", async () => {
    await openDialog();
    expect(screen.getByRole("heading", { name: TITLE })).toBeTruthy();
    expect(
      screen.getByPlaceholderText(/Describe your learning goal/),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Start Session/ }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Cancel/ }),
    ).toBeTruthy();
  });

  it("shows a pending state and disables the buttons while the request is in flight", async () => {
    stubFetch(() => new Promise(() => {}));
    await openDialog("I want to understand Rust ownership and borrowing rules in depth.");
    fireEvent.click(screen.getByRole("button", { name: /Start Session/ }));

    const pending = await screen.findByRole("button", { name: /Starting/ });
    expect((pending as HTMLButtonElement).disabled).toBe(true);
    expect(
      (screen.getByRole("button", { name: /Cancel/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("keeps the dialog open and shows narrow feedback when the intake is too thin", async () => {
    stubFetch(() =>
      Promise.resolve(
        jsonResponse({ verdict: "narrow", feedback: "A bit more, please." }),
      ),
    );
    await openDialog(SHORT);
    fireEvent.click(screen.getByRole("button", { name: /Start Session/ }));

    await screen.findByText("A bit more, please.");
    // The modal stays open with the learner's text preserved.
    expect(screen.getByRole("heading", { name: TITLE })).toBeTruthy();
    expect((screen.getByLabelText(LABEL) as HTMLTextAreaElement).value).toBe(SHORT);
  });

  it("resets the form when the dialog is closed and reopened", async () => {
    stubFetch(() =>
      Promise.resolve(
        jsonResponse({ verdict: "narrow", feedback: "A bit more, please." }),
      ),
    );
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
    fireEvent.click(screen.getByRole("button", { name: /Start Session/ }));
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
    stubFetch(() =>
      Promise.resolve(
        jsonResponse({
          verdict: "accept_target",
          sessionId: "s-1",
          knowledgePoint: "Newton's second law of motion",
        }),
      ),
    );
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
    fireEvent.click(screen.getByRole("button", { name: /Start Session/ }));

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
    stubFetch(() => Promise.reject(new Error("network down")));
    await openDialog(
      "I want to master Newton's second law of motion and I know velocity but mix up force and momentum.",
    );
    fireEvent.click(screen.getByRole("button", { name: /Start Session/ }));

    const error = await screen.findByText(/went wrong|try again/i);
    expect(error).toBeTruthy();
    expect(screen.getByRole("heading", { name: TITLE })).toBeTruthy();
  });
});
