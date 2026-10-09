// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithLocale } from "@/test/test-utils";
import { Review } from "@/views/review";
import {
  answerReviewCard,
  getReviewDue,
  type ReviewAnswerOut,
  type ReviewCardOut,
} from "@/lib/api-client";
import { notifySignedIn, notifySignedOut } from "@/lib/auth-events";

// Deterministic display order: the reverse permutation, so display position
// `i` maps to canonical index `n-1-i`. Lets the tests assert the exact
// display→canonical mapping without driving the RNG. `cn` is left real —
// the card panel relies on it.
vi.mock("@/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils")>();
  return {
    ...actual,
    displayOrder: (n: number) => Array.from({ length: n }, (_, i) => n - 1 - i),
  };
});

vi.mock("@/lib/api-client", () => ({
  getReviewDue: vi.fn(),
  answerReviewCard: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

const mockGetReviewDue = vi.mocked(getReviewDue);
const mockAnswerReviewCard = vi.mocked(answerReviewCard);

function card(overrides: Partial<ReviewCardOut> = {}): ReviewCardOut {
  return {
    id: 1,
    source: "material",
    session_id: "s-1",
    step_id: null,
    question: {
      text: "What does F stand for?",
      options: ["Force", "Friction"],
      correct_index: 0,
      explanation: "F is the net force.",
    },
    due_at: "",
    ...overrides,
  };
}

beforeEach(() => {
  mockGetReviewDue
    .mockReset()
    .mockResolvedValue([
      card({ id: 1 }),
      card({
        id: 2,
        question: {
          text: "What does a stand for?",
          options: ["Acceleration", "Area"],
          correct_index: 0,
          explanation: "a is the acceleration.",
        },
      }),
    ]);
  mockAnswerReviewCard
    .mockReset()
    .mockResolvedValue({
      due_at: "",
      interval_days: 2,
      lapses: 0,
    } satisfies ReviewAnswerOut);
});

afterEach(() => {
  cleanup();
});

/** The progress pill, labelled `{index} / {total}`. */
function progressAt(index: number, total: number) {
  return screen.getByLabelText(new RegExp(`^${index} / ${total}$`, "i"));
}

/** The option whose letter badge reads `letter` followed by `word`. */
function option(letter: string, word: string) {
  return screen.getByRole("button", {
    name: new RegExp(`^${letter}\\s*${word}$`, "i"),
  });
}

/** The confidence control whose accessible name matches `name`. */
function confidence(name: RegExp) {
  return screen.getByRole("button", { name });
}

describe("Review", () => {
  it("fetches due cards on mount and shows the first card without grading a pick", async () => {
    renderWithLocale(<Review />);
    expect(await screen.findByText("What does F stand for?")).toBeTruthy();
    expect(mockGetReviewDue).toHaveBeenCalled();
    // Two cards, first is active.
    expect(progressAt(1, 2)).toBeTruthy();
    // Display order is reversed for n=2: position A = "Friction", B = "Force".
    expect(option("a", "friction")).toBeTruthy();
    expect(option("b", "force")).toBeTruthy();
    // No Reveal yet — the explanation is hidden and nothing is recorded.
    expect(screen.queryByText("F is the net force.")).toBeNull();
    expect(mockAnswerReviewCard).not.toHaveBeenCalled();
  });

  it("shows the question and options without a pick: tapping an option does nothing", async () => {
    renderWithLocale(<Review />);
    await screen.findByText("What does F stand for?");
    fireEvent.click(option("b", "force"));
    // The options carry no pick — the card is untouched, nothing recorded.
    expect(screen.queryByText("F is the net force.")).toBeNull();
    expect(mockAnswerReviewCard).not.toHaveBeenCalled();
    // The Reveal control is the only way to uncover the answer.
    expect(confidence(/reveal/i)).toBeTruthy();
  });

  it("reveals the correct answer and explanation before any confidence is recorded", async () => {
    renderWithLocale(<Review />);
    await screen.findByText("What does F stand for?");
    fireEvent.click(confidence(/reveal/i));
    // The explanation is uncovered…
    expect(screen.getByText("F is the net force.")).toBeTruthy();
    // …and the four confidence controls appear — nothing recorded yet.
    expect(confidence(/^again$/i)).toBeTruthy();
    expect(confidence(/^hard$/i)).toBeTruthy();
    expect(confidence(/^good$/i)).toBeTruthy();
    expect(confidence(/^easy$/i)).toBeTruthy();
    expect(mockAnswerReviewCard).not.toHaveBeenCalled();
  });

  it("records the tapped confidence and advances to the next due card", async () => {
    renderWithLocale(<Review />);
    await screen.findByText("What does F stand for?");
    fireEvent.click(confidence(/reveal/i));
    fireEvent.click(confidence(/^hard$/i));
    expect(mockAnswerReviewCard).toHaveBeenCalledWith(1, "hard");
    // Advanced to the second card, fresh unrevealed state (the recording is
    // awaited before advancing, #132 — so the advance is awaited too).
    expect(await screen.findByText("What does a stand for?")).toBeTruthy();
    expect(progressAt(2, 2)).toBeTruthy();
    expect(screen.queryByText("a is the acceleration.")).toBeNull();
    // Reveal control is back; no confidence controls.
    expect(confidence(/reveal/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^good$/i })).toBeNull();
  });

  it("disables the confidence controls while the recording is in flight", async () => {
    let resolveAnswer: (value: ReviewAnswerOut) => void;
    mockAnswerReviewCard.mockReturnValue(
      new Promise((resolve) => {
        resolveAnswer = resolve;
      }),
    );
    renderWithLocale(<Review />);
    await screen.findByText("What does F stand for?");
    fireEvent.click(confidence(/reveal/i));
    fireEvent.click(confidence(/^good$/i));
    // In flight — the controls are locked until the recording settles.
    expect((confidence(/^good$/i) as HTMLButtonElement).disabled).toBe(true);
    resolveAnswer!({ due_at: "", interval_days: 2, lapses: 0 });
    expect(await screen.findByText("What does a stand for?")).toBeTruthy();
  });

  it("keeps the card on screen with a notice when the recording fails", async () => {
    renderWithLocale(<Review />);
    await screen.findByText("What does F stand for?");
    fireEvent.click(confidence(/reveal/i));
    mockAnswerReviewCard.mockRejectedValueOnce(new Error("nope"));
    fireEvent.click(confidence(/^easy$/i));
    // The card stays (no advance) with the failure notice — a missed
    // schedule is never lost silently (#132).
    expect(
      await screen.findByText(
        "Couldn't record your answer — tap a confidence to try again.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("What does F stand for?")).toBeTruthy();
    expect(progressAt(1, 2)).toBeTruthy();
    // A second tap records and advances.
    mockAnswerReviewCard.mockResolvedValue({
      due_at: "",
      interval_days: 2,
      lapses: 0,
    });
    fireEvent.click(confidence(/^easy$/i));
    expect(await screen.findByText("What does a stand for?")).toBeTruthy();
    expect(mockAnswerReviewCard).toHaveBeenLastCalledWith(1, "easy");
  });

  it("finishes the deck on the last card's confidence", async () => {
    renderWithLocale(<Review />);
    await screen.findByText("What does F stand for?");
    fireEvent.click(confidence(/reveal/i));
    fireEvent.click(confidence(/^good$/i));
    await screen.findByText("What does a stand for?");
    // Last card: reveal, then a confidence — the deck completes.
    fireEvent.click(confidence(/reveal/i));
    fireEvent.click(confidence(/^easy$/i));
    expect(mockAnswerReviewCard).toHaveBeenLastCalledWith(2, "easy");
    // Deck complete → all-clear state (awaited — the recording is awaited
    // before advancing, #132).
    expect(await screen.findByText("All clear")).toBeTruthy();
  });

  it("shows the empty state with a home link when there are no due cards", async () => {
    mockGetReviewDue.mockResolvedValue([]);
    renderWithLocale(<Review />);
    expect(await screen.findByText("All clear")).toBeTruthy();
    expect(screen.getByText("No cards are due right now — keep studying!")).toBeTruthy();
    expect(screen.getByRole("link", { name: /back to my sessions/i })).toBeTruthy();
  });

  it("shows the error state with a Retry when the fetch fails", async () => {
    mockGetReviewDue.mockRejectedValue(new Error("nope"));
    renderWithLocale(<Review />);
    expect(await screen.findByText("Can't load your review deck")).toBeTruthy();
    expect(screen.getByText("We couldn't reach the backend.")).toBeTruthy();
    // Retry re-runs the fetch and lands on the deck (#132).
    mockGetReviewDue.mockResolvedValue([card()]);
    fireEvent.click(screen.getByRole("button", { name: /Retry/ }));
    expect(await screen.findByText("What does F stand for?")).toBeTruthy();
  });

  it("discards the fetch result when unmounted before it settles", async () => {
    let resolveDue: (cards: ReviewCardOut[]) => void;
    mockGetReviewDue.mockReturnValue(
      new Promise((resolve) => {
        resolveDue = resolve;
      }),
    );
    const { unmount } = renderWithLocale(<Review />);
    unmount();
    resolveDue!([card()]);
    // Let the settled promise's state updates run — they must be no-ops.
    await Promise.resolve();
  });

  it("re-fetches the due cards after a sign-in through the modal", async () => {
    // #147: a token that expired mid-use — the fetch 401s (the modal
    // opened over the page), the person signs back in, and the deck
    // refetches in place, no navigation.
    mockGetReviewDue
      .mockRejectedValueOnce(new Error("unauthorized"))
      .mockResolvedValueOnce([card({ id: 1 })]);
    renderWithLocale(<Review />);
    await screen.findByText("Can't load your review deck");
    act(() => {
      notifySignedIn();
    });
    await waitFor(() => {
      expect(screen.getByText("What does F stand for?")).toBeTruthy();
    });
    expect(mockGetReviewDue).toHaveBeenCalledTimes(2);
  });

  it("re-renders as a Visitor after sign-out — re-fetches and settles on the error state", async () => {
    // #147: sign-out does not navigate. The deck refetches in place; the
    // now-anonymous fetch answers 401 and the page settles into its error
    // state rather than keeping the stale cards.
    mockGetReviewDue
      .mockResolvedValueOnce([card({ id: 1 })])
      .mockRejectedValueOnce(new Error("unauthorized"));
    renderWithLocale(<Review />);
    await screen.findByText("What does F stand for?");
    act(() => {
      notifySignedOut();
    });
    await waitFor(() => {
      expect(screen.queryByText("What does F stand for?")).toBeNull();
    });
    expect(mockGetReviewDue).toHaveBeenCalledTimes(2);
  });

  it("discards the fetch failure when unmounted before it settles", async () => {
    let rejectDue: (error: Error) => void;
    mockGetReviewDue.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectDue = reject;
      }),
    );
    const { unmount } = renderWithLocale(<Review />);
    unmount();
    rejectDue!(new Error("late"));
    await Promise.resolve();
  });
});
