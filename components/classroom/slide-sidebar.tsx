import { cn } from "@/lib/utils";

/**
 * The five sandbox samples the sidebar lists, in deck order. Each card loads
 * its matching `/sandbox/<name>` route from the sandbox origin.
 */
const SAMPLES = ["sample_1", "sample_2", "sample_3", "sample_4", "sample_5"];

/**
 * Left slide sidebar for `/classroom` (map #41).
 *
 * Purely presentational and static — no props, no state, no event handlers.
 * It always renders the five sample cards, the first highlighted, each loading
 * its sandbox route in a scaled-down iframe.
 */
export function SlideSidebar() {
  return (
    <aside className="flex h-full w-80 shrink-0 select-none flex-col border-r border-outline-variant bg-surface">
      <div className="flex-1 overflow-y-auto p-3">
        <ul className="flex flex-col gap-2.5">
          {SAMPLES.map((name, i) => {
            const active = i === 0;
            return (
              <li
                key={name}
                className={cn(
                  "rounded-xl border p-2.5",
                  active
                    ? "border-primary/60 bg-gradient-to-b from-surface-container-low to-surface-container-lowest shadow-md shadow-primary/10"
                    : "border-outline-variant/40 bg-surface-container-low/60",
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
                    className="absolute top-0 left-0 h-[720px] w-[1280px] origin-top-left scale-[0.22]"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
