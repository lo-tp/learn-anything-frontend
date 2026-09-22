"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * The top-bar navigation tabs (per design/topbar).
 *
 * The three tabs from the top-bar design — Project, History, and Export.
 * Self-contained: it tracks the active tab in local state and is not bound
 * to a route; the History/Export destinations land with their tickets on
 * map #11. Tab labels come from the `topbar` namespace. Hidden on mobile
 * (shown from the `md` breakpoint up), matching the design.
 */

const TABS = ["project", "history", "export"] as const;

type Tab = (typeof TABS)[number];

export function TopBarTabs() {
  const t = useTranslations("topbar");
  const [active, setActive] = useState<Tab>("project");

  return (
    <nav className="hidden items-center gap-1 md:flex">
      {TABS.map((tab) => (
        <button
          key={tab}
          type="button"
          aria-current={active === tab ? "page" : undefined}
          onClick={() => setActive(tab)}
          className={cn(
            "rounded px-3 py-2 text-base transition-colors hover:bg-surface-variant",
            active === tab
              ? "border-b-2 border-primary font-bold text-primary"
              : "text-on-surface-variant opacity-80 hover:opacity-100",
          )}
        >
          {t(tab)}
        </button>
      ))}
    </nav>
  );
}
