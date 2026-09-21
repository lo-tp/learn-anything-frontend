"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ControlBar } from "@/components/control-bar";
import { PhaseIndicator } from "@/components/phase-indicator";
import { QuizQuestion } from "@/components/session/quiz-question";
import { SessionSidebar, type SidebarGroup } from "@/components/session/session-sidebar";
import { SandboxFrame } from "@/components/sandbox/sandbox-frame";
import { useTheme, type Theme } from "@/hooks/use-theme";
import {
  getMaterials,
  getSession,
  type MaterialsOut,
  type SessionState,
} from "@/lib/api-client";

/** How often the view polls while materials are still generating. */
const POLL_INTERVAL_MS = 3000;

/** The phases before material generation has begun. */
const PRE_MATERIAL = new Set(["clarifying", "probing", "planning", "reviewing"]);

/**
 * The sandbox URL that serves a slide item's content. The app's theme is
 * passed as a query param so the slide page renders in the same palette
 * (`?theme=light` sets the `light` class on the page's `<html>`, #78);
 * absent/dark keeps the page's dark default.
 */
const sandboxSrc = (slideId: string, theme: Theme) =>
  `${process.env.NEXT_PUBLIC_SANDBOX_ORIGIN}/slides/${slideId}?theme=${theme}`;

/**
 * The `/session/{sessionId}` view (#47). **Client** component — the single
 * state owner for the materials deck: the fetched session and materials, the
 * polled materials, the active (flattened) item, and the quiz selections.
 * The route is a static shell, so the view owns the initial fetch (session
 * state + materials in parallel, each tolerating its own failure — the
 * backend may be unreachable, or the session/materials may not exist yet)
 * and the refresh polls (#87).
 *
 * The deck is `generated_steps` flattened — one card per slide/question —
 * grouped in the sidebar under step-summary dividers. While the session is
 * in `generating`, the view polls `getMaterials` until content arrives;
 * the polled response's phase beats the session's. Friendly states
 * (loading / not found / error / not ready / generating) render instead of
 * the deck. The shared frame is applied by the root layout.
 */
