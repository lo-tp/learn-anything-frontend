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
  within,
} from "@testing-library/react";
import { renderWithLocale, stubVisualViewport } from "@/test/test-utils";
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
  clickSend,
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

/**
 * jsdom lays nothing out: `scrollHeight` is 0 and assigning `scrollTop` goes
 * nowhere. State a scrolled record instead — one whose bottom sits 1200px down
 * its pane — and record every pin the sheet asks for.
 */
const RECORD_BOTTOM_PX = 1200;

function stubRecordScroll() {
  const proto = Element.prototype;
  const originalTop = Object.getOwnPropertyDescriptor(proto, "scrollTop")!;
  const originalHeight = Object.getOwnPropertyDescriptor(
    proto,
    "scrollHeight",
  )!;
  const pins: number[] = [];
  Object.defineProperty(proto, "scrollTop", {
    configurable: true,
    get: () => pins.at(-1) ?? 0,
    set: (value: number) => {
      pins.push(value);
    },
  });
  Object.defineProperty(proto, "scrollHeight", {
    configurable: true,
    get: () => RECORD_BOTTOM_PX,
  });
  return {
    pins,
    restore: () => {
      Object.defineProperty(proto, "scrollTop", originalTop);
      Object.defineProperty(proto, "scrollHeight", originalHeight);
    },
  };
}

/** Every focus the sheet asks for, with the options it gave the browser. */
function stubFocus() {
  const proto = HTMLElement.prototype;
  const original = Object.getOwnPropertyDescriptor(proto, "focus")!;
  const calls: unknown[] = [];
  Object.defineProperty(proto, "focus", {
    configurable: true,
    value: function (this: HTMLElement, options?: FocusOptions) {
      calls.push(options);
    },
  });
  return {
    calls,
    restore: () => Object.defineProperty(proto, "focus", original),
  };
}

/** The record pane the sheet renders. */
function recordPane(): HTMLElement {
  return document.querySelector(".overflow-y-auto") as HTMLElement;
}

/**
 * The room a record pane has when no test states one: enough to scroll, fixed.
 */
const RECORD_PANE_VIEW_PX = 600;

/** The room the record pane itself has reserved at its bottom — padding the
 *  sheet put there, read off the node the sheet put it on. A real pane counts
 *  its own padding in its scroll height, so this does too.
 */
function reservedRoomOnPanePx(): number {
  const panel = document.querySelector(".overflow-y-auto") as HTMLElement | null;
  return Number.parseFloat(panel?.style.paddingBottom ?? "") || 0;
}

/**
 * A record of a known length inside a pane of a known room, shown as a real pane
 * shows it: `clientHeight` is the room, `scrollHeight` is the record plus
 * whatever room the sheet has reserved at the pane's bottom, and a pinned
 * `scrollTop` clamps to the scrollable maximum the way a browser clamps it.
 *
 * Two numbers a test has to be able to move, because both are what the sheet's
 * pinning actually has to cope with:
 *
 * - `setBottom(px)` — content that has landed is not finished laying out, so a
 *   record ends lower than the height it had the moment it was measured (#236).
 * - `roomPx` — read whenever the sheet measures the pane, because a sheet is
 *   sized to the visible viewport and its pane shrinks with a keyboard: whether
 *   the keys are hiding part of the record is a fact about the record *and* the
 *   room it is left with (#230).
 */
function stubRecordPane(
  startBottomPx: number,
  { roomPx = () => RECORD_PANE_VIEW_PX }: { roomPx?: () => number } = {},
) {
  const proto = Element.prototype;
  const originalTop = Object.getOwnPropertyDescriptor(proto, "scrollTop")!;
  const originalHeight = Object.getOwnPropertyDescriptor(
    proto,
    "scrollHeight",
  )!;
  const originalClient = Object.getOwnPropertyDescriptor(
    proto,
    "clientHeight",
  )!;
  let bottom = startBottomPx;
  const pins: number[] = [];
  const maxScroll = () => Math.max(0, bottom + reservedRoomOnPanePx() - roomPx());
  Object.defineProperty(proto, "scrollTop", {
    configurable: true,
    get: () => pins.at(-1) ?? 0,
    set: (value: number) => {
      pins.push(Math.min(value, maxScroll()));
    },
  });
  Object.defineProperty(proto, "scrollHeight", {
    configurable: true,
    get: () => bottom + reservedRoomOnPanePx(),
  });
  Object.defineProperty(proto, "clientHeight", {
    configurable: true,
    get: () => roomPx(),
  });
  /** The offset a pin at this bottom lands at, as a browser would clamp it. */
  const offset = (bottomPx: number) =>
    Math.max(0, bottomPx + reservedRoomOnPanePx() - roomPx());
  return {
    pins,
    offset,
    setBottom: (px: number) => {
      bottom = px;
    },
    restore: () => {
      Object.defineProperty(proto, "scrollTop", originalTop);
      Object.defineProperty(proto, "scrollHeight", originalHeight);
      Object.defineProperty(proto, "clientHeight", originalClient);
    },
  };
}

