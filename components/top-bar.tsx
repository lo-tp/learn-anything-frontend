"use client";

import { AccountMenu } from "@/components/account-menu";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { TopBarTabs } from "@/components/top-bar-tabs";
import { Link } from "@/i18n/navigation";

/**
 * Top app bar — wordmark + navigation tabs on the left, utility actions on
 * the right. The tabs (Study → root, Review → /review) are bound to routes
 * and derive their active state from the current pathname. The wordmark (a
 * brand name) stays untranslated; the utility aria labels come from the
 * `topbar` namespace.
 */
export function TopBar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-outline-variant bg-surface px-gutter">
      <div className="flex items-center gap-6">
        <Link href="/" className="font-display text-lg font-semibold text-primary">
          Learn Anything
        </Link>
        <TopBarTabs />
      </div>
      <nav className="flex items-center gap-2">
        <ThemeToggle />
        <LanguageSwitcher />
        <AccountMenu />
      </nav>
    </header>
  );
}
