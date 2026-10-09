// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderWithLocale } from "@/test/test-utils";
import { EmptyState } from "@/components/empty-state";

afterEach(() => {
  cleanup();
});

describe("EmptyState", () => {
  it("renders the caller's title and body copy", () => {
    renderWithLocale(
      <EmptyState
        title="No sessions yet"
        body="Start your first deep dive or launch a contextual inquiry to begin your learning journey."
      />,
    );
    expect(screen.getByText("No sessions yet")).toBeTruthy();
    expect(
      screen.getByText(
        "Start your first deep dive or launch a contextual inquiry to begin your learning journey.",
      ),
    ).toBeTruthy();
  });

  it("renders the zh copy passed by the caller under the zh locale", () => {
    renderWithLocale(
      <EmptyState title="还没有会话" body="开始你的第一次深度探索，或发起一次新的学习探究，开启学习之旅。" />,
      { locale: "zh" },
    );
    expect(screen.getByText("还没有会话")).toBeTruthy();
  });
});
