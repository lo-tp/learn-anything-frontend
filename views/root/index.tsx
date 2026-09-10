"use client";

import { useCallback, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { NewSessionDialog } from "./new-session-dialog";
import { SessionCard } from "@/components/session-card";
import { StartSessionButton } from "@/components/start-session-button";
import type { SessionSummary } from "@/lib/dummy-sessions";

/**
 * The home page: the learner's History. Owns the list state (seeded from the
 * server-rendered `initialSessions`), the re-fetch against
 * `GET /api/sessions` (run after the new-session dialog accepts an intake),
 * and the dialog's open state, and renders the page directly from the pure
 * leaf components in `components/*`.
 *
 * With sessions: the "My Sessions" header (title + CTA) above the cards.
 * When empty: the header is hidden and the empty state carries the CTA at its
 * base, so there is one primary button in either view. Either CTA opens the
 * new-session dialog (#26).
 */
export function Root({ initialSessions }: { initialSessions: SessionSummary[] }) {
  const [sessions, setSessions] = useState<SessionSummary[]>(initialSessions);
  const [dialogOpen, setDialogOpen] = useState(false);

  /** Re-fetch the History from the dummy store and swap the list in place. */
  const refresh = useCallback(async () => {
    const res = await fetch("/api/sessions");
    if (res.ok) setSessions(await res.json());
  }, []);

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[1200px] p-8 md:p-margin-page">
        {sessions.length === 0 ? (
          <EmptyState>
            <StartSessionButton onClick={() => setDialogOpen(true)} />
          </EmptyState>
        ) : (
          <>
            <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="font-display text-3xl font-semibold tracking-tight text-on-surface">
                  My Sessions
                </h1>
                <p className="mt-2 max-w-2xl text-lg text-on-surface-variant">
                  Resume your deep dives or launch a new contextual inquiry.
                </p>
              </div>
              <StartSessionButton onClick={() => setDialogOpen(true)} />
            </div>

            <div className="flex flex-col gap-4">
              {sessions.map((session) => (
                <SessionCard key={session.id} session={session} />
              ))}
            </div>
          </>
        )}
        <NewSessionDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onAccept={refresh}
        />
      </div>
    </main>
  );
}
