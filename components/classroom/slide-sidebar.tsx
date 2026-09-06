import { cn } from "@/lib/utils";

/**
 * The shape a slide's mini-thumbnail renders as — one per card, chosen to
 * echo the slide type in the mockup (design/classroom) with simple CSS only.
 */
type SlideType = "preview" | "grid" | "list" | "formula" | "simulator" | "equation" | "blank";

/**
 * The 7 outline cards, in deck order. Titles follow the sample deck already
 * wired into `views/classroom`; the thumbnail `type` drives the little shape
 * drawn inside each card.
 */
const SLIDES: { title: string; type: SlideType }[] = [
  { title: "Momentum & Energy in Collisions", type: "preview" },
  { title: "Where Did the Kinetic Energy Go?", type: "grid" },
  { title: "Identifying Collision Types", type: "list" },
  { title: "1D Elastic Collision Math", type: "formula" },
  { title: "Interactive: 1D Collision Simulator", type: "simulator" },
  { title: "Relative Velocity Relationship", type: "equation" },
  { title: "Special Case: Equal Mass Collision", type: "blank" },
];

/**
 * Mini-thumbnail: a simple, type-specific shape in a dark well. Pure CSS —
 * no images, no state.
 */
function Thumbnail({ type }: { type: SlideType }) {
  const well =
    "relative overflow-hidden rounded-lg border border-outline-variant/50 bg-surface-container-lowest";

  switch (type) {
    case "preview":
      return (
        <div className={cn(well, "flex h-24 items-center justify-between gap-2 border-primary/30 p-2")}>
          <div aria-hidden className="absolute inset-0 bg-primary/5" />
          <div className="relative space-y-1">
            <div className="h-1.5 w-16 rounded bg-primary/50" />
            <div className="h-1 w-20 rounded bg-surface-container-high" />
            <div className="h-1 w-12 rounded bg-surface-container-high" />
          </div>
          <div className="relative h-10 w-16 rounded border border-outline-variant/50 bg-surface-container" />
        </div>
      );
    case "grid":
      return (
        <div className={cn(well, "flex h-20 items-center justify-center p-2.5")}>
          <div className="grid w-full grid-cols-2 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-10 rounded border border-dashed border-outline-variant/50 bg-surface-container/40"
              />
            ))}
          </div>
        </div>
      );
    case "list":
      return (
        <div className={cn(well, "flex h-20 flex-col justify-center gap-1.5 px-3")}>
          <div className="h-3 w-full rounded bg-surface-container/60" />
          <div className="h-3 w-4/5 rounded bg-surface-container/40" />
        </div>
      );
    case "formula":
      return (
        <div className={cn(well, "flex h-20 items-center justify-center")}>
          <span className="font-mono text-xs text-primary/70">m₁v₁ + m₂v₂ = …</span>
        </div>
      );
    case "simulator":
      return (
        <div className={cn(well, "flex h-20 items-center justify-center p-2")}>
          <div className="flex w-full items-center justify-around">
            <div className="size-4 rounded-full bg-secondary/60" />
            <div className="h-px w-16 bg-outline-variant/60" />
            <div className="size-5 rounded-full bg-primary/60" />
          </div>
        </div>
      );
    case "equation":
      return (
        <div className={cn(well, "flex h-20 items-center justify-center")}>
          <span className="font-mono text-xs text-on-surface-variant/70">
            v₂′ − v₁′ = −(v₂ − v₁)
          </span>
        </div>
      );
    case "blank":
      return <div className={cn(well, "h-20")} />;
  }
}

/**
 * Left slide sidebar for `/classroom` (map #41).
 *
 * Purely presentational and static — no props, no state, no event handlers.
 * It always renders the same 7 outline cards, the first highlighted, with a
 * simple per-type shape standing in for each slide's thumbnail.
 */
export function SlideSidebar() {
  return (
    <aside className="flex h-full w-80 shrink-0 select-none flex-col border-r border-outline-variant bg-surface">
      <div className="flex-1 overflow-y-auto p-3">
        <ul className="flex flex-col gap-2.5">
          {SLIDES.map((slide, i) => {
            const active = i === 0;
            return (
              <li
                key={slide.title}
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
                    {slide.title}
                  </span>
                </div>
                <Thumbnail type={slide.type} />
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
