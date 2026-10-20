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
import { onKeyboardInsetChange } from "@/lib/keyboard-inset";
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
 * Reserve the room a keyboard covers at the record's bottom (#230).
 *
 * iOS leaves the layout viewport at its full height when its keyboard opens, so
 * the pane keeps the height it was given and its lower half is under the
 * keyboard — where the open ask is. Padding the pane by exactly the inset does
 * two things at once: it gives the pane's own scroll enough range to bring the
 * open ask above the keyboard, and it makes pinning to the pane's bottom land
 * the ask just above the keys instead of behind them. The inset is measured, so
 * nothing here guesses at how tall a keyboard is on some device.
 */
function reserveKeyboardRoom(
  panel: HTMLDivElement | null,
  insetPx: number,
) {
  if (!panel) return;
  panel.style.paddingBottom = insetPx > 0 ? `${insetPx}px` : "";
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
 * keep that ask above a keyboard — by reserving the room it covers, and by
 * re-pinning when the room the sheet has shrinks — and focus the open field).
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

  // …and keep the open ask above a keyboard that covers part of the screen
  // (#230). Subscribed while the **record** is in the DOM — not while its field
  // is: an ask at the boundary is a set of option rows, and the reservation
  // belongs to the record, not to whichever control is answering it. The measure
  // is asked for as a value rather than as a change, so a sheet that opens into
  // a room the keyboard had already taken is told that room the moment its
  // record appears. That is the reported case — the learner reaches the sheet
  // from a field they were already typing in, nothing shrinks in front of them,
  // and the open ask was simply out of sight with no scroll left that could
  // reach it.
  useEffect(() => {
    if (!open || !record.mounted) return;
    return onKeyboardInsetChange((insetPx) => {
      const panel = record.ref.current;
      reserveKeyboardRoom(panel, insetPx);
      // Pinned *after* the padding is set: the padded bottom is the point above
      // the keys. Where nothing covers the record the reservation comes off and
      // the scroll is the reader's again — the pane clamps itself to its new
      // range, which lands the open ask back at the bottom of what is visible.
      if (insetPx > 0) pinRecordToOpenAsk(panel);
    });
  }, [open, record.mounted]);

  // …and pinned there again when the room the sheet has *shrinks* (#230). A
  // sheet sized to the visible viewport shrinks with the room, and a scroll
  // container keeps its offset from the *top* when it shrinks — which is how the
  // field being filled ended up under the keyboard with its action below it.
  // Where a keyboard disagrees with the layout viewport the effect above has an
  // inset to reserve and pins with it; this is the case where there is nothing
  // to reserve — a browser that resizes its own layout viewport for the keyboard
  // (what `interactive-widget=resizes-content` asks of Chrome) leaves the pane
  // shorter and the reservation already gone. Nothing else re-pins: a room that
  // grows hides nothing, and a room that only moved is the browser panning after
  // a focused field. Both are left to the scroll the reader chose.
  const roomRef = useRef<number | null>(null);
  useEffect(
    () =>
      onVisualViewportChange(({ heightPx }) => {
        const previous = roomRef.current;
        roomRef.current = heightPx;
        if (previous === null || heightPx >= previous) return;
        pinRecordToOpenAsk(record.ref.current);
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
