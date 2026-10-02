// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, fireEvent } from "@testing-library/react";
import { renderWithLocale } from "@/test/test-utils";import { ControlBar } from "@/components/control-bar";

const noop = () => {};

afterEach(() => {
  cleanup();
});

describe("ControlBar", () => {
  it("renders the counter as zero-padded 'index / total'", () => {
    renderWithLocale(<ControlBar index={1} total={7} onPrev={noop} onNext={noop} />);
    expect(screen.getByText("01")).toBeTruthy();
    expect(screen.getByText("/")).toBeTruthy();
    expect(screen.getByText("07")).toBeTruthy();
  });

  it("drives the counter from its props", () => {
    cleanup();
    renderWithLocale(<ControlBar index={3} total={9} onPrev={noop} onNext={noop} />);
    expect(screen.getByText("03")).toBeTruthy();
    expect(screen.getByText("09")).toBeTruthy();
  });

  it("renders prev and next buttons", () => {
    renderWithLocale(<ControlBar index={1} total={7} onPrev={noop} onNext={noop} />);
    expect(screen.getByRole("button", { name: "Previous slide" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next slide" })).toBeTruthy();
  });

  it("calls onPrev when the previous button is clicked", () => {
    const onPrev = vi.fn();
    renderWithLocale(<ControlBar index={2} total={5} onPrev={onPrev} onNext={noop} />);
    fireEvent.click(screen.getByRole("button", { name: "Previous slide" }));
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it("calls onNext when the next button is clicked", () => {
    const onNext = vi.fn();
    renderWithLocale(<ControlBar index={2} total={5} onPrev={noop} onNext={onNext} />);
    fireEvent.click(screen.getByRole("button", { name: "Next slide" }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("disables prev when at the first slide", () => {
    renderWithLocale(<ControlBar index={1} total={5} onPrev={noop} onNext={noop} />);
    expect((screen.getByRole("button", { name: "Previous slide" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("disables next when at the last slide", () => {
    renderWithLocale(<ControlBar index={5} total={5} onPrev={noop} onNext={noop} />);
    expect((screen.getByRole("button", { name: "Next slide" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
