"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/empty-state";
import { SessionCard } from "@/components/session-card";
import { StartSessionButton } from "@/components/start-session-button";
import { StatePanel } from "@/components/state-panel";
import { NewSessionDialog } from "@/views/mine/new-session-dialog";
import { listExploreSessions, type SessionListItem } from "@/lib/api-client";

/**
 * The public Explore surface at the site root (#150): what people are
 * learning — the newest twenty Sessions that reached materials, goal text
 * first, no names, no pager. The feed is public (#144), so signed-in and
 * Visitor look the same here: no credentials are sent, no 401 can land, and
 * there is no auth-events re-fetch. Like the personal list (#148), the view
 * owns its feed fetch in the browser (#87); the route is a static shell.
 *
 * Three fetch-driven states (#132): **loading** (a friendly panel — never
 * the empty state), **error** (a panel with a Retry that re-runs the
 * fetch), and **ready** (the cards, or — when the deployment has nothing to
 * show yet — the pitch: the record header band stays put, and the blank
 * sheet carries the start-a-Session invitation instead of a bare empty
 * frame). The invitation reuses the personal list's intake dialog (it lives
 * under `views/mine` and is imported here rather than duplicated).
 */
export function Explore() {
  const t = useTranslations("explore");
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [dialogOpen, setDialogOpen] = useState(false);

  /** The error state's Retry: re-run the fetch with full status tracking. */
  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const { sessions } = await listExploreSessions();
      setSessions(sessions);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  // The initial fetch: the route is a static shell, so the view owns its
  // data (#87). The mount state starts at `loading`.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { sessions } = await listExploreSessions();
        if (!cancelled) {
          setSessions(sessions);
          setStatus("ready");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Silent re-fetch after an accepted intake (#132): keep the current list
   *  on failure — a new session joins the feed once it starts generating. */
  const refresh = useCallback(async () => {
    try {
      const { sessions } = await listExploreSessions();
      setSessions(sessions);
    } catch {
      /* keep the current list */
    }
  }, []);

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
        {/* Record header band, same as the personal list — the root reads
            as the app's front door either way. */}
        <header className="relative mb-10 double-rule-b">
          {/* The Colour Press's dot screen at the band's end — the header
              is printed, not pasted on. */}
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
          </div>
        </header>

        {sessions.length === 0 ? (
          <EmptyState title={t("emptyTitle")} body={t("emptyBody")}>
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
