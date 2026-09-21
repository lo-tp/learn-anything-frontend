"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/empty-state";
import { NewSessionDialog } from "./new-session-dialog";
import { SessionCard } from "@/components/session-card";
import { StartSessionButton } from "@/components/start-session-button";
import { listSessions, type SessionListItem } from "@/lib/api-client";

/**
 * The home page: the learner's History. Owns the list state, the initial
 * and refresh fetches against `GET /sessions` (the refresh runs after the
 * new-session dialog accepts an intake), and the dialog's open state, and
 * renders the page directly from the pure leaf components in `components/*`.
 * The route is a static shell — the view does the fetching in the browser
 * (#87). While the initial fetch is in flight (or the backend is
 * unreachable), the empty state shows; the refresh can retry.
 *
 * With sessions: the "My Sessions" header (title + CTA) above the cards.
 * When empty: the header is hidden and the empty state carries the CTA at its
 * base, so there is one primary button in either view. Either CTA opens the
 * new-session dialog (#26).
 */
export function Root() {
  const t = useTranslations("home");
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  /** Re-fetch the History from the backend and swap the list in place. */
  const refresh = useCallback(async () => {
    try {
      const { sessions } = await listSessions();
      setSessions(sessions);
    } catch {
      /* keep the current list */
    }
  }, []);

  // The initial fetch: the route is a static shell, so the view owns its
  // data (#87).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { sessions } = await listSessions();
        if (!cancelled) setSessions(sessions);
      } catch {
        /* keep the current list */
      }
    })();
    return () => {
      cancelled = true;
    };
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
                  {t("title")}
                </h1>
                <p className="mt-2 max-w-2xl text-lg text-on-surface-variant">
                  {t("subtitle")}
                </p>
              </div>
              <StartSessionButton onClick={() => setDialogOpen(true)} />
            </div>

            <div className="flex flex-col gap-4">
              {sessions.map((session) => (
                <SessionCard key={session.session_id} session={session} />
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
