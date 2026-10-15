// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderWithLocale } from "@/test/test-utils";
import { SlideRegenerateControl } from "@/components/session/slide-regenerate";

/**
 * The one-slide regeneration control (#213), tested at its own seam: what the
 * learner can press, what it says it will do, and what it says while a slide is
 * being rewritten. The view's decisions (which slide, opening the sheet, the
 * request itself) are the view's tests.
 */
describe("SlideRegenerateControl", () => {
  afterEach(() => {
    cleanup();
  });

  it("names itself and asks for the sheet when pressed", () => {
    const onRequest = vi.fn();
    renderWithLocale(
      <SlideRegenerateControl regenerating={false} onRequest={onRequest} />,
    );
    const button = screen.getByRole("button", { name: /regenerate this slide/i });
    fireEvent.click(button);
    expect(onRequest).toHaveBeenCalledTimes(1);
  });

  it("is not pressable while the slide is being rewritten", () => {
    renderWithLocale(
      <SlideRegenerateControl regenerating onRequest={vi.fn()} />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("says the slide is being generated where the pointer rests", () => {
    renderWithLocale(
      <SlideRegenerateControl regenerating onRequest={vi.fn()} />,
    );
    const status = screen.getByRole("status");
    expect(status.getAttribute("title")).toMatch(/being generated/i);
    expect(status.getAttribute("aria-label")).toMatch(/regenerating/i);
  });

  it("spins only while the slide is being rewritten", () => {
    renderWithLocale(
      <SlideRegenerateControl regenerating={false} onRequest={vi.fn()} />,
    );
    expect(
      screen.getByRole("button").querySelector(".animate-spin"),
    ).toBeNull();

    cleanup();
    renderWithLocale(
      <SlideRegenerateControl regenerating onRequest={vi.fn()} />,
    );
    expect(screen.getByRole("status").querySelector(".animate-spin")).toBeTruthy();
  });
});
