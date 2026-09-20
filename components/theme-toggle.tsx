"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "@/hooks/use-theme";

/**
 * Light/dark theme toggle for the TopBar.
 *
 * Two-state button: the icon shows the theme you'd switch *to* — Sun in
 * dark mode, Moon in light mode. The choice persists per browser
 * (`localStorage["la:theme"]`) and first-time visitors follow the OS
 * `prefers-color-scheme` (see the pre-paint script in the `[locale]` layout).
 */
export function ThemeToggle() {
  const t = useTranslations("topbar");
  const { theme, toggle } = useTheme();

  return (
    <button
      type="button"
      aria-label={t("toggleTheme")}
      onClick={toggle}
      className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-highest"
    >
      {theme === "dark" ? (
        <Sun className="size-5" />
      ) : (
        <Moon className="size-5" />
      )}
    </button>
  );
}
