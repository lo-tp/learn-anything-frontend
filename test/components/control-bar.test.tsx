// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { cleanup, screen, fireEvent } from "@testing-library/react";
import { renderWithLocale } from "@/test/test-utils";import { ControlBar } from "@/components/control-bar";

const noop = () => {};

afterEach(() => {
  cleanup();
});

/** Every render needs all three of the bar's actions. */
function barProps(
  overrides: Partial<ComponentProps<typeof ControlBar>> = {},
) {
  return { index: 1, total: 7, onPrev: noop, onNext: noop, onOpenJump: noop, ...overrides };
}

describe("ControlBar", () => {
  it("renders the counter as zero-padded 'index / total'", () => {
    renderWithLocale(<ControlBar {...barProps()} />);
    expect(screen.getByText("01")).toBeTruthy();
    expect(screen.getByText("/")).toBeTruthy();
    expect(screen.getByText("07")).toBeTruthy();
  });

  it("drives the counter from its props", () => {
    cleanup();
    renderWithLocale(<ControlBar {...barProps({ index: 3, total: 9 })} />);
    expect(screen.getByText("03")).toBeTruthy();
    expect(screen.getByText("09")).toBeTruthy();
  });

  it("renders prev and next buttons", () => {
    renderWithLocale(<ControlBar {...barProps()} />);
    expect(screen.getByRole("button", { name: "Previous slide" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next slide" })).toBeTruthy();
  });

  it("calls onPrev when the previous button is clicked", () => {
    const onPrev = vi.fn();
    renderWithLocale(<ControlBar {...barProps({ index: 2, total: 5, onPrev })} />);
    fireEvent.click(screen.getByRole("button", { name: "Previous slide" }));
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it("calls onNext when the next button is clicked", () => {
    const onNext = vi.fn();
    renderWithLocale(<ControlBar {...barProps({ index: 2, total: 5, onNext })} />);
    fireEvent.click(screen.getByRole("button", { name: "Next slide" }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("disables prev when at the first slide", () => {
    renderWithLocale(<ControlBar {...barProps({ index: 1, total: 5 })} />);
    expect((screen.getByRole("button", { name: "Previous slide" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("disables next when at the last slide", () => {
    renderWithLocale(<ControlBar {...barProps({ index: 5, total: 5 })} />);
    expect((screen.getByRole("button", { name: "Next slide" }) as HTMLButtonElement).disabled).toBe(true);
  });

  describe("the go-to-slide chip (#229)", () => {
    it("is the counter itself — a button whose name carries the position", () => {
      renderWithLocale(<ControlBar {...barProps({ index: 3, total: 45 })} />);
      const chip = screen.getByRole("button", {
        name: /^go to a slide \(slide 3 of 45\)$/i,
      });
      expect(chip).toBeTruthy();
      // The zero-padded pair it prints is still on the chip.
      expect(chip.textContent).toContain("03");
      expect(chip.textContent).toContain("45");
    });

    it("opens the jump dialog when pressed", () => {
      const onOpenJump = vi.fn();
      renderWithLocale(<ControlBar {...barProps({ onOpenJump })} />);
      fireEvent.click(
        screen.getByRole("button", { name: /^go to a slide/i }),
      );
      expect(onOpenJump).toHaveBeenCalledTimes(1);
    });
  });
});
