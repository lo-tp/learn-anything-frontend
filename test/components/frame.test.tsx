// @vitest-environment jsdom
import { describe, expect, it, afterEach } from "vitest";
import { screen, cleanup } from "@testing-library/react";
import { renderWithLocale } from "@/test/test-utils";
afterEach(cleanup);
import { Frame } from "@/components/frame";

describe("Frame", () => {
  it("renders the shared TopBar above the page content", () => {
    renderWithLocale(
      <Frame>
        <main>Page content</main>
      </Frame>,
    );

    const wordmark = screen.getByText("Learn Anything");
    expect(wordmark).toBeTruthy();

    const content = screen.getByText("Page content");
    expect(content).toBeTruthy();
  });

  it("places the TopBar before the children in the DOM", () => {
    renderWithLocale(
      <Frame>
        <main>Page content</main>
      </Frame>,
    );

    const wordmark = screen.getByText("Learn Anything");
    const content = screen.getByText("Page content");
    const position = wordmark.compareDocumentPosition(content);
    // Node.DOCUMENT_POSITION_FOLLOWING — content comes after the TopBar
    expect(position & 0x04).toBeTruthy();
  });

  it("is a full-height flex column so the content fills the space below the TopBar", () => {
    renderWithLocale(
      <Frame>
        <main>Page content</main>
      </Frame>,
    );

    const content = screen.getByText("Page content");
    const frameRoot =
      screen.getByText("Learn Anything").closest(".flex.h-full.flex-col");
    expect(frameRoot).toBeTruthy();
    expect(frameRoot?.contains(content)).toBe(true);
  });
});
