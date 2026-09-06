import { ControlBar } from "@/components/classroom/control-bar";
import { SlideSidebar } from "@/components/classroom/slide-sidebar";
import { SandboxFrame } from "@/components/sandbox/sandbox-frame";

/** The scene title shown in the main column's top bar. */
const CURRENT_SCENE = "Momentum & Energy in Collisions";

/**
 * The classroom view — presentational **server** component (no client state).
 *
 * Layout: full-height flex row.
 *  - Left: static slide sidebar (map #41) — 7 outline cards, first highlighted
 *  - Right: main column — static top bar, dominant content area, control bar
 *
 * The shared frame / top app bar come from the root layout; they are NOT
 * re-added here. All leaves are placeholders for now.
 */
export function ClassroomView() {
  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar — static slide navigation (left) */}
      <SlideSidebar />

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Static top bar (breadcrumb / scene info) */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-outline-variant bg-surface px-6">
          <span className="text-sm font-medium text-on-surface">{CURRENT_SCENE}</span>
        </header>

        {/* Dominant content area — the sandbox */}
        <main className="min-h-0 flex-1 p-6">
          <SandboxFrame />
        </main>

        {/* Control bar (bottom-right) */}
        <footer className="flex h-16 shrink-0 items-center justify-end border-t border-outline-variant bg-surface px-6">
          <ControlBar index={1} total={7} />
        </footer>
      </div>
    </div>
  );
}
