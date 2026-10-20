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
import {
  measureRoomShortfall,
  onKeyboardInsetChange,
} from "@/lib/keyboard-inset";
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
 * The room this surface has itself reserved at the record's bottom. The record
 * pane carries no padding of its own, so whatever inline padding is there was put
 * there by `reserveKeyboardRoom` — and it is not part of the record.
 */
function reservedRoomPx(panel: HTMLDivElement): number {
  return Number.parseFloat(panel.style.paddingBottom) || 0;
}

/**
 * How far the record reaches past the room its pane has.
 *
 * The sheet is sized to the visible viewport (The Visible-Viewport Rule), so the
 * pane's bottom edge is the top edge of the keys: whatever reaches past the
 * pane's room is whatever the keyboard is hiding, and whatever does not is
 * entirely above the keys already. That is the difference the reservation has to
 * make (#230) — a keyboard covering a stretch of screen the record was never
 * using asks for nothing.
 */
function recordRoomShortfallPx(panel: HTMLDivElement): number {
  return measureRoomShortfall({
    contentHeightPx: panel.scrollHeight,
    visibleHeightPx: panel.clientHeight,
    reservedPx: reservedRoomPx(panel),
  });
}

/**
 * Decide whether the room a keyboard covers is reserved at the record's bottom,
 * for a record the keyboard is actually hiding (#230), and report what was
 * decided — because a surface that reserved is a surface whose bottom has moved,
 * and only its caller knows whether it is the one to move the reader there.
 *
 * iOS leaves the layout viewport at its full height when its keyboard opens, so
 * where a sheet has not been sized to the room the keyboard leaves, its pane
 * keeps the height it was given and its lower half is under the keys — where the
 * open ask is. Padding the pane by exactly the measured inset does two things at
 * once: it gives the pane's own scroll enough range to bring the open ask above
 * the keyboard, and it makes pinning to the pane's bottom land the ask just above
 * the keys instead of behind them. The inset is measured, so nothing here guesses
 * at how tall a keyboard is on some device.
 *
 * Neither half of that is owed to a keyboard that hides nothing. A record that
 * fits the room above the keys needs no extra scroll range, and is not cut off:
 * padding it would add a blank stretch below the last item and — because a padded
 * pane can suddenly scroll — a pin would move a record the learner could already
 * read in full. So the reservation is decided from both measures: the room the
 * keyboard covers, and what the record reaches past its own room. Either one
 * empty, and the pane is left as it is.
 */
function reserveKeyboardRoom(
  panel: HTMLDivElement | null,
  insetPx: number,
): boolean {
  if (!panel) return false;
  const hiddenPx = recordRoomShortfallPx(panel);
  if (insetPx > 0 && hiddenPx > 0) {
    panel.style.paddingBottom = `${insetPx}px`;
    return true;
  }
  // Nothing covered, or nothing hidden: the reservation comes off and the scroll
  // stays the reader's. Where the pane was padded, taking it off leaves a shorter
  // range, which the pane clamps itself to.
  panel.style.paddingBottom = "";
  return false;
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
 * keep that ask above a keyboard — reserving the room it covers, and re-pinning
 * when the room the sheet has shrinks, but only where the keyboard leaves part
 * of the record out of sight — and focus the open field).
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
  //
  // Whether the keys are hiding part of the record is a fact about *both* the
  // keyboard and the record, so both are reasons to decide it again: every report
  // of the keyboard's room, and every change to the record's own size. A record
  // that grows past the room it fitted is one the keys have begun covering; one
  // that fell back into the room was never covered, and its reservation goes back
  // off. The record's size is watched here only to re-ask the reservation —
  // whether the sheet is at the bottom the reader was last at is the record
  // follow's question, and moving a reader who had scrolled up to re-read is its
  // refusal to make.
  //
  // The room is read off the pane, and the pane is only as tall as the shell
  // sized it: `components/visual-viewport.tsx` holds the measurement of the
  // visible viewport from the page's own mount, so it is the first listener the
  // browser tells and it publishes a changed room before this sheet is told the
  // keyboard took it — and the pane's own resize is the second reason to re-read
  // it, whichever order the two reports arrive in.
  const insetRef = useRef(0);
  useEffect(() => {
    if (!open || !record.mounted) return;
    const followInset = onKeyboardInsetChange((insetPx) => {
      insetRef.current = insetPx;
      const panel = record.ref.current;
      // Pinned *after* the padding is set: the padded bottom is the point above
      // the keys. Where nothing covers the record, or nothing is hidden, the
      // reservation comes off and the scroll is the reader's again — the pane
      // clamps itself to its new range.
      if (reserveKeyboardRoom(panel, insetPx)) pinRecordToOpenAsk(panel);
    });
    let stopWatchingRecord = () => {};
    const panel = record.ref.current;
    if (panel && typeof ResizeObserver === "function") {
      const resizes = new ResizeObserver(() => {
        reserveKeyboardRoom(record.ref.current, insetRef.current);
      });
      // The record column is the pane's only child: its box is the record's
      // length. The pane's own box is watched too, since a shorter room moves the
      // line the record has to fit under.
      resizes.observe(panel);
      if (panel.firstElementChild) resizes.observe(panel.firstElementChild);
      stopWatchingRecord = () => resizes.disconnect();
    }
    return () => {
      followInset();
      stopWatchingRecord();
    };
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
  // a focused field. Both are left to the scroll the reader chose. Nor is a
  // shorter room a reason in itself: a record that still fits the room it was
  // left with was never hidden, and stays where the reader has it (#230).
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
