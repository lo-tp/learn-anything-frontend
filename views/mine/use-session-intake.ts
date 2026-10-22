"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ApiError,
  adjustPlan,
  answerProbe,
  approvePlan,
  clarifySession,
  createSession,
  generatePlan,
  startProbe,
} from "@/lib/api-client";
import { measureRoomShortfall } from "@/lib/keyboard-room";
import { onVisualViewportChange } from "@/lib/visual-viewport";
import {
  apply,
  deriveViewModel,
  initialState,
  isConfirming,
  type Effect,
  type IntakeAction,
  type IntakeState,
  type Translator,
} from "./intake";

/**
 * Pin the record to the open ask: the pane's end is where the thing being
 * answered is, the pinned band above it never moves, and the sheet's own scroll
 * is the only way to reach it — the page itself never scrolls.
 */
function pinRecordToOpenAsk(panel: HTMLDivElement | null) {
  if (panel) panel.scrollTop = panel.scrollHeight;
}

/**
 * How far the record reaches past the room its pane has (#230).
 *
 * The sheet is sized to the visible viewport (The Visible-Viewport Rule), so the
 * record pane's bottom edge *is* the top edge of the keys: whatever reaches past
 * the pane's room is whatever the keyboard is hiding, and whatever does not is
 * entirely above the keys already. The number this reports is the distance the
 * sheet's own scroll has to run to bring that part back into sight — and it is
 * the whole of that distance, never a keyboard's height added on top of it.
 */
function recordRoomShortfallPx(panel: HTMLDivElement): number {
  return measureRoomShortfall({
    contentHeightPx: panel.scrollHeight,
    visibleHeightPx: panel.clientHeight,
  });
}

/** A settled scroll can sit 1px off its stated maximum — the browser clamps a
 *  pin to the scrollable range and rounds its measurements — so "close to the
 *  bottom" is the bottom, and a rounding gap is not a record still growing. */
const BOTTOM_TOLERANCE_PX = 2;

/** A follow measures the record a bounded while: hosts differ in when a late
 *  layout settles, and a follow that chased forever would move a reader who
 *  had scrolled up to re-read. Anything that truly lands starts a new one. */
const FOLLOW_LIMIT_MS = 2000;

/**
 * Keep the record at the bottom the record is actually at (#236).
 *
 * A pin measures the pane at the instant it is asked for — and the record is
 * not finished at that instant. Content that has landed is not yet laid out:
 * an equation renders a beat after the text it was typed from, a line reflows
 * when a web font arrives. A pane pinned at the first measurement can stop
 * above the bottom it was told to reach — the reported failure was the scroll
 * finishing first and the record's growth arriving after it.
 *
 * So a trigger starts a follow, not a one-shot pin: it pins now, then in each
 * following frame measures the record again and re-pins while that measurement
 * keeps growing — the re-measurement is what sees the late layout. The follow
 * stops when the record's own size stops changing, and never longer than a
 * bounded watch (hosts differ in when a late layout settles; a runaway follow
 * would be the sheet chasing a bottom forever, moving a reader who had
 * scrolled up to re-read).
 *
 * What may start a follow: the record's DOM changing, and the record column's
 * or the pane's own resize — but a resize only re-follows while the reader is
 * at the bottom the sheet last measured. A reader who has scrolled up to
 * re-read something earlier is not dragged back for a reflow (the same
 * promise the keyboard reservation keeps, #230); a thing *landing* on the
 * record is an answer arriving at the open ask, and the sheet goes back to
 * it.
 */
function followRecordBottom(panel: HTMLDivElement): () => void {
  // The record column is the pane's only child: its height is the record's
  // length, so it is the box whose growth the follow has to chase. The pane
  // itself is watched too: when its own box shrinks, the bottom the reader
  // was holding moves out from under them.
  const column = panel.firstElementChild;
  let running = false;
  let frame = 0;
  let deadline = 0;
  let lastHeight = 0;
  let stableFrames = 0;

  const stop = () => {
    running = false;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };

  const checkNextFrame = () => {
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!running) return;
      const height = panel.scrollHeight - panel.clientHeight;
      if (
        height !== lastHeight ||
        panel.scrollTop < height - BOTTOM_TOLERANCE_PX
      ) {
        // The record changed since the last measurement, or the pane no
        // longer sits at the height it measured. Re-pin and keep looking.
        lastHeight = height;
        stableFrames = 0;
        pinRecordToOpenAsk(panel);
      } else {
        stableFrames += 1;
      }
      if (stableFrames >= 2 || Date.now() > deadline) {
        // The record's size stopped changing. That is the bottom. (A pane
        // that cannot scroll at all is already at its bottom too.)
        stop();
      } else {
        checkNextFrame();
      }
    });
  };

  const start = () => {
    // Every trigger pins: an arrival on the record is never lost, even while
    // a follow is already running — this one just re-arms its measurement.
    // Reading the height after the pin measures a laid-out pane.
    pinRecordToOpenAsk(panel);
    lastHeight = panel.scrollHeight - panel.clientHeight;
    stableFrames = 0;
    deadline = Date.now() + FOLLOW_LIMIT_MS;
    if (!running) {
      running = true;
      checkNextFrame();
    }
  };

  const startIfAtBottom = () => {
    const height = panel.scrollHeight - panel.clientHeight;
    // "At the bottom" is judged against the bottom as the sheet last measured
    // it *or* the one the pane reports now — a shrink moves the bottom up to
    // a clamped reader, and the new measurement is taken so it cannot go
    // stale for the next trigger. A reader who has scrolled away from both is
    // not moved by a re-layout.
    const readerIsAtABottom =
      panel.scrollTop >= lastHeight - BOTTOM_TOLERANCE_PX ||
      panel.scrollTop >= height - BOTTOM_TOLERANCE_PX;
    lastHeight = height;
    if (readerIsAtABottom) start();
  };

  // The record's own DOM is the fact that something landed on it — an answer,
  // the next question, a re-rendered option list, a refusal — and each of
  // those is an arrival at the open ask: always a reason to follow, even if
  // the reader had scrolled away (#230).
  const observer = new MutationObserver(start);
  observer.observe(panel, { childList: true, subtree: true });

  let resizes: ResizeObserver | null = null;
  if (typeof ResizeObserver === "function") {
    resizes = new ResizeObserver(startIfAtBottom);
    resizes.observe(panel);
    if (column) resizes.observe(column);
  }

  start();
  return () => {
    stop();
    observer.disconnect();
    resizes?.disconnect();
  };
}

