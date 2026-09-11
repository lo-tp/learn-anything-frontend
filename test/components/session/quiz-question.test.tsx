// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QuizQuestion } from "@/components/session/quiz-question";
import type { QuestionItem } from "@/lib/api-client";

const question: QuestionItem = {
  type: "question",
  id: "q-1",
  text: "What does F stand for?",
  options: ["Force", "Friction"],
  correct_index: 0,
  explanation: "F is the net force.",
};

afterEach(() => {
  cleanup();
});

describe("QuizQuestion", () => {
  it("renders the prompt and lettered options, no reveal yet", () => {
    render(<QuizQuestion question={question} selected={null} onSelect={() => {}} />);
    expect(screen.getByText("What does F stand for?")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^a\s*force$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^b\s*friction$/i })).toBeTruthy();
    expect(screen.queryByText(/not quite|correct\./i)).toBeNull();
    expect(screen.queryByText("F is the net force.")).toBeNull();
  });

  it("reports the clicked option's index without revealing", () => {
    const onSelect = vi.fn();
    render(<QuizQuestion question={question} selected={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /^b\s*friction$/i }));
    expect(onSelect).toHaveBeenCalledWith(1);
    expect(screen.queryByText("F is the net force.")).toBeNull();
  });

  it("reveals the explanation and locks the options after a wrong answer", () => {
    render(<QuizQuestion question={question} selected={1} onSelect={() => {}} />);
    expect(screen.getByText("Not quite.")).toBeTruthy();
    expect(screen.getByText("F is the net force.")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: /^a\s*force$/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: /^b\s*friction$/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("shows Correct. when the right option is selected", () => {
    render(<QuizQuestion question={question} selected={0} onSelect={() => {}} />);
    expect(screen.getByText("Correct.")).toBeTruthy();
    expect(screen.getByText("F is the net force.")).toBeTruthy();
  });
});
