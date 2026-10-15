"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ControlBar } from "@/components/control-bar";
import { PhaseIndicator } from "@/components/phase-indicator";
import { StatePanel } from "@/components/state-panel";
import { QuizQuestion } from "@/components/session/quiz-question";
import { RegenerateSlideSheet } from "@/components/session/regenerate-slide-sheet";
import { SlideRegenerateControl } from "@/components/session/slide-regenerate";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SessionSidebar, type SidebarGroup } from "@/components/session/session-sidebar";
import { SandboxFrame } from "@/components/sandbox/sandbox-frame";
import { useTheme } from "@/hooks/use-theme";
import {
  getMaterials,
  getSession,
  postReviewCard,
  regenerateSlide,
  type MaterialsOut,
  type ReviewCardIn,
  type SessionState,
} from "@/lib/api-client";
import { onSignedIn, requestSignIn } from "@/lib/auth-events";
import { cn, sandboxSlideSrc } from "@/lib/utils";
import { useSignInState } from "@/hooks/use-sign-in-state";

/** How often the view polls while materials are still generating. */
const POLL_INTERVAL_MS = 3000;

/** The phases before material generation has begun. */
const PRE_MATERIAL = new Set(["clarifying", "probing", "planning", "reviewing"]);

/**
 * The statuses whose answer is a sentence the backend wrote for a learner
 * (#197): mock mode, no such slide, and the three 409s (the deck is
 * generating, this slide is already being rewritten, this slide predates stored
 * content specs). Anything else — a 5xx, a transport failure — is not the
 * backend talking, so the app speaks in its own words instead of passing an
 * internal message through.
 */
const BACKEND_REFUSALS = new Set([400, 404, 409]);

function refusalText(error: unknown): string {
  const detail = (error as { status?: unknown; message?: unknown } | undefined)
    ?.message;
  const status = (error as { status?: unknown } | undefined)?.status;
  const text = typeof detail === "string" ? detail : "";
  return typeof status === "number" && BACKEND_REFUSALS.has(status) ? text : "";
}

/** Does this deck read report this slide as being rewritten? */
function readReportsRewrite(read: MaterialsOut, slideId: string): boolean {
  return read.generated_steps.some((step) =>
    step.items.some(
      (item) =>
        item.type === "slide" && item.slide_id === slideId && item.regenerating,
    ),
  );
}

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
 * answer stays local to this view and no write is attempted. The view reads
 * the page's sign-in state (`useSignInState`, #143) rather than probing for
 * itself: while that state is unsettled, or its probe failed, the deck is a
 * Visitor's and writes nothing; it flips in place on sign-in/out (#147),
 * with no navigation.
 *
 * A Visitor's missed questions are held in a pending set and replayed
 * into the Review deck on sign-in (#152); the first miss raises a nudge
 * that offers signing in as the way to keep them.
 */

/**
 * The deck's arrow-key map: ArrowUp walks to the previous item, ArrowDown
 * to the next. Modifier-held keys are the browser's (reload, page up/down)
 * and never the deck's, and arrow keys pressed while the reader is in a
 * text field move the caret, not the slide — those are ignored so the
 * deck never steals input navigation. Everything else is not a deck key.
 */
export function deckMoveFor(
  e: KeyboardEvent,
): "prev" | "next" | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  const target = e.target;
  if (target instanceof HTMLElement) {
    const tag = target.tagName;
    if (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      target.isContentEditable
    ) {
      return null;
    }
  }
  if (e.key === "ArrowUp") return "prev";
  if (e.key === "ArrowDown") return "next";
  return null;
}

