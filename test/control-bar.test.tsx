// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ControlBar } from "../components/classroom/control-bar";

afterEach(() => {
  cleanup();
});

describe("ControlBar", () => {
  it("renders the counter as 'index / total'", () => {
    render(<ControlBar index={1} total={7} />);
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("/")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
  });

  it("drives the counter from its props", () => {
    cleanup();
    render(<ControlBar index={3} total={9} />);
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("9")).toBeTruthy();
  });

  it("renders static prev and next buttons", () => {
    render(<ControlBar index={1} total={7} />);
    expect(screen.getByRole("button", { name: "Previous slide" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next slide" })).toBeTruthy();
  });

  it("is static: the prev/next buttons carry no DOM handlers", () => {
    const { container } = render(<ControlBar index={1} total={7} />);
    for (const button of container.querySelectorAll("button")) {
      expect((button as HTMLButtonElement).onclick).toBeNull();
    }
  });
});
