/**
 * `lib/dummy-sessions` — dummy in-memory session store (server-side only;
 * never import from client components).
 *
 * The single seam the app uses to read a learner's History: `listSessions()`.
 * Swap this module for the real store later — the pages and
 * `app/api/sessions` only ever see `SessionSummary` rows.
 */

/**
 * The real stage vocabulary a session can be shown in (CONTEXT.md "Stage").
 * `planning` is machine-internal to `core/session` — no request is ever made
 * in it, so History never displays it.
 */
export const STAGES = [
  "intake",
  "probing",
  "review",
  "executing",
  "complete",
] as const;
export type Stage = (typeof STAGES)[number];

/** One row of the `/api/sessions` contract. */
export interface SessionSummary {
  id: string;
  /** The session's knowledge point, or null before intake has recorded one. */
  knowledgePoint: string | null;
  /** ISO timestamp the session was created. */
  createdAt: string;
  stage: Stage;
}

/**
 * Fixture toggle — flip to `false` to get an empty History
 * (exercises the empty state, owned by the empty-state ticket).
 */
const USE_FIXTURES = true;

const store = new Map<string, SessionSummary>();

function iso(msBefore: number, now: Date): string {
  return new Date(now.getTime() - msBefore).toISOString();
}

function seedFixtures(): void {
  const now = Date.now();
  const HOUR = 3_600_000;
  const fixtures: SessionSummary[] = [
    {
      id: "s-react-hooks",
      knowledgePoint: "React Hooks Deep Dive",
      createdAt: iso(2 * HOUR, new Date(now)),
      stage: "probing",
    },
    {
      id: "s-system-design",
      knowledgePoint: "System Design Patterns",
      createdAt: iso(12 * HOUR, new Date(now)),
      stage: "review",
    },
    {
      id: "s-advanced-typescript",
      knowledgePoint: "Advanced TypeScript",
      createdAt: iso(30 * 24 * HOUR, new Date(now)),
      stage: "complete",
    },
    {
      id: "s-graphql-setup",
      knowledgePoint: "GraphQL API Setup",
      createdAt: iso(40 * 24 * HOUR, new Date(now)),
      stage: "executing",
    },
  ];
  for (const session of fixtures) store.set(session.id, session);
}

if (USE_FIXTURES) {
  seedFixtures();
}

/** All sessions, most recently created first. */
export function listSessions(): SessionSummary[] {
  return [...store.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
