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
  Q1,
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

describe("NewSessionDialog clarify phase", () => {
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
    mockStartProbe.mockResolvedValue({ phase: "probing", questions: [Q1] });
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
      screen.getByText("A bit more, please.").closest("div")?.className,
    ).not.toContain("bg-primary/10");
    fireEvent.change(screen.getByLabelText(LABEL), {
      target: { value: ANSWER },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    // The session was created once; the follow-up went to clarifySession.
    expect(mockCreateSession).toHaveBeenCalledTimes(1);
    expect(mockClarifySession).toHaveBeenCalledWith("s-1", ANSWER);
    // The history grows (beside the fixed opening prompt): you goal →
    // ai questions → you answer → ai goal → ai first probe question
    // (auto-fetched once probing starts).
    await screen.findByText("6 messages");
    // The multi-line answer renders as a list inside the "you" bubble —
    // one trimmed item per line.
    const firstLine = screen.getByText(
      "Focus on how F=ma applies to collisions.",
    );
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
    );
    expect(goal.closest('[class*="bg-primary/10"]')).toBeTruthy();
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
    );
    expect(goal.closest('[class*="bg-primary/10"]')).toBeTruthy();
    // The plan auto-generates and lands in a highlighted plan bubble.
    expect(mockGeneratePlan).toHaveBeenCalledWith("s-1");
    const summary = await screen.findByText(PLAN_OUT.plan.prose_summary);
    expect(summary.closest('[class*="bg-primary/10"]')).toBeTruthy();
    // The review step: the footer keeps Cancel + Send (no Confirm) —
    // approval is a typed command, not a button. The intake stays visible,
    // adapted to plan adjustments.
    expect(screen.getByRole("button", { name: /Cancel/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Send/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Confirm/ })).toBeNull();
    expect(screen.getByText(REVIEW_LABEL)).toBeTruthy();
    // A non-probing advanced phase never touches the probe endpoints.
    expect(mockStartProbe).not.toHaveBeenCalled();
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
    expect(
      screen.queryByText("A bit more, please.", { selector: "p" }),
    ).toBeNull();
    // The modal stays open; the answer moved into the history, so the
    // textarea is cleared (unlike the error path, which preserves it).
    expect(screen.getByRole("heading", { name: TITLE })).toBeTruthy();
    expect(
      (screen.getByLabelText(LABEL) as HTMLTextAreaElement).value,
    ).toBe("");
  });

  it("records the learner's input and the clarifying questions as recent messages", async () => {
    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "clarifying",
      clarifying_questions: ["A bit more, please."],
    });
    await openDialog(SHORT);
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    // The clarifying round appends both turns to the Recent Messages
    // preview (beside the fixed opening prompt).
    await screen.findByText("3 messages");
    // The learner's input shows as a "you" bubble (the textarea value would
    // also match the plain text, so scope to the "you" bubble element).
    expect(
      screen.getByText(SHORT).closest(".bg-secondary-container"),
    ).toBeTruthy();
    // The AI's question shows as a single-line "ai" bubble.
    expect(screen.getByText("A bit more, please.")).toBeTruthy();
  });

  it("renders multiple clarifying questions as a list", async () => {
    mockCreateSession.mockResolvedValue({
      session_id: "s-1",
      phase: "clarifying",
      clarifying_questions: [
        "What is the scope?",
        "What is the target audience?",
      ],
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
});
