// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { ControlBar } from "@/components/classroom/control-bar";

const noop = () => {};

afterEach(() => {
  cleanup();
});

describe("ControlBar", () => {
  it("renders the counter as 'index / total'", () => {
    render(<ControlBar index={1} total={7} onPrev={noop} onNext={noop} />);
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("/")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
  });

  it("drives the counter from its props", () => {
    cleanup();
    render(<ControlBar index={3} total={9} onPrev={noop} onNext={noop} />);
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("9")).toBeTruthy();
  });

  it("renders prev and next buttons", () => {
    render(<ControlBar index={1} total={7} onPrev={noop} onNext={noop} />);
    expect(screen.getByRole("button", { name: "Previous slide" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next slide" })).toBeTruthy();
  });

  it("calls onPrev when the previous button is clicked", () => {
    const onPrev = vi.fn();
    render(<ControlBar index={2} total={5} onPrev={onPrev} onNext={noop} />);
    fireEvent.click(screen.getByRole("button", { name: "Previous slide" }));
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it("calls onNext when the next button is clicked", () => {
    const onNext = vi.fn();
    render(<ControlBar index={2} total={5} onPrev={noop} onNext={onNext} />);
    fireEvent.click(screen.getByRole("button", { name: "Next slide" }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("disables prev when at the first slide", () => {
    render(<ControlBar index={1} total={5} onPrev={noop} onNext={noop} />);
    expect((screen.getByRole("button", { name: "Previous slide" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("disables next when at the last slide", () => {
    render(<ControlBar index={5} total={5} onPrev={noop} onNext={noop} />);
    expect((screen.getByRole("button", { name: "Next slide" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
