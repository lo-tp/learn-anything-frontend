"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, TriangleAlert } from "lucide-react";
import { ControlBar } from "@/components/control-bar";
import { PhaseIndicator } from "@/components/phase-indicator";
import { QuizQuestion } from "@/components/session/quiz-question";
import { SessionSidebar, type SidebarGroup } from "@/components/session/session-sidebar";
import { SandboxFrame } from "@/components/sandbox/sandbox-frame";
import {
  getMaterials,
  type MaterialsOut,
  type SessionState,
} from "@/lib/api-client";

/** How often the view polls while materials are still generating. */
const POLL_INTERVAL_MS = 3000;

/** The phases before material generation has begun. */
const PRE_MATERIAL = new Set(["clarifying", "probing", "planning", "reviewing"]);

/** The sandbox URL that serves a slide item's content. */
const sandboxSrc = (slideId: string) =>
  `${process.env.NEXT_PUBLIC_SANDBOX_ORIGIN}/slides/${slideId}`;

/**
 * The `/session/{sessionId}` view (#47). **Client** component — the single
 * state owner for the materials deck: the polled materials, the active
 * (flattened) item, and the quiz selections.
 *
 * The deck is `generated_steps` flattened — one card per slide/question —
 * grouped in the sidebar under step-summary dividers. While the session is
 * in `generating`, the view polls `getMaterials` until content arrives;
 * the polled response's phase beats the SSR session's. Friendly states
 * (not found / error / not ready / generating) render instead of the deck.
 * The shared frame is applied by the root layout.
 */
export function Session({
  sessionId,
  initialSession,
  initialMaterials,
}: {
  sessionId: string;
  initialSession: SessionState | null;
  initialMaterials: MaterialsOut | null;
}) {
  const [materials, setMaterials] =
    useState<MaterialsOut | null>(initialMaterials);
  const [pollError, setPollError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const inFlight = useRef(false);

  /** The freshest known phase — the polled materials beat the SSR session. */
  const phase = materials?.phase ?? initialSession?.phase ?? null;
  const generating = phase === "generating";

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

  // ── Render branches, in priority order ──────────────────────────

  if (initialSession === null) {
    return (
      <StatePanel
        icon={<TriangleAlert className="size-8 text-error" aria-hidden />}
        title="Session not found"
        note="That session doesn't exist — it may have been removed."
      />
    );
  }

  if (phase === "error") {
    return (
      <StatePanel
        icon={<TriangleAlert className="size-8 text-error" aria-hidden />}
        title="Something went wrong"
        note="This session hit an error. Head back and try again."
        chip={<PhaseIndicator phase={phase} />}
      />
    );
  }

  if (PRE_MATERIAL.has(phase ?? "") || materials === null) {
    return (
      <StatePanel
        title="Materials aren't ready yet"
        note="They're generated in the background once your plan is approved."
        subtitle={initialSession.narrowed_goal ?? undefined}
        chip={<PhaseIndicator phase={phase} />}
      />
    );
  }

  if (deck.length === 0) {
    // Reaching here means the phase is `generating` (with no items yet).
    return (
      <StatePanel
        icon={
          <Loader2 className="size-8 animate-spin text-tertiary" aria-hidden />
        }
        title="Generating materials…"
        note={
          pollError
            ? "Can't reach the backend right now — retrying."
            : "Hang tight — your slides and questions are being prepared."
        }
      />
    );
  }

  const total = deck.length;
  const clampedIndex = Math.min(activeIndex, total - 1);
  const active = deck[clampedIndex];

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
            {initialSession.narrowed_goal ?? "Learning session"}
          </span>
          <PhaseIndicator phase={phase} />
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-6">
          {active.type === "slide" ? (
            <div className="h-full">
              <SandboxFrame src={sandboxSrc(active.slide_id)} />
            </div>
          ) : (
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
          Back to my sessions
        </Link>
      </div>
    </main>
  );
}
