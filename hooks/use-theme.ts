"use client";

import { useCallback, useState } from "react";

/** The two themes the app supports. */
export type Theme = "light" | "dark";

/** The localStorage key holding the user's theme choice. */
const STORAGE_KEY = "la:theme";

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark";
}

/**
 * Resolve the current theme, in the same order the pre-paint script in
 * `app/[locale]/layout.tsx` uses: the class already on `<html>`, then the
 * stored preference, then the OS `prefers-color-scheme`, then dark as the
 * last resort (matches the no-class / no-JS fallback).
 */
function resolveTheme(): Theme {
  const classes = document.documentElement.classList;
  if (classes.contains("light")) return "light";
  if (classes.contains("dark")) return "dark";
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
 * The SSR-safe initial state is `dark`; on the client it reads the actual
 * state from `documentElement`'s class — set by the pre-paint script before
 * hydration — so there is no flash and no mismatch between React's state
 * and the DOM.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() =>
    typeof document === "undefined" ? "dark" : resolveTheme(),
  );

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
