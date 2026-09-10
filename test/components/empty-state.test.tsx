// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { EmptyState } from "@/components/empty-state";

afterEach(() => {
  cleanup();
});

describe("EmptyState", () => {
  it("renders the 'No sessions yet' heading", () => {
    render(<EmptyState />);
    expect(screen.getByText("No sessions yet")).toBeTruthy();
  });

  it("renders the design's body copy verbatim", () => {
    render(<EmptyState />);
    expect(
      screen.getByText(
        "Start your first deep dive or launch a contextual inquiry to begin your learning journey.",
      ),
    ).toBeTruthy();
  });
});
