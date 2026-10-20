// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { cleanup, screen, fireEvent } from "@testing-library/react";
import { renderWithLocale } from "@/test/test-utils";
import { GoToSlideDialog } from "@/components/session/go-to-slide";

const noop = () => {};

/** The bar's default actions; the dialog's own callbacks come from props. */
function dialogProps(
  overrides: Partial<ComponentProps<typeof GoToSlideDialog>> = {},
) {
  return {
    open: true,
    onOpenChange: noop,
    index: 1,
    total: 7,
    onGoTo: noop,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("GoToSlideDialog (#229)", () => {
  it("lists every page as a button, zero-padded like the footer counter", () => {
    renderWithLocale(<GoToSlideDialog {...dialogProps({ total: 7 })} />);
    expect(
      screen.getByRole("heading", { name: /go to a slide/i }),
    ).toBeTruthy();
    for (let n = 1; n <= 7; n += 1) {
      expect(
        screen.getByRole("button", { name: new RegExp(`^page ${n}$`, "i") }),
      ).toBeTruthy();
    }
    // The printed page numbers are zero-padded, like the form page number.
    expect(screen.getByRole("button", { name: /^page 1$/i }).textContent)
      .toContain("01");
    expect(screen.getByRole("button", { name: /^page 7$/i }).textContent)
      .toContain("07");
  });

  it("marks the page the reader is on", () => {
    renderWithLocale(<GoToSlideDialog {...dialogProps({ index: 4 })} />);
    expect(
      screen
        .getByRole("button", { name: /^page 4$/i })
        .getAttribute("aria-current"),
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: /^page 3$/i })
        .getAttribute("aria-current"),
    ).toBeNull();
  });

  it("goes to the picked page and closes", () => {
    const onGoTo = vi.fn();
    const onOpenChange = vi.fn();
    renderWithLocale(
      <GoToSlideDialog {...dialogProps({ onGoTo, onOpenChange })} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^page 5$/i }));
    expect(onGoTo).toHaveBeenCalledTimes(1);
    expect(onGoTo).toHaveBeenCalledWith(5);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("goes to the typed page on submit and closes", () => {
    const onGoTo = vi.fn();
    const onOpenChange = vi.fn();
    renderWithLocale(
      <GoToSlideDialog {...dialogProps({ onGoTo, onOpenChange })} />,
    );
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.submit(input.closest("form")!);
    expect(onGoTo).toHaveBeenCalledWith(5);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("clamps a typed page to the deck's ends", () => {
    const onGoTo = vi.fn();
    renderWithLocale(<GoToSlideDialog {...dialogProps({ onGoTo })} />);
    const input = screen.getByRole("spinbutton");

    fireEvent.change(input, { target: { value: "99" } });
    fireEvent.submit(input.closest("form")!);
    expect(onGoTo).toHaveBeenLastCalledWith(7);

    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.submit(input.closest("form")!);
    expect(onGoTo).toHaveBeenLastCalledWith(1);
  });

  it("says so, in the dialog, when the typed page is not a page", () => {
    const onGoTo = vi.fn();
    renderWithLocale(<GoToSlideDialog {...dialogProps({ onGoTo })} />);
    const input = screen.getByRole("spinbutton");

    // An empty box holds no page.
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.submit(input.closest("form")!);
    expect(onGoTo).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeTruthy();
    // The dialog stayed open — the reader is still mid-ask.
    expect(
      screen.getByRole("heading", { name: /go to a slide/i }),
    ).toBeTruthy();

    // A fractional page is not a page either: it is refused, not walked
    // down to page 5.
    fireEvent.change(input, { target: { value: "5.5" } });
    fireEvent.submit(input.closest("form")!);
    expect(onGoTo).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("clears the refusal once the reader types again", () => {
    const onGoTo = vi.fn();
    renderWithLocale(<GoToSlideDialog {...dialogProps({ onGoTo })} />);
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.submit(input.closest("form")!);
    expect(screen.getByRole("alert")).toBeTruthy();

    fireEvent.change(input, { target: { value: "2" } });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("starts the input on the page the reader is on", () => {
    // A fresh mount per ask is the view's job; the dialog's own job is that
    // the box it is given starts where the reader is.
    renderWithLocale(<GoToSlideDialog {...dialogProps({ index: 3 })} />);
    expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe("3");
  });

  it("closes from its own close button without going anywhere", () => {
    const onGoTo = vi.fn();
    const onOpenChange = vi.fn();
    renderWithLocale(
      <GoToSlideDialog {...dialogProps({ onGoTo, onOpenChange })} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^close$/i }));
    expect(onGoTo).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
