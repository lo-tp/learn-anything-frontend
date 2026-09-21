// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderWithLocale } from "@/test/test-utils";
import { Review } from "@/views/review";
import {
  answerReviewCard,
  getReviewDue,
  type ReviewAnswerOut,
  type ReviewCardOut,
} from "@/lib/api-client";

// Deterministic display order: the reverse permutation, so display position
// `i` maps to canonical index `n-1-i`. Lets the tests assert the exact
// display→canonical mapping without driving the RNG. `cn` is left real —
// `QuizQuestion` relies on it.
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
    interval_days: 1,
    ease: 2.5,
    lapses: 0,
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
      was_correct: true,
      due_at: "",
      interval_days: 2,
      ease: 2.5,
      lapses: 0,
      is_retired: false,
    } satisfies ReviewAnswerOut);
});

afterEach(() => {
  cleanup();
});

/** The progress pill, labelled `{index} / {total}`. */
function progressAt(index: number, total: number) {
  return screen.getByLabelText(new RegExp(`^${index} / ${total}$`, "i"));
}

/** The option button whose accessible name is `letter + option text`. */
function option(letter: string, word: string) {
  return screen.getByRole("button", {
    name: new RegExp(`^${letter}\\s*${word}$`, "i"),
  });
}

describe("Review", () => {
  it("fetches due cards on mount and shows the first card in display order", async () => {
    renderWithLocale(<Review />);
    expect(await screen.findByText("What does F stand for?")).toBeTruthy();
    expect(mockGetReviewDue).toHaveBeenCalled();
    // Two cards, first is active.
    expect(progressAt(1, 2)).toBeTruthy();
    // Display order is reversed for n=2: position A = "Friction", B = "Force".
    expect(option("a", "friction")).toBeTruthy();
    expect(option("b", "force")).toBeTruthy();
  });

  it("reveals the answer on pick and records the canonical index", async () => {
    renderWithLocale(<Review />);
    await screen.findByText("What does F stand for?");
    // Pick the correct option: canonical 0 sits at display position B
    // (reverse order). The reveal shows "Correct."
    fireEvent.click(option("b", "force"));
    expect(screen.getByText("Correct.")).toBeTruthy();
    expect(screen.getByText("F is the net force.")).toBeTruthy();
    expect(mockAnswerReviewCard).toHaveBeenCalledWith(1, 0);
  });

  it("records the canonical index for a wrong pick and reveals 'Not quite.'", async () => {
    renderWithLocale(<Review />);
    await screen.findByText("What does F stand for?");
    // Position A = canonical 1 ("Friction") — the wrong answer.
    fireEvent.click(option("a", "friction"));
    expect(screen.getByText("Not quite.")).toBeTruthy();
    expect(mockAnswerReviewCard).toHaveBeenCalledWith(1, 1);
  });

  it("advances to the next card on Next", async () => {
    renderWithLocale(<Review />);
    await screen.findByText("What does F stand for?");
    fireEvent.click(option("b", "force"));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    // Second card, position 2/2.
    expect(screen.getByText("What does a stand for?")).toBeTruthy();
    expect(progressAt(2, 2)).toBeTruthy();
  });

  it("offers Done on the last card and finishes the deck", async () => {
    renderWithLocale(<Review />);
    await screen.findByText("What does F stand for?");
    fireEvent.click(option("b", "force"));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await screen.findByText("What does a stand for?");
    // Last card: the control reads Done.
    fireEvent.click(option("b", "acceleration"));
    fireEvent.click(screen.getByRole("button", { name: /done/i }));
    // Deck complete → all-clear state.
    expect(screen.getByText("All clear")).toBeTruthy();
  });

  it("hides the advance control until an option is picked", async () => {
    renderWithLocale(<Review />);
    await screen.findByText("What does F stand for?");
    expect(
      screen.queryByRole("button", { name: /next|done/i }),
    ).toBeNull();
  });

  it("shows the empty state with a home link when there are no due cards", async () => {
    mockGetReviewDue.mockResolvedValue([]);
    renderWithLocale(<Review />);
    expect(await screen.findByText("All clear")).toBeTruthy();
    expect(screen.getByText("No cards are due right now — keep studying!")).toBeTruthy();
    expect(screen.getByRole("link", { name: /back to my sessions/i })).toBeTruthy();
  });

  it("shows the error state with a home link when the fetch fails", async () => {
    mockGetReviewDue.mockRejectedValue(new Error("nope"));
    renderWithLocale(<Review />);
    expect(
      await screen.findByText("Can't reach the review service. Please try again."),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: /back to my sessions/i })).toBeTruthy();
  });
});
