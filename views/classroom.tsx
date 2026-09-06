/** A single slide in the classroom deck. */
export interface Slide {
  id: string;
  title: string;
}

/**
 * The classroom view — presentational **server** component (no client state).
 *
 * Layout: full-height flex row.
 *  - Left: slide-navigation sidebar
 *  - Right: main column — static top bar, dominant content area, control bar
 *
 * The shared frame / top app bar come from the root layout; they are NOT
 * re-added here. All leaves are placeholders for now.
 */
export function ClassroomView({ slides }: { slides: Slide[] }) {
  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar — slide navigation (left) */}
      <aside className="w-80 shrink-0 border-r border-outline-variant bg-surface">
        <div className="flex h-full flex-col">
          {/* sidebar header */}
          <div className="flex h-16 shrink-0 items-center border-b border-outline-variant px-4">
            <span className="text-sm font-semibold text-on-surface">
              Slides
            </span>
          </div>
          {/* slide list */}
          <div className="flex-1 overflow-y-auto p-3">
            <ul className="flex flex-col gap-2">
              {slides.map((slide, i) => (
                <li
                  key={slide.id}
                  className="rounded-lg border border-outline-variant bg-surface-container p-3"
                >
                  <span className="text-xs font-medium text-on-surface-variant">
                    {i + 1}. {slide.title}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Static top bar (breadcrumb / scene info) */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-outline-variant bg-surface px-6">
          <span className="text-sm font-medium text-on-surface">
            {slides[0]?.title ?? ""}
          </span>
        </header>

        {/* Dominant content area — slide canvas */}
        <main className="flex flex-1 items-center justify-center overflow-y-auto p-6">
          <div className="flex aspect-video w-full max-w-5xl items-center justify-center rounded-xl border border-outline-variant bg-surface-container">
            <span className="text-sm text-on-surface-variant">
              Slide canvas
            </span>
          </div>
        </main>

        {/* Control bar (bottom-right) */}
        <footer className="flex h-16 shrink-0 items-center justify-end border-t border-outline-variant bg-surface px-6">
          <span className="text-xs text-on-surface-variant">Controls</span>
        </footer>
      </div>
    </div>
  );
}
