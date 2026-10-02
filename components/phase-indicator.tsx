"use client";

import {
  CircleCheck,
  FilePen,
  ListChecks,
  Loader2,
  MessageSquareText,
  Play,
  Search,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { Phase } from "@/lib/api-client";
import { cn } from "@/lib/utils";

/**
 * The design treatment per phase. The vocabulary is the stamp, not the
 * badge: work-in-progress phases take a pencil outline stamp, executing a
 * filled ink one, complete the verified green stamp, error the red-pen
 * one. The human-readable label and hint live in the `phases` message
 * namespace (one `{label, hint}` pair per phase, plus `ready`).
 */
type PhaseStyle = {
  icon: LucideIcon;
  /** Text/line color classes for the stamp. */
  ink: string;
  /** True when the stamp carries a dashed outline (work in flight). */
  working?: boolean;
  /** True when the stamp body is filled (executing). */
  filled?: boolean;
};

const PHASE_STYLE: Record<Phase, PhaseStyle> = {
  clarifying: { icon: MessageSquareText, ink: "text-engage", working: true },
  probing: { icon: Search, ink: "text-engage", working: true },
  planning: { icon: ListChecks, ink: "text-engage", working: true },
  reviewing: { icon: FilePen, ink: "text-engage", working: true },
  generating: { icon: Loader2, ink: "text-engage", working: true },
  executing: { icon: Play, ink: "text-engage", filled: true },
  complete: { icon: CircleCheck, ink: "text-tertiary" },
  error: { icon: TriangleAlert, ink: "text-error" },
};

/** The no-session state before the first submit. */
const READY_STYLE: PhaseStyle = {
  icon: Search,
  ink: "text-on-surface-variant",
  working: true,
};

/**
 * The current-phase indicator: a rubber stamp — a square, slightly rotated,
 * double-ruled outline in monospace caps, pressed onto the page with the
 * stamp-press motion. A compact stamp tells the learner what the app is
 * doing right now — clarifying, probing, planning, … When `pending` is set
 * (a request is in flight) the phase icon is swapped for a spinner so the
 * "working" state is obvious at a glance. Pure, props-driven leaf.
 */
export function PhaseIndicator({
  phase,
  pending = false,
}: {
  /** The backend phase, or null before the first submit. */
  phase: Phase | null;
  /** True while a request is in flight (the AI is thinking). */
  pending?: boolean;
}) {
  const t = useTranslations("phases");
  const key = phase ?? "ready";
  const style = phase ? PHASE_STYLE[phase] : READY_STYLE;
  const Icon = pending ? Loader2 : style.icon;

  return (
    <span
      role="status"
      aria-label={`${t(`${key}.label`)} — ${t(`${key}.hint`)}`}
      title={t(`${key}.hint`)}
      className={cn(
        "animate-stamp-press inline-flex -rotate-2 items-center gap-1.5 rounded-[3px] border-[1.5px] px-2.5 py-1",
        style.filled
          ? "border-engage bg-engage text-on-engage"
          : [style.ink, "border-current"],
        style.working && "border-dashed",
        // The inner rule of a real stamp's double border.
        "shadow-[inset_0_0_0_1px_color-mix(in_oklab,currentColor_35%,transparent)]",
      )}
    >
      <Icon
        className={cn("size-3.5", pending && "animate-spin")}
        aria-hidden
      />
      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em]">
        {t(`${key}.label`)}
      </span>
    </span>
  );
}
