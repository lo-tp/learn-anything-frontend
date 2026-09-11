// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Session } from "@/views/session";
import { getMaterials, type MaterialsOut, type SessionState } from "@/lib/api-client";

vi.mock("@/lib/api-client", () => ({
  getMaterials: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

const mockGetMaterials = vi.mocked(getMaterials);

beforeEach(() => {
  mockGetMaterials.mockReset();
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

function renderSession(
  props: Partial<React.ComponentProps<typeof Session>> = {},
) {
  return render(
    <Session
      sessionId="s-1"
      initialSession={session()}
      initialMaterials={materials()}
      {...props}
    />,
  );
}

/** The ControlBar counter, labelled `Slide {index} of {total}`. */
function counterAt(index: number, total: number) {
  return screen.getByLabelText(new RegExp(`^slide ${index} of ${total}$`, "i"));
}

describe("Session", () => {
  it("groups the flattened items under step-summary dividers", () => {
    renderSession();
    // Step dividers (number + title).
    expect(screen.getByText("Force and mass")).toBeTruthy();
    expect(screen.getByText("Putting it together")).toBeTruthy();
    // One card per item: slide, question, question.
    expect(
      screen.getByRole("button", { name: /^slide$/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /what does f stand for\?/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /what does a stand for\?/i }),
    ).toBeTruthy();
  });

  it("starts on the first item (a slide) and loads it from the sandbox", () => {
    renderSession();
    const frame = screen.getByTitle("Sandbox");
    expect(frame.getAttribute("src")).toContain("/slides/slide-1");
  });

  it("activates the clicked item in the main area", () => {
    renderSession();
    fireEvent.click(
      screen.getByRole("button", { name: /what does f stand for\?/i }),
    );
    // The quiz now owns the main area: its options are visible.
    expect(
      screen.getByRole("button", { name: /^a\s*force$/i }),
    ).toBeTruthy();
    // And the slide frame is gone.
    expect(screen.queryByTitle("Sandbox")).toBeNull();
  });

  it("walks items with prev/next across group boundaries", () => {
    renderSession();

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

  it("reveals feedback and locks the question on answer", () => {
    renderSession();
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

  it("shows Correct. when the right option is chosen", () => {
    renderSession();
    fireEvent.click(
      screen.getByRole("button", { name: /what does f stand for\?/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^a\s*force$/i }));
    expect(screen.getByText("Correct.")).toBeTruthy();
  });

  it("renders the not-found state when the session does not exist", () => {
    renderSession({ initialSession: null });
    expect(screen.getByText("Session not found")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /back to my sessions/i } ).getAttribute("href"),
    ).toBe("/");
  });

  it("renders the error state when the session errored", () => {
    renderSession({
      initialSession: session({ phase: "error" }),
      initialMaterials: null,
    });
    expect(screen.getByText("Something went wrong")).toBeTruthy();
  });

  it("renders the not-ready state for pre-material phases (no polling)", () => {
    renderSession({
      initialSession: session({ phase: "planning" }),
      initialMaterials: null,
    });
    expect(screen.getByText("Materials aren't ready yet")).toBeTruthy();
    expect(screen.getByText("Newton's second law")).toBeTruthy();
    expect(mockGetMaterials).not.toHaveBeenCalled();
  });

  it("polls every 3s while generating, then renders the deck", async () => {
    vi.useFakeTimers();
    try {
      mockGetMaterials.mockResolvedValue(materials());
      render(
        <Session
          sessionId="s-1"
          initialSession={session({ phase: "generating" })}
          initialMaterials={materials({
            phase: "generating",
            generated_steps: [],
          })}
        />,
      );
      expect(screen.getByText("Generating materials…")).toBeTruthy();
      expect(mockGetMaterials).not.toHaveBeenCalled();

      // First tick: fetch lands, the deck renders, polling stops.
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      await act(async () => {});
      expect(mockGetMaterials).toHaveBeenCalledTimes(1);
      expect(mockGetMaterials).toHaveBeenCalledWith("s-1");
      expect(screen.getByText("Force and mass")).toBeTruthy();

      // Further ticks stay quiet — the phase left `generating`.
      act(() => {
        vi.advanceTimersByTime(9000);
      });
      await act(async () => {});
      expect(mockGetMaterials).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps waiting (with a note) when a poll fails", async () => {
    vi.useFakeTimers();
    try {
      mockGetMaterials.mockRejectedValue(new Error("boom"));
      render(
        <Session
          sessionId="s-1"
          initialSession={session({ phase: "generating" })}
          initialMaterials={materials({ phase: "generating", generated_steps: [] })}
        />,
      );

      act(() => {
        vi.advanceTimersByTime(3000);
      });
      await act(async () => {});
      expect(screen.getByText("Can't reach the backend right now — retrying.")).toBeTruthy();
      // Still generating — the next tick polls again.
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      await act(async () => {});
      expect(mockGetMaterials).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
