// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, renderHook } from "@testing-library/react";
import { useTheme, type Theme } from "@/hooks/use-theme";

const STORAGE_KEY = "la:theme";

function setHtmlClass(theme: "light" | "dark" | null) {
  document.documentElement.classList.remove("light", "dark");
  if (theme) document.documentElement.classList.add(theme);
}

/**
 * Stub the OS preference. jsdom has no `matchMedia`, so every test that
 * reaches the system-setting branch (no class on <html>, no usable stored
 * value) needs a deterministic stand-in.
 */
function mockSystemPreference(light: boolean) {
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: light }));
}

beforeEach(() => {
  setHtmlClass(null);
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  setHtmlClass(null);
  localStorage.clear();
});

describe("useTheme", () => {
  it("first render is the SSR theme (dark), then adopts the DOM class", () => {
    // The DOM already says light (as the pre-paint script would have set it),
    // but the first client render must match the server HTML (dark) or the
    // hydration mismatch regenerates the tree and wipes the class.
    setHtmlClass("light");
    const rendered: Theme[] = [];
    function Recorder() {
      rendered.push(useTheme().theme);
      return null;
    }
    render(<Recorder />);
    expect(rendered[0]).toBe("dark");
    expect(rendered[rendered.length - 1]).toBe("light");
  });

  it("adopts the DOM class after mount", () => {
    setHtmlClass("light");
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("light");

    cleanup();
    setHtmlClass("dark");
    const { result: dark } = renderHook(() => useTheme());
    expect(dark.current.theme).toBe("dark");
  });

  it("re-applies the class and uses the stored preference when the DOM has none", () => {
    localStorage.setItem(STORAGE_KEY, "light");
    mockSystemPreference(false); // OS says dark — the stored choice must win.
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);
  });

  it("falls back to the OS setting when no class or stored value applies", () => {
    mockSystemPreference(true);
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);

    cleanup();
    setHtmlClass(null);
    mockSystemPreference(false);
    const { result: dark } = renderHook(() => useTheme());
    expect(dark.current.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("falls back to the OS setting for a corrupt stored value", () => {
    localStorage.setItem(STORAGE_KEY, "bogus");
    mockSystemPreference(true);
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("light");
  });

  it("toggle flips the html class and persists the choice", () => {
    setHtmlClass("dark");
    const { result } = renderHook(() => useTheme());
    act(() => result.current.toggle());
    expect(result.current.theme).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("light");
  });

  it("setTheme applies and persists an explicit theme", () => {
    setHtmlClass("light");
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme("dark"));
    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");
  });

  it("does not throw when storage read/write fails (session-only preference)", () => {
    // Both access paths can throw (e.g. blocked in private mode).
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    mockSystemPreference(true);

    const { result } = renderHook(() => useTheme());
    // Mount sync's read failure falls through to the OS setting.
    expect(result.current.theme).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);

    // Write failure still swaps the class and updates state.
    act(() => result.current.toggle());
    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(setItem).toHaveBeenCalled();
  });
});
