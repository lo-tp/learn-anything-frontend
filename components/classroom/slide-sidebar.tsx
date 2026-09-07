import { cn } from "@/lib/utils";

/**
 * Left slide sidebar for `/classroom` (map #41).
 *
 * A controlled navigation list. The parent (the classroom view) owns the deck
 * (`samples`) and the current selection (`activeIndex`); this component
 * renders one card per sample, highlights the active one, and reports clicks
 * through `onSelect`. Each card shows a non-interactive mini preview of its
 * sandbox route; the whole card is the click target (mouse + keyboard).
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
  return (
    <aside className="flex h-full w-80 shrink-0 select-none flex-col border-r border-outline-variant bg-surface">
      <div className="flex-1 overflow-y-auto p-3">
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
      </div>
    </aside>
  );
}