/**
 * A node the binding acts on, and whether it is in the DOM yet. The Radix
 * portal content lands a commit later than the render that asked for it, so a
 * plain ref is not enough. The attach callback is stable, so React does not
 * detach and re-attach it — and every render — tearing down whatever follows the
 * node.
 */
function useNodePresence<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [mounted, setMounted] = useState(false);
  const attach = useCallback((node: T | null) => {
    ref.current = node;
    setMounted(node !== null);
  }, []);
  return { ref, mounted, attach };
}

/**
 * The thin React binding over the pure intake core. It owns: the state ref
 * (source of truth), the effect runner (fire the API calls, feed results back
 * as feedback events), the dialog-local `paragraph`, and the DOM effects the
 * dialog can't do from its own render (keep the record pinned to the open ask,
 * bring that ask back above a keyboard that is hiding part of the record — by
 * running the record's own scroll, never by padding the pane — and focus the open
 * field).
 * The dialog receives render-ready view-model data and calls these intents.
 */
export function useSessionIntake({
  open,
  onAccept,
  onOpenChange,
}: {
  open: boolean;
  onAccept: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("dialog");
  const translator = t as unknown as Translator;

  const [state, setState] = useState<IntakeState>(() => initialState(translator));
  const stateRef = useRef(state);
  // Keep the ref in sync with the latest committed state (not during render).
  useEffect(() => {
    stateRef.current = state;
  });

  const [paragraph, setParagraph] = useState("");
  const record = useNodePresence<HTMLDivElement>();
  const field = useNodePresence<HTMLTextAreaElement>();

  const view = deriveViewModel(state, translator);

  /** Fire a single effect and dispatch the matching feedback event when it
   *  settles. At most one API call is in flight at a time, so there is no
   *  re-entrancy. */
  function runEffect(effect: Effect) {
    if (effect.type === "accept") {
      // The hand-off: the intake is accepted into the History, so the parent
      // refetches. The binding's `close`/`confirm` handle the actual close.
      onAccept();
      return;
    }
    const fail = (err: unknown) =>
      dispatch({
        type: "apiFailed",
        message: err instanceof ApiError ? err.message : t("errorFallback"),
      });
    switch (effect.call) {
      case "createSession":
        createSession(effect.goal)
          .then((result) => dispatch({ type: "clarifyResolved", result }))
          .catch(fail);
        break;
      case "clarifySession":
        clarifySession(effect.sessionId, effect.answer)
          .then((result) => dispatch({ type: "clarifyResolved", result }))
          .catch(fail);
        break;
      case "startProbe":
        startProbe(effect.sessionId)
          .then((probe) => dispatch({ type: "probeStarted", probe }))
          .catch(fail);
        break;
      case "answerProbe":
        answerProbe(effect.sessionId, effect.answers)
          .then((probe) => dispatch({ type: "batchResolved", probe }))
          .catch(fail);
        break;
      case "generatePlan":
        generatePlan(effect.sessionId)
          .then((plan) => dispatch({ type: "planResolved", plan }))
          .catch(fail);
        break;
      case "adjustPlan":
        adjustPlan(effect.sessionId, effect.adjustment)
          .then((plan) => dispatch({ type: "planAdjusted", plan }))
          .catch(fail);
        break;
      case "approvePlan":
        approvePlan(effect.sessionId)
          .then(() => dispatch({ type: "approveDone" }))
          .catch(fail);
        break;
    }
  }

  /** Apply one action, commit the new state, then run its effects. */
  function dispatch(action: IntakeAction) {
    const result = apply(stateRef.current, action, translator);
    stateRef.current = result.state;
    setState(result.state);
    // The textarea follows the transcript: emptied when a you-turn is
    // recorded, refilled when a failed request rolls that turn back.
    if (result.restoreInput !== null && result.restoreInput !== undefined) {
      setParagraph(result.restoreInput);
    } else if (result.clearInput) {
      setParagraph("");
    }
    for (const effect of result.effects) runEffect(effect);
  }

  function submit(text: string) {
    const s = stateRef.current;
    if (s.inFlight || isConfirming(s.phase)) return;
    dispatch({ type: "submit", text });
  }

  function pickOption(canonicalIndex: number) {
    if (stateRef.current.inFlight) return;
    dispatch({ type: "pickOption", canonicalIndex });
  }

  /** Approve the plan through its control. The core guards it the same way
   *  the typed command is guarded: a plan must be on screen and nothing may
   *  be in flight. */
  function approve() {
    if (stateRef.current.inFlight) return;
    dispatch({ type: "approve" });
  }

  function close() {
    // Both the footer button and the header Close reach here. Closing from
    // the "on the way" state emits the accept effect (a History refetch);
    // the rest is a local close.
    dispatch({ type: "close" });
    onOpenChange(false);
  }

  function confirm() {
    // The confirm step hands off via the accept effect, then closes. A
    // hand-off while a request is in flight would drop that request's
    // reply onto a reset core, so the binding guards it too (the footer
    // disables the button for the same reason).
    if (stateRef.current.inFlight) return;
    dispatch({ type: "confirm" });
    onOpenChange(false);
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      onOpenChange(true);
      return;
    }
    if (stateRef.current.inFlight) return; // can't close while a request is in flight
    close();
  }

  // Keep the record at its bottom: once when its record appears, and again
  // whenever the record changes or keeps growing — whatever the reason (#230,
  // #236).
  useEffect(() => {
    const panel = record.ref.current;
    if (!open || !record.mounted || !panel) return;
    return followRecordBottom(panel);
  }, [open, record.mounted]);

  // Keep the record at its bottom: once when its record appears, and again
  // whenever the record changes or keeps growing — whatever the reason (#230,
  // #236). This is also what reaches the open ask when the sheet opens into a
  // room the keyboard had already taken: the reported case, where the learner
  // arrives from a field they were typing in, nothing shrinks in front of the
  // sheet, and the first pin is the one that measures the room the sheet has.
  useEffect(() => {
    const panel = record.ref.current;
    if (!open || !record.mounted || !panel) return;
    return followRecordBottom(panel);
  }, [open, record.mounted]);

  // …and the open ask brought back above a keyboard that covers part of the
  // screen (#230). A sheet sized to the visible viewport shrinks with the room,
  // and a scroll container keeps its offset from the *top* when it shrinks — which
  // is how the field being filled ended up under the keyboard with its action
  // below it. So the whole of what a keyboard asks of this sheet is one thing:
  // run the record's own scroll to the bottom the keys leave, by exactly the
  // length of what they are hiding.
  //
  // Nothing is padded. The pane already ends at the keys, so reserving the
  // keyboard's height inside it moves the record a keyboard further from the keys
  // than it needs to be and leaves the pane scrollable down to a blank stretch
  // below the last item — the overshoot the device pass reported on #230. This is
  // likewise the whole answer for a browser that resizes its own layout viewport
  // for the keyboard (`interactive-widget=resizes-content`, what the root layout
  // asks of Chrome 108 and later): there the room and the layout viewport agree,
  // the pane is simply shorter, and the scroll is everything that is left to do.
  //
  // Nothing else re-pins. A room that grows hides nothing; a room that only moved
  // is the browser panning after a focused field; and a record that still fits the
  // room it was left with was never hidden. All of them leave the reader's own
  // scroll exactly where they left it (#230). The room is read off the pane after
  // the shell has sized it: `components/visual-viewport.tsx` holds that
  // measurement from the page's own mount, so it is published before this
  // listener is told the room changed.
  const roomRef = useRef<number | null>(null);
  useEffect(
    () =>
      onVisualViewportChange(({ heightPx }) => {
        const previous = roomRef.current;
        roomRef.current = heightPx;
        if (previous === null || heightPx >= previous) return;
        const panel = record.ref.current;
        if (panel && recordRoomShortfallPx(panel) > 0) {
          pinRecordToOpenAsk(panel);
        }
      }),
    [],
  );

  // Focus the intake textarea when it becomes enabled and is mounted (the
  // dialog opening for the first time, and again after any in-flight request
  // settles). The Radix portal content lands in a later commit, so gate on the
  // field being mounted to focus once the node is actually in the DOM. The focus
  // is asked not to scroll: the record is held at this field by the effects over
  // there, and a browser invited to chase the field pans the page a second time
  // (#230).
  const enabled = !view.intake.pending && !view.intake.disabled;
  useEffect(() => {
    if (open && enabled && field.mounted) {
      field.ref.current?.focus({ preventScroll: true });
    }
  }, [open, enabled, field.mounted]);

  return {
    view,
    paragraph,
    setParagraph,
    submit,
    pickOption,
    approve,
    close,
    confirm,
    handleOpenChange,
    attachRecord: record.attach,
    attachTextarea: field.attach,
  };
}
