"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ControlBar } from "@/components/control-bar";
import { PhaseIndicator } from "@/components/phase-indicator";
import { StatePanel } from "@/components/state-panel";
import { QuizQuestion } from "@/components/session/quiz-question";
import { SessionSidebar, type SidebarGroup } from "@/components/session/session-sidebar";
import { SandboxFrame } from "@/components/sandbox/sandbox-frame";
import { useTheme, type Theme } from "@/hooks/use-theme";
import {
  getMaterials,
  getSession,
  isSignedIn,
  postReviewCard,
  type MaterialsOut,
  type ReviewCardIn,
  type SessionState,
} from "@/lib/api-client";
import { onSignedIn, onSignedOut, requestSignIn } from "@/lib/auth-events";

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
 *
 * One address, two audiences (#151): the route serves a signed-in User and
 * a Visitor the same deck — the reads are public, so both open it by
 * address or from an Explore card. The audiences differ in what a miss
 * keeps: a User's missed question becomes a review card, a Visitor's
 * answer stays local to this view and no write is attempted. The view
 * settles the audience once on mount (`isSignedIn`, the `GET /auth/me`
 * probe — a 401 is a Visitor, not an error) and flips it in place on
 * sign-in/out (#147), with no navigation.
 *
 * A Visitor's missed questions are held in a pending set and replayed
 * into the Review deck on sign-in (#152); the first miss raises a nudge
 * that offers signing in as the way to keep them.
 */
export function Session({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<SessionState | null>(null);
  const [materials, setMaterials] = useState<MaterialsOut | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pollError, setPollError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  // The viewer is a Visitor until the identity probe confirms a User
  // (#151) — a miss becomes a review card only from a confirmed User.
  const [isUser, setIsUser] = useState(false);
  // Held misses from this deck visit, replayed on sign-in (#152)
  const [pendingMisses, setPendingMisses] = useState<ReviewCardIn[]>([]);
  // True once the nudge has been shown this deck visit (#152)
  const [hasNudged, setHasNudged] = useState(false);
  // True when a replay attempt failed — the misses stay held, not dropped (#152)
  const [replayFailed, setReplayFailed] = useState(false);
  const inFlight = useRef(false);
  // Ref so the sign-in handler reads the current pending misses (#152)
  const pendingMissesRef = useRef<ReviewCardIn[]>([]);
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

  /**
   * Settle the viewer's audience once (#151): the `GET /auth/me` probe
   * confirms a signed-in User, and a 401 leaves the view as a Visitor's —
   * it never writes from a miss, and it never asks for the sign-in modal
   * (an unsigned visitor is the expected caller of this route, not an
   * error). A transient probe failure settles the same way: no write.
   */
  useEffect(() => {
    let cancelled = false;
    isSignedIn()
      .then((signedIn) => {
        if (!cancelled) setIsUser(signedIn);
      })
      .catch(() => {
        /* a Visitor — no error surface, no sign-in request */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Keep the ref in sync with the state for the sign-in handler (#152). */
  useEffect(() => {
    pendingMissesRef.current = pendingMisses;
  }, [pendingMisses]);

  /**
   * Sign-in and sign-out flip the audience in place (#147): no navigation.
   * On sign-in, held misses from the deck visit are replayed into the
   * Review deck (#152).
   */
  useEffect(() => {
    const stopIn = onSignedIn(() => {
      setIsUser(true);
      const misses = pendingMissesRef.current;
      if (misses.length === 0) return;
      Promise.allSettled(misses.map((m) => postReviewCard(m))).then(
        (results) => {
          if (results.some((r) => r.status === "rejected")) {
            setReplayFailed(true);
            // Misses stay held — retryable on the next sign-in
          } else {
            pendingMissesRef.current = [];
            setPendingMisses([]);
            setHasNudged(false);
            setReplayFailed(false);
          }
        },
      );
    });
    const stopOut = onSignedOut(() => setIsUser(false));
    return () => {
      stopIn();
      stopOut();
    };
  }, []);

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

  /** The flattened deck: every slide/question in step order, tagged with its parent step_id. */
  const deck = useMemo(
    () => (materials?.generated_steps ?? []).flatMap((step) =>
      step.items.map((item) => ({ ...item, step_id: step.step_id })),
    ),
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
  /** The shared footer action of the friendly states: a link home. */
  const backToSessions = (
    <Link
      href="/mine"
      className="focus-ring mt-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:-translate-y-px hover:shadow-[var(--shadow-sheet-raised)]"
    >
      {t("backToSessions")}
    </Link>
  );

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
          <Loader2 className="size-8 animate-spin text-on-surface-variant" aria-hidden />
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
        action={backToSessions}
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
        action={backToSessions}
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
        action={backToSessions}
      />
    );
  }

  if (deck.length === 0) {
    // Reaching here means the phase is `generating` (with no items yet —
    // `materials` null or empty steps both flatten to an empty deck).
    // A poll failure only changes the note — the 3s poll self-retries, so
    // there is no user action to surface (#132).
    return (
      <StatePanel
        icon={
          <Loader2 className="size-8 animate-spin text-on-surface-variant" aria-hidden />
        }
        title={t("generating.title")}
        note={
          pollError
            ? t("generating.pollingNote")
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
        inquiryId={session.session_id}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 bg-surface px-6 double-rule-b">
          <span className="min-w-0 flex-1 truncate font-display text-base font-semibold text-on-surface">
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
            <div className="flex min-h-full flex-col items-center justify-center gap-6">
              <QuizQuestion
                question={active}
                selected={answers[active.id] ?? null}
                onSelect={(i) => {
                  setAnswers((prev) => ({ ...prev, [active.id]: i }));
                  if (i === active.correct_index) return;
                  const miss: ReviewCardIn = {
                    source: "material",
                    session_id: sessionId,
                    question_id: active.id,
                    question: {
                      text: active.text,
                      options: active.options,
                      correct_index: active.correct_index,
                      explanation: active.explanation,
                    },
                    step_id: active.step_id,
                    selected_index: i,
                  };
                  if (isUser) {
                    // A confirmed User's miss becomes a review card (#151)
                    postReviewCard(miss).catch(() => {});
                  } else {
                    // A Visitor's miss is held locally and replayed on sign-in (#152)
                    setPendingMisses((prev) => [...prev, miss]);
                    if (!hasNudged) setHasNudged(true);
                  }
                }}
              />
              {hasNudged && (
                <div className="w-full max-w-2xl rounded-md border border-engage/40 bg-engage/5 p-4">
                  <div className="flex items-start gap-3">
                    <TriangleAlert
                      className="mt-0.5 size-4 shrink-0 text-engage"
                      aria-hidden
                    />
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-on-surface">
                        {t("nudge.title")}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">
                        {replayFailed ? t("nudge.replayFailed") : t("nudge.body")}
                      </p>
                      <button
                        type="button"
                        onClick={requestSignIn}
                        className="focus-ring mt-3 rounded-md bg-engage px-3 py-1.5 text-sm font-semibold text-on-engage transition-opacity hover:opacity-90"
                      >
                        {t("nudge.action")}
                      </button>
                    </div>
                  </div>
                </div>
              )}
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


