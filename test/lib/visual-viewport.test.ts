// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubVisualViewport, type StubbedVisualViewport } from "@/test/test-utils";
import {
  measureVisualViewport,
  onVisualViewportChange,
  startVisualViewport,
} from "@/lib/visual-viewport";

/** The stand-in the current test installed, so the next one starts clean. */
let stub: StubbedVisualViewport | undefined;

function stubWindow(options: {
  innerHeight: number;
  height: number;
  offsetTop: number;
}) {
  stub = stubVisualViewport(options);
  return stub;
}

/** The two properties the measure is published as. */
function published() {
  const style = document.documentElement.style;
  return {
    height: style.getPropertyValue("--visual-viewport-height"),
    offsetTop: style.getPropertyValue("--visual-viewport-offset-top"),
  };
}

afterEach(() => {
  stub?.restore();
  stub = undefined;
  document.documentElement.style.removeProperty("--visual-viewport-height");
  document.documentElement.style.removeProperty("--visual-viewport-offset-top");
});

describe("measureVisualViewport", () => {
  it("measures the room on screen, not the room the layout viewport reserved", () => {
    // The iOS case (#230): the layout viewport is still 844px tall with the
    // keyboard up; 514px of it is what the learner can actually see.
    expect(
      measureVisualViewport({
        innerHeight: 844,
        visualViewport: { height: 514, offsetTop: 0 },
      }),
    ).toEqual({ heightPx: 514, offsetTopPx: 0 });
  });

  it("keeps the room the browser has panned away", () => {
    // A browser that pans the layout viewport to chase a focused field leaves
    // the top 37px of it above the screen; the room starts below that.
    expect(
      measureVisualViewport({
        innerHeight: 844,
        visualViewport: { height: 514, offsetTop: 37 },
      }),
    ).toEqual({ heightPx: 514, offsetTopPx: 37 });
  });

  it("never claims more room than the layout viewport has", () => {
    expect(
      measureVisualViewport({
        innerHeight: 844,
        visualViewport: { height: 900, offsetTop: 0 },
      }),
    ).toEqual({ heightPx: 844, offsetTopPx: 0 });
  });

  it("measures the layout viewport where there is no visual-viewport API", () => {
    expect(measureVisualViewport({ innerHeight: 900 })).toEqual({
      heightPx: 900,
      offsetTopPx: 0,
    });
  });

  it("refuses to measure an empty room", () => {
    // A mid-transition zero is not a surface any sheet could be sized to.
    expect(
      measureVisualViewport({
        innerHeight: 844,
        visualViewport: { height: 0, offsetTop: 0 },
      }),
    ).toBeNull();
    expect(measureVisualViewport({ innerHeight: 0 })).toBeNull();
  });
});

