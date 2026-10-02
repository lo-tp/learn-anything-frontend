"use client";

import { AccountMenu } from "@/components/account-menu";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { TopBarTabs } from "@/components/top-bar-tabs";
import { Link } from "@/i18n/navigation";

/**
 * Top app bar — the record header band, closed with a printed double rule:
 * masthead + navigation on the left, utility controls on the right. The tabs
 * (Study → root, Review → /review) are bound to routes and derive their
 * active state from the current pathname; an active tab carries a filled
 * bubble marker. The wordmark (a brand name) stays untranslated; the utility
 * aria labels come from the `topbar` namespace.
 */
export function TopBar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between bg-surface px-4 double-rule-b md:px-gutter">
      <div className="flex items-center gap-6">
        <Link
          href="/"
          className="hidden rounded-sm font-display text-base font-bold uppercase tracking-[0.12em] text-primary focus-ring sm:block"
        >
          Learn Anything
        </Link>
        <TopBarTabs />
      </div>
      <nav className="flex items-center gap-1.5">
        <ThemeToggle />
        <LanguageSwitcher />
        <AccountMenu />
      </nav>
    </header>
  );
}