export function Session({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<SessionState | null>(null);
  const [materials, setMaterials] = useState<MaterialsOut | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pollError, setPollError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  // The viewer is a Visitor until the page's sign-in state confirms a User
  // (#151/#143) — a miss becomes a review card only from a confirmed User.
  const { signedIn: isUser } = useSignInState();
  // Held misses from this deck visit, replayed on sign-in (#152)
  const [pendingMisses, setPendingMisses] = useState<ReviewCardIn[]>([]);
  // True once the nudge has been shown this deck visit (#152)
  const [hasNudged, setHasNudged] = useState(false);
  // True when a replay attempt failed — the misses stay held, not dropped (#152)
  const [replayFailed, setReplayFailed] = useState(false);
  const inFlight = useRef(false);
  // Ref so the sign-in handler reads the current pending misses (#152)
  const pendingMissesRef = useRef<ReviewCardIn[]>([]);
  // ── One-slide regeneration (#213) ─────────────────────────────────────
  // The slide the regeneration sheet is open for, if any.
  const [regenSheetFor, setRegenSheetFor] = useState<string | null>(null);
  /**
   * Slides this view has asked for, each paired with the deck read that was
   * current when the request was made (#213). A `202` says only that a rewrite
   * *started*, and the deck read that answered the request is the one that
   * carries the slide's own flag — so a mark lives exactly as long as no newer
   * read has contradicted or taken over from it. A mark with no snapshot to
   * compare against could never be lifted: the slide would sit in flight forever.
   */
  const [requestedRegens, setRequestedRegens] = useState<
    ReadonlyMap<string, MaterialsOut | null>
  >(new Map());
  // The request round-trip, so the sheet cannot be pressed twice.
  const [regenSubmitting, setRegenSubmitting] = useState(false);
  // A refusal's text, shown in the sheet that asked for it.
  const [regenError, setRegenError] = useState<string | null>(null);
  /**
   * Bumped when a rewrite finishes. The player frame's URL is the only thing
   * that can bring the new slide to the reader: the slide keeps its ID, and a
   * frame re-importing the URL it already fetched gets the module map's copy —
   * the slide it was written from (#213).
   */
  const [frameNonce, setFrameNonce] = useState(0);
  /**
   * Slides this view has watched finish a rewrite, and how many times each has
   * done so. The sidebar's mini previews are separate documents the player's
   * re-key never touches, so each one needs its own not-yet-fetched URL for
   * the slide it previews, or it keeps showing the version the slide was
   * written from (#213).
   */
  const [rewrittenSlides, setRewrittenSlides] = useState<ReadonlyMap<
    string,
    number
  >>(new Map());
  /** What this view last believed to be in flight. The flag's *falling edge*
   *  is the only completion signal the API has, so it has to be remembered to
   *  be noticed. */
  const seenRegenerating = useRef<ReadonlySet<string>>(new Set());
  // True when a rewrite just finished: what the live region says about it.
  const [regenDone, setRegenDone] = useState(false);
  const t = useTranslations("session");
  const { theme } = useTheme();

  /** The freshest known phase — the polled materials beat the session. */
  const phase = materials?.phase ?? session?.phase ?? null;
  const generating = phase === "generating";

  /**
   * One deck read. `inFlight` is the guard that keeps two polls from ever
   * overlapping — the interval's tick and a view-triggered refresh share it.
   */
  const refreshMaterials = useCallback(async (): Promise<MaterialsOut | null> => {
    if (inFlight.current) return null; // the guard is shared: one read at a time
    inFlight.current = true;
    try {
      const read = await getMaterials(sessionId);
      setMaterials(read);
      setPollError(false);
      return read;
    } catch {
      setPollError(true);
      return null;
    } finally {
      inFlight.current = false;
    }
  }, [sessionId]);

  /** The initial fetch: session state and materials in parallel, each
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

  /** Keep the ref in sync with the state for the sign-in handler (#152). */
  useEffect(() => {
    pendingMissesRef.current = pendingMisses;
  }, [pendingMisses]);

  /**
   * The sign-in state flips the audience in place (#147) — the state itself
   * is held for the page, so this handler owns only what this view owes the
   * change: held misses from the deck visit are replayed into the Review
   * deck on sign-in (#152). A sign-out is not handled here: the account menu
   * leaves this page for the public Explore list at the site root.
   */
  useEffect(() => {
    const stopIn = onSignedIn(() => {
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
    return () => {
      stopIn();
    };
  }, []);

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

  // ── Which slides are being rewritten (#213) ────────────────────────────
  /**
   * The requests whose snapshot is still the current deck read — the stretch
   * where this view has asked for a slide and no read newer than its own ask
   * has landed. As soon as a newer read lands the mark is retired: that read
   * either carries the slide's own flag (the flag takes over) or says the slide
   * is not being rewritten (the rewrite already ended).
   */
  const liveRequests = useMemo(() => {
    const live = new Set<string>();
    for (const [slideId, snapshot] of requestedRegens) {
      if (snapshot === materials) live.add(slideId);
    }
    return live;
  }, [requestedRegens, materials]);

  /**
   * In flight, for the indicator and for the poll's own guard: the deck read's
   * flag — the truth — plus the live requests above, which only cover the gap
   * before that flag can be seen.
   */
  const regeneratingSlides = useMemo(() => {
    const ids = new Set<string>();
    for (const item of deck) {
      if (item.type === "slide" && item.regenerating) ids.add(item.slide_id);
    }
    for (const id of liveRequests) ids.add(id);
    return ids;
  }, [deck, liveRequests]);
  const anyRegenerating = regeneratingSlides.size > 0;

  /**
   * Poll every 3s while the deck is generating **or** while one of its slides
   * is being rewritten (#213). `regenerating` is the only completion signal the
   * API has, and it lives in this read; the cleanup stops the interval when
   * neither is true any more.
   */
  useEffect(() => {
    if (!generating && !anyRegenerating) return;
    const timer = setInterval(() => {
      void refreshMaterials();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [generating, anyRegenerating, refreshMaterials]);

  /**
   * The falling edge of that flag is the completion signal (#197's follow-up):
   * a rewrite that was in flight and now is not. Everything the view does on
   * that edge — drop its own mark, re-key the player frame, say so to a screen
   * reader — is a once-per-rewrite act, so the previous set is kept in a ref
   * and compared instead of re-deriving the moment.
   *
   * It fires for a rewrite that started somewhere else too (another tab, a
   * rewrite that was already running when this deck was opened), which is the
   * honest reading: the slide in front of the reader changed.
   */
  useEffect(() => {
    const previous = seenRegenerating.current;
    seenRegenerating.current = regeneratingSlides;

    // A new rewrite started: the next news this region tells is new text, so a
    // later completion is announced rather than repeating the last sentence.
    if (regeneratingSlides.size > previous.size) setRegenDone(false);

    const finished = [...previous].filter((id) => !regeneratingSlides.has(id));
    if (finished.length === 0) return;

    setRequestedRegens((prev) => {
      const next = new Map(prev);
      for (const id of finished) next.delete(id);
      return next;
    });
    setFrameNonce((n) => n + 1);
    setRewrittenSlides((prev) => {
      const next = new Map(prev);
      for (const id of finished) next.set(id, (next.get(id) ?? 0) + 1);
      return next;
    });
    setRegenDone(true);
  }, [regeneratingSlides]);

  // ── Active item + slide player (hooks must run before any early return) ──
  const total = deck.length;
  const clampedIndex = Math.min(activeIndex, total - 1);
  const active = deck[clampedIndex];

  /**
   * Walk the deck one item, clamped at both ends. The footer's prev/next
   * and the arrow keys share this exact step, so the two cannot drift.
   */
  const stepDeck = useCallback(
    (move: "prev" | "next") => {
      setActiveIndex((i) =>
        move === "next" ? Math.min(total - 1, i + 1) : Math.max(0, i - 1),
      );
    },
    [total],
  );

  /**
   * Keyboard deck navigation: ArrowUp/ArrowDown walk the flattened deck
   * exactly like the footer's prev/next. The listener is window-level and
   * answers only when the deck is on screen (`total > 0` — the friendly
   * states have no deck to walk). `preventDefault` stops the page from
   * also scrolling. Keys held with a modifier and keys typed in text
   * fields are never the deck's — see `deckMoveFor`.
   */
  useEffect(() => {
    // The sheet is a modal ask about one slide: while it is open the deck is
    // held still, so the reader cannot walk away from the slide they are asking
    // about mid-question (#213).
    if (total === 0 || regenSheetFor !== null) return;
    const onKey = (e: KeyboardEvent) => {
      const move = deckMoveFor(e);
      if (move === null) return;
      e.preventDefault();
      stepDeck(move);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total, stepDeck, regenSheetFor]);

  // The slide player is one persistent iframe whose `src` is built **once per
  // deck** and never changes after that: it always loads the session's first
  // slide, and each slide switch is told to the sandbox harness via
  // `postMessage` (it swaps the rendered slide in its own React state).
  // Navigating the iframe to a per-slide URL appends a top-level history entry
  // that swallows the browser Back button (#80) — so slide switches never
  // change `src`. A theme switch must not change it either (#185): a `src`
  // change is a whole frame reload, and a fresh frame begins on its own slug,
  // so the reader who was on item 5 lands on item 1 with the slide bundle
  // re-fetched, its entrance animation replayed and its in-slide state
  // discarded. Themes travel as `DEMO_SET_THEME`, which the harness answers by
  // toggling the `light` class on its own `<html>` — the palette.css the frame
  // loads carries both palettes, so everything repaints in place. The sidebar
  // mini previews keep a per-theme constant `src` (one fixed slide each),
  // except a slide that has just been rewritten: its preview is a separate
  // document the player's re-key never touches, so it gets its own `fresh=`
  // nonce and re-fetches — the rail must not keep showing the version the
  // reader asked to be replaced (#213).
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

  /**
   * The player frame's URL, built **once per deck** (#185). Keyed on the slide
   * it loads — a new deck is a new frame; a theme change is not, because a new
   * `src` would be a frame reload and a reload lands on the frame's own slug,
   * item 1 (see the note above).
   *
   * A finished slide rewrite is the one other thing that rebuilds it (#213), and
   * it is keyed on `frameNonce`, never on the theme: the deck's first slide
   * stays the slide the frame loads, and the reader lands back on the item they
   * were on through the existing `load` / `SANDBOX_READY` resync.
   *
   * The theme it carries is the one `<html>` has when the frame is built, which
   * is already the reader's stored theme: `useTheme` adopts the stored value in
   * a `useLayoutEffect` before paint (`hooks/use-theme.ts`) and the deck only
   * renders once the materials fetch has resolved. A cold load therefore paints
   * in that palette with no dark-frame flash.
   */
  const [deckFrame, setDeckFrame] = useState<{
    slug: string;
    nonce: number;
    url: string;
  } | null>(null);
  if (
    firstSlideId &&
    (deckFrame?.slug !== firstSlideId || deckFrame.nonce !== frameNonce)
  ) {
    // React's render-time state adjustment: the deck's first slide and the
    // current nonce are the key, so a new deck or a finished rewrite gets a new
    // URL, and a theme change (same slug, same nonce) does not re-enter this
    // branch — the frame keeps the `?theme=` of its first paint and is re-themed
    // by message instead (#185).
    setDeckFrame({
      slug: firstSlideId,
      nonce: frameNonce,
      url: sandboxSlideSrc(firstSlideId, theme, frameNonce),
    });
  }
  const playerSrc = deckFrame?.url ?? null;

  /**
   * Tell the frame the reader's current item *and* the app's current theme:
   * `postMessage` is the only channel to a cross-origin frame, and it is the
   * one that leaves the frame where it is (#185). Both are sent together —
   * each is idempotent in the harness, and a post that lands before the frame
   * is listening is re-sent by its `load` / `SANDBOX_READY` cues below.
   */
  const postToPlayer = useCallback(() => {
    const frame = playerRef.current;
    if (!frame?.contentWindow) return;
    frame.contentWindow.postMessage({ type: "DEMO_SET_THEME", theme }, "*");
    if (activeSlideId) {
      frame.contentWindow.postMessage(
        { type: "DEMO_SET_SLIDE", slideId: activeSlideId },
        "*",
      );
    }
  }, [theme, activeSlideId]);

  // The frame follows the deck: a new item or a new theme is posted, never
  // re-requested (#185). `postToPlayer`'s identity *is* that pair, so this
  // effect runs exactly when either changes.
  useEffect(postToPlayer, [postToPlayer]);

  /**
   * The harness may not be listening on first paint — resync on load, so the
   * correct slide and palette show even when they differ from the frame's
   * static `src`. The callback's closure carries the current item and theme.
   */
  const handlePlayerLoad = postToPlayer;

  /**
   * `SANDBOX_READY` is the harness saying "my listener exists now" (#185). It
   * is the cue that turns a post that raced the frame's mount from a lost
   * first paint into a retry, so answering it is what makes the first paint
   * correct rather than eventually correct.
   */
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const frame = playerRef.current;
      // `event.source` is who sent it: only the player frame's own cue counts
      // — a `SANDBOX_READY` from anywhere else (this window included) is not
      // a frame that needs resyncing.
      if (!frame || event.source !== frame.contentWindow) return;
      if ((event.data as { type?: unknown } | null)?.type !== "SANDBOX_READY") {
        return;
      }
      postToPlayer();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [postToPlayer]);

  // ── Asking for one slide back (#213) ──────────────────────────────
  /**
   * The control press. A User is asked what they want changed; a Visitor is not,
   * because this is a gated write (#178) and a doomed request is a worse answer
   * than the sign-in ask. `requestSignIn` opens the modal over this deck, in
   * place (#147).
   */
  const askForRegeneration = (slideId: string) => {
    if (!isUser) {
      requestSignIn();
      return;
    }
    setRegenError(null);
    setRegenSheetFor(slideId);
  };

  /**
   * The sheet's submit. What it sent is the request; what happens next is the
   * view's reading of the answer:
   *
   * - **202 — started, not done.** The slide is marked in the same commit that
   *   answered, so the very next deck read carries it; the mark above covers the
   *   stretch until then, and `refreshMaterials` shortens even that.
   * - **A refusal that is the deck having moved under the request** — most often
   *   “this slide is already being regenerated”. Re-read first: if the deck now
   *   says this slide *is* being rewritten, the honest answer is the loading
   *   state and a closed sheet, not a message, and the control is gone so no
   *   second request can be made.
   * - **Any other refusal — its reason, in the sheet that asked.** “This slide
   *   predates stored content specs; regenerate the whole deck instead” is a dead
   *   end the learner has to be told about in so many words. A failure that is
   *   not one of the backend's own refusals gets the app's words instead
   *   (`refusalText`), never an internal message.
   */
  const submitRegeneration = async (slideId: string, feedback: string | null) => {
    setRegenSubmitting(true);
    setRegenError(null);
    try {
      await regenerateSlide(sessionId, slideId, feedback);
      setRequestedRegens((prev) => new Map(prev).set(slideId, materials));
      setRegenSheetFor(null);
      setRegenDone(false);
      void refreshMaterials();
    } catch (error) {
      const fresh = await refreshMaterials();
      if (fresh !== null && readReportsRewrite(fresh, slideId)) {
        setRegenSheetFor(null);
        setRegenDone(false);
        return;
      }
      setRegenError(refusalText(error));
    } finally {
      setRegenSubmitting(false);
    }
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

  /**
   * The header's title line: the session's narrowed goal, or the generic label
   * for a session that has none. The voice is named once because the clipped
   * line and the slip that prints it in full are one text shown twice (#210):
   * they must be set identically, or the reader reads them as two things.
   */
  const headerTitle = session.narrowed_goal ?? t("learningSession");
  const headerTitleVoice =
    "font-display text-base font-semibold text-on-surface";

  /**
   * The slide the regeneration affordance belongs to, or null. It is offered on
   * a slide and on nothing else: not on a question, and not while the deck is
   * still being written (`generating`) — the whole-deck route already owns that
   * work, and the backend refuses a single-slide request in that phase (#197).
   */
  const slideOnScreen =
    active.type === "slide" && !generating ? active.slide_id : null;

  return (
    <div className="flex h-full overflow-hidden">
      <SessionSidebar
        groups={groups}
        activeIndex={clampedIndex}
        onSelect={setActiveIndex}
        inquiryId={session.session_id}
        previewFresh={rewrittenSlides}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* The header band prints the session's title on one line, and a goal
            longer than the row has no room left: the line clips it to an
            ellipsis. Hovering that line prints the whole title as a slip
            (#210) — the full text is already in the line, which is what screen
            readers read, so this is the reading affordance for the ellipsis,
            set in the same voice as the line it completes.
            The holder takes the row's free space, so the phase stamp is never
            squeezed to make room for a long title; the title line inside it is
            sized to its own text (`min-w-0` lets flex shrink it, which is what
            makes the clip happen), so the slip is raised by the title rather
            than by the empty half of the band, and it centres on the title. */}
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 bg-surface px-6 double-rule-b">
          <span className="flex min-w-0 flex-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cn(headerTitleVoice, "min-w-0 truncate")}>
                  {headerTitle}
                </span>
              </TooltipTrigger>
              <TooltipContent className={headerTitleVoice}>
                {headerTitle}
              </TooltipContent>
            </Tooltip>
          </span>
          <PhaseIndicator phase={phase} />
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-6">
          {firstSlideId && playerSrc && (
            <div
              className={active.type === "slide" ? "relative h-full" : "hidden"}
            >
              <SandboxFrame
                ref={playerRef}
                src={playerSrc}
                onLoad={handlePlayerLoad}
              />
              {/* The ask-for-it-back control, at the corner of the slide area it
                  is shown in (#213). It sits inside the frame's own bounds rather
                  than in the header band: the request is about *this* slide, and a
                  control that floats over a rendered surface has to be legible on
                  whatever the slide happens to be painted with. */}
              {slideOnScreen !== null && (
                <div className="absolute right-3 top-3 z-10">
                  <SlideRegenerateControl
                    regenerating={regeneratingSlides.has(slideOnScreen)}
                    onRequest={() => askForRegeneration(slideOnScreen)}
                  />
                </div>
              )}
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
            onPrev={() => stepDeck("prev")}
            onNext={() => stepDeck("next")}
          />
        </footer>

        {/* One live region for the whole deck, always mounted: what it announces
            is a change in its text, and a region that appears only when there is
            news is a region a screen reader may not be listening to yet (#213). */}
        <span role="status" aria-live="polite" className="sr-only">
          {regenDone ? t("regenerate.announced.done") : ""}
        </span>

        {regenSheetFor !== null && (
          <RegenerateSlideSheet
            key={regenSheetFor}
            open
            onOpenChange={() => {
              // The sheet is mounted open, so the only change Radix can be
              // asking for is a close — Escape, the overlay, and the sheet's own
              // Cancel all land here. Closing also clears the refusal: it
              // belonged to the ask that was just abandoned.
              setRegenSheetFor(null);
              setRegenError(null);
            }}
            onSubmit={(feedback) =>
              void submitRegeneration(regenSheetFor, feedback)
            }
            pending={regenSubmitting}
            error={regenError}
          />
        )}
      </div>
    </div>
  );
}


