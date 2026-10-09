// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { renderWithLocale } from "@/test/test-utils";
import { Session } from "@/views/session";
import {
  getMaterials,
  getSession,
  getSignedInUser,
  postReviewCard,
  type MaterialsOut,
  type ReviewCardOut,
  type SessionState,
} from "@/lib/api-client";
import { notifySignedIn, notifySignedOut } from "@/lib/auth-events";

vi.mock("@/lib/api-client", () => ({
  getSession: vi.fn(),
  getMaterials: vi.fn(),
  getSignedInUser: vi.fn(),
  postReviewCard: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

// The deck's audience is the page's sign-in state (#143/#151), which one
// `GET /auth/me` probe settles. These tests answer that probe: a profile for
// a User, `null` for a Visitor (the 401 answer), a never-settling promise for
// a viewer not yet known.
const USER = { id: 1, email: "a@b.c", display_name: "Alice" };

const mockGetSession = vi.mocked(getSession);
const mockGetMaterials = vi.mocked(getMaterials);
const mockGetSignedInUser = vi.mocked(getSignedInUser);
const mockPostReviewCard = vi.mocked(postReviewCard);

beforeEach(() => {
  mockGetSession
    .mockReset()
    .mockResolvedValue(session());
  mockGetMaterials
    .mockReset()
    .mockResolvedValue(materials());
  // The default viewer is a signed-in User (#151): a miss becomes a review
  // card. The visitor tests answer the probe with `null` instead.
  mockGetSignedInUser
    .mockReset()
    .mockResolvedValue(USER);
  mockPostReviewCard
    .mockReset()
    .mockResolvedValue({
      id: 1,
      source: "material",
      question: { text: "", options: [], correct_index: 0, explanation: "" },
      session_id: "s-1",
      step_id: null,
      due_at: "",
    } satisfies ReviewCardOut);
});

afterEach(() => {
  cleanup();
});

function session(overrides: Partial<SessionState> = {}): SessionState {
  return {
    session_id: "s-1",
    phase: "executing",
    narrowed_goal: "Newton's second law",
    progress: {
      current_step_id: null,
      completed_steps: [],
      total_steps: 2,
      step_scores: {},
    },
    ...overrides,
  };
}

function materials(overrides: Partial<MaterialsOut> = {}): MaterialsOut {
  return {
    phase: "executing",
    generated_steps: [
      {
        step_id: "st-1",
        summary: {
          step_id: "st-1",
          title: "Force and mass",
          key_points: ["F = ma"],
        },
        items: [
          { type: "slide", slide_id: "slide-1" },
          {
            type: "question",
            id: "q-1",
            text: "What does F stand for?",
            options: ["Force", "Friction"],
            correct_index: 0,
            explanation: "F is the net force.",
          },
        ],
      },
      {
        step_id: "st-2",
        summary: { step_id: "st-2", title: "Putting it together", key_points: [] },
        items: [
          {
            type: "question",
            id: "q-2",
            text: "What does a stand for?",
            options: ["Acceleration", "Area"],
            correct_index: 0,
            explanation: "a is the acceleration.",
          },
        ],
      },
    ],
    ...overrides,
  };
}

function renderSession(props: Partial<React.ComponentProps<typeof Session>> = {}) {
  return renderWithLocale(<Session sessionId="s-1" {...props} />);
}

/**
 * Settle the view's mount fetches (both resolve in microtasks) and the
 * sign-in probe, then assert the first step's divider rendered — from here
 * the deck state and the viewer's audience are both current.
 */
async function settle() {
  await screen.findByText("Force and mass");
  await act(async () => {});
}

/** Answer the probe as a Visitor: the 401 answer, no profile (#151). */
function asVisitor() {
  mockGetSignedInUser.mockResolvedValue(null);
}

/** The ControlBar counter, labelled `Slide {index} of {total}`. */
function counterAt(index: number, total: number) {
  return screen.getByLabelText(new RegExp(`^slide ${index} of ${total}$`, "i"));
}

describe("Session", () => {
  it("fetches the session and its materials on mount, and groups the flattened items under step-summary dividers", async () => {
    renderSession();
    await settle();
    expect(mockGetSession).toHaveBeenCalledWith("s-1");
    expect(mockGetMaterials).toHaveBeenCalledWith("s-1");
    // Step dividers (number + title).
    expect(screen.getByText("Force and mass")).toBeTruthy();
    expect(screen.getByText("Putting it together")).toBeTruthy();
    // One card per item: slide, question, question.
    expect(
      screen.getByRole("button", { name: /^slide 1$/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /what does f stand for\?/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /what does a stand for\?/i }),
    ).toBeTruthy();
  });

  it("starts on the first item (a slide) and loads it from the sandbox", async () => {
    renderSession();
    await settle();
    const frame = screen.getByTitle("Sandbox");
    expect(frame.getAttribute("src")).toContain("/slides/slide-1");
  });

  it("activates the clicked item in the main area", async () => {
    renderSession();
    await settle();
    fireEvent.click(
      screen.getByRole("button", { name: /what does f stand for\?/i }),
    );
    // The quiz now owns the main area: its options are visible.
    expect(
      screen.getByRole("button", { name: /^a\s*force$/i }),
    ).toBeTruthy();
    // The slide player stays mounted but is hidden — its `src` never changes,
    // slide switches arrive via postMessage (#80), so the frame is never torn
    // down (which would re-navigate and add history entries).
    expect(
      screen.getByTitle("Sandbox").parentElement?.getAttribute("class"),
    ).toContain("hidden");
  });

  it("walks items with prev/next across group boundaries", async () => {
    renderSession();
    await settle();

    expect(
      (screen.getByRole("button", { name: "Previous slide" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(counterAt(1, 3)).toBeTruthy();

    // 1 → 2 (step 1's question)
    fireEvent.click(screen.getByRole("button", { name: "Next slide" }));
    expect(counterAt(2, 3)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /^a\s*force$/i }),
    ).toBeTruthy();

    // 2 → 3 (step 2's question, across the group boundary)
    fireEvent.click(screen.getByRole("button", { name: "Next slide" }));
    expect(counterAt(3, 3)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /^a\s*acceleration$/i }),
    ).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Next slide" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    // Back to the start.
    fireEvent.click(screen.getByRole("button", { name: "Previous slide" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous slide" }));
    expect(counterAt(1, 3)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Previous slide" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("reveals feedback and locks the question on answer", async () => {
    renderSession();
    await settle();
    fireEvent.click(
      screen.getByRole("button", { name: /what does f stand for\?/i }),
    );

    // Answer wrong.
    fireEvent.click(screen.getByRole("button", { name: /^b\s*friction$/i }));
    expect(screen.getByText("Not quite.")).toBeTruthy();
    expect(screen.getByText("F is the net force.")).toBeTruthy();
    // Every option is locked after answering.
    expect(
      (screen.getByRole("button", { name: /^a\s*force$/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    // Navigating away and back keeps the answer.
    fireEvent.click(screen.getByRole("button", { name: "Next slide" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous slide" }));
    expect(screen.getByText("Not quite.")).toBeTruthy();
  });

  it("shows Correct. when the right option is chosen", async () => {
    renderSession();
    await settle();
    fireEvent.click(
      screen.getByRole("button", { name: /what does f stand for\?/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^a\s*force$/i }));
    expect(screen.getByText("Correct.")).toBeTruthy();
  });

  it("fires postReviewCard with source 'material' on a wrong pick", async () => {
    renderSession();
    await settle();
    fireEvent.click(
      screen.getByRole("button", { name: /what does f stand for\?/i }),
    );
    // q-1 correct_index is 0; picking index 1 ("Friction") is wrong.
    fireEvent.click(screen.getByRole("button", { name: /^b\s*friction$/i }));
    // Fire-and-forget: assert the call was made (not awaited by the UI).
    expect(mockPostReviewCard).toHaveBeenCalledWith({
      source: "material",
      session_id: "s-1",
      question_id: "q-1",
      question: {
        text: "What does F stand for?",
        options: ["Force", "Friction"],
        correct_index: 0,
        explanation: "F is the net force.",
      },
      step_id: "st-1",
      selected_index: 1,
    });
  });

  it("does NOT fire postReviewCard on a correct pick", async () => {
    renderSession();
    await settle();
    fireEvent.click(
      screen.getByRole("button", { name: /what does f stand for\?/i }),
    );
    // q-1 correct_index is 0; picking index 0 ("Force") is correct.
    fireEvent.click(screen.getByRole("button", { name: /^a\s*force$/i }));
    expect(mockPostReviewCard).not.toHaveBeenCalled();
  });

  it("swallows postReviewCard errors (fire-and-forget never blocks)", async () => {
    mockPostReviewCard.mockRejectedValue(new Error("network down"));
    renderSession();
    await settle();
    fireEvent.click(
      screen.getByRole("button", { name: /what does f stand for\?/i }),
    );
    // q-1 correct_index is 0; picking index 1 is wrong → fires and rejects.
    fireEvent.click(screen.getByRole("button", { name: /^b\s*friction$/i }));
    // The rejection must not crash the UI.
    expect(screen.getByText("Not quite.")).toBeTruthy();
    expect(mockPostReviewCard).toHaveBeenCalledTimes(1);
  });

  it("serves a Visitor the same deck — reading and answering work, no write is attempted", async () => {
    // An unsigned visitor: the sign-in state holds no User, but the reads
    // are public, so the deck renders exactly as a User's (#151).
    asVisitor();
    renderSession();
    await settle();
    expect(screen.getByText("Force and mass")).toBeTruthy();
    // The deck can be moved through…
    fireEvent.click(screen.getByRole("button", { name: "Next slide" }));
    expect(counterAt(2, 3)).toBeTruthy();
    // …and a wrong pick reveals the result locally — with no review card.
    fireEvent.click(screen.getByRole("button", { name: /^b\s*friction$/i }));
    expect(screen.getByText("Not quite.")).toBeTruthy();
    expect(screen.getByText("F is the net force.")).toBeTruthy();
    expect(mockPostReviewCard).not.toHaveBeenCalled();
  });

  it("is a Visitor's deck while the viewer is not yet known", async () => {
    // Before the probe answers — and if it never can — the state holds no
    // User, so the deck still renders, and a miss never attempts a write
    // (#151).
    let answerProbe: ((user: typeof USER | null) => void) | undefined;
    mockGetSignedInUser.mockImplementation(
      () => new Promise((resolve) => { answerProbe = resolve; }),
    );
    renderSession();
    await settle();
    expect(screen.getByText("Force and mass")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: /what does f stand for\?/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^b\s*friction$/i }));
    expect(screen.getByText("Not quite.")).toBeTruthy();
    expect(mockPostReviewCard).not.toHaveBeenCalled();
    // Let the held probe answer, so it does not sit in flight for the tests
    // that follow.
    answerProbe?.(null);
    await act(async () => {});
  });

  it("flips to a User on sign-in — a miss then writes its review card", async () => {
    // A Visitor browsing the deck signs in in place (#147): the audience
    // flips without navigation, and the next miss persists (#151).
    asVisitor();
    renderSession();
    await settle();
    // The sign-in is announced, and the probe it triggers now answers with a
    // profile: the deck becomes a User's, without navigation (#143/#147).
    mockGetSignedInUser.mockResolvedValue(USER);
    act(() => {
      notifySignedIn();
    });
    await act(async () => {});
    fireEvent.click(
      screen.getByRole("button", { name: /what does f stand for\?/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^b\s*friction$/i }));
    expect(screen.getByText("Not quite.")).toBeTruthy();
    expect(mockPostReviewCard).toHaveBeenCalledTimes(1);
    expect(mockPostReviewCard).toHaveBeenCalledWith(
      expect.objectContaining({ question_id: "q-1", selected_index: 1 }),
    );
  });

  it("flips to a Visitor on sign-out — a miss no longer writes", async () => {
    // A signed-in User signs out in place (#147): the sign-out announcement
    // settles the state back to a Visitor's — no probe needed, we already
    // know — and the next miss stays local (#151).
    renderSession();
    await settle();
    act(() => {
      notifySignedOut();
    });
    fireEvent.click(
      screen.getByRole("button", { name: /what does f stand for\?/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^b\s*friction$/i }));
    expect(screen.getByText("Not quite.")).toBeTruthy();
    expect(mockPostReviewCard).not.toHaveBeenCalled();
  });

  it("renders the not-found state when the session does not exist", async () => {
    mockGetSession.mockRejectedValue(new Error("nope"));
    renderSession();
    expect(await screen.findByText("Session not found")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /back to my sessions/i }).getAttribute("href"),
    ).toBe("/en/mine");
  });

  it("renders the error state when the session errored", async () => {
    mockGetSession.mockResolvedValue(session({ phase: "error" }));
    mockGetMaterials.mockRejectedValue(new Error("nope"));
    renderSession();
    expect(await screen.findByText("Something went wrong")).toBeTruthy();
  });

  it("renders the not-ready state for pre-material phases", async () => {
    mockGetSession.mockResolvedValue(session({ phase: "planning" }));
    mockGetMaterials.mockRejectedValue(new Error("nope"));
    renderSession();
    expect(await screen.findByText("Materials aren't ready yet")).toBeTruthy();
    expect(screen.getByText("Newton's second law")).toBeTruthy();
    // The mount fetch happened once — no polling for pre-material phases.
    expect(mockGetMaterials).toHaveBeenCalledTimes(1);
  });

  it("omits the goal subtitle when the session has no narrowed goal", async () => {
    mockGetSession.mockResolvedValue(
      session({ phase: "planning", narrowed_goal: null }),
    );
    mockGetMaterials.mockRejectedValue(new Error("nope"));
    renderSession();
    expect(await screen.findByText("Materials aren't ready yet")).toBeTruthy();
    // The subtitle is omitted for a goal-less session (the `?? undefined`).
    expect(screen.queryByText("Newton's second law")).toBeNull();
  });

  it("labels a goal-less deck with the generic learning-session header", async () => {
    mockGetSession.mockResolvedValue(session({ narrowed_goal: null }));
    renderSession();
    await settle();
    // The deck's header falls back to the generic label, not the goal.
    expect(screen.getByText("Learning session")).toBeTruthy();
    expect(screen.queryByText("Newton's second law")).toBeNull();
  });

  it("renders the not-ready state when the materials fetch fails for a post-material phase", async () => {
    // Not the generating spinner: with a non-`generating` phase, a failed
    // materials fetch degrades to "not ready" (no polling to retry it).
    mockGetSession.mockResolvedValue(session({ phase: "executing" }));
    mockGetMaterials.mockRejectedValue(new Error("nope"));
    renderSession();
    expect(await screen.findByText("Materials aren't ready yet")).toBeTruthy();
  });

  it("polls every 3s while generating, then renders the deck", async () => {
    vi.useFakeTimers();
    try {
      mockGetSession.mockResolvedValue(session({ phase: "generating" }));
      mockGetMaterials
        .mockResolvedValueOnce(
          materials({ phase: "generating", generated_steps: [] }),
        )
        .mockResolvedValue(materials());
      renderWithLocale(<Session sessionId="s-1" />);
      // Let the mount fetches settle (microtasks, not timers).
      await act(async () => {});
      expect(screen.getByText("Generating materials…")).toBeTruthy();

      // First tick: the poll lands with finished materials, the deck renders,
      // polling stops.
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      await act(async () => {});
      // mount fetch (1) + first poll (2)
      expect(mockGetMaterials).toHaveBeenCalledTimes(2);
      expect(mockGetMaterials).toHaveBeenCalledWith("s-1");
      expect(screen.getByText("Force and mass")).toBeTruthy();

      // Further ticks stay quiet — the phase left `generating`.
      act(() => {
        vi.advanceTimersByTime(9000);
      });
      await act(async () => {});
      expect(mockGetMaterials).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps waiting (with a note) when a poll fails", async () => {
    vi.useFakeTimers();
    try {
      mockGetSession.mockResolvedValue(session({ phase: "generating" }));
      mockGetMaterials.mockRejectedValue(new Error("boom"));
      renderWithLocale(<Session sessionId="s-1" />);
      await act(async () => {});
      // The mount fetch failed, so the view is still "generating" — the first
      // tick polls again.
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      await act(async () => {});
      expect(
        screen.getByText("We can't reach the backend right now — we'll keep trying."),
      ).toBeTruthy();
      // Still generating — the next tick polls again.
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      await act(async () => {});
      expect(mockGetMaterials).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows the nudge on the first miss only, and holds all misses locally", async () => {
    asVisitor();
    renderSession();
    await settle();

    // First miss: the nudge appears
    fireEvent.click(
      screen.getByRole("button", { name: /what does f stand for\?/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^b\s*friction$/i }));
    expect(screen.getByText("Save your progress")).toBeTruthy();
    expect(mockPostReviewCard).not.toHaveBeenCalled();

    // Second miss: the nudge stays (not re-triggered), no write
    fireEvent.click(screen.getByRole("button", { name: "Next slide" }));
    fireEvent.click(
      screen.getByRole("button", { name: /what does a stand for\?/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^b\s*area$/i }));
    expect(screen.getByText("Save your progress")).toBeTruthy();
    expect(mockPostReviewCard).not.toHaveBeenCalled();
  });

  it("replays the held misses into the Review deck on sign-in", async () => {
    asVisitor();
    renderSession();
    await settle();

    // Hold two misses
    fireEvent.click(
      screen.getByRole("button", { name: /what does f stand for\?/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^b\s*friction$/i }));
    fireEvent.click(screen.getByRole("button", { name: "Next slide" }));
    fireEvent.click(
      screen.getByRole("button", { name: /what does a stand for\?/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^b\s*area$/i }));
    expect(screen.getByText("Save your progress")).toBeTruthy();

    // Sign in: the replay fires
    act(() => {
      notifySignedIn();
    });
    await act(async () => {}); // let the Promise.allSettled.then run

    // Both misses were replayed
    expect(mockPostReviewCard).toHaveBeenCalledTimes(2);
    expect(mockPostReviewCard).toHaveBeenCalledWith(
      expect.objectContaining({ question_id: "q-1", selected_index: 1 }),
    );
    expect(mockPostReviewCard).toHaveBeenCalledWith(
      expect.objectContaining({ question_id: "q-2", selected_index: 1 }),
    );
    // The nudge is gone (replay succeeded)
    expect(screen.queryByText("Save your progress")).toBeNull();
  });

  it("keeps held misses retryable when the replay fails", async () => {
    asVisitor();
    renderSession();
    await settle();

    // Hold a miss
    fireEvent.click(
      screen.getByRole("button", { name: /what does f stand for\?/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^b\s*friction$/i }));
    expect(screen.getByText("Save your progress")).toBeTruthy();

    // Sign in with the replay failing
    mockPostReviewCard.mockRejectedValue(new Error("network down"));
    act(() => {
      notifySignedIn();
    });
    await act(async () => {}); // let the Promise.allSettled.then run

    // The nudge shows the error, and the miss is still held
    expect(
      screen.getByText(
        "We couldn't save your progress. Your missed questions are still here — sign in again to try.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Save your progress")).toBeTruthy();
  });
});
