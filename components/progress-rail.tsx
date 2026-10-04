"use client";

import { cn } from "@/lib/utils";
import { Bubble } from "@/components/bubble";
import type { RailData } from "@/views/root/intake";

/**
 * The intake progress rail: a printed row of four bubbles and labels
 * (Clarifying → Probing → Planning → Generating) — the sheet's own progress
 * track. Replaces the PhaseIndicator chip in the dialog header (#126).
 *
 * The state-dependent counter is not rendered as text — it only names
 * the `status` role for screen readers.
 *
 * Step states (the shared bubble vocabulary):
 * - done: filled bubble, solid rule between steps
 * - current: open bubble with a breathing ink dot
 * - future: empty bubble, dashed rule
 *
 * The rail is visible from the Ready state (all steps are "future"),
 * so the road is previewed before the first submit.
 *
 * Pure presentation — the rail data (step states, counter text, pending,
 * probe position) is derived by `deriveViewModel` in the intake core.
 */

/** The rail's Clarifying step — carries the batch-local clarify position
 *  ("Question X of Y") while the clarifying questions are asked one at a
 *  time. */
const CLARIFY_STEP_INDEX = 0;

/** The rail's Probing step — carries the batch-local probe position
 *  ("Question X of Y") while a probe batch is on screen. */
const PROBE_STEP_INDEX = 1;

export function ProgressRail({ rail }: { rail: RailData }) {
  return (
    <div
      role="status"
      aria-label={rail.counter}
      className="flex w-full shrink-0 items-start gap-2 bg-surface-container-low px-6 py-3 double-rule-b"
    >
      {/* Steps */}
      <ol className="flex flex-1 items-start gap-0">
        {rail.steps.map((step, i) => (
          <li key={i} className="flex flex-1 items-start last:flex-none">
            <div className="flex flex-col items-start">
              {/* Step bubble + printed label */}
              <div className="flex items-center gap-2">
                <Bubble
                  state={
                    step.state === "done"
                      ? "filled"
                      : step.state === "current"
                        ? "current"
                        : "empty"
                  }
                />
                <span
                  className={cn(
                    "font-mono text-[11px] font-semibold uppercase tracking-[0.14em]",
                    step.state === "current" && "text-primary",
                    step.state === "done" && "text-on-surface",
                    step.state === "future" && "text-on-surface-variant",
                  )}
                >
                  {step.label}
                </span>
              </div>
              {/* Batch-local position, shown only under the active Clarifying
                  or Probing step while a batch is on screen. */}
              {i === CLARIFY_STEP_INDEX && rail.clarifyPosition ? (
                <span className="pl-5.5 font-mono text-[0.6rem] font-medium text-on-surface-variant">
                  {rail.clarifyPosition}
                </span>
              ) : i === PROBE_STEP_INDEX && rail.probePosition ? (
                <span className="pl-5.5 font-mono text-[0.65rem] font-medium text-on-surface-variant">
                  {rail.probePosition}
                </span>
              ) : null}
            </div>
            {/* Connector to next step: solid once walked, dashed ahead. */}
            {i < rail.steps.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "mt-2 mx-2 flex-1",
                  step.state === "done"
                    ? "h-0.5 bg-primary"
                    : "border-t border-dashed border-outline-variant",
                )}
              />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
