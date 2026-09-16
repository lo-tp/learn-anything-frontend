// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderWithLocale } from "@/test/test-utils";import { EmptyState } from "@/components/empty-state";

afterEach(() => {
  cleanup();
});

describe("EmptyState", () => {
  it("renders the 'No sessions yet' heading", () => {
    renderWithLocale(<EmptyState />);
    expect(screen.getByText("No sessions yet")).toBeTruthy();
  });

  it("renders the design's body copy verbatim", () => {
    renderWithLocale(<EmptyState />);
    expect(
      screen.getByText(
        "Start your first deep dive or launch a contextual inquiry to begin your learning journey.",
      ),
    ).toBeTruthy();
  });

  it("renders the zh catalog under the zh locale", () => {
    renderWithLocale(<EmptyState />, { locale: "zh" });
    expect(screen.getByText("还没有会话")).toBeTruthy();
  });
});
