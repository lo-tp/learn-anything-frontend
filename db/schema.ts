/**
 * Drizzle mirror of `db/schema.sql`.
 *
 * `db/schema.sql` stays the canonical DDL — it is what `scripts/dev-db.sh`
 * and `scripts/test-db.sh` apply. This file exists purely for Drizzle's
 * typed queries; there are no drizzle-kit migrations in this repo.
 *
 * After any change to `db/schema.sql`, re-verify the mirror with
 * `npx drizzle-kit pull` (against a fresh schema-only db) and reconcile.
 */
import {
  bigint,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("users_email_key").on(t.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Short AI-recorded summary; home label; updated on re-scope.
    knowledgePoint: text("knowledge_point"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

/**
 * The row `type`: the stage the session was in when the request was made —
 * a filter/sectioning aid, not the current stage. 'planning' and 'complete'
 * never occur as row types under the current flow.
 */
export type SessionMessageType =
  | "intake"
  | "probing"
  | "planning"
  | "review"
  | "executing"
  | "complete";

export const sessionMessages = pgTable(
  "session_messages",
  {
    // id order = truth order
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    type: text("type").$type<SessionMessageType>().notNull(),
    // The learner's input: typed text or a canonical action token.
    request: text("request").notNull(),
    // The LLM's structured reply, a typed union validated by core/contracts.
    response: jsonb("response").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("session_messages_session_id_idx").on(t.sessionId)],
);

export const rawMessages = pgTable(
  "raw_messages",
  {
    sessionId: uuid("session_id")
      .primaryKey()
      .references(() => sessions.id, { onDelete: "cascade" }),
    // @ai-sdk UIMessage[] — a view-layer type (ADR 0004). Stored as plain
    // JSON so this module stays SDK-independent.
    messages: jsonb("messages").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type SessionMessage = typeof sessionMessages.$inferSelect;
export type RawMessagesRow = typeof rawMessages.$inferSelect;
