"use client";

import { useCallback, useLayoutEffect, useSyncExternalStore } from "react";

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
 * The app's single theme source of truth, shared by every `useTheme`
 * consumer (the top-bar toggle, the session's iframe srcs, …).
 *
 * It starts at `dark` — the SSR theme. It must NOT read the pre-paint
 * script's DOM state during the first render: that would make the client's
 * first render differ from the server HTML (e.g. Sun vs Moon icon in
 * ThemeToggle), a structural hydration mismatch React can't suppress,
 * which regenerates the whole tree from the root and wipes the script's
 * class off `<html>`. Instead the theme is adopted after hydration, in a
 * `useLayoutEffect` that runs before paint — no flash, no mismatch. If the
 * class is missing (dev Strict Mode remounts reset `<html>` to the
 * JSX-managed attributes), it is re-applied from state.
 *
 * State lives in module scope (not `useState`) so that every hook instance
 * subscribes to the same value: a `setTheme` call in one component
 * re-renders all others, keeping the DOM class, the state, and every
 * consumer in sync.
 */
let theme: Theme = "dark";
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Theme {
  return theme;
}

/**
 * The snapshot React reads during server rendering. Always `dark` — the
 * SSR theme the first client render must match to avoid a hydration
 * mismatch. (Required by `useSyncExternalStore` for server-rendered
 * content; without it React throws during SSR.)
 */
function getServerSnapshot(): Theme {
  return "dark";
}

function emit() {
  listeners.forEach((listener) => listener());
}

export function useTheme() {
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useLayoutEffect(() => {
    const dom = domTheme();
    const actual = dom ?? resolveTheme();
    if (dom === null) {
      document.documentElement.classList.add(actual);
    }
    if (actual !== theme) {
      theme = actual;
      emit();
    }
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
    if (next !== theme) {
      theme = next;
      emit();
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme]);

  return { theme: value, setTheme, toggle };
}