/**
 * Animation frames and resize reports, driven by hand: `flushFrames(n)` runs
 * the queued frames — one wave per call — and `fireResize()` delivers the
 * resize observations the browser would have made. jsdom lays nothing out
 * and ships no ResizeObserver, so the sheet's follow is only testable
 * through its own frame and resize seams (#236).
 */
function stubFramesAndResizes() {
  const win = window as Window & {
    ResizeObserver?: typeof ResizeObserver | undefined;
  };
  const original = {
    raf: window.requestAnimationFrame,
    caf: window.cancelAnimationFrame,
    ro: win.ResizeObserver,
  };
  const queue = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    const id = nextId++;
    queue.set(id, cb);
    return id;
  }) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = ((id: number) => {
    queue.delete(id);
  }) as typeof window.cancelAnimationFrame;
  const observers: ResizeObserverCallback[] = [];
  class StubResizeObserver {
    constructor(cb: ResizeObserverCallback) {
      observers.push(cb);
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  win.ResizeObserver = StubResizeObserver as unknown as typeof ResizeObserver;
  return {
    flushFrames: (waves = 1) => {
      for (let wave = 0; wave < waves; wave += 1) {
        const pending = [...queue.values()];
        queue.clear();
        for (const cb of pending) cb(0);
      }
    },
    fireResize: () => {
      for (const cb of observers) cb([], {} as unknown as ResizeObserver);
    },
    restore: () => {
      window.requestAnimationFrame = original.raf;
      window.cancelAnimationFrame = original.caf;
      if (original.ro === undefined) delete win.ResizeObserver;
      else win.ResizeObserver = original.ro;
    },
  };
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

  it("keeps every option of a boundary check on the record after the learner picks (#231)", async () => {
    mockCreateSession.mockResolvedValue({ session_id: "s-1", phase: "probing" });
    mockStartProbe.mockResolvedValue({ phase: "probing", questions: [Q1] });
    mockAnswerProbe.mockResolvedValue({ phase: "probing", questions: [Q2] });
    await openDialog(GOAL);
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    // What the learner was shown, in the order they were shown it.
    const question = await screen.findByText(Q1.text);
    const buttons = Array.from(
      question.closest("fieldset")!.querySelectorAll("button"),
    ) as HTMLButtonElement[];
    const presented = buttons.map((button) => button.textContent ?? "");
    fireEvent.click(
      buttons.find((button) => (button.textContent ?? "").includes("10 m/s²"))!,
    );
    await screen.findByText("Not quite.");

    // The record keeps the whole question: every option the check presented,
    // in the order it presented them (#231) — answering never reorders the
    // learner's own answer out from under them.
    const entry = screen.getByText(Q1.text).closest(".border-t") as HTMLElement;
    const fields = Array.from(
      entry.querySelectorAll(".bg-surface-container-lowest"),
    ) as HTMLElement[];
    expect(fields.map((field) => field.textContent ?? "")).toEqual(presented);

    // The pick is still labelled as the learner's own, and the record states
    // the verdict in the reserved inks: the wrong pick in correction ink, the
    // option the check verifies in verified green, the alternatives in pencil.
    const fieldOf = (option: string) =>
      within(entry)
        .getByText(option)
        .closest(".bg-surface-container-lowest") as HTMLElement;
    expect(within(entry).getByText("Your answer")).toBeTruthy();
    expect(fieldOf("10 m/s²").classList.contains("text-error")).toBe(true);
    expect(fieldOf("5 m/s²").classList.contains("text-tertiary")).toBe(true);
    expect(fieldOf("2 m/s²").classList.contains("text-on-surface-variant")).toBe(
      true,
    );
    expect(
      fieldOf("I don't know").classList.contains("text-on-surface-variant"),
    ).toBe(true);

    // The verified option is named in words too — the record states its
    // verdict in the reserved ink, never in colour alone.
    const verifiedLabel = fieldOf("5 m/s²")
      .previousElementSibling as HTMLElement;
    expect(verifiedLabel.textContent).toBe("Correct.");
    expect(verifiedLabel.classList.contains("text-tertiary")).toBe(true);
    expect(within(entry).getAllByText("Correct.")).toHaveLength(1);
  });

  it("keeps the whole question on the record after a right answer too (#231)", async () => {
    mockCreateSession.mockResolvedValue({ session_id: "s-1", phase: "probing" });
    mockStartProbe.mockResolvedValue({ phase: "probing", questions: [Q1] });
    mockAnswerProbe.mockResolvedValue({ phase: "probing", questions: [Q2] });
    await openDialog(GOAL);
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    const question = await screen.findByText(Q1.text);
    const buttons = Array.from(
      question.closest("fieldset")!.querySelectorAll("button"),
    ) as HTMLButtonElement[];
    fireEvent.click(
      buttons.find((button) => (button.textContent ?? "").includes("5 m/s²"))!,
    );
    await screen.findByText("Correct.");

    const entry = screen.getByText(Q1.text).closest(".border-t") as HTMLElement;
    for (const option of Q1.options) {
      expect(within(entry).getByText(option)).toBeTruthy();
    }
    // The verified pick wears the verified ink; the alternatives stay pencil.
    const picked = within(entry)
      .getByText("5 m/s²")
      .closest(".bg-surface-container-lowest") as HTMLElement;
    expect(picked.classList.contains("text-tertiary")).toBe(true);
    expect(within(entry).getByText("Your answer")).toBeTruthy();
    // A pick that was right needs no second name: the record's one
    // "Correct." is the verdict caption itself.
    expect(within(entry).getAllByText("Correct.")).toHaveLength(1);
    expect(picked.previousElementSibling?.textContent).toBe("Your answer");
    expect(
      within(entry)
        .getByText("20 m/s²")
        .closest(".bg-surface-container-lowest")!.classList.contains(
          "text-on-surface-variant",
        ),
    ).toBe(true);
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
    const record = stubRecordScroll();
    await openDialog(SHORT);
    clickSend();
    await screen.findByText("A bit more, please.");

    fireEvent.change(screen.getByLabelText("A bit more, please."), {
      target: { value: "More detail." },
    });
    clickSend();
    await screen.findByText("One more detail, please.");

    // jsdom lays nothing out, so `stubRecordScroll` states the record's scroll:
    // a pin is an assignment to its bottom.
    expect(record.pins).toContain(RECORD_BOTTOM_PX);

    record.restore();
  });

  it("pins the record to the open ask again when the keyboard takes the room (#230)", async () => {
    // The reported iPhone case: the sheet is 844px tall with the keyboard out,
    // 514px of it is left above the keyboard once it is up. A scroll container
    // keeps its offset from the top when it shrinks, so the field being filled
    // — the last item in the record — is what ends under the keyboard.
    const stub = stubVisualViewport({ innerHeight: 844, height: 844 });
    try {
      await openDialog();
      const panel = document.querySelector(".overflow-y-auto") as HTMLElement;
      const setScrollTop = vi.fn();
      Object.defineProperty(panel, "scrollTop", {
        set: setScrollTop,
        get: () => 0,
        configurable: true,
      });
      Object.defineProperty(panel, "scrollHeight", { value: 1200, configurable: true });

      stub.resizeTo({ height: 514 });
      expect(setScrollTop).toHaveBeenCalledWith(1200);

      // A room that only *moves* is the browser panning after a focused field,
      // and a room that grows hides nothing: neither touches the scroll the
      // reader chose. What reserves the room, and what pins with it, is a
      // keyboard covering the screen — which this has stopped doing.
      setScrollTop.mockClear();
      stub.panTo(37);
      stub.resizeTo({ height: 844 });
      expect(setScrollTop).not.toHaveBeenCalled();
    } finally {
      stub.restore();
    }
  });

  /** Watch every `scrollTop` the page writes while the sheet mounts: the record
   *  is the one that may not be touched unless the room asks for it. */
  function watchScrollWrites() {
    const original = Object.getOwnPropertyDescriptor(Element.prototype, "scrollTop");
    const written: Element[] = [];
    Object.defineProperty(Element.prototype, "scrollTop", {
      configurable: true,
      get: original?.get,
      set(this: Element, value: number) {
        written.push(this);
        original?.set?.call(this, value);
      },
    });
    return {
      written,
      restore: () => {
        if (original) {
          Object.defineProperty(Element.prototype, "scrollTop", original);
        }
      },
    };
  }

  it("pins the record when the sheet opens into a room the keyboard had already taken (#230)", async () => {
    // The case the report showed: a learner reaching the sheet from a field they
    // were already typing in. Nothing shrinks in front of the sheet — the room it
    // opens into is already the keyboard's — so the measure has to be read as a
    // fact the moment the record appears, not as a change to wait for.
    const stub = stubVisualViewport({ innerHeight: 844, height: 514 });
    const scrollWrites = watchScrollWrites();
    try {
      await openDialog();
      const panel = document.querySelector(".overflow-y-auto") as HTMLElement;
      expect(scrollWrites.written).toContain(panel);
    } finally {
      scrollWrites.restore();
      stub.restore();
    }
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

    // The room the sheet is bounded to is the measured one, not the layout
    // viewport (#230): the shell states it as two properties and the sheet is
    // sized and pinned from them.
    expect(
      sheet.classList.contains("h-[var(--visual-viewport-height)]"),
    ).toBe(true);
    expect(
      sheet.classList.contains("top-[var(--visual-viewport-offset-top)]"),
    ).toBe(true);

    const form = sheet.querySelector("form") as HTMLElement;
    expect(form.classList.contains("flex-1")).toBe(true);
    expect(form.classList.contains("min-h-0")).toBe(true);

    const panel = recordPane();
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

describe("NewSessionDialog — the record above the keyboard (#230)", () => {
  /**
   * The iPhone 14 the report came from: an 844px layout viewport, 514px of it
   * left above the keyboard. The sheet's pinned band — the masthead and the
   * progress rail — keeps its height, so the record reaches its reader through
   * whatever is left: a 694px pane with the keyboard out, a 364px one with it
   * up (The Visible-Viewport Rule).
   */
  const VIEWPORT_WITH_KEYBOARD_PX = 514;
  const PINNED_BAND_PX = 150;
  /** The room the record's pane has: the screen above the keys, less the band. */
  const recordRoomPx = () =>
    (window.visualViewport?.height ?? 0) - PINNED_BAND_PX;

  afterEach(() => {
    delete (window as unknown as { visualViewport?: unknown }).visualViewport;
  });

  it("leaves a record the room shows unpadded, and does not scroll it, when the keyboard opens (#230)", async () => {
    // A 300px record fits the 694px pane with the keyboard out, and it fits the
    // 364px pane the keyboard leaves. It is entirely above the keys, so the
    // keyboard hides nothing: no room is reserved and the sheet does not touch
    // the record's scroll. Padding and pinning belong to a record the keys are
    // covering, not to a keyboard that happens to be out.
    const stub = stubVisualViewport({
      innerHeight: 844,
      height: 844,
    });
    const record = stubRecordPane(300, { roomPx: recordRoomPx });
    const frames = stubFramesAndResizes();
    try {
      await openDialog();
      const panel = recordPane();
      const scrolled = vi.fn();
      Object.defineProperty(panel, "scrollTop", {
        configurable: true,
        get: () => 0,
        set: scrolled,
      });

      stub.resizeTo({ height: VIEWPORT_WITH_KEYBOARD_PX });

      expect(panel.style.paddingBottom).toBe("");
      expect(scrolled).not.toHaveBeenCalled();
    } finally {
      frames.restore();
      record.restore();
      stub.restore();
    }
  });

  it("reserves the room, and pins, where the room is too short to show the record (#230)", async () => {
    // The same viewport and the same pane, with a 500px record: it fits the
    // 694px pane with the keyboard out — nothing is reserved — and it does not
    // fit the 364px pane the keyboard leaves, which is the case the reservation
    // exists for.
    const stub = stubVisualViewport({
      innerHeight: 844,
      height: 844,
    });
    const record = stubRecordPane(500, { roomPx: recordRoomPx });
    const frames = stubFramesAndResizes();
    try {
      await openDialog();
      const panel = recordPane();
      expect(panel.style.paddingBottom).toBe("");
      expect(panel.scrollTop).toBe(0);

      stub.resizeTo({ height: VIEWPORT_WITH_KEYBOARD_PX });

      // The record reaches 136px past the room the keyboard leaves, so the
      // covered 330px are reserved at its bottom — and it is pinned to the
      // padded bottom, which lands the open ask just above the keys: 500 + 330
      // of content scrolled through a 364px room leaves it at 466px.
      expect(panel.style.paddingBottom).toBe("330px");
      expect(panel.scrollTop).toBe(466);
    } finally {
      frames.restore();
      record.restore();
      stub.restore();
    }
  });

  it("pins the record to the bottom of a room a browser shrank itself, with nothing to reserve (#230)", async () => {
    // The other half of #230: a browser that takes the room out of its own
    // layout viewport (`interactive-widget=resizes-content`, Chrome from 108)
    // leaves the two viewports equal, so the measure reports no inset and there
    // is nothing to reserve. The pane is still shorter, and a 500px record no
    // longer fits the 364px room it now has — so it is pinned to the bottom it
    // can reach, which is 500 - 364 = 136px down, with no padding added.
    const stub = stubVisualViewport({ innerHeight: 844, height: 844 });
    const record = stubRecordPane(500, { roomPx: recordRoomPx });
    const frames = stubFramesAndResizes();
    try {
      await openDialog();
      const panel = recordPane();
      expect(panel.style.paddingBottom).toBe("");

      stub.resizeTo({ innerHeight: 514, height: 514 });

      expect(panel.style.paddingBottom).toBe("");
      expect(panel.scrollTop).toBe(136);
    } finally {
      frames.restore();
      record.restore();
      stub.restore();
    }
  });

  it("leaves a record a shorter room still shows where the reader has it (#230)", async () => {
    // A 300px record fits the 364px room the shrunk viewport leaves, so the
    // shorter room hides nothing of it: the reservation stays off and the sheet
    // does not touch the record's scroll.
    const stub = stubVisualViewport({ innerHeight: 844, height: 844 });
    const record = stubRecordPane(300, { roomPx: recordRoomPx });
    const frames = stubFramesAndResizes();
    try {
      await openDialog();
      const panel = recordPane();
      const scrolled = vi.fn();
      Object.defineProperty(panel, "scrollTop", {
        configurable: true,
        get: () => 0,
        set: scrolled,
      });

      stub.resizeTo({ innerHeight: 514, height: 514 });

      expect(panel.style.paddingBottom).toBe("");
      expect(scrolled).not.toHaveBeenCalled();
    } finally {
      frames.restore();
      record.restore();
      stub.restore();
    }
  });

  it("re-asks the reservation whenever the record's own size changes, not only when the keyboard moves (#230)", async () => {
    // The room the keys leave is 364px. A 500px record reaches past it, so the
    // covered 330px are reserved at its bottom. Then the learner answers a
    // boundary check: a set of option rows is replaced by the one line that
    // records the pick, and the record is 200px — a room it fits. The keyboard
    // never moved; the record did. Whether the keys are hiding part of the record
    // is a fact about both, so the padding comes off, and goes back on when the
    // record grows past the room again.
    const stub = stubVisualViewport({
      innerHeight: 844,
      height: 844,
    });
    const record = stubRecordPane(500, { roomPx: recordRoomPx });
    const frames = stubFramesAndResizes();
    try {
      await openDialog();
      const panel = recordPane();
      stub.resizeTo({ height: VIEWPORT_WITH_KEYBOARD_PX });
      expect(panel.style.paddingBottom).toBe("330px");

      record.setBottom(200);
      // The fact that the record got shorter, with no keyboard event in it.
      frames.fireResize();
      expect(panel.style.paddingBottom).toBe("");

      record.setBottom(700);
      frames.fireResize();
      expect(panel.style.paddingBottom).toBe("330px");
      frames.flushFrames(2);
      // …and the follow lands the open ask above the keys: 700 + 330 of content
      // through a 364px room lands it at 666px.
      expect(panel.scrollTop).toBe(666);
    } finally {
      frames.restore();
      record.restore();
      stub.restore();
    }
  });

  it("reserves the room an opening keyboard covers at the record's bottom, and pins to it", async () => {
    const stub = stubVisualViewport({ innerHeight: 844, height: 844 });
    const record = stubRecordScroll();
    await openDialog();
    const panel = recordPane();
    const before = record.pins.length;

    // The keyboard opens: 330px of the screen is gone, and the record's own
    // scroll is the only way to reach the field being answered.
    stub.resizeTo({ height: 514 });

    expect(panel.style.paddingBottom).toBe("330px");
    expect(record.pins.length).toBeGreaterThan(before);
    expect(record.pins.at(-1)).toBe(RECORD_BOTTOM_PX);

    record.restore();
    stub.restore();
  });

  it("reserves the room when the sheet opens into a keyboard already up", async () => {
    // The reported case: the learner arrives at the sheet from a field they were
    // typing in, so nothing shrinks in front of the sheet — the room it opens
    // into is already the keyboard's.
    const stub = stubVisualViewport({ innerHeight: 844, height: 514 });
    const record = stubRecordScroll();
    await openDialog();

    expect(recordPane().style.paddingBottom).toBe("330px");
    expect(record.pins).toContain(RECORD_BOTTOM_PX);

    record.restore();
    stub.restore();
  });

  it("takes the reservation back when the keyboard goes, and leaves the reader's scroll alone", async () => {
    const stub = stubVisualViewport({ innerHeight: 844, height: 514 });
    const record = stubRecordScroll();
    const frames = stubFramesAndResizes(); // no follow frames while the reader scrolls
    await openDialog();
    try {
      const panel = recordPane();
      expect(panel.style.paddingBottom).toBe("330px");

      // The reader scrolls up to re-read a question the app asked earlier.
      panel.scrollTop = 400;

      stub.resizeTo({ height: 844 });

      // Nothing covers the record any more, so it is not padded — and nothing
      // is scrolled either: the room is whole again and the scroll is the
      // reader's.
      expect(panel.style.paddingBottom).toBe("");
      expect(record.pins.at(-1)).toBe(400);
    } finally {
      frames.restore();
      record.restore();
      stub.restore();
    }
  });

  it("leaves the record unpadded where no room is taken", async () => {
    const stub = stubVisualViewport({ innerHeight: 844, height: 844 });
    const record = stubRecordScroll();
    await openDialog();

    expect(recordPane().style.paddingBottom).toBe("");

    record.restore();
    stub.restore();
  });

  it("re-pins when the record changes for a reason the entry count cannot see", async () => {
    // A boundary pick adds no entry: the card on the record changes state and
    // the refusal is printed beneath it, while the open ask re-renders below
    // that. The record visibly got longer and the keyboard is still up — only
    // watching the record itself notices, which is why the pin follows the
    // record rather than a count of entries (#230).
    mockCreateSession.mockResolvedValue({ session_id: "s-1", phase: "probing" });
    mockStartProbe.mockResolvedValue({ phase: "probing", questions: [Q1] });
    mockAnswerProbe.mockRejectedValue(new Error("no answer came back"));
    const stub = stubVisualViewport({ innerHeight: 844, height: 844 });
    const record = stubRecordScroll();
    await openDialog(GOAL);
    clickSend();
    await screen.findByText(Q1.text);
    const before = record.pins.length;

    fireEvent.click(screen.getByRole("button", { name: /5 m\/s²/ }));
    await screen.findByText(/Something went wrong/);

    expect(record.pins.length).toBeGreaterThan(before);

    record.restore();
    stub.restore();
  });

  it("holds the reservation through an ask that is a choice, not a field", async () => {
    // The record's ask is not always a textarea: at the boundary it is a set of
    // option rows. The reservation belongs to the record, not to the control, so
    // it has to survive that change — and the keyboard closing still has to take
    // it back off.
    mockCreateSession.mockResolvedValue({ session_id: "s-1", phase: "probing" });
    mockStartProbe.mockResolvedValue({ phase: "probing", questions: [Q1] });
    const stub = stubVisualViewport({ innerHeight: 844, height: 514 });
    const record = stubRecordScroll();
    await openDialog(GOAL);
    const panel = recordPane();
    expect(panel.style.paddingBottom).toBe("330px");

    clickSend();
    await screen.findByText(Q1.text);
    expect(document.querySelector("textarea")).toBeNull();

    stub.resizeTo({ height: 844 });

    expect(panel.style.paddingBottom).toBe("");

    record.restore();
    stub.restore();
  });

  it("asks the browser not to scroll when it focuses the field", async () => {
    const stub = stubVisualViewport({ innerHeight: 844, height: 514 });
    const focus = stubFocus();
    await openDialog();

    // The record above the field has just been pinned to it. A browser asked to
    // chase the field pans the whole page a second time, which is what puts the
    // pinned band and the record out of sight (#230).
    expect(focus.calls.some((o) => (o as FocusOptions)?.preventScroll === true)).toBe(
      true,
    );

    focus.restore();
    stub.restore();
  });
});

describe("NewSessionDialog — keeping the record at its bottom (#236)", () => {
  it("re-pins when the record finishes laying out after the pin that measured it", async () => {
    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "clarifying",
      clarifying_questions: ["What do you already know about forces?"],
    });
    const record = stubRecordPane(1200);
    const frames = stubFramesAndResizes();
    try {
      await openDialog(GOAL);
      clickSend();

      // A question lands on the record, and the sheet pins to the bottom the
      // record measures at that moment — clamped, as a browser clamps, to the
      // scrollable maximum.
      await screen.findByText("What do you already know about forces?");
      expect(record.pins.at(-1)).toBe(record.offset(1200));

      // …then that content finishes laying out — the equation renders, the
      // text re-wraps — and the record ends 300px lower without another DOM
      // change. The follow re-measures in the frames after the pin and finds
      // the bottom the first measurement missed (#236: the reported failure
      // was the scroll finishing before the appended content arrived).
      record.setBottom(1500);
      frames.flushFrames(1);
      expect(record.pins.at(-1)).toBe(record.offset(1500));

      // The follow stops when the bottom stops moving: the pane is at rest,
      // not chased forever.
      const settled = record.pins.length;
      frames.flushFrames(3);
      expect(record.pins).toHaveLength(settled);
    } finally {
      frames.restore();
      record.restore();
    }
  });

  it("follows a record that gets longer with no DOM change at all", async () => {
    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "clarifying",
      clarifying_questions: ["What do you already know about forces?"],
    });
    const record = stubRecordPane(1200);
    const frames = stubFramesAndResizes();
    try {
      await openDialog(GOAL);
      clickSend();
      await screen.findByText("What do you already know about forces?");
      frames.flushFrames(2); // let the first follow settle at 1200

      // A web font arrives: every recorded line reflows a little taller.
      // No node was added or changed — a MutationObserver can never see this
      // one. The record column's own resize is the fact, and the sheet
      // treats it as one.
      record.setBottom(1800);
      frames.fireResize();
      expect(record.pins.at(-1)).toBe(record.offset(1800));
    } finally {
      frames.restore();
      record.restore();
    }
  });

  it("leaves a reader who scrolled up out of a re-layout, and returns to what lands", async () => {
    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "clarifying",
      clarifying_questions: ["What do you already know about forces?"],
    });
    mockClarifySession.mockResolvedValue({
      session_id: "s-1",
      phase: "clarifying",
      clarifying_questions: ["And what happens when the mass changes?"],
    });
    const record = stubRecordPane(1200);
    const frames = stubFramesAndResizes();
    try {
      await openDialog(GOAL);
      clickSend();
      await screen.findByText("What do you already know about forces?");
      frames.flushFrames(2); // let the first follow settle at 1200

      // The reader scrolls up to re-read the opening lines.
      const panel = recordPane();
      panel.scrollTop = 400;

      // Then a web font arrives and every recorded line reflows taller. The
      // new bottom is not a reason to move a reader who had already scrolled
      // away from the old one (#230's promise, extended to re-lays).
      record.setBottom(1800);
      frames.fireResize();
      expect(record.pins.at(-1)).toBe(400);
      const settled = record.pins.length;
      frames.flushFrames(3);
      expect(record.pins).toHaveLength(settled);

      // An answer arriving on the record is different: it is the open ask
      // moving, and the sheet goes back to it even when the reader had
      // scrolled away.
      fireEvent.change(await screen.findByRole("textbox"), {
        target: { value: "Forces make things speed up." },
      });
      clickSend();
      await screen.findByText("Forces make things speed up.");
      expect(record.pins.at(-1)).toBe(record.offset(1800));
    } finally {
      frames.restore();
      record.restore();
    }
  });
});
