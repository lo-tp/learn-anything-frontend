"use client";

import { useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Left slide sidebar for `/classroom` (map #41).
 *
 * A controlled navigation list. The parent (the classroom view) owns the deck
 * (`samples`) and the current selection (`activeIndex`); this component
 * renders one card per sample, highlights the active one, and reports clicks
 * through `onSelect`. Each expanded card shows a non-interactive mini preview
 * of its sandbox route; the whole card is the click target (mouse + keyboard).
 *
 * The sidebar is collapsible: the header toggle switches between the full
 * card list and a narrow rail of numbered badges (still clickable to navigate).
 * The collapsed/expanded state is pure UI preference, so it is kept locally.
 */
export function SlideSidebar({
  samples,
  activeIndex,
  onSelect,
}: {
  samples: string[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 select-none flex-col border-r border-outline-variant bg-surface transition-[width] duration-200 ease-out",
        collapsed ? "w-14" : "w-80",
      )}
    >
      {/* Header — label (expanded only) + collapse/expand toggle */}
      <div className={cn("flex items-center p-3 pb-1", collapsed ? "justify-center" : "justify-between")}>
        <span
          className={cn(
            "text-xs font-semibold uppercase tracking-wide text-on-surface-variant",
            collapsed && "hidden",
          )}
        >
          Slides
        </span>
        <button
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((c) => !c)}
          className="flex size-7 items-center justify-center rounded text-on-surface-variant transition-colors hover:bg-surface-container"
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {collapsed ? (
          /* Collapsed rail — numbered badges, still clickable */
          <ul className="flex flex-col items-center gap-2">
            {samples.map((name, i) => {
              const active = i === activeIndex;
              return (
                <li key={name}>
                  <button
                    type="button"
                    title={name}
                    aria-label={`Slide ${i + 1}: ${name}`}
                    aria-current={active ? "true" : undefined}
                    onClick={() => onSelect(i)}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full text-[11px] font-semibold transition-colors",
                      active
                        ? "bg-primary text-on-primary"
                        : "border border-outline-variant/60 bg-surface-container text-on-surface-variant hover:border-outline-variant",
                    )}
                  >
                    {i + 1}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          /* Expanded — full cards with sandbox previews */
          <ul className="flex flex-col gap-2.5">
            {samples.map((name, i) => {
              const active = i === activeIndex;
              return (
                <li key={name}>
                  <div
                    role="button"
                    tabIndex={0}
                    aria-current={active ? "true" : undefined}
                    onClick={() => onSelect(i)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(i);
                      }
                    }}
                    className={cn(
                      "cursor-pointer rounded-xl border p-2.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/50",
                      active
                        ? "border-primary/60 bg-gradient-to-b from-surface-container-low to-surface-container-lowest shadow-md shadow-primary/10"
                        : "border-outline-variant/40 bg-surface-container-low/60 hover:border-outline-variant",
                    )}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                          active
                            ? "bg-primary text-on-primary"
                            : "border border-outline-variant/60 bg-surface-container text-on-surface-variant",
                        )}
                      >
                        {i + 1}
                      </span>
                      <span
                        className={cn(
                          "truncate text-xs",
                          active ? "font-medium text-primary" : "text-on-surface-variant",
                        )}
                      >
                        {name}
                      </span>
                    </div>
                    <div className="relative h-40 w-full overflow-hidden rounded-lg border border-outline-variant/50">
                      <iframe
                        src={`${process.env.NEXT_PUBLIC_SANDBOX_ORIGIN}/sandbox/${name}`}
                        sandbox="allow-scripts allow-same-origin"
                        aria-hidden
                        tabIndex={-1}
                        className="pointer-events-none absolute top-0 left-0 h-[720px] w-[1280px] origin-top-left scale-[0.22]"
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
