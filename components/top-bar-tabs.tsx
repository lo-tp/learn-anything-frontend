"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Bubble } from "@/components/bubble";
import { cn } from "@/lib/utils";

/**
 * The top-bar navigation tabs (per design/topbar).
 *
 * Two tabs bound to the app's top-level routes — Study (the personal
 * list at `/mine`, #148) and Review (the review deck). The active tab is
 * derived from the current pathname, so it stays in sync with the route;
 * Study also owns the session detail pages (a session lives under Study).
 * Labels come from the `topbar` namespace. Always visible — Review must
 * stay reachable on small screens — so the tabs shrink below `md` (the
 * wordmark steps aside there).
 */

type Tab = {
  key: "study" | "review";
  href: string;
  isActive: (pathname: string) => boolean;
};

const TABS: Tab[] = [
  { key: "study", href: "/mine", isActive: (p) => p === "/mine" || p === "/session" || p.startsWith("/session/") },
  { key: "review", href: "/review", isActive: (p) => p === "/review" },
];

export function TopBarTabs() {
  const t = useTranslations("topbar");
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {TABS.map(({ key, href, isActive }) => {
        const active = isActive(pathname);
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-2 font-mono text-xs font-semibold uppercase tracking-[0.12em] transition-colors focus-ring md:px-3 md:text-sm",
              active
                ? "text-engage"
                : "text-on-surface-variant hover:text-on-surface",
            )}
          >
            <Bubble state={active ? "active" : "empty"} />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
