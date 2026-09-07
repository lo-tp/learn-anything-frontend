// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { SlideSidebar } from "../components/classroom/slide-sidebar";

const samples = ["sample_1", "sample_2", "sample_3"];

afterEach(() => {
  cleanup();
});

describe("SlideSidebar", () => {
  it("renders one card per sample in the expanded state", () => {
    render(<SlideSidebar samples={samples} activeIndex={0} onSelect={() => {}} />);
    // samples.length clickable cards + 1 toggle button
    expect(screen.getAllByRole("button").length).toBe(samples.length + 1);
    expect(screen.getByText("sample_1")).toBeTruthy();
  });

  it("collapses and expands via the toggle", () => {
    const { container } = render(
      <SlideSidebar samples={samples} activeIndex={0} onSelect={() => {}} />,
    );
    const aside = container.querySelector("aside") as HTMLElement;
    const toggle = screen.getByRole("button", { name: "Collapse sidebar" });
    expect(aside.className).toContain("w-80");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(toggle);
    expect(aside.className).toContain("w-14");
    expect(
      screen.getByRole("button", { name: "Expand sidebar" }).getAttribute("aria-expanded"),
    ).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));
    expect(aside.className).toContain("w-80");
  });

  it("keeps navigation available while collapsed", () => {
    const onSelect = vi.fn();
    render(<SlideSidebar samples={samples} activeIndex={0} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));

    fireEvent.click(screen.getByRole("button", { name: "Slide 3: sample_3" }));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it("only mounts the preview iframes when expanded", () => {
    const { container } = render(
      <SlideSidebar samples={samples} activeIndex={0} onSelect={() => {}} />,
    );
    expect(container.querySelectorAll("iframe").length).toBe(samples.length);

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(container.querySelectorAll("iframe").length).toBe(0);
  });
});
