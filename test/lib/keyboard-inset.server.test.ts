// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { onKeyboardInsetChange } from "@/lib/keyboard-inset";

/**
 * The same module is imported by client components during the server render
 * (#87: the pages are static shells). Nothing in it may reach for a window at
 * import time, or when one is not there.
 */
describe("the keyboard inset with no browser", () => {
  it("holds nothing and tells no one", () => {
    const listener = vi.fn();

    const unsubscribe = onKeyboardInsetChange(listener);

    expect(listener).not.toHaveBeenCalled();

    unsubscribe();
  });
});
