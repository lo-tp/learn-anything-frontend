"use client";

import { useTranslations } from "next-intl";
import { AccountMenu } from "@/components/account-menu";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { TopBarTabs } from "@/components/top-bar-tabs";
import { Link } from "@/i18n/navigation";
import { requestSignIn } from "@/lib/auth-events";

/**
 * Top app bar — the record header band, closed with a printed double rule:
 * masthead + navigation on the left, utility controls on the right. The tabs
 * (Study → root, Review → /review) are bound to routes and derive their
 * active state from the current pathname; an active tab carries a filled
 * bubble marker. The wordmark (a brand name) stays untranslated; the utility
 * aria labels come from the `topbar` namespace.
 *
 * The right end carries a standing Sign in affordance (#147): it is static —
 * the app never probes who you are — so a Visitor sees it in place of the
 * account menu, which still hides itself when it cannot identify anyone.
 * Clicking it asks the sign-in modal (mounted in the frame) to open.
 */
export function TopBar() {
  const t = useTranslations("topbar");

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
        <button
          type="button"
          onClick={requestSignIn}
          className="focus-ring rounded-md px-2.5 py-2 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant transition-colors hover:bg-accent hover:text-on-surface"
        >
          {t("signIn")}
        </button>
        <AccountMenu />
      </nav>
    </header>
  );
}
