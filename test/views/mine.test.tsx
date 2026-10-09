// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
} from "@testing-library/react";
import { renderWithLocale } from "@/test/test-utils";
import { Mine } from "@/views/mine";
import {
  createSession,
  generatePlan,
  approvePlan,
  listSessions,
  ApiError,
  type SessionListItem,
} from "@/lib/api-client";
import { notifySignedIn, notifySignedOut } from "@/lib/auth-events";

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

describe("Mine (the personal list at /mine)", () => {
  it("shows the 'Start New Session' button in the empty state", async () => {
    mockListSessions.mockResolvedValue({ sessions: [] });
    renderWithLocale(<Mine />);
    expect(await screen.findByText("No sessions yet")).toBeTruthy();
    // The record header band is present even when empty (the first viewport
    // reads as a study record); the ONLY 'Start New Session' button is the
    // one the empty sheet renders at the bottom.
    expect(screen.getByText("My Sessions")).toBeTruthy();
    const ctas = screen.getAllByRole("button", { name: /Start New Session/ });
    expect(ctas).toHaveLength(1);
  });

  it("fetches the History on mount and shows the 'My Sessions' header with session cards", async () => {
    mockListSessions.mockResolvedValue({ sessions: [session()] });
    renderWithLocale(<Mine />);
    expect(await screen.findByText("My Sessions")).toBeTruthy();
    expect(screen.getByText("React Hooks Deep Dive")).toBeTruthy();
    expect(screen.queryByText("No sessions yet")).toBeNull();
    // History lists only sessions at/after the generating step (#131) —
    // the mount fetch filters to the confirming phases.
    expect(mockListSessions).toHaveBeenCalledWith(
      ["generating", "executing", "complete"],
    );
  });

  it("shows the loading state while the initial fetch is in flight", async () => {
    let resolveFetch: (value: { sessions: [] }) => void;
    mockListSessions.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );
    renderWithLocale(<Mine />);
    expect(await screen.findByText("Loading your sessions…")).toBeTruthy();
    // The empty state must not double as the loading state (#132).
    expect(screen.queryByText("No sessions yet")).toBeNull();
    resolveFetch!({ sessions: [] });
    expect(await screen.findByText("No sessions yet")).toBeTruthy();
  });

  it("shows the error state with a Retry when the initial fetch fails", async () => {
    mockListSessions.mockRejectedValue(new Error("boom"));
    renderWithLocale(<Mine />);
    expect(await screen.findByText("Can't load your sessions")).toBeTruthy();
    // A failed fetch is not an empty History — the empty state stays hidden
    // (#132).
    expect(screen.queryByText("No sessions yet")).toBeNull();
    // Retry re-runs the fetch and lands on the list.
    mockListSessions.mockResolvedValue({ sessions: [] });
    fireEvent.click(screen.getByRole("button", { name: /Retry/ }));
    expect(await screen.findByText("No sessions yet")).toBeTruthy();
    expect(mockListSessions).toHaveBeenCalledTimes(2);
  });

  it("does not update state when unmounted before the initial fetch settles", async () => {
    let resolveFetch: (value: { sessions: [] }) => void;
    mockListSessions.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );
    const { unmount } = renderWithLocale(<Mine />);
    unmount();

    // The in-flight fetch resolves after unmount; the cancelled guard skips
    // the state update. Let the resolution run.
    resolveFetch!({ sessions: [] });
    await Promise.resolve();
    expect(screen.queryByText("No sessions yet")).toBeNull();
  });

  it("keeps the page rendered on a 401 — the sign-in modal asks, not a redirect", async () => {
    // #147: a 401 no longer suppresses the page or navigates. The API client
    // has already asked for the sign-in modal to open over it; the page
    // settles into its ordinary error state behind the modal (not the empty
    // state — the History is unknown, not empty).
    mockListSessions.mockRejectedValue(new ApiError("unauthorized", 401));
    renderWithLocale(<Mine />);
    await waitFor(() => expect(mockListSessions).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByText("No sessions yet")).toBeNull();
    expect(screen.getByText("Can't load your sessions")).toBeTruthy();
  });

  it("keeps the error state (no suppression) when the Retry hits a 401", async () => {
    // First fetch fails (error state); the Retry hits a 401 — the page stays
    // put with the modal asking for sign-in, not a redirect (#147).
    mockListSessions
      .mockRejectedValueOnce(new Error("boom"))
      .mockRejectedValueOnce(new ApiError("unauthorized", 401));
    renderWithLocale(<Mine />);
    await act(async () => {});
    expect(screen.getByText("Can't load your sessions")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Retry/ }));
    await act(async () => {});
    expect(screen.getByText("Can't load your sessions")).toBeTruthy();
    expect(screen.queryByText("No sessions yet")).toBeNull();
  });

  it("refetches the History after a successful sign-in through the modal", async () => {
    // A token that expired mid-use: the fetch 401s (the modal opened over
    // the page), the person signs back in, and the surface refetches in
    // place (#147).
    mockListSessions
      .mockRejectedValueOnce(new ApiError("unauthorized", 401))
      .mockResolvedValue({ sessions: [session()] });
    renderWithLocale(<Mine />);
    await screen.findByText("Can't load your sessions");
    act(() => {
      notifySignedIn();
    });
    expect(await screen.findByText("React Hooks Deep Dive")).toBeTruthy();
    expect(mockListSessions).toHaveBeenCalledTimes(2);
  });

  it("re-renders as a Visitor after sign-out — the History refetches and settles on the error state", async () => {
    // #147: sign-out does not navigate. The surface refetches in place; the
    // now-anonymous fetch answers 401 (the real client would also have
    // asked for the sign-in modal — this seam's mock only throws), and the
    // page settles into its error state rather than keeping the stale list.
    mockListSessions
      .mockResolvedValueOnce({ sessions: [session()] })
      .mockRejectedValueOnce(new ApiError("unauthorized", 401));
    renderWithLocale(<Mine />);
    await screen.findByText("React Hooks Deep Dive");
    act(() => {
      notifySignedOut();
    });
    expect(await screen.findByText("Can't load your sessions")).toBeTruthy();
    expect(mockListSessions).toHaveBeenCalledTimes(2);
  });

  it("opens the new-session dialog from the 'Start New Session' CTA", async () => {
    mockListSessions.mockResolvedValue({ sessions: [session()] });
    renderWithLocale(<Mine />);
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
    renderWithLocale(<Mine />);
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

    renderWithLocale(<Mine />);
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

    // The final stage: the "on the way" title moves into the header and the
    // card replaces the transcript and intake controls — the rail is kept.
    await screen.findByRole("button", { name: /Back to my sessions/ });
    expect(
      screen.getByRole("heading", { name: "Your lesson is on the way" }),
    ).toBeTruthy();
    expect(screen.queryByText("Recent Messages")).toBeNull();
    expect(screen.getByText("Generating")).toBeTruthy(); // the kept rail
    expect(screen.queryByLabelText("How should we adjust the plan?")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Back to my sessions/ }));

    // The accepted session appears at the top — only possible through the
    // re-fetch, since it was not in the mount fetch's list.
    expect(await screen.findByText("Newton's second law of motion")).toBeTruthy();
    expect(mockListSessions).toHaveBeenCalledTimes(2); // mount fetch + re-fetch
  });
});