describe("startVisualViewport", () => {
  it("publishes the measure now and on every change to it", () => {
    const stub = stubWindow({ innerHeight: 844, height: 844, offsetTop: 0 });
    const stop = startVisualViewport();
    expect(published()).toEqual({ height: "844px", offsetTop: "0px" });

    stub.resizeTo({ height: 514, offsetTop: 37 });
    expect(published()).toEqual({ height: "514px", offsetTop: "37px" });

    stop();
  });

  it("follows the browser panning the page, which moves the room without resizing it", () => {
    const stub = stubWindow({ innerHeight: 844, height: 844, offsetTop: 0 });
    const stop = startVisualViewport();

    stub.panTo(37);
    // The room is the same height; it has simply moved down the page.
    expect(published()).toEqual({ height: "844px", offsetTop: "37px" });

    stop();
  });

  it("measures the layout viewport through the window's own resize where there is no visual-viewport API", () => {
    Object.defineProperty(window, "innerHeight", {
      value: 768,
      configurable: true,
    });
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const stop = startVisualViewport();
    const call = addSpy.mock.calls.find(([type]) => type === "resize");
    expect(typeof call?.[1]).toBe("function");
    expect(published()).toEqual({ height: "768px", offsetTop: "0px" });

    Object.defineProperty(window, "innerHeight", {
      value: 640,
      configurable: true,
    });
    (call?.[1] as EventListener)(new Event("resize"));
    expect(published()).toEqual({ height: "640px", offsetTop: "0px" });

    stop();
    expect(removeSpy).toHaveBeenCalledWith("resize", expect.any(Function));
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("holds one measurement when it is started twice", () => {
    const stub = stubWindow({ innerHeight: 844, height: 844, offsetTop: 0 });
    const first = startVisualViewport();
    const second = startVisualViewport();
    // Mounting the shell's measure twice — a remount, a second layout — joins
    // the measurement rather than starting another one or re-measuring.
    expect(stub.added).toEqual(["resize", "scroll"]);

    stub.resizeTo({ height: 514 });
    expect(published().height).toBe("514px");

    // One holder leaving leaves the measurement running for the other.
    first();
    stub.resizeTo({ height: 700 });
    expect(published().height).toBe("700px");

    // The last one leaving is what stops the watching.
    second();
    stub.resizeTo({ height: 844 });
    expect(published().height).toBe("700px");
  });

  it("stops listening when the last holder leaves", () => {
    const stub = stubWindow({ innerHeight: 844, height: 844, offsetTop: 0 });
    const stop = startVisualViewport();
    expect(stub.handlers.size).toBe(2); // resize + scroll
    stop();
    expect(stub.handlers.size).toBe(0);
  });
});

describe("onVisualViewportChange", () => {
  it("reports the current measure first, then every change", () => {
    const stub = stubWindow({ innerHeight: 844, height: 844, offsetTop: 0 });
    const seen = vi.fn();
    const unsubscribe = onVisualViewportChange(seen);
    // A subscriber is told where the room is before it can be told it moved.
    expect(seen).toHaveBeenCalledWith({ heightPx: 844, offsetTopPx: 0 });

    stub.resizeTo({ height: 514, offsetTop: 0 });
    expect(seen).toHaveBeenLastCalledWith({ heightPx: 514, offsetTopPx: 0 });

    unsubscribe();
    stub.resizeTo({ height: 400, offsetTop: 0 });
    expect(seen).toHaveBeenCalledTimes(2);
  });

  it("shares one measurement between holders", () => {
    const stub = stubWindow({ innerHeight: 844, height: 844, offsetTop: 0 });
    const first = vi.fn();
    const second = vi.fn();
    const stop = startVisualViewport();
    const offFirst = onVisualViewportChange(first);
    const offSecond = onVisualViewportChange(second);
    // `start` installed the listeners; the subscribers joined the measurement
    // rather than each installing their own.
    expect(stub.added).toEqual(["resize", "scroll"]);

    stub.resizeTo({ height: 514, offsetTop: 0 });
    expect(first).toHaveBeenLastCalledWith({ heightPx: 514, offsetTopPx: 0 });
    expect(second).toHaveBeenLastCalledWith({ heightPx: 514, offsetTopPx: 0 });

    offFirst();
    offSecond();
    stop();
  });

  it("keeps the measurement running while a listener is held", () => {
    const stub = stubWindow({ innerHeight: 844, height: 844, offsetTop: 0 });
    const unsubscribe = onVisualViewportChange(vi.fn());
    expect(stub.handlers.size).toBe(2);
    unsubscribe();
    // The last holder leaving takes the listeners with it.
    expect(stub.handlers.size).toBe(0);
  });

  it("publishes what it measures, so the shell and a subscriber read one value", () => {
    const stub = stubWindow({ innerHeight: 844, height: 844, offsetTop: 0 });
    const unsubscribe = onVisualViewportChange(vi.fn());
    stub.resizeTo({ height: 514, offsetTop: 0 });
    expect(published().height).toBe("514px");
    unsubscribe();
  });
});
