// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderWithLocale } from "@/test/test-utils";
import { ThemeToggle } from "@/components/theme-toggle";

const TOGGLE_NAME = "Toggle theme";

function setHtmlClass(theme: "light" | "dark" | null) {
  document.documentElement.classList.remove("light", "dark");
  if (theme) document.documentElement.classList.add(theme);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  setHtmlClass(null);
  localStorage.clear();
});

describe("ThemeToggle", () => {
  it("renders with the translated aria-label", () => {
    renderWithLocale(<ThemeToggle />);
    expect(screen.getByRole("button", { name: TOGGLE_NAME })).toBeTruthy();
  });

  it("uses the Chinese label in the zh locale", () => {
    renderWithLocale(<ThemeToggle />, { locale: "zh" });
    expect(screen.getByRole("button", { name: "切换主题" })).toBeTruthy();
  });

  it("shows Sun in dark mode", () => {
    setHtmlClass("dark");
    renderWithLocale(<ThemeToggle />);
    const icon = screen
      .getByRole("button", { name: TOGGLE_NAME })
      .querySelector("svg");
    // The Sun icon contains a <circle>; the Moon icon is a single path.
    expect(icon?.querySelector("circle")).toBeTruthy();
  });

  it("shows Moon in light mode", () => {
    setHtmlClass("light");
    renderWithLocale(<ThemeToggle />);
    const icon = screen
      .getByRole("button", { name: TOGGLE_NAME })
      .querySelector("svg");
    expect(icon?.querySelector("circle")).toBeNull();
  });

  it("clicking toggles the html class and persists the choice", () => {
    setHtmlClass("dark");
    renderWithLocale(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: TOGGLE_NAME }));
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("la:theme")).toBe("light");
  });
});
