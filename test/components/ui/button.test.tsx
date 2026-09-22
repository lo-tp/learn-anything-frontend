// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";

afterEach(() => {
  cleanup();
});

describe("Button", () => {
  it("renders a native button by default", () => {
    render(<Button>Press</Button>);
    expect(screen.getByRole("button", { name: "Press" })).toBeTruthy();
  });

  it("renders the child as the element when asChild is set", () => {
    render(
      <Button asChild>
        <a href="https://example.com">Review</a>
      </Button>,
    );
    // The link (not a button) carries the button's styles.
    const link = screen.getByRole("link", { name: "Review" });
    expect(link.getAttribute("href")).toBe("https://example.com");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
