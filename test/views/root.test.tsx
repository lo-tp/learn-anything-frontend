// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
} from "@testing-library/react";
import { renderWithLocale } from "@/test/test-utils";
import { Root } from "@/views/root";
import {
  createSession,
  generatePlan,
  approvePlan,
  listSessions,
  ApiError,
  type SessionListItem,
} from "@/lib/api-client";

// The new-session dialog creates sessions through the typed backend client;
// stub that module (openapi-fetch binds `fetch` at client-creation time, so
// stubbing the global fetch after import never intercepts it).
// `ApiError` keeps its `status` field so the view's 401 check is exercised.
vi.mock("@/lib/api-client", () => ({
  createSession: vi.fn(),
  clarifySession: vi.fn(),
  startProbe: vi.fn(),
  answerProbe: vi.fn(),
  generatePlan: vi.fn(),
  adjustPlan: vi.fn(),
  approvePlan: vi.fn(),
  listSessions: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(
      message: string,
      readonly status?: number,
    ) {
      super(message);
      this.name = "ApiError";
    }
  },
}));

const mockCreateSession = vi.mocked(createSession);
const mockGeneratePlan = vi.mocked(generatePlan);
const mockApprovePlan = vi.mocked(approvePlan);
const mockListSessions = vi.mocked(listSessions);

beforeEach(() => {
  mockCreateSession.mockReset();
  mockGeneratePlan.mockReset();
  mockApprovePlan.mockReset();
  mockListSessions.mockReset();
});

afterEach(() => {
  cleanup();
});

function session(overrides: Partial<SessionListItem> = {}): SessionListItem {
  return {
    session_id: "s-1",
    phase: "executing",
    goal: "React Hooks Deep Dive",
    narrowed_goal: null,
    created_at: "2025-10-25T10:00:00.000Z",
    ...overrides,
  };
}

describe("Root (home History)", () => {
  it("shows the 'Start New Session' button in the empty state", async () => {
    mockListSessions.mockResolvedValue({ sessions: [] });
    renderWithLocale(<Root />);
    expect(await screen.findByText("No sessions yet")).toBeTruthy();
    // Header hidden ⇒ the only 'Start New Session' button must be the one the
    // empty state renders at the bottom.
    expect(screen.queryByText("My Sessions")).toBeNull();
    expect(screen.getByRole("button", { name: /Start New Session/ })).toBeTruthy();
  });

  it("fetches the History on mount and shows the 'My Sessions' header with session cards", async () => {
    mockListSessions.mockResolvedValue({ sessions: [session()] });
    renderWithLocale(<Root />);
    expect(await screen.findByText("My Sessions")).toBeTruthy();
    expect(screen.getByText("React Hooks Deep Dive")).toBeTruthy();
    expect(screen.queryByText("No sessions yet")).toBeNull();
    expect(mockListSessions).toHaveBeenCalledWith(); // no phase filter — History shows all phases
  });

  it("degrades to the empty state when the backend is unreachable", async () => {
    mockListSessions.mockRejectedValue(new Error("boom"));
    renderWithLocale(<Root />);
    expect(await screen.findByText("No sessions yet")).toBeTruthy();
  });

  it("does not update state when unmounted before the initial fetch settles", async () => {
    let resolveFetch: (value: { sessions: [] }) => void;
    mockListSessions.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );
    const { unmount } = renderWithLocale(<Root />);
    unmount();

    // The in-flight fetch resolves after unmount; the cancelled guard skips
    // the state update. Let the resolution run.
    resolveFetch!({ sessions: [] });
    await Promise.resolve();
    expect(screen.queryByText("No sessions yet")).toBeNull();
  });

  it("does not show the empty state when the fetch fails with 401", async () => {
    // The API client redirects to login on a 401 (handleUnauthorized); while
    // the redirect takes over the tab, the page must not claim there are no
    // sessions.
    mockListSessions.mockRejectedValue(new ApiError("unauthorized", 401));
    renderWithLocale(<Root />);
    await waitFor(() => expect(mockListSessions).toHaveBeenCalled());
    expect(screen.queryByText("No sessions yet")).toBeNull();
  });

  it("opens the new-session dialog from the 'Start New Session' CTA", async () => {
    mockListSessions.mockResolvedValue({ sessions: [session()] });
    renderWithLocale(<Root />);
    // Let the mount fetch settle so the header CTA is the one under test.
    await screen.findByText("My Sessions");
    fireEvent.click(
      screen.getByRole("button", { name: /Start New Session/ }),
    );
    expect(
      await screen.findByRole("heading", { name: "Start New Session" }),
    ).toBeTruthy();
  });

  it("opens the new-session dialog from the empty-state CTA", async () => {
    mockListSessions.mockResolvedValue({ sessions: [] });
    renderWithLocale(<Root />);
    await screen.findByText("No sessions yet");
    fireEvent.click(
      screen.getByRole("button", { name: /Start New Session/ }),
    );
    expect(
      await screen.findByRole("heading", { name: "Start New Session" }),
    ).toBeTruthy();
  });

  it("refetches the History when the dialog accepts a new session", async () => {
    const fresh: SessionListItem = {
      session_id: "s-newton",
      // Just approved → the backend transitions it to `generating`.
      phase: "generating",
      goal: "Newton's second law of motion",
      narrowed_goal: "Newton's second law of motion",
      created_at: "2025-10-25T11:00:00.000Z",
    };
    // The dialog creates the session through the typed backend client. A
    // non-probing advanced phase skips the probe loop and auto-generates the
    // plan (the review step replaces the old confirm step).
    mockCreateSession.mockResolvedValue({
      session_id: fresh.session_id,
      phase: "planning",
      narrowed_goal: fresh.narrowed_goal,
    });
    mockGeneratePlan.mockResolvedValue({
      phase: "reviewing",
      plan: {
        prose_summary: "Start from scalar F = ma, then extend to vectors.",
        dependency_dag: "scalar -> vector",
        steps: [
          {
            id: "step-1",
            letter: "A",
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
    // The mount fetch returns the old list; the re-fetch after accept
    // returns the new session on top.
    mockListSessions
      .mockResolvedValueOnce({ sessions: [session()] })
      .mockResolvedValueOnce({ sessions: [fresh, session()] });

    renderWithLocale(<Root />);
    await screen.findByText("My Sessions");
    fireEvent.click(
      screen.getByRole("button", { name: /Start New Session/ }),
    );
    const textarea = await screen.findByLabelText(
      "What would you like to explore or learn?",
    );
    fireEvent.change(textarea, {
      target: {
        value:
          "I want to master Newton's second law of motion and how force, mass, and acceleration fit together.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    // The plan auto-generates: the review step replaces the old confirm
    // step. The typed approval command ("approve" + Enter) keeps the dialog
    // open in the "on the way" state (no re-fetch yet); closing back to the
    // session list hands off (triggering the re-fetch).
    const review = await screen.findByLabelText(
      "How should we adjust the plan?",
    );
    fireEvent.change(review, { target: { value: "approve" } });
    fireEvent.keyDown(review, { key: "Enter" });
    await screen.findByRole("button", { name: /Back to my sessions/ });
    fireEvent.click(screen.getByRole("button", { name: /Back to my sessions/ }));

    // The accepted session appears at the top — only possible through the
    // re-fetch, since it was not in the mount fetch's list.
    expect(await screen.findByText("Newton's second law of motion")).toBeTruthy();
    expect(mockListSessions).toHaveBeenCalledTimes(2); // mount fetch + re-fetch
  });
});
