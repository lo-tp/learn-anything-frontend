// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";
import { renderWithLocale } from "@/test/test-utils";
import { Bubble } from "@/components/bubble";

afterEach(() => {
  cleanup();
});

/** The bubble itself: a decorative marker, so the test reads its classes. */
function renderBubble(state: "empty" | "filled" | "current" | "active") {
  const { container } = renderWithLocale(<Bubble state={state} />);
  return container.querySelector("span[aria-hidden]") as HTMLElement;
}

describe("Bubble", () => {
  it("is hidden from assistive technology — it marks a step, it is not one", () => {
    expect(renderBubble("empty").getAttribute("aria-hidden")).toBe("true");
  });

  it("draws a step not reached as an outlined ring in the rule colour", () => {
    const bubble = renderBubble("empty");
    expect(bubble.className).toContain("border-outline-variant");
    expect(bubble.className).not.toContain("bg-primary");
    expect(bubble.childElementCount).toBe(0);
  });

  it("inks a done step in print ink, with the bubble-fill motion", () => {
    const bubble = renderBubble("filled");
    expect(bubble.className).toContain("animate-bubble-fill");
    expect(bubble.className).toContain("bg-primary");
    expect(bubble.className).not.toContain("border-engage");
  });

  it("shows the step being worked as an engagement-blue ring with a breathing dot", () => {
    const bubble = renderBubble("current");
    expect(bubble.className).toContain("border-engage");
    expect(bubble.className).not.toContain("bg-engage");
    const dot = bubble.firstElementChild as HTMLElement;
    expect(dot.className).toContain("animate-dot-breathe");
    expect(dot.className).toContain("bg-engage");
  });

  it("shows the step you are standing on as a filled engagement-blue bubble", () => {
    const bubble = renderBubble("active");
    expect(bubble.className).toContain("border-engage");
    expect(bubble.className).toContain("bg-engage");
    expect(bubble.childElementCount).toBe(0);
  });

  it("takes the caller's own classes", () => {
    const { container } = renderWithLocale(
      <Bubble state="filled" className="size-4" />,
    );
    const bubble = container.querySelector("span[aria-hidden]") as HTMLElement;
    expect(bubble.className).toContain("size-4");
    expect(bubble.className).toContain("animate-bubble-fill");
  });
});
