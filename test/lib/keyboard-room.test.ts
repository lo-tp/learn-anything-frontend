import { describe, expect, it } from "vitest";
import { measureRoomShortfall } from "@/lib/keyboard-room";

/**
 * The measure seam: given what a pane reports about its own content and the room
 * it shows that content through, how much of the content is below the room — out
 * of reach, and what an on-screen keyboard covering that stretch is hiding?
 *
 * The expected values are worked examples, not recomputations, on the iPhone 14
 * the report came from: an 844px layout viewport, 514px of it left above the
 * keyboard, the intake sheet's pinned band taking 150px of that, so the record
 * reaches its reader through a 364px pane.
 */
describe("measureRoomShortfall", () => {
  it("states how far a record reaches past the room its pane has", () => {
    expect(
      measureRoomShortfall({
        contentHeightPx: 1200,
        visibleHeightPx: 364,
      }),
    ).toBe(836);
  });

  it("states nothing where the room shows the whole record", () => {
    // The keyboard is out — and the sheet has the record, the open ask and the
    // field being filled all above it. There is nothing to reach for, so nothing
    // is padded and nothing is scrolled.
    expect(
      measureRoomShortfall({
        contentHeightPx: 300,
        visibleHeightPx: 364,
      }),
    ).toBe(0);
  });

  it("reads a room exactly as tall as its record as showing all of it", () => {
    expect(
      measureRoomShortfall({
        contentHeightPx: 364,
        visibleHeightPx: 364,
      }),
    ).toBe(0);
  });

  it("reads a two-pixel disagreement as a rounding gap, not a hidden item", () => {
    // A pane's measurements are rounded, so settled content can report itself a
    // couple of pixels longer than the room it fits in. Calling that hidden would
    // scroll the pane and move the reader; leaving it is two pixels of one line.
    expect(
      measureRoomShortfall({
        contentHeightPx: 366,
        visibleHeightPx: 364,
      }),
    ).toBe(0);
  });

  it("states a record that genuinely reaches past its room", () => {
    expect(
      measureRoomShortfall({
        contentHeightPx: 400,
        visibleHeightPx: 364,
      }),
    ).toBe(36);
  });
});
