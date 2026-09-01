/**
 * `core/store` — Postgres access (the I/O seam).
 *
 * A thin function surface for the route layer; no business logic in here.
 * All data is reached through `sessions.user_id`: reads for a session the
 * user does not own come back empty (`null` / `[]`), and writes to another
 * user's session reject with `StoreError`.
 *
 * Connection: a single lazy `pg` pool from `DATABASE_URL`, queried through
 * Drizzle against the canonical schema in `db/schema.ts`.
 *
 * MVP learner resolution: `getCurrentLearner()` returns the seeded row from
 * `db/seed.sql` for every request; it becomes a session-cookie lookup when
 * real auth lands post-MVP.
 */
import { and, desc, eq } from "drizzle-orm";
import { type NodePgDatabase, drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../../db/schema";
import {
  rawMessages,
  sessionMessages,
  sessions,
  users,
  type Session,
  type SessionMessage,
  type SessionMessageType,
  type User,
} from "../../db/schema";

/** A JSON-serializable value (jsonb column data is `unknown` in Drizzle 0.45). */
export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

/** The seeded learner from `db/seed.sql` — the MVP's only identity. */
export const SEEDED_LEARNER_ID = "00000000-0000-0000-0000-000000000001";

/** Raised when a write targets a session the learner does not own (or is missing). */
export class StoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreError";
  }
}

let pool: pg.Pool | undefined;
let db: NodePgDatabase<typeof schema> | undefined;

function getDb() {
  if (!db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new StoreError("DATABASE_URL is not set");
    pool = new pg.Pool({ connectionString: url, max: 5 });
    db = drizzle(pool, { schema });
  }
  return db;
}

/** Close the pool (test teardown, graceful shutdown). */
export async function closeStore(): Promise<void> {
  await pool?.end();
  pool = undefined;
  db = undefined;
}

/**
 * Current-Learner resolution: in the MVP this is always the seeded row.
 * Throws if the seed is missing (run `scripts/setup-db.sh dev`).
 */
export async function getCurrentLearner(): Promise<Pick<User, "id" | "email" | "name">> {
  const [row] = await getDb()
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, SEEDED_LEARNER_ID));
  if (!row) {
    throw new StoreError(
      "seeded learner row is missing — run scripts/setup-db.sh dev (db/seed.sql)",
    );
  }
  return row;
}

/** Create a session row for the learner. */
export async function createSession(
  userId: string,
  knowledgePoint?: string | null,
): Promise<Session> {
  const [session] = await getDb()
    .insert(sessions)
    .values({ userId, knowledgePoint: knowledgePoint ?? null })
    .returning();
  return session;
}

/** Fetch one session, or `null` if it is not the learner's. */
export async function getSession(userId: string, sessionId: string) {
  const [session] = await getDb()
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));
  return session ?? null;
}

/** List the learner's sessions, newest first. */
export async function listSessions(userId: string): Promise<Session[]> {
  return getDb()
    .select()
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.createdAt), desc(sessions.id));
}

/** Update `knowledge_point` — the one mutable column on `sessions`. */
export async function setKnowledgePoint(
  userId: string,
  sessionId: string,
  knowledgePoint: string | null,
): Promise<Session> {
  await assertOwnedSession(userId, sessionId);
  const [session] = await getDb()
    .update(sessions)
    .set({ knowledgePoint })
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .returning();
  if (!session) {
    throw new StoreError(`session ${sessionId} does not belong to learner ${userId}`);
  }
  return session;
}

/**
 * Append one LLM turn to the append-only log. `response` is the LLM's
 * structured reply — already validated against the core/contracts Zod
 * schemas upstream; the store only persists it.
 */
export async function appendTurn(
  userId: string,
  sessionId: string,
  type: SessionMessageType,
  request: string,
  response: Json,
): Promise<SessionMessage> {
  await assertOwnedSession(userId, sessionId);
  const [message] = await getDb()
    .insert(sessionMessages)
    .values({ sessionId, type, request, response })
    .returning();
  return message;
}

/** The learner's turn log for a session in `id` order (= truth order); `[]` if not theirs. */
export async function getTurnLog(userId: string, sessionId: string): Promise<SessionMessage[]> {
  return getDb()
    .select({
      id: sessionMessages.id,
      sessionId: sessionMessages.sessionId,
      type: sessionMessages.type,
      request: sessionMessages.request,
      response: sessionMessages.response,
      createdAt: sessionMessages.createdAt,
    })
    .from(sessionMessages)
    .innerJoin(sessions, eq(sessionMessages.sessionId, sessions.id))
    .where(and(eq(sessionMessages.sessionId, sessionId), eq(sessions.userId, userId)))
    .orderBy(sessionMessages.id);
}

/** Replace the session's UIMessage[] UI projection (dual-written each turn). */
export async function saveRawMessages(
  userId: string,
  sessionId: string,
  messages: readonly Json[],
): Promise<void> {
  await assertOwnedSession(userId, sessionId);
  const value = messages as Json;
  const now = new Date();
  await getDb()
    .insert(rawMessages)
    .values({ sessionId, messages: value, updatedAt: now })
    .onConflictDoUpdate({
      target: rawMessages.sessionId,
      set: { messages: value, updatedAt: now },
    });
}

/** The learner's raw-message projection for a session, or `null` if none / not theirs. */
export async function getRawMessages(userId: string, sessionId: string) {
  const [row] = await getDb()
    .select({ messages: rawMessages.messages, updatedAt: rawMessages.updatedAt })
    .from(rawMessages)
    .innerJoin(sessions, eq(rawMessages.sessionId, sessions.id))
    .where(and(eq(rawMessages.sessionId, sessionId), eq(sessions.userId, userId)));
  return row ?? null;
}

/** Writes must target a session the learner actually owns. */
async function assertOwnedSession(userId: string, sessionId: string): Promise<void> {
  const [row] = await getDb()
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(eq(sessions.id, sessionId));
  if (!row || row.userId !== userId) {
    throw new StoreError(`session ${sessionId} does not belong to learner ${userId}`);
  }
}
