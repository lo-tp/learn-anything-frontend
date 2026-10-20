/**
 * The same module with no browser.
 *
 * Deliberately not a jsdom file: `components/visual-viewport.tsx` is a client
 * component, which means this module is loaded on the server too, whenever the
 * root layout renders a page. A browser authority that assumes a browser is how
 * a static shell stops being one (#87: every page here is prerendered, and the
 * measurement only ever starts in an effect).
 */
import { describe, expect, it } from "vitest";
import {
  measureVisualViewport,
  onVisualViewportChange,
  startVisualViewport,
} from "@/lib/visual-viewport";

describe("visual-viewport without a browser", () => {
  it("has no window to measure", () => {
    expect(typeof window).toBe("undefined");
  });

  it("starts and stops without a window, publishing nothing", () => {
    const stop = startVisualViewport();
    expect(typeof stop).toBe("function");
    expect(() => stop()).not.toThrow();
    // Releasing twice is the same as releasing once — the holder count cannot
    // go negative and take a later holder's measurement down with it.
    expect(() => stop()).not.toThrow();
  });

  it("holds a listener with nothing to tell it", () => {
    let called = 0;
    const unsubscribe = onVisualViewportChange(() => {
      called += 1;
    });
    expect(called).toBe(0);
    unsubscribe();
    expect(() => unsubscribe()).not.toThrow();
  });

  it("still measures what it is handed", () => {
    expect(
      measureVisualViewport({
        innerHeight: 844,
        visualViewport: { height: 514, offsetTop: 37 },
      }),
    ).toEqual({ heightPx: 514, offsetTopPx: 37, roomTakenByBrowserPx: 330 });
  });
});
