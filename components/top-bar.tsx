"use client";

import { CircleHelp, Settings } from "lucide-react";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Link } from "@/i18n/navigation";

/**
 * Top app bar — wordmark on the left, utility actions on the right.
 * Static placeholder; the History/Export destinations land with their
 * tickets on map #11. The wordmark (a brand name) stays untranslated; the
 * utility aria labels come from the `topbar` namespace.
 */
export function TopBar() {
  const t = useTranslations("topbar");
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-outline-variant bg-surface px-gutter">
      <Link href="/" className="font-display text-lg font-semibold text-primary">
        Learn Anything
      </Link>
      <nav className="flex items-center gap-2">
        <button
          type="button"
          aria-label={t("settings")}
          className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-highest"
        >
          <Settings className="size-5" />
        </button>
        <LanguageSwitcher />
        <button
          type="button"
          aria-label={t("help")}
          className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-highest"
        >
          <CircleHelp className="size-5" />
        </button>
      </nav>
    </header>
  );
}
