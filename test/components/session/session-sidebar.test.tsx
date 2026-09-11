// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  SessionSidebar,
  type SidebarGroup,
} from "@/components/session/session-sidebar";
import type { SlideItem, QuestionItem } from "@/lib/api-client";

const slide: SlideItem = { type: "slide", slide_id: "slide-1" };
const question: QuestionItem = {
  type: "question",
  id: "q-1",
  text: "What does F stand for?",
  options: ["Force", "Friction"],
  correct_index: 0,
  explanation: "F is the net force.",
};

const groups: SidebarGroup[] = [
  {
    step: {
      step_id: "st-1",
      summary: { step_id: "st-1", title: "Force and mass", key_points: [] },
      items: [slide, question],
    },
    items: [
      { index: 0, item: slide },
      { index: 1, item: question },
    ],
  },
];

afterEach(() => {
  cleanup();
});

describe("SessionSidebar", () => {
  it("renders the step divider and one card per item", () => {
    render(<SessionSidebar groups={groups} activeIndex={0} onSelect={() => {}} />);
    expect(screen.getByText("Force and mass")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^slide$/i })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /what does f stand for\?/i }),
    ).toBeTruthy();
  });

  it("previews the slide card's sandbox route scaled down", () => {
    const { container } = render(
      <SessionSidebar groups={groups} activeIndex={0} onSelect={() => {}} />,
    );
    const frame = container.querySelector("iframe");
    expect(frame).toBeTruthy();
    expect(frame?.getAttribute("src")).toContain("/sandbox/slide-1");
    // The preview is a non-interactive, a11y-hidden mini render.
    expect(frame?.getAttribute("aria-hidden")).toBe("true");
    expect(frame?.getAttribute("tabindex")).toBe("-1");
  });

  it("previews the question card's full content (prompt and options)", () => {
    render(<SessionSidebar groups={groups} activeIndex={0} onSelect={() => {}} />);
    // The options exist only in the preview — the main area isn't rendered here.
    expect(screen.getByText("Friction")).toBeTruthy();
    expect(screen.getByText("Force")).toBeTruthy();
  });

  it("keeps the previews out of the accessibility tree", () => {
    render(<SessionSidebar groups={groups} activeIndex={0} onSelect={() => {}} />);
    // The preview's option buttons are aria-hidden; only the two cards
    // plus nothing else expose the button role.
    expect(screen.queryAllByRole("button")).toHaveLength(2);
  });

  it("reports the clicked item's flat index", () => {
    const onSelect = vi.fn();
    render(<SessionSidebar groups={groups} activeIndex={0} onSelect={onSelect} />);
    fireEvent.click(
      screen.getByRole("button", { name: /what does f stand for\?/i }),
    );
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("marks the active card with aria-current", () => {
    render(<SessionSidebar groups={groups} activeIndex={1} onSelect={() => {}} />);
    expect(
      screen
        .getByRole("button", { name: /what does f stand for\?/i })
        .getAttribute("aria-current"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: /^slide$/i }).getAttribute("aria-current"),
    ).toBeNull();
  });
});
