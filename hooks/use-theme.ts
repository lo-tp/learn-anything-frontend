"use client";

import { useCallback, useLayoutEffect, useState } from "react";

/** The two themes the app supports. */
export type Theme = "light" | "dark";

/** The localStorage key holding the user's theme choice. */
const STORAGE_KEY = "la:theme";

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark";
}

/** The theme carried by `<html>`'s class, or `null` if neither is present. */
function domTheme(): Theme | null {
  const classes = document.documentElement.classList;
  if (classes.contains("light")) return "light";
  if (classes.contains("dark")) return "dark";
  return null;
}

/**
 * Resolve a theme from the stored preference, then the OS
 * `prefers-color-scheme`, then dark as the last resort — the same fallback
 * chain the pre-paint script uses when no class is on `<html>` yet.
 */
function resolveTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isTheme(stored)) return stored;
  } catch {
    // Storage unavailable (e.g. blocked in private mode) — fall through.
  }
  try {
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  } catch {
    return "dark";
  }
}

/**
 * App theme state, backed by the `light`/`dark` class on `<html>`.
 *
 * The initial state is always `dark` — the SSR theme. It must NOT read the
 * pre-paint script's DOM state during the first render: that would make the
 * client's first render differ from the server HTML (e.g. Sun vs Moon icon
 * in ThemeToggle), a structural hydration mismatch React can't suppress,
 * which regenerates the whole tree from the root and wipes the script's
 * class off `<html>`.
 *
 * Instead the theme is adopted after hydration, in a `useLayoutEffect` that
 * runs before paint — no flash, no mismatch. If the class is missing (dev
 * Strict Mode remounts reset `<html>` to the JSX-managed attributes), it is
 * re-applied from state so state stays the source of truth.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("dark");

  useLayoutEffect(() => {
    const dom = domTheme();
    const actual = dom ?? resolveTheme();
    if (dom === null) {
      document.documentElement.classList.add(actual);
    }
    // Intentional: adopt the pre-paint script's theme once, after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState((prev) => (prev === actual ? prev : actual));
  }, []);

  const setTheme = useCallback((next: Theme) => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable (e.g. private mode) — the choice degrades to
      // session-only; the class still carries it for the rest of the page.
    }
    setThemeState(next);
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  return { theme, setTheme, toggle };
}
