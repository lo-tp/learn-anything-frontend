// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  screen,
} from "@testing-library/react";
import { renderWithLocale } from "@/test/test-utils";
import { Explore } from "@/views/explore";
import {
  approvePlan,
  createSession,
  getSignedInUser,
  generatePlan,
  listExploreSessions,
  type SessionListItem,
} from "@/lib/api-client";
import { notifySignedIn, onRequestSignIn } from "@/lib/auth-events";

// The Explore surface reads the public feed through the typed backend
// client, and the start-a-Session invitation opens the personal list's
// intake dialog, which starts sessions through the same module — stub the
// whole thing (openapi-fetch binds `fetch` at client-creation time, so
// stubbing the global fetch after import never intercepts it).
vi.mock("@/lib/api-client", () => ({
  createSession: vi.fn(),
  clarifySession: vi.fn(),
  startProbe: vi.fn(),
  answerProbe: vi.fn(),
  generatePlan: vi.fn(),
  adjustPlan: vi.fn(),
  approvePlan: vi.fn(),
  listExploreSessions: vi.fn(),
  getSignedInUser: vi.fn(),
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
const mockListExploreSessions = vi.mocked(listExploreSessions);
const mockGetSignedInUser = vi.mocked(getSignedInUser);

const USER = { id: 1, email: "a@b.c", display_name: "Alice" };

/** Who the page's identity probe answers with: a User, or nobody (#143). */
function asUser() {
  mockGetSignedInUser.mockResolvedValue(USER);
}
function asVisitor() {
  mockGetSignedInUser.mockResolvedValue(null);
}

/** Let an in-flight probe settle before acting on the page. */
async function flush() {
  await act(async () => {});
}

beforeEach(() => {
  mockCreateSession.mockReset();
  mockGeneratePlan.mockReset();
  mockApprovePlan.mockReset();
  mockListExploreSessions.mockReset();
  // The default viewer of a public surface is a Visitor.
  mockGetSignedInUser.mockReset().mockResolvedValue(null);
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

describe("Explore (the public feed at the site root)", () => {
  it("renders the public list for a Visitor — the goal text first, no names", async () => {
    mockListExploreSessions.mockResolvedValue({
      sessions: [
        session(),
        session({ session_id: "s-2", goal: "Morse code" }),
      ],
    });
    renderWithLocale(<Explore />);
    expect(await screen.findByText("Explore")).toBeTruthy();
    expect(screen.getByText("React Hooks Deep Dive")).toBeTruthy();
    expect(screen.getByText("Morse code")).toBeTruthy();
    // The feed is read with no arguments: the backend serves it newest
    // first, capped at 20 (#144).
    expect(mockListExploreSessions).toHaveBeenCalledTimes(1);
    expect(mockListExploreSessions).toHaveBeenCalledWith();
  });

  it("a card links to the Session deck", async () => {
    mockListExploreSessions.mockResolvedValue({ sessions: [session()] });
    renderWithLocale(<Explore />);
    const card = await screen.findByRole("link", {
      name: /React Hooks Deep Dive/,
    });
    expect(card.getAttribute("href")).toBe("/en/session/s-1");
  });

  it("an empty list shows the pitch and the start-a-Session invitation, not a bare empty state", async () => {
    mockListExploreSessions.mockResolvedValue({ sessions: [] });
    renderWithLocale(<Explore />);
    expect(
      await screen.findByText("Learn anything, one question at a time"),
    ).toBeTruthy();
    expect(screen.getByText(/Declare a knowledge point/)).toBeTruthy();
    // The invitation is the same Start New Session CTA the personal list
    // wears — one primary button on the page either way.
    expect(screen.getAllByRole("button", { name: /Start New Session/ })).toHaveLength(1);
  });

  it("a filled feed carries the same Start New Session CTA in its header band", async () => {
    // Starting a Session is offered to whoever is reading the list, not only
    // to the person whose list is empty (#143).
    mockListExploreSessions.mockResolvedValue({ sessions: [session()] });
    renderWithLocale(<Explore />);
    await screen.findByText("React Hooks Deep Dive");
    expect(screen.getByRole("button", { name: /Start New Session/ })).toBeTruthy();
  });

  it("a Visitor's CTA opens the sign-in ask over the feed, not the intake (#143)", async () => {
    asVisitor();
    const asked = vi.fn();
    const unsubscribe = onRequestSignIn(asked);
    mockListExploreSessions.mockResolvedValue({ sessions: [session()] });
    renderWithLocale(<Explore />);
    await screen.findByText("React Hooks Deep Dive");
    await flush();

    fireEvent.click(screen.getByRole("button", { name: /Start New Session/ }));

    expect(asked).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("What would you like to explore or learn?")).toBeNull();
    unsubscribe();
  });

  it("opens the intake for a signed-in User, and resumes it after the sign-in a Visitor asked for", async () => {
    // The CTA's intent survives the sign-in: the person who clicked Start
    // New Session lands in the intake, not back on the feed (#143/#147).
    asVisitor();
    mockListExploreSessions.mockResolvedValue({ sessions: [session()] });
    renderWithLocale(<Explore />);
    await screen.findByText("React Hooks Deep Dive");
    await flush();

    fireEvent.click(screen.getByRole("button", { name: /Start New Session/ }));
    asUser();
    act(() => {
      notifySignedIn();
    });
    await flush();

    expect(
      await screen.findByLabelText("What would you like to explore or learn?"),
    ).toBeTruthy();
  });

  it("does not open the intake for a sign-in the CTA did not ask for", async () => {
    // The held intent belongs to the click that asked for sign-in. A
    // sign-in from anywhere else — the top bar, a 401 from another surface
    // — changes nothing on this one (#147).
    asVisitor();
    mockListExploreSessions.mockResolvedValue({ sessions: [session()] });
    renderWithLocale(<Explore />);
    await screen.findByText("React Hooks Deep Dive");
    await flush();

    asUser();
    act(() => {
      notifySignedIn();
    });
    await flush();

    expect(
      screen.queryByLabelText("What would you like to explore or learn?"),
    ).toBeNull();
  });

  it("a signed-in User's CTA opens the intake directly", async () => {
    asUser();
    mockListExploreSessions.mockResolvedValue({ sessions: [session()] });
    renderWithLocale(<Explore />);
    await screen.findByText("React Hooks Deep Dive");
    await flush();

    const asked = vi.fn();
    const unsubscribe = onRequestSignIn(asked);
    fireEvent.click(screen.getByRole("button", { name: /Start New Session/ }));

    expect(
      await screen.findByLabelText("What would you like to explore or learn?"),
    ).toBeTruthy();
    expect(asked).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("shows the loading state while the initial fetch is in flight", async () => {
    let resolveFeed: (value: { sessions: [] }) => void;
    mockListExploreSessions.mockReturnValue(
      new Promise((resolve) => {
        resolveFeed = resolve;
      }),
    );
    renderWithLocale(<Explore />);
    expect(await screen.findByText("Loading the feed…")).toBeTruthy();
    // The empty pitch must not double as the loading state (#132).
    expect(
      screen.queryByText("Learn anything, one question at a time"),
    ).toBeNull();
    resolveFeed!({ sessions: [] });
    expect(
      await screen.findByText("Learn anything, one question at a time"),
    ).toBeTruthy();
  });

  it("shows the error state with a Retry when the initial fetch fails", async () => {
    mockListExploreSessions.mockRejectedValue(new Error("boom"));
    renderWithLocale(<Explore />);
    expect(await screen.findByText("Can't load the feed")).toBeTruthy();
    // A failed fetch is not an empty feed — the pitch stays hidden (#132).
    expect(
      screen.queryByText("Learn anything, one question at a time"),
    ).toBeNull();
    // Retry re-runs the fetch and lands on the list.
    mockListExploreSessions.mockResolvedValue({ sessions: [session()] });
    fireEvent.click(screen.getByRole("button", { name: /Retry/ }));
    expect(await screen.findByText("React Hooks Deep Dive")).toBeTruthy();
    expect(mockListExploreSessions).toHaveBeenCalledTimes(2);
  });

  it("keeps the error state when the Retry fails again", async () => {
    mockListExploreSessions
      .mockRejectedValueOnce(new Error("boom"))
      .mockRejectedValueOnce(new Error("boom again"));
    renderWithLocale(<Explore />);
    await screen.findByText("Can't load the feed");
    fireEvent.click(screen.getByRole("button", { name: /Retry/ }));
    await screen.findByText("Can't load the feed");
    expect(mockListExploreSessions).toHaveBeenCalledTimes(2);
  });

  it("does not update state when unmounted before the initial fetch settles", async () => {
    let resolveFeed: (value: { sessions: [] }) => void;
    mockListExploreSessions.mockReturnValue(
      new Promise((resolve) => {
        resolveFeed = resolve;
      }),
    );
    const { unmount } = renderWithLocale(<Explore />);
    unmount();

    // The in-flight fetch resolves after unmount; the cancelled guard skips
    // the state update.
    resolveFeed!({ sessions: [] });
    await Promise.resolve();
    expect(
      screen.queryByText("Learn anything, one question at a time"),
    ).toBeNull();
  });

  it("silently refetches the feed when the dialog accepts a new session", async () => {
    // An intake accepted from the empty-state invitation: the new session
    // joins the public feed once it starts generating (#144), so the view
    // silently refetches — keeping the current list on failure (#132).
    asUser();
    const fresh: SessionListItem = {
      session_id: "s-newton",
      // Just approved → the backend transitions it to `generating`.
      phase: "generating",
      goal: "Newton's second law of motion",
      narrowed_goal: "Newton's second law of motion",
      created_at: "2025-10-25T11:00:00.000Z",
    };
    // The dialog creates the session through the typed backend client. A
    // non-probing advanced phase skips the probe loop and auto-generates
    // the plan (the review step replaces the old confirm step).
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
    // The mount fetch shows an empty feed; the re-fetch after accept shows
    // the new session on top.
    mockListExploreSessions
      .mockResolvedValueOnce({ sessions: [] })
      .mockResolvedValueOnce({ sessions: [fresh] });

    renderWithLocale(<Explore />);
    await screen.findByText("Learn anything, one question at a time");
    await flush();
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

    // The plan auto-generates: the typed approval command ("approve" +
    // Enter) lands the dialog in the "on the way" state; closing back to
    // the sessions handoff triggers the re-fetch.
    const review = await screen.findByLabelText(
      "How should we adjust the plan?",
    );
    fireEvent.change(review, { target: { value: "approve" } });
    fireEvent.keyDown(review, { key: "Enter" });

    await screen.findByRole("button", { name: /Back to my sessions/ });
    fireEvent.click(screen.getByRole("button", { name: /Back to my sessions/ }));

    // The accepted session appears in the feed — only possible through the
    // re-fetch, since it was not in the mount fetch's list.
    expect(
      await screen.findByText("Newton's second law of motion"),
    ).toBeTruthy();
    expect(mockListExploreSessions).toHaveBeenCalledTimes(2); // mount + re-fetch
  });

  it("labels the public surface from the zh catalog under the zh locale", async () => {
    mockListExploreSessions.mockResolvedValue({ sessions: [] });
    renderWithLocale(<Explore />, { locale: "zh" });
    expect(await screen.findByText("探索")).toBeTruthy();
    expect(screen.getByText("任何知识，一次一个问题")).toBeTruthy();
  });
});
