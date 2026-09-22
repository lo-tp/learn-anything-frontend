"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * The top-bar navigation tabs (per design/topbar).
 *
 * Two tabs bound to the app's top-level routes — Study (the root session
 * list) and Review (the review deck). The active tab is derived from the
 * current pathname, so it stays in sync with the route; Study also owns the
 * session detail pages (a session lives under Study). Labels come from the
 * `topbar` namespace. Hidden on mobile (shown from the `md` breakpoint up),
 * matching the design.
 */

type Tab = {
  key: "study" | "review";
  href: string;
  isActive: (pathname: string) => boolean;
};

const TABS: Tab[] = [
  { key: "study", href: "/", isActive: (p) => p === "/" || p === "/session" || p.startsWith("/session/") },
  { key: "review", href: "/review", isActive: (p) => p === "/review" },
];

export function TopBarTabs() {
  const t = useTranslations("topbar");
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-1 md:flex">
      {TABS.map(({ key, href, isActive }) => {
        const active = isActive(pathname);
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded px-3 py-2 text-base transition-colors hover:bg-surface-variant",
              active
                ? "border-b-2 border-primary font-bold text-primary"
                : "text-on-surface-variant opacity-80 hover:opacity-100",
            )}
          >
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
