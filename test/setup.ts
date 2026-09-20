import { vi } from "vitest";

// jsdom doesn't implement Element#scrollIntoView. Give it a mock so
// components that call it (e.g. the session sidebar scrolling its active
// card into view, #81) work under test; tests assert on it via
// `vi.mocked(HTMLElement.prototype.scrollIntoView)`. Node-environment test
// files have no DOM globals — skip them.
if (typeof HTMLElement !== "undefined") {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    value: vi.fn(),
    writable: true,
    configurable: true,
  });

  // Node ≥ 26 exposes its own `localStorage` global (disabled unless
  // --localstorage-file is given), which shadows jsdom's storage before
  // vitest copies window keys over. Point the global at jsdom's Storage so
  // tests exercise real storage semantics. `globalThis.jsdom` is set by
  // vitest's jsdom environment only — node-environment files skip this.
  const jsdom = (globalThis as { jsdom?: { window: { localStorage: Storage } } })
    .jsdom;
  if (jsdom) {
    Object.defineProperty(globalThis, "localStorage", {
      value: jsdom.window.localStorage,
      writable: true,
      configurable: true,
    });
  }
}
