/**
 * `lib/dummy-sessions` — dummy in-memory session store (server-side only;
 * never import from client components).
 *
 * The seam the app uses to read a learner's History: resolve the current
 * learner with `getCurrentLearner()`, then `listSessions(userId)` their rows.
 * Swap this module for `core/store` later — the pages and `app/api/sessions`
 * only ever see `SessionSummary` rows.
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

/**
 * The MVP's single learner (see `db/seed.sql` — one static row). Post-MVP the
 * current-learner resolution becomes a session-cookie -> user lookup; until
 * then every request resolves to this id. Mirrors `core/store`.
 */
export const MVP_LEARNER_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Resolve the current learner. MVP: always the seeded learner. Mirrors
 * `core/store.getCurrentLearner()` — the one identity seam the app uses.
 */
export function getCurrentLearner(): { id: string } {
  return { id: MVP_LEARNER_ID };
}

/** The learners' sessions, keyed by learner id. */
const store = new Map<string, SessionSummary[]>();

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
  store.set(MVP_LEARNER_ID, fixtures);
}

if (USE_FIXTURES) {
  seedFixtures();
}

/** The learner's sessions, most recently created first; `[]` if they have none. */
export function listSessions(userId: string): SessionSummary[] {
  return [...(store.get(userId) ?? [])].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}
