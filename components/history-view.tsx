"use client";

import { useCallback, useState } from "react";
import { Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { SessionCard } from "@/components/session-card";
import type { SessionSummary } from "@/lib/dummy-sessions";

/**
 * The learner's History (home): header with the CTA, then the session
 * cards (or the empty state). Owns the list state — the initial value is
 * the server-side fetch result; after the new-session dialog (#26)
 * succeeds it re-fetches and swaps the list in place.
 */
export function HistoryView({
  initialSessions,
}: {
  initialSessions: SessionSummary[];
}) {
  const [sessions, setSessions] = useState(initialSessions);

  /** Re-fetch the History from the dummy store and swap the list in place. */
  const refresh = useCallback(async () => {
    const res = await fetch("/api/sessions");
    if (res.ok) setSessions(await res.json());
  }, []);

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[1200px] p-8 md:p-margin-page">
        <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-on-surface">
              My Sessions
            </h1>
            <p className="mt-2 max-w-2xl text-lg text-on-surface-variant">
              Resume your deep dives or launch a new contextual inquiry.
            </p>
          </div>
          {/* #26 wires this to the new-session dialog; until then it just re-syncs. */}
          <button
            type="button"
            onClick={refresh}
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-on-primary-container shadow-[0_4px_20px_rgba(192,193,255,0.15)] transition-all hover:-translate-y-0.5 hover:bg-primary-fixed md:flex-shrink-0"
          >
            <Plus className="size-5" />
            Start New Session
          </button>
        </div>

        {sessions.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-4">
            {sessions.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
