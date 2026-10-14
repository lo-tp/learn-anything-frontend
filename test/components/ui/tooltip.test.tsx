// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { clip } from "@/test/test-utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * A clipped line with its slip attached. The trigger *is* the line (`asChild`,
 * so the span stays a span and the slip adds no element to the line's layout),
 * and the content is the full text the line could not show.
 *
 * `delayDuration={0}` turns the hover-intent delay off; the default is
 * exercised by its own test below. Whether the line is hiding text is a
 * layout fact jsdom does not have, so `clip()` states it (see test-utils).
 */
function ClippedLine({
  delayDuration,
  title =
    "Introduce the core mechanisms of evolution (variation, selection, " +
    "inheritance) through the concrete case of antibiotic resistance.",
}: {
  delayDuration?: number;
  title?: string;
} = {}) {
  return (
    <Tooltip delayDuration={delayDuration}>
      <TooltipTrigger asChild>
        <span data-testid="line">Introduce the core mechanisms…</span>
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
}

/** Render the line, claim it is (or is not) hiding text, hover it, return both. */
async function hoverForSlip(hidden = true) {
  render(<ClippedLine delayDuration={0} />);
  const line = clip(screen.getByTestId("line"), hidden);
  fireEvent.pointerMove(line);
  const slip = hidden ? await screen.findByRole("tooltip") : null;
  return { line, slip };
}

afterEach(() => {
  cleanup();
});

describe("Tooltip", () => {
  it("keeps the slip closed until the pointer enters the line", () => {
    render(<ClippedLine delayDuration={0} />);
    clip(screen.getByTestId("line"), true);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("opens the slip when the pointer rests on a line that is hiding text", async () => {
    const { slip } = await hoverForSlip();
    expect(slip!.textContent?.replace(/\s+/g, " ").trim()).toContain(
      "antibiotic resistance",
    );
    // A slip opened by hover carries Radix's `delayed-open` state — the name
    // is about the hover-intent path, not about how long it actually waited.
    expect(slip!.getAttribute("data-state")).toBe("delayed-open");
  });

  it("raises nothing for a line that is showing all of its text", async () => {
    const { line } = await hoverForSlip(false);
    // The whole point of the gate: a slip that repeats what the surface
    // already printed is noise, not an annotation.
    fireEvent.pointerMove(line);
    expect(screen.queryByRole("tooltip")).toBeNull();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("closes the slip when the pointer leaves the line — it is not a place the pointer can move into", async () => {
    // The reported bug: hover the line, cross into the slip, cross out of it,
    // and the slip stays. Radix's hoverable content keeps a slip open while a
    // grace-area polygon tracks pointermove on *our* document — but these
    // slips hang over the deck's slide, a cross-origin iframe, and a pointer
    // inside a frame never reaches this document, so nothing ever closes them.
    // The slip is therefore keyed to the line alone: the line's own
    // pointerleave dismisses it, and the content takes no pointer events at all.
    const { line, slip } = await hoverForSlip();
    expect(slip!.className).toContain("pointer-events-none");

    fireEvent.pointerLeave(line);
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  });

  it("closes the slip on Escape", async () => {
    const { slip } = await hoverForSlip();
    fireEvent.keyDown(slip!, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  });

  it("closes the slip when the reader taps the line", async () => {
    const { line } = await hoverForSlip();
    fireEvent.pointerDown(line);
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  });

  it("prints the slip as a sheet: 3px corners, a 1px rule, paper fill, sheet-contact shadow", async () => {
    const { slip } = await hoverForSlip();
    expect(slip!.getAttribute("data-slot")).toBe("tooltip-content");
    expect(slip!.className).toContain("rounded-[3px]");
    expect(slip!.className).toContain("border-outline-variant");
    expect(slip!.className).toContain("bg-surface-container-lowest");
    expect(slip!.className).toContain("shadow-[var(--shadow-sheet)]");
    // No type voice of its own: the surface supplies the voice, so a slip is
    // set exactly as the line it completes is set.
    expect(slip!.className).not.toContain("text-[15px]");
  });

  it("sits centred under the line it annotates, capped at that line's width", async () => {
    const { slip } = await hoverForSlip();
    // Radix reports placement as data attributes. The geometry — the slip's
    // centre on the line's centre — is layout, so it is checked in a real
    // browser rather than claimed here (jsdom lays nothing out).
    expect(slip!.getAttribute("data-side")).toBe("bottom");
    expect(slip!.getAttribute("data-align")).toBe("center");
    // The measure cap: the line's own width, the press's copy column, and the
    // space actually on screen — whichever is smallest.
    expect(slip!.className).toContain(
      "max-w-[min(var(--radix-tooltip-content-available-width),var(--radix-tooltip-trigger-width),36rem)]",
    );
  });

  it("keeps the line itself as the trigger — no new control, no new element", async () => {
    render(<ClippedLine delayDuration={0} />);
    const line = clip(screen.getByTestId("line"), true);
    // The trigger stays the span it was: no button is introduced around it.
    expect(line.tagName).toBe("SPAN");
    expect(screen.queryByRole("button")).toBeNull();
    expect(line.getAttribute("data-slot")).toBe("tooltip-trigger");
    fireEvent.pointerMove(line);
    const slip = await screen.findByRole("tooltip");
    // The slip is portalled out of the line's own ancestors.
    expect(line.contains(slip)).toBe(false);
  });

  it("waits for the hover-intent delay before opening", async () => {
    render(<ClippedLine />);
    const line = clip(screen.getByTestId("line"), true);
    fireEvent.pointerMove(line);
    // The delay is real time: the slip is not there on the pointer's first
    // touch… (which is what keeps a swept-past line from raising one)
    expect(screen.queryByRole("tooltip")).toBeNull();
    // …and it is once the pointer has actually rested there.
    expect(
      await screen.findByRole("tooltip", {}, { timeout: 3000 }),
    ).toBeTruthy();
  });

  it("refuses a trigger with no Tooltip to belong to", () => {
    // The gate is the whole point of the pairing: a bare trigger has no one to
    // ask whether its line is clipping, so it is an error, not a silent no-op.
    const errors = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    try {
      expect(() =>
        render(
          <TooltipTrigger asChild>
            <span>Orphan line…</span>
          </TooltipTrigger>,
        ),
      ).toThrow(/TooltipTrigger` must be used within `Tooltip/);
    } finally {
      errors.mockRestore();
    }
  });

  it("lets a surface keep its own handle on the clipped line", () => {
    // The trigger's ref is the primitive's (it feeds the clip gate); a surface
    // that also wants the element gets it too — either kind of ref.
    const seen: HTMLElement[] = [];
    const objectRef = React.createRef<HTMLButtonElement>();
    render(
      <>
        <Tooltip delayDuration={0}>
          <TooltipTrigger
            asChild
            ref={(el) => {
              if (el) seen.push(el);
            }}
          >
            <span data-testid="callback">First clipped line…</span>
          </TooltipTrigger>
          <TooltipContent>First full title</TooltipContent>
        </Tooltip>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild ref={objectRef}>
            <span data-testid="object">Second clipped line…</span>
          </TooltipTrigger>
          <TooltipContent>Second full title</TooltipContent>
        </Tooltip>
      </>,
    );
    expect(seen).toEqual([screen.getByTestId("callback")]);
    expect(objectRef.current).toBe(screen.getByTestId("object"));
  });

  it("keeps one slip open at a time across a surface full of clipped lines", async () => {
    // The rail case: many dividers, each with its own slip.
    render(
      <>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <span data-testid="a">First line…</span>
          </TooltipTrigger>
          <TooltipContent>First full title</TooltipContent>
        </Tooltip>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <span data-testid="b">Second line…</span>
          </TooltipTrigger>
          <TooltipContent>Second full title</TooltipContent>
        </Tooltip>
      </>,
    );
    clip(screen.getByTestId("a"), true);
    clip(screen.getByTestId("b"), true);
    fireEvent.pointerMove(screen.getByTestId("a"));
    const first = await screen.findByRole("tooltip");
    expect(first.textContent).toContain("First full title");
    expect(screen.getAllByRole("tooltip")).toHaveLength(1);

    // Hovering the other line moves the slip — the surface never holds two.
    fireEvent.pointerMove(screen.getByTestId("b"));
    const second = await screen.findByText("Second full title");
    expect(second.getAttribute("role")).toBe("tooltip");
    expect(second).not.toBe(first);
    expect(screen.getAllByRole("tooltip")).toHaveLength(1);
  });
});
