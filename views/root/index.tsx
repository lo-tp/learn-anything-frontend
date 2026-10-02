"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/empty-state";
import { NewSessionDialog } from "./new-session-dialog";
import { SessionCard } from "@/components/session-card";
import { StartSessionButton } from "@/components/start-session-button";
import { StatePanel } from "@/components/state-panel";
import { ApiError, listSessions, type SessionListItem } from "@/lib/api-client";
import { CONFIRMING_PHASES } from "./intake";

/**
 * The home page: the learner's History. Owns the list state, the initial
 * and refresh fetches against `GET /sessions` (the refresh runs after the
 * new-session dialog accepts an intake), and the dialog's open state, and
 * renders the page directly from the pure leaf components in `components/*`.
 * The route is a static shell — the view does the fetching in the browser
 * (#87).
 *
 * Three fetch-driven states (#132): **loading** (the initial fetch in
 * flight — a friendly panel, never the empty state), **error** (a non-401
 * initial failure — a friendly panel with a Retry that re-runs the fetch),
 * and **ready** (the list — empty or filled). A 401 is the special case:
 * the API client already redirected to login (`handleUnauthorized`), so
 * the page suppresses itself while the tab hands over (#94). The refresh
 * after the dialog accepts an intake is a silent re-fetch — it keeps the
 * current list on failure.
 *
 * With sessions: the "My Sessions" header (title + CTA) above the cards.
 * When empty: the header is hidden and the empty state carries the CTA at
 * its base, so there is one primary button in either view. Either CTA
 * opens the new-session dialog (#26).
 */
export function Root() {
  const t = useTranslations("home");
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [dialogOpen, setDialogOpen] = useState(false);
  // A 401 means the API client already redirected to login
  // (`handleUnauthorized`); suppress the page while the tab hands over
  // (#94).
  const [unauthorized, setUnauthorized] = useState(false);

  /** The error state's Retry: re-run the fetch with full status tracking. */
  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const { sessions } = await listSessions(CONFIRMING_PHASES);
      setSessions(sessions);
      setUnauthorized(false);
      setStatus("ready");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUnauthorized(true);
      } else {
        setStatus("error");
      }
    }
  }, []);

  // The initial fetch: the route is a static shell, so the view owns its
  // data (#87). The mount state starts at `loading`.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { sessions } = await listSessions(CONFIRMING_PHASES);
        if (!cancelled) {
          setSessions(sessions);
          setUnauthorized(false);
          setStatus("ready");
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError && err.status === 401) {
            setUnauthorized(true);
          } else {
            setStatus("error");
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Re-fetch the History after an accepted intake — a silent re-fetch:
   *  it keeps the current list on failure (#132). */
  const refresh = useCallback(async () => {
    try {
      const { sessions } = await listSessions(CONFIRMING_PHASES);
      setSessions(sessions);
      setUnauthorized(false);
    } catch {
      /* keep the current list */
    }
  }, []);

  if (unauthorized) return null;

  if (status === "loading") {
    return (
      <StatePanel
        icon={
          <Loader2 className="size-8 animate-spin text-on-surface-variant" aria-hidden />
        }
        title={t("loading.title")}
        note={t("loading.note")}
      />
    );
  }

  if (status === "error") {
    return (
      <StatePanel
        icon={<TriangleAlert className="size-8 text-error" aria-hidden />}
        title={t("error.title")}
        note={t("error.note")}
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="focus-ring mt-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:-translate-y-px hover:shadow-[var(--shadow-sheet-raised)]"
          >
            {t("retry")}
          </button>
        }
      />
    );
  }

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[1200px] p-4 md:p-margin-page">
        {/* Record header band: always the top of the page — the title
            typeset as a printed form header, closed by the double rule.
            With no sessions the CTA lives on the blank sheet instead, so
            the page carries exactly one primary button either way. */}
        <header className="relative mb-10 double-rule-b">
          {/* The Colour Press's dot screen behind the CTA end of the band —
              the header is printed, not pasted on. */}
          <span
            aria-hidden
            className="halftone pointer-events-none absolute top-0 right-0 hidden h-full w-56 text-engage opacity-[0.13] md:block"
          />
          <div className="flex flex-col gap-6 pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold uppercase tracking-[0.04em] text-on-surface">
                {t("title")}
              </h1>
              <p className="mt-3 max-w-2xl text-[15px] text-on-surface-variant">
                {t("subtitle")}
              </p>
            </div>
            {sessions.length > 0 ? (
              <StartSessionButton onClick={() => setDialogOpen(true)} />
            ) : null}
          </div>
        </header>

        {sessions.length === 0 ? (
          <EmptyState>
            <StartSessionButton onClick={() => setDialogOpen(true)} />
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-4">
              {sessions.map((session, i) => (
                <SessionCard
                  key={session.session_id}
                  session={session}
                  delay={Math.min(i * 40, 320)}
                />
              ))}
            </div>
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
