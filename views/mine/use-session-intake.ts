"use client";
import { useEffect, useRef, useState } from "react";
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

/**
 * The thin React binding over the pure intake core. It owns: the state ref
 * (source of truth), the effect runner (fire the API calls, feed results back
 * as feedback events), the dialog-local `paragraph`, and the DOM effects the
 * dialog can't do from its own render (keep the record pinned to the open ask,
 * keep the open ask above a keyboard, focus the open field). The dialog receives
 * render-ready view-model data and calls these intents.
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
  const recordRef = useRef<HTMLDivElement | null>(null);
  const [recordMounted, setRecordMounted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [textareaMounted, setTextareaMounted] = useState(false);
  /** Callback refs: track the node and flag it mounted (the Radix portal
   *  content lands in a later commit than the first render). */
  function attachRecord(node: HTMLDivElement | null) {
    recordRef.current = node;
    setRecordMounted(node !== null);
  }
  function attachTextarea(node: HTMLTextAreaElement | null) {
    textareaRef.current = node;
    setTextareaMounted(node !== null);
  }

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

  // Keep the record pinned to the item that just landed.
  useEffect(() => {
    pinRecordToOpenAsk(recordRef.current);
  }, [view.bubbles.length]);

  // …and keep the open ask above a keyboard that covers part of the screen
  // (#230). Subscribed while the **record** is in the DOM — not while its field
  // is: an ask at the boundary is a set of option rows, and the reservation
  // belongs to the record, not to whichever control is answering it. The Radix
  // portal mounts the record a commit after this hook runs, and the measure is
  // asked for as a value rather than as a change, so a sheet that opens into a
  // room the keyboard had already taken is told that room the moment its record
  // appears. That is the reported case — the learner reaches the sheet from a
  // field they were already typing in, nothing shrinks in front of them, and the
  // open ask was simply out of sight with no scroll left that could reach it.
  useEffect(() => {
    if (!open || !recordMounted) return;
    return onKeyboardInsetChange((insetPx) => {
      const panel = recordRef.current;
      reserveKeyboardRoom(panel, insetPx);
      // Pinned *after* the padding is set: the padded bottom is the point above
      // the keys. Where nothing covers the record it is left with the scroll the
      // reader chose.
      if (insetPx > 0) pinRecordToOpenAsk(panel);
    });
  }, [open, recordMounted]);

  // Focus the intake textarea when it becomes enabled and is mounted (the
  // dialog opening for the first time, and again after any in-flight request
  // settles). The Radix portal content lands in a later commit, so gate on
  // `textareaMounted` to focus once the node is actually in the DOM. The focus
  // is asked not to scroll: the record is held at this field by the effect over
  // there, and a browser invited to chase the field pans the page a second time
  // (#230).
  const enabled = !view.intake.pending && !view.intake.disabled;
  useEffect(() => {
    if (open && enabled && textareaMounted) {
      textareaRef.current?.focus({ preventScroll: true });
    }
  }, [open, enabled, textareaMounted]);

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
    attachRecord,
    textareaRef,
    attachTextarea,
  };
}
