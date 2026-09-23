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
 * The thin React binding over the pure intake core. It owns: the state ref
 * (source of truth), the effect runner (fire the API calls, feed results back
 * as feedback events), the dialog-local `paragraph`, and the two DOM effects
 * (auto-scroll + focus) the dialog can't do from its own render. The dialog
 * receives render-ready view-model data and calls these intents.
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
  const messagesPanelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [textareaMounted, setTextareaMounted] = useState(false);
  /** Callback ref: track the node and flag it mounted (the Radix portal
   *  content lands in a later commit than the first render). */
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
      onAccept();
      onOpenChange(false);
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
    if (result.clearInput) setParagraph("");
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

  function close() {
    dispatch({ type: "close" });
    onOpenChange(false);
  }

  function confirm() {
    onAccept();
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

  // Auto-scroll the "Recent Messages" panel to the bottom on each new bubble.
  useEffect(() => {
    const panel = messagesPanelRef.current;
    if (panel) panel.scrollTop = panel.scrollHeight;
  }, [view.bubbles.length]);

  // Focus the intake textarea when it becomes enabled and is mounted (the
  // dialog opening for the first time, and again after any in-flight request
  // settles). The Radix portal content lands in a later commit, so gate on
  // `textareaMounted` to focus once the node is actually in the DOM.
  const enabled = !view.intake.pending && !view.intake.disabled;
  useEffect(() => {
    if (open && enabled && textareaMounted) textareaRef.current?.focus();
  }, [open, enabled, textareaMounted]);

  return {
    view,
    paragraph,
    setParagraph,
    submit,
    pickOption,
    close,
    confirm,
    handleOpenChange,
    messagesPanelRef,
    textareaRef,
    attachTextarea,
  };
}
