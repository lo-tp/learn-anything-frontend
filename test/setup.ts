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
}
