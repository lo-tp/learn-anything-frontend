// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { measureKeyboardInset, onKeyboardInsetChange } from "@/lib/keyboard-inset";
import { stubVisualViewport } from "@/test/test-utils";

/**
 * The measure seam: given what a browser reports about its two viewports, how
 * much of the screen has the on-screen keyboard covered?
 *
 * The expected values are worked examples, not recomputations: an iPhone 14
 * layout viewport is 844px tall and its keyboard, with the suggestion bar above
 * the keys, leaves 514px of it on screen — 330px is the room a surface has to
 * get out of the way of.
 */
describe("measureKeyboardInset", () => {
  it("reports the room an opened keyboard covers", () => {
    expect(
      measureKeyboardInset({
        innerHeight: 844,
        visualViewport: { height: 514, scale: 1 },
      }),
    ).toBe(330);
  });

  it("reports nothing when the keyboard is out", () => {
    expect(
      measureKeyboardInset({
        innerHeight: 844,
        visualViewport: { height: 844, scale: 1 },
      }),
    ).toBe(0);
  });

  it("reads a zoomed page as a page, not as a keyboard", () => {
    // Pinch-zooming shrinks the visual viewport while leaving the layout
    // viewport alone too — the same reading as a keyboard, and nothing a surface
    // should reserve room for.
    expect(
      measureKeyboardInset({
        innerHeight: 844,
        visualViewport: { height: 422, scale: 2 },
      }),
    ).toBe(0);
  });

  it("treats a sub-pixel disagreement as a browser mid-transition", () => {
    expect(
      measureKeyboardInset({
        innerHeight: 844,
        visualViewport: { height: 843.2, scale: 1 },
      }),
    ).toBe(0);
  });
});

/**
 * The follow seam: the one every surface that acts on the room uses.
 */
describe("following the keyboard inset", () => {
  afterEach(() => {
    delete (window as unknown as { visualViewport?: unknown }).visualViewport;
  });

  it("tells a follower where the room is, then on every change", () => {
    const stub = stubVisualViewport({ innerHeight: 844, height: 514 });
    const seen = vi.fn();

    // A surface joining a page that is already measuring is told the room it
    // has: a follower that only ever reacts to the inset *growing* never learns
    // the keyboard was up before it mounted (#230).
    const unsubscribe = onKeyboardInsetChange(seen);
    expect(seen).toHaveBeenCalledWith(330);

    stub.resizeTo({ height: 844 });
    expect(seen).toHaveBeenLastCalledWith(0);

    unsubscribe();
    stub.resizeTo({ height: 514 });
    expect(seen).toHaveBeenCalledTimes(2);

    stub.restore();
  });

  it("leaves nothing behind when the last follower goes", () => {
    const stub = stubVisualViewport({ innerHeight: 844, height: 844 });
    const unsubscribe = onKeyboardInsetChange(vi.fn());

    expect([...stub.handlers.keys()]).toEqual(["resize"]);

    unsubscribe();
    expect(stub.handlers.size).toBe(0);

    // Nothing is measuring any more, so a keyboard opening reaches no one.
    const late = vi.fn();
    stub.resizeTo({ height: 514 });
    const followAgain = onKeyboardInsetChange(late);
    // …and a follower that arrives after the room changed measures it again
    // rather than repeating a value the page no longer holds.
    expect(late).toHaveBeenCalledWith(330);

    followAgain();
    stub.restore();
  });

  it("holds one measurement for every follower", () => {
    const stub = stubVisualViewport({ innerHeight: 844, height: 514 });
    const first = vi.fn();
    const stopFirst = onKeyboardInsetChange(first);

    // A second holder joins a measurement that is already running: it is told
    // where the room is, and the page does not install a second browser
    // listener for it.
    const second = vi.fn();
    const stopSecond = onKeyboardInsetChange(second);
    expect(second).toHaveBeenCalledWith(330);
    expect([...stub.handlers.keys()]).toEqual(["resize"]);

    stub.resizeTo({ height: 844 });
    expect(first).toHaveBeenLastCalledWith(0);
    expect(second).toHaveBeenLastCalledWith(0);

    // Letting go of one holder leaves the other measuring.
    stopFirst();
    stub.resizeTo({ height: 514 });
    expect(second).toHaveBeenLastCalledWith(330);

    stopSecond();
    stub.restore();
  });

  it("releases once, so a cleanup that runs twice cannot take the measurement from another holder", () => {
    // React Strict Mode runs an effect's cleanup twice in development; a second
    // release is inert rather than a second decrement.
    const stub = stubVisualViewport({ innerHeight: 844, height: 844 });
    const stop = onKeyboardInsetChange(vi.fn());
    const keep = vi.fn();
    const stopKeep = onKeyboardInsetChange(keep);

    stop();
    stop();

    stub.resizeTo({ height: 514 });
    expect(keep).toHaveBeenLastCalledWith(330);

    stopKeep();
    stub.restore();
  });

  it("follows a room it cannot measure as a room with nothing covering it", () => {
    // jsdom reports no `window.visualViewport`, which is the honest stand-in for
    // a browser that reports none: the layout viewport is the whole room.
    const seen = vi.fn();
    const unsubscribe = onKeyboardInsetChange(seen);

    expect(seen).toHaveBeenCalledWith(0);

    window.dispatchEvent(new Event("resize"));
    expect(seen).toHaveBeenLastCalledWith(0);

    unsubscribe();
  });
});
