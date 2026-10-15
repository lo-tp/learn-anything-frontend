// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderWithLocale } from "@/test/test-utils";
import { RegenerateSlideSheet } from "@/components/session/regenerate-slide-sheet";

/**
 * The regeneration sheet (#213): the small form that turns "this slide doesn't
 * fit me" into the `feedback` the one-slide route is given. Tested at its own
 * seam — what it sends, what it refuses to send, and what it says when the
 * slide cannot be rewritten. Performing the request is the view's job.
 */
function renderSheet(
  overrides: {
    onSubmit?: (feedback: string | null) => void;
    onOpenChange?: (open: boolean) => void;
    pending?: boolean;
    error?: string | null;
  } = {},
) {
  const onSubmit = overrides.onSubmit ?? vi.fn();
  const onOpenChange = overrides.onOpenChange ?? vi.fn();
  renderWithLocale(
    <RegenerateSlideSheet
      open
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
      pending={overrides.pending ?? false}
      error={overrides.error ?? null}
    />,
  );
  return { onSubmit, onOpenChange };
}

describe("RegenerateSlideSheet", () => {
  afterEach(() => {
    cleanup();
  });

  it("sends what the learner typed about this slide", () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "  make it more visual  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /^regenerate$/i }));
    expect(onSubmit).toHaveBeenCalledWith("make it more visual");
  });

  it("asks for a plain rewrite, not a blank instruction, when the box is left empty", () => {
    const { onSubmit } = renderSheet();
    fireEvent.click(screen.getByRole("button", { name: /^regenerate$/i }));
    expect(onSubmit).toHaveBeenCalledWith(null);
  });

  it("cancels without asking for anything", () => {
    const { onSubmit, onOpenChange } = renderSheet();
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("cannot be pressed twice while a request is in flight", () => {
    const { onSubmit } = renderSheet({ pending: true });
    // The control is still there and still says what it is doing — it is the
    // pressing that is refused.
    const sending = screen.getByRole("button", { name: /sending/i });
    expect(sending.hasAttribute("disabled")).toBe(true);
    fireEvent.click(sending);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows the backend's reason when this slide cannot be rewritten", () => {
    renderSheet({
      error:
        "This slide has no stored content spec — Regenerate the whole deck instead.",
    });
    expect(
      screen.getByText(/no stored content spec/i, { selector: "[role='alert']" }),
    ).toBeTruthy();
  });

  it("still says something when the refusal came with no reason attached", () => {
    renderSheet({ error: "" });
    expect(
      screen.getByText("This slide couldn't be regenerated.", {
        selector: "[role='alert']",
      }),
    ).toBeTruthy();
  });
});
