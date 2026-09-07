"use client";

import { useState } from "react";
import { ControlBar } from "@/components/classroom/control-bar";
import { SlideSidebar } from "@/components/classroom/slide-sidebar";
import { SandboxFrame } from "@/components/sandbox/sandbox-frame";

/**
 * The sandbox samples shown in the sidebar, in deck order. The active sample
 * is the one loaded into the main content area.
 */
const SAMPLES = ["sample_1", "sample_2", "sample_3", "sample_4", "sample_5"];

/** The `/sandbox/<name>` route for a sample, on the sandbox origin. */
const sandboxSrc = (name: string) =>
  `${process.env.NEXT_PUBLIC_SANDBOX_ORIGIN}/sandbox/${name}`;

/**
 * The classroom view. **Client** component — owns the selection state that
 * links the sidebar to the main content area (map #41 / #43).
 *
 * Layout: full-height flex row.
 *  - Left: slide sidebar — one card per sample, active highlighted
 *  - Right: main column — top bar, dominant content area (the sandbox), control bar
 *
 * Selecting a sidebar card loads that sample into the sandbox, updates the
 * top-bar title, and moves the control-bar counter.
 */
export function ClassroomView() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeSample = SAMPLES[activeIndex];

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar — slide navigation (left); controls the main content */}
      <SlideSidebar
        samples={SAMPLES}
        activeIndex={activeIndex}
        onSelect={setActiveIndex}
      />

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar (scene info) */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-outline-variant bg-surface px-6">
          <span className="text-sm font-medium text-on-surface">{activeSample}</span>
        </header>

        {/* Dominant content area — the active sample in the sandbox */}
        <main className="min-h-0 flex-1 p-6">
          <SandboxFrame src={sandboxSrc(activeSample)} />
        </main>

        {/* Control bar (bottom-right) */}
        <footer className="flex h-16 shrink-0 items-center justify-end border-t border-outline-variant bg-surface px-6">
          <ControlBar
            index={activeIndex + 1}
            total={SAMPLES.length}
            onPrev={() => setActiveIndex((i) => Math.max(0, i - 1))}
            onNext={() => setActiveIndex((i) => Math.min(SAMPLES.length - 1, i + 1))}
          />
        </footer>
      </div>
    </div>
  );
}