export function Session({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<SessionState | null>(null);
  const [materials, setMaterials] = useState<MaterialsOut | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pollError, setPollError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const inFlight = useRef(false);
  const t = useTranslations("session");
  const { theme } = useTheme();

  /** The freshest known phase — the polled materials beat the session. */
  const phase = materials?.phase ?? session?.phase ?? null;
  const generating = phase === "generating";

  /**
   * The initial fetch: session state and materials in parallel, each
   * tolerating its own failure (the backend may be unreachable, or the
   * session/materials may not exist yet — the view renders the friendly
   * states, so there is no `notFound()`). #87
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [sessionResult, materialsResult] = await Promise.allSettled([
        getSession(sessionId),
        getMaterials(sessionId),
      ]);
      if (cancelled) return;
      setSession(
        sessionResult.status === "fulfilled" ? sessionResult.value : null,
      );
      setMaterials(
        materialsResult.status === "fulfilled" ? materialsResult.value : null,
      );
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  /** Poll every 3s while generating; the cleanup stops it on phase change. */
  useEffect(() => {
    if (!generating) return;
    const poll = async () => {
      if (inFlight.current) return; // never overlap in-flight polls
      inFlight.current = true;
      try {
        setMaterials(await getMaterials(sessionId));
        setPollError(false);
      } catch {
        setPollError(true);
      } finally {
        inFlight.current = false;
      }
    };
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [generating, sessionId]);

  /** The flattened deck: every slide/question in step order. */
  const deck = useMemo(
    () => (materials?.generated_steps ?? []).flatMap((step) => step.items),
    [materials],
  );

  /** The sidebar's step groups: the divider plus each step's flat indices. */
  const groups = useMemo<SidebarGroup[]>(() => {
    let offset = 0;
    return (materials?.generated_steps ?? []).map((step) => ({
      step,
      items: step.items.map((item) => ({ index: offset++, item })),
    }));
  }, [materials]);

  // ── Active item + slide player (hooks must run before any early return) ──
  const total = deck.length;
  const clampedIndex = Math.min(activeIndex, total - 1);
  const active = deck[clampedIndex];

  // The slide player is one persistent iframe whose `src` changes only when
  // the theme does (to re-sync the slide page's palette, #78): it always
  // loads the session's first slide, and each slide switch is told to the
  // sandbox harness via `postMessage` (it swaps the rendered slide in its
  // own React state). Navigating the iframe to a per-slide URL appends a
  // top-level history entry that swallows the browser Back button (#80) — so
  // slide switches never change `src`. The sidebar mini previews already use
  // a per-theme constant `src` (one fixed slide each) and are measured not
  // to add history entries.
  const playerRef = useRef<HTMLIFrameElement>(null);
  const firstSlideId = useMemo(
    () => deck.find((d) => d.type === "slide")?.slide_id ?? null,
    [deck],
  );
  const activeSlideId = active?.type === "slide" ? active.slide_id : null;

  // Tell the player which slide to show whenever the active slide changes.
  useEffect(() => {
    if (!activeSlideId) return;
    playerRef.current?.contentWindow?.postMessage(
      { type: "DEMO_SET_SLIDE", slideId: activeSlideId },
      "*",
    );
  }, [activeSlideId]);

  // The harness may not be listening on first paint — resync on load so the
  // correct slide shows even when it differs from the iframe's static `src`.
  // The handler's closure carries the current `activeSlideId`.
  const handlePlayerLoad = () => {
    if (!activeSlideId) return;
    playerRef.current?.contentWindow?.postMessage(
      { type: "DEMO_SET_SLIDE", slideId: activeSlideId },
      "*",
    );
  };

  // ── Render branches, in priority order ──────────────────────────

  if (!loaded) {
    return (
      <StatePanel
        icon={
          <Loader2 className="size-8 animate-spin text-tertiary" aria-hidden />
        }
        title={t("loading.title")}
        note={t("loading.note")}
      />
    );
  }

  if (session === null) {
    return (
      <StatePanel
        icon={<TriangleAlert className="size-8 text-error" aria-hidden />}
        title={t("notFound.title")}
        note={t("notFound.note")}
      />
    );
  }

  if (phase === "error") {
    return (
      <StatePanel
        icon={<TriangleAlert className="size-8 text-error" aria-hidden />}
        title={t("error.title")}
        note={t("error.note")}
        chip={<PhaseIndicator phase={phase} />}
      />
    );
  }

  // Pre-material phases show "not ready"; a null `materials` for a
  // post-material phase (the materials fetch failed) does too — the
  // generating panel is only honest while the phase is `generating`.
  if (PRE_MATERIAL.has(phase ?? "") || (materials === null && phase !== "generating")) {
    return (
      <StatePanel
        title={t("notReady.title")}
        note={t("notReady.note")}
        subtitle={session.narrowed_goal ?? undefined}
        chip={<PhaseIndicator phase={phase} />}
      />
    );
  }

  if (deck.length === 0) {
    // Reaching here means the phase is `generating` (with no items yet —
    // `materials` null or empty steps both flatten to an empty deck).
    return (
      <StatePanel
        icon={
          <Loader2 className="size-8 animate-spin text-tertiary" aria-hidden />
        }
        title={t("generating.title")}
        note={
          pollError
            ? t("generating.retryNote")
            : t("generating.note")
        }
      />
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      <SessionSidebar
        groups={groups}
        activeIndex={clampedIndex}
        onSelect={setActiveIndex}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-outline-variant bg-surface px-6">
          <span className="truncate text-sm font-medium text-on-surface">
            {session.narrowed_goal ?? t("learningSession")}
          </span>
          <PhaseIndicator phase={phase} />
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-6">
          {firstSlideId && (
            <div className={active.type === "slide" ? "h-full" : "hidden"}>
              <SandboxFrame
                ref={playerRef}
                src={sandboxSrc(firstSlideId, theme)}
                onLoad={handlePlayerLoad}
              />
            </div>
          )}
          {active.type === "question" && (
            <div className="flex min-h-full items-center justify-center">
              <QuizQuestion
                question={active}
                selected={answers[active.id] ?? null}
                onSelect={(i) =>
                  setAnswers((prev) => ({ ...prev, [active.id]: i }))
                }
              />
            </div>
          )}
        </main>

        <footer className="flex h-16 shrink-0 items-center justify-end border-t border-outline-variant bg-surface px-6">
          <ControlBar
            index={clampedIndex + 1}
            total={total}
            onPrev={() => setActiveIndex((i) => Math.max(0, i - 1))}
            onNext={() => setActiveIndex((i) => Math.min(total - 1, i + 1))}
          />
        </footer>
      </div>
    </div>
  );
}

/**
 * The friendly full-page states (not found / error / not ready /
 * generating): a centered icon, title, optional subtitle, note, phase
 * chip, and a link back to the home page.
 */
function StatePanel({
  icon,
  title,
  note,
  subtitle,
  chip,
}: {
  icon?: React.ReactNode;
  title: string;
  note: string;
  subtitle?: string;
  chip?: React.ReactNode;
}) {
  const t = useTranslations("session");
  return (
    <main className="flex flex-1 items-center justify-center overflow-y-auto">
      <div className="flex flex-col items-center gap-3 p-8 text-center">
        {icon}
        <h1 className="font-display text-2xl font-semibold text-on-surface">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-on-surface-variant">{subtitle}</p>
        )}
        <p className="max-w-md text-sm text-on-surface-variant">{note}</p>
        {chip}
        <Link
          href="/"
          className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-fixed"
        >
          {t("backToSessions")}
        </Link>
      </div>
    </main>
  );
}
