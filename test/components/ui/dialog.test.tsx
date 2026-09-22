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
});
