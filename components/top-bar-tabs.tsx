"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * The top-bar navigation tabs (per design/topbar).
 *
 * Two tabs bound to the app's top-level routes — Study (the root session
 * list) and Review (the review deck). The active tab is derived from the
 * current pathname, so it stays in sync with the route. Labels come from the
 * `topbar` namespace. Hidden on mobile (shown from the `md` breakpoint up),
 * matching the design.
 */

const TABS = [
  { key: "study", href: "/" },
  { key: "review", href: "/review" },
] as const;

export function TopBarTabs() {
  const t = useTranslations("topbar");
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-1 md:flex">
      {TABS.map(({ key, href }) => (
        <Link
          key={key}
          href={href}
          aria-current={pathname === href ? "page" : undefined}
          className={cn(
            "rounded px-3 py-2 text-base transition-colors hover:bg-surface-variant",
            pathname === href
              ? "border-b-2 border-primary font-bold text-primary"
              : "text-on-surface-variant opacity-80 hover:opacity-100",
          )}
        >
          {t(key)}
        </Link>
      ))}
    </nav>
  );
}
