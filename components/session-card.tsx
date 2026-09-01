import {
  CircleCheck,
  FilePen,
  Play,
  Search,
  Sparkles,
  Clock,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/time";
import type { SessionSummary, Stage } from "@/lib/dummy-sessions";

/**
 * Badge map for the session cards — the real stage vocabulary only, each
 * mapped to one of the design accents (design/home/session_list).
 */
export const STAGE_BADGES: Record<
  Stage,
  { label: string; icon: LucideIcon; text: string; glow: string; hover: string }
> = {
  intake: {
    label: "Intake",
    icon: Sparkles,
    text: "text-on-surface-variant",
    glow: "bg-outline/5",
    hover: "hover:border-outline-variant",
  },
  probing: {
    label: "Probing",
    icon: Search,
    text: "text-primary",
    glow: "bg-primary/5",
    hover: "hover:border-primary/50",
  },
  review: {
    label: "Review",
    icon: FilePen,
    text: "text-secondary",
    glow: "bg-secondary/5",
    hover: "hover:border-secondary/50",
  },
  executing: {
    label: "Executing",
    icon: Play,
    text: "text-tertiary",
    glow: "bg-tertiary/5",
    hover: "hover:border-tertiary/50",
  },
  complete: {
    label: "Complete",
    icon: CircleCheck,
    text: "text-tertiary",
    glow: "bg-tertiary/5",
    hover: "hover:border-tertiary/50",
  },
};

/**
 * One History card: stage icon tile, title, relative time, stage badge.
 * Links to the placeholder session page (`/demo`) until the real session
 * route lands.
 */
export function SessionCard({ session }: { session: SessionSummary }) {
  const badge = STAGE_BADGES[session.stage];
  const { icon: Icon } = badge;

  return (
    <a
      href="/demo"
      className={cn(
        "group relative flex flex-col gap-4 overflow-hidden rounded-xl border border-outline-variant/50 bg-surface-container p-6 transition-all hover:bg-surface-container-high md:flex-row md:items-center md:gap-6",
        badge.hover,
      )}
    >
      <div className={cn("absolute -top-8 -right-8 h-32 w-32 rounded-bl-full", badge.glow)} />
      <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-outline-variant/30 bg-surface-bright">
        <Icon className={cn("size-6", badge.text)} />
      </div>
      <div className="relative z-10 flex-1">
        <h3
          className={cn(
            "mb-1 font-display text-xl font-medium",
            session.knowledgePoint
              ? "text-on-surface"
              : "text-on-surface-variant",
          )}
        >
          {session.knowledgePoint ?? "New session"}
        </h3>
        <span className="flex items-center gap-1 font-mono text-xs tracking-widest text-on-surface-variant">
          <Clock className="size-3.5" />
          {timeAgo(session.createdAt)}
        </span>
      </div>
      <span className={cn("relative z-10 flex items-center gap-2", badge.text)}>
        <Icon className="size-5" />
        <span className="font-mono text-xs font-semibold tracking-wider uppercase">
          {badge.label}
        </span>
      </span>
    </a>
  );
}
