"use client";

import {
  CircleCheck,
  FilePen,
  ListChecks,
  Loader2,
  MessageSquareText,
  Play,
  Search,
  Sparkles,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { Phase } from "@/lib/api-client";
import { cn } from "@/lib/utils";

/**
 * The design treatment per phase: icon + accent colors. The human-readable
 * label and hint live in the `phases` message namespace (one
 * `{label, hint}` pair per phase, plus `ready`).
 */
type PhaseStyle = {
  icon: LucideIcon;
  text: string;
  border: string;
  bg: string;
};

const PHASE_STYLE: Record<Phase, PhaseStyle> = {
  clarifying: {
    icon: MessageSquareText,
    text: "text-primary",
    border: "border-primary/30",
    bg: "bg-primary/10",
  },
  probing: {
    icon: Search,
    text: "text-primary",
    border: "border-primary/30",
    bg: "bg-primary/10",
  },
  planning: {
    icon: ListChecks,
    text: "text-secondary",
    border: "border-secondary/30",
    bg: "bg-secondary/10",
  },
  reviewing: {
    icon: FilePen,
    text: "text-secondary",
    border: "border-secondary/30",
    bg: "bg-secondary/10",
  },
  generating: {
    icon: Sparkles,
    text: "text-tertiary",
    border: "border-tertiary/30",
    bg: "bg-tertiary/10",
  },
  executing: {
    icon: Play,
    text: "text-tertiary",
    border: "border-tertiary/30",
    bg: "bg-tertiary/10",
  },
  complete: {
    icon: CircleCheck,
    text: "text-tertiary",
    border: "border-tertiary/30",
    bg: "bg-tertiary/10",
  },
  error: {
    icon: TriangleAlert,
    text: "text-error",
    border: "border-error/30",
    bg: "bg-error/10",
  },
};

/** The no-session state before the first submit. */
const READY_STYLE: PhaseStyle = {
  icon: Sparkles,
  text: "text-on-surface-variant",
  border: "border-outline-variant/50",
  bg: "bg-outline/5",
};

/**
 * The current-phase indicator for the new-session dialog: a compact chip
 * (icon + phase label) that tells the learner what the AI is doing right now
 * — clarifying, probing, planning, … When `pending` is set (a request is in
 * flight) the phase icon is swapped for a spinner so the "working" state is
 * obvious at a glance. Pure, props-driven leaf.
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
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1",
        style.border,
        style.bg,
      )}
    >
      <Icon
        className={cn("size-3.5", style.text, pending && "animate-spin")}
        aria-hidden
      />
      <span
        className={cn(
          "font-mono text-xs font-semibold uppercase tracking-wider",
          style.text,
        )}
      >
        {t(`${key}.label`)}
      </span>
    </span>
  );
}
