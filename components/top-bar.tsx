"use client";

import { useTranslations } from "next-intl";
import { AccountMenu } from "@/components/account-menu";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { TopBarTabs } from "@/components/top-bar-tabs";
import { useSignInState } from "@/hooks/use-sign-in-state";
import { Link } from "@/i18n/navigation";
import { requestSignIn } from "@/lib/auth-events";

/**
 * Top app bar — the record header band, closed with a printed double rule:
 * masthead + navigation on the left, utility controls on the right. The tabs
 * (Explore for a Visitor or Study for a User — never both, #143 — and
 * Review) are bound to routes and derive their active state from the current
 * pathname; an active tab carries a filled bubble marker. The wordmark (a
 * brand name) stays untranslated; the utility aria labels come from the
 * `topbar` namespace.
 *
 * The right end carries the identity half of the bar (#143): a Visitor sees
 * a Sign in affordance, which asks the sign-in modal (mounted in the frame)
 * to open; a signed-in User sees the account menu instead. Both halves read
 * the page's one sign-in state (`useSignInState`), so the bar cannot
 * contradict itself or ask a signed-in person to sign in again.
 */
export function TopBar() {
  const t = useTranslations("topbar");
  const { signedIn } = useSignInState();

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
        {!signedIn && (
          <button
            type="button"
            onClick={requestSignIn}
            className="focus-ring rounded-md px-2.5 py-2 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant transition-colors hover:bg-accent hover:text-on-surface"
          >
            {t("signIn")}
          </button>
        )}
        <AccountMenu />
      </nav>
    </header>
  );
}
