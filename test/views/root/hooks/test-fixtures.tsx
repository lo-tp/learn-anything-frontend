// Shared fixtures and helpers for the new-session phase tests.
// Import this from each per-phase test file. The `vi.mock` call must still
// live in each test file (Vitest hoists it to the top of the module).

import { fireEvent, screen } from "@testing-library/react";
import { renderWithLocale, type TestLocale } from "@/test/test-utils";
import { NewSessionDialog } from "@/views/root/new-session-dialog";
import type { PlanBody, PlanOut } from "@/lib/api-client";

// ── Constants ──────────────────────────────────────────────────────────────

export const TITLE = "Start New Session";
export const LABEL = "What would you like to explore or learn?";
export const PROBE_LABEL = "Which option is right?";
export const REVIEW_LABEL = "How should we adjust the plan?";
export const SHORT = "Too short.";
export const GOAL = "I want to master Newton's second law of motion.";

/** A 4-option probe question (0-based correct index 1). */
export const Q1 = {
  id: "q1",
  text: "A 2 kg object experiences a net force of 10 N. What is its acceleration?",
  options: ["2 m/s²", "5 m/s²", "10 m/s²", "20 m/s²"],
  correct_index: 1,
  explanation: "a = F/m = 10/2 = 5 m/s².",
  strand: "f_ma_relation",
  difficulty: 2,
};

/** The follow-up question served after answering Q1. */
export const Q2 = {
  id: "q2",
  text: "If the net force on the object doubles, its acceleration…",
  options: ["halves", "doubles", "stays the same", "quadruples"],
  correct_index: 1,
  explanation: "a = F/m, so doubling F doubles a.",
  strand: "f_ma_relation",
  difficulty: 3,
};

/** A size-1 follow-up (the scalar-vs-vector distinction). */
export const Q3 = {
  id: "q3",
  text: "In the vector form F = ma, which quantity is a scalar?",
  options: ["force", "mass", "acceleration"],
  correct_index: 1,
  explanation: "Mass is a scalar; force and acceleration are vectors.",
  strand: "f_ma_relation",
  difficulty: 4,
};

/** A 3-step plan, depth-ascending, with a dependency chain. */
export const PLAN: PlanBody = {
  prose_summary:
    "Start from scalar F = ma, extend to vectors, then combine forces.",
  dependency_dag: "scalar -> vector -> combine",
  steps: [
    {
      id: "step-1",
      title: "Scalar F = ma",
      description: "One-dimensional force, mass, and acceleration.",
      depends_on: [],
      depth: 0,
    },
    {
      id: "step-2",
      title: "Vector form",
      description: "Forces and accelerations as vectors.",
      depends_on: ["step-1"],
      depth: 1,
    },
    {
      id: "step-3",
      title: "Combining forces",
      description: "Summing several forces into a net force.",
      depends_on: ["step-2"],
      depth: 2,
    },
  ],
};

/** The plan-generation/adjustment result the backend returns. */
export const PLAN_OUT: PlanOut = { phase: "reviewing", plan: PLAN };

/** A revised plan (one step dropped) returned by an adjustment. */
export const PLAN_OUT_REVISED: PlanOut = {
  phase: "reviewing",
  plan: {
    prose_summary: "A tighter two-step path from scalar F = ma to vectors.",
    dependency_dag: "scalar -> vector",
    steps: PLAN.steps.slice(0, 2),
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────

/** Render the dialog open and focus its textarea with `value`. */
export async function openDialog(
  value: string = "",
  onAccept: () => void = () => {},
  locale: TestLocale = "en",
) {
  renderWithLocale(
    <NewSessionDialog open onOpenChange={() => {}} onAccept={onAccept} />,
    { locale },
  );
  // The intake textarea is the dialog's only textbox (its label is
  // localized, so look it up by role instead of by `LABEL`).
  const textarea = await screen.findByRole("textbox");
  if (value) fireEvent.change(textarea, { target: { value } });
  return textarea;
}

/**
 * Click the Send button after the dialog is open. The caller must have
 * configured the relevant mocks before calling this.
 */
export function clickSend() {
  fireEvent.click(screen.getByRole("button", { name: /Send/ }));
}
