"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RailData } from "@/views/root/intake";

/**
 * The intake progress rail: a full-width row of four steps
 * (Clarifying → Probing → Planning → Generating). Replaces the
 * PhaseIndicator chip in the dialog header (#126).
 *
 * The state-dependent counter is not rendered as text — it only names
 * the `status` role for screen readers.
 *
 * Step states:
 * - done: filled circle with a check
 * - current: active ring; pulses while `pending` is true
 * - future: dimmed
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
      className="flex w-full items-start gap-2 border-b border-outline-variant/50 bg-surface-container-low px-6 py-2.5"
    >
      {/* Steps */}
      <ol className="flex flex-1 items-start gap-0">
        {rail.steps.map((step, i) => (
          <li key={i} className="flex flex-1 items-start last:flex-none">
            <div className="flex flex-col items-start">
              {/* Step dot + label */}
              <div className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full border text-xs",
                    step.state === "done" &&
                      "border-primary bg-primary text-primary-foreground",
                    step.state === "current" &&
                      "border-primary bg-primary/10 text-primary",
                    step.state === "future" &&
                      "border-outline-variant/50 bg-transparent text-on-surface-variant",
                    step.state === "current" && rail.pending && "animate-pulse",
                  )}
                >
                  {step.state === "done" ? (
                    <Check className="size-3" aria-hidden />
                  ) : (
                    <span className="text-[0.6rem] font-semibold">{i + 1}</span>
                  )}
                </span>
                <span
                  className={cn(
                    "font-mono text-xs font-medium tracking-wide",
                    step.state === "current" && "text-primary",
                    step.state === "done" && "text-primary/70",
                    step.state === "future" && "text-on-surface-variant/60",
                  )}
                >
                  {step.label}
                </span>
              </div>
              {/* Batch-local position, shown only under the active Clarifying
                  or Probing step while a batch is on screen. */}
              {i === CLARIFY_STEP_INDEX && rail.clarifyPosition ? (
                <span className="pl-6 font-mono text-[0.6rem] font-medium text-primary/70">
                  {rail.clarifyPosition}
                </span>
              ) : i === PROBE_STEP_INDEX && rail.probePosition ? (
                <span className="pl-6 font-mono text-[0.6rem] font-medium text-primary/70">
                  {rail.probePosition}
                </span>
              ) : null}
            </div>
            {/* Connector to next step */}
            {i < rail.steps.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "mx-2 mt-2.5 h-px flex-1",
                  step.state === "done"
                    ? "bg-primary/50"
                    : "bg-outline-variant/30",
                )}
              />
            )}
          </li>
        ))}
      </ol>

    </div>
  );
}
