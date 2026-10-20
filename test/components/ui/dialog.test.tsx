// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

afterEach(() => {
  cleanup();
});

describe("Dialog", () => {
  it("renders an open content with the default close button", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Default</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    // The default close button is rendered (X icon with sr-only label).
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
  });

  it("omits the close button when showCloseButton is false", () => {
    render(
      <Dialog open>
        <DialogContent showCloseButton={false}>
          <DialogTitle>No close</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });

  it("renders the footer close button when showCloseButton is true", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Footer</DialogTitle>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>,
    );
    // The content's default close button plus the footer's close button.
    expect(screen.getAllByRole("button", { name: "Close" })).toHaveLength(2);
  });

  it("opens from a DialogTrigger", async () => {
    render(
      <Dialog>
        <DialogTrigger asChild>
          <button type="button">Open dialog</button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Triggered</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open dialog" }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });

  // The room a sheet is placed in is the visible viewport — what is on screen
  // after the browser's own furniture (#230). jsdom has no layout, so these
  // guard the placement itself: the measure a sheet is sized from.
  it("places a centred sheet in the middle of the visible viewport, capped to it", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Centred</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    const sheet = document.querySelector(
      '[data-slot="dialog-content"]',
    ) as HTMLElement;
    // The scrim behind it covers the same room, not the layout viewport.
    const scrim = document.querySelector('[data-slot="dialog-overlay"]') as HTMLElement;
    expect(scrim.classList.contains("h-[var(--visual-viewport-height)]")).toBe(true);
    expect(scrim.classList.contains("inset-0")).toBe(false);
    const placed = (name: string) => sheet.classList.contains(name);
    expect(placed("top-[var(--visual-viewport-centre)]")).toBe(true);
    expect(placed("max-h-[var(--visual-viewport-sheet-max-height)]")).toBe(true);
    // A sheet with no room left to be centred in scrolls instead of running
    // off the screen.
    expect(placed("overflow-y-auto")).toBe(true);
    // Nothing here is stated in viewport units: on iOS `100dvh` and `top-1/2`
    // describe the layout viewport, which keeps its height when the keyboard
    // opens, and a sheet placed against it ends under the keyboard.
    expect(sheet.className).not.toMatch(/\b(top|left|h|w)-\[?\d+d?vh\]/);
    expect(sheet.className).not.toContain("top-1/2");
  });

  it("places a full-bleed sheet across the visible viewport", () => {
    render(
      <Dialog open>
        <DialogContent placement="full-bleed" showCloseButton={false}>
          <DialogTitle>Full bleed</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    const sheet = document.querySelector(
      '[data-slot="dialog-content"]',
    ) as HTMLElement;
    const placed = (name: string) => sheet.classList.contains(name);
    expect(placed("top-[var(--visual-viewport-offset-top)]")).toBe(true);
    expect(placed("h-[var(--visual-viewport-height)]")).toBe(true);
    // The full-bleed surface *is* the room, so the placement gives it the shape
    // that follows: no corners, no border, no padding of its own.
    expect(placed("rounded-none")).toBe(true);
    expect(placed("border-0")).toBe(true);
    expect(placed("p-0")).toBe(true);
    // Neither centred nor capped: it owns its own scrolling.
    expect(placed("top-[var(--visual-viewport-centre)]")).toBe(false);
    expect(placed("max-h-[var(--visual-viewport-sheet-max-height)]")).toBe(false);
    expect(placed("-translate-y-1/2")).toBe(false);
  });
});
