import { BookOpen, Clock } from "lucide-react";
import { timeAgo } from "@/lib/time";
import type { SessionListItem } from "@/lib/api-client";

/**
 * One History card: neutral icon tile, title, relative time. Links to the
 * session's materials page (`/session/{sessionId}`). The stage badge was
 * removed in #46 — cards no longer carry stage vocabulary; the icon tile
 * has a fixed neutral treatment instead.
 */
export function SessionCard({ session }: { session: SessionListItem }) {
  const { session_id, narrowed_goal, goal, created_at } = session;

  return (
    <a
      href={`/session/${session_id}`}
      className="group relative flex flex-col gap-4 overflow-hidden rounded-xl border border-outline-variant/50 bg-surface-container p-6 transition-all hover:border-outline-variant hover:bg-surface-container-high md:flex-row md:items-center md:gap-6"
    >
      <div className="absolute -top-8 -right-8 h-32 w-32 rounded-bl-full bg-outline/5" />
      <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-outline-variant/30 bg-surface-bright">
        <BookOpen className="size-6 text-on-surface-variant" />
      </div>
      <div className="relative z-10 flex-1">
        <h3 className="mb-1 font-display text-xl font-medium text-on-surface">
          {narrowed_goal ?? goal}
        </h3>
        <span className="flex items-center gap-1 font-mono text-xs tracking-widest text-on-surface-variant">
          <Clock className="size-3.5" />
          {timeAgo(created_at)}
        </span>
      </div>
    </a>
  );
}
