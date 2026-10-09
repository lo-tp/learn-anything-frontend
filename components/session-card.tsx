"use client";

import { Loader2 } from "lucide-react";
import { useLocale, useMessages, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { timeAgo } from "@/lib/time";
import { inquiryInk } from "@/lib/utils";
import type { SessionListItem } from "@/lib/api-client";

/**
 * One History sheet: a paper card with the inquiry's identity spot as a
 * color press edge on the left, punch holes along the margin, a red
 * monospace sheet number and timestamp on a ruled header strip, and the
 * goal title below it (#46: no stage vocabulary on cards — the only
 * in-progress signal is a quiet pencil note while materials generate).
 * Links to the session's materials page (`/session/{sessionId}`) via the
 * locale-aware `Link`.
 */
export function SessionCard({
  session,
  delay = 0,
}: {
  session: SessionListItem;
  /** Settle-stagger delay in ms, assigned by the History list. */
  delay?: number;
}) {
  const { session_id, narrowed_goal, goal, created_at, phase } = session;
  const locale = useLocale();
  const messages = useMessages();
  const t = useTranslations("mine");
  const sheetNo = session_id.replace(/-/g, "").slice(-4).toUpperCase();
  const spot = inquiryInk(session_id);

  return (
    <Link
      href={`/session/${session_id}`}
      style={{ animationDelay: `${delay}ms` }}
      className="group focus-ring animate-sheet-settle relative block overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest p-5 pl-8 shadow-[var(--shadow-sheet)] transition-all duration-150 hover:-translate-y-px hover:shadow-[var(--shadow-sheet-raised)]"
    >
      {/* The inquiry's identity spot — the color this study is printed in. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[5px]"
        style={{ backgroundColor: `var(--${spot})` }}
      />

      {/* Punch holes — the left margin of a sheet meant for a binder. */}
      <span aria-hidden className="absolute left-2.5 top-0 bottom-0 flex flex-col justify-center gap-5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="block size-2 rounded-full border border-outline-variant/70 bg-surface" />
        ))}
      </span>

      {/* Ruled header strip: red sheet number, ruled from the timestamp. */}
      <div className="flex items-baseline justify-between gap-4 border-b border-outline-variant/60 pb-2">
        <span className="font-mono text-xs font-semibold tracking-[0.14em] text-error">
          No. {sheetNo}
        </span>
        <span className="font-mono text-xs text-on-surface-variant">
          {timeAgo(created_at, locale, messages.time)}
        </span>
      </div>

      <div className="pt-3">
        <h3 className="font-display text-xl font-semibold text-on-surface">
          {narrowed_goal ?? goal}
        </h3>
        {phase === "generating" ? (
          // In-progress indicator for background material generation (#127).
          // Deliberately minimal — a pencil note, not a stage label.
          <span
            role="status"
            aria-label={t("generating")}
            className="mt-2 flex items-center gap-2 text-on-surface-variant"
          >
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            <span className="font-mono text-xs tracking-widest">{t("generating")}</span>
          </span>
        ) : null}
      </div>
    </Link>
  );
}
