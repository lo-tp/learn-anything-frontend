import {
  CircleCheck,
  FilePen,
  ListChecks,
  Loader2,
  MessageSquareText,
  Play,
  Search,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { Phase } from "@/lib/api-client";
import { cn } from "@/lib/utils";

/**
 * What the AI is doing right now, per backend phase (`lib/api-client`
 * `Phase`): a short label, a one-line hint, an icon, and the design accent.
 */
type PhaseMeta = {
  label: string;
  hint: string;
  icon: LucideIcon;
  text: string;
  border: string;
  bg: string;
};

const PHASE_META: Record<Phase, PhaseMeta> = {
  clarifying: {
    label: "Clarifying",
    hint: "Pinning down your goal",
    icon: MessageSquareText,
    text: "text-primary",
    border: "border-primary/30",
    bg: "bg-primary/10",
  },
  probing: {
    label: "Probing",
    hint: "Testing your understanding",
    icon: Search,
    text: "text-primary",
    border: "border-primary/30",
    bg: "bg-primary/10",
  },
  planning: {
    label: "Planning",
    hint: "Building your study plan",
    icon: ListChecks,
    text: "text-secondary",
    border: "border-secondary/30",
    bg: "bg-secondary/10",
  },
  reviewing: {
    label: "Reviewing",
    hint: "Adjusting the plan",
    icon: FilePen,
    text: "text-secondary",
    border: "border-secondary/30",
    bg: "bg-secondary/10",
  },
  generating: {
    label: "Generating",
    hint: "Preparing the steps",
    icon: Sparkles,
    text: "text-tertiary",
    border: "border-tertiary/30",
    bg: "bg-tertiary/10",
  },
  executing: {
    label: "Executing",
    hint: "Working through the steps",
    icon: Play,
    text: "text-tertiary",
    border: "border-tertiary/30",
    bg: "bg-tertiary/10",
  },
  complete: {
    label: "Complete",
    hint: "Session finished",
    icon: CircleCheck,
    text: "text-tertiary",
    border: "border-tertiary/30",
    bg: "bg-tertiary/10",
  },
};

/** The no-session state before the first submit. */
const READY: PhaseMeta = {
  label: "Ready",
  hint: "Describe what you want to learn",
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
  const meta = phase ? PHASE_META[phase] : READY;
  const Icon = pending ? Loader2 : meta.icon;

  return (
    <span
      role="status"
      aria-label={`${meta.label} — ${meta.hint}`}
      title={meta.hint}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1",
        meta.border,
        meta.bg,
      )}
    >
      <Icon
        className={cn("size-3.5", meta.text, pending && "animate-spin")}
        aria-hidden
      />
      <span
        className={cn(
          "font-mono text-xs font-semibold uppercase tracking-wider",
          meta.text,
        )}
      >
        {meta.label}
      </span>
    </span>
  );
}
