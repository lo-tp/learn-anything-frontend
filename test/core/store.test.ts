/**
 * Integration test for `core/store` — the Postgres access layer.
 *
 * Runs against the dedicated `learn_anything_test` database, recreated
 * from scratch by `scripts/setup-db.sh` before the suite starts (schema
 * only — this test inserts its own fixtures).
 */
import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://learn_anything:learn_anything@localhost:5434/learn_anything_test";

// Seeded learner (see db/seed.sql) + a second learner to prove user scoping.
const LEARNER_ID = "00000000-0000-0000-0000-000000000001";
const OTHER_ID = "00000000-0000-0000-0000-000000000002";

const SESSION_A = "aaaaaaaa-0000-0000-0000-000000000001";
const SESSION_B = "aaaaaaaa-0000-0000-0000-000000000002";

let store: typeof import("@/core/store");
// Raw client for fixtures and cross-checks (the store itself is the API under test).
const fixture = new pg.Client({ connectionString: TEST_DATABASE_URL });

beforeAll(async () => {
  execSync("bash scripts/setup-db.sh test", { stdio: "inherit" });
  // The store resolves DATABASE_URL on first use; point it at the test db.
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  store = await import("@/core/store");

  await fixture.connect();
  await fixture.query(
    `INSERT INTO users (id, email, name) VALUES
       ($1, 'learner@example.com', 'Test Learner'),
       ($2, 'other@example.com', 'Other Learner')`,
    [LEARNER_ID, OTHER_ID],
  );
  // Two sessions with distinct created_at so list ordering is deterministic.
  await fixture.query(
    `INSERT INTO sessions (id, user_id, knowledge_point, created_at) VALUES
       ($1, $2, 'Older point', now() - interval '1 hour'),
       ($3, $2, 'Newer point', now())`,
    [SESSION_A, LEARNER_ID, SESSION_B],
  );
});

afterAll(async () => {
  await store.closeStore();
  await fixture.end();
});

describe("learner resolution", () => {
  it("returns the seeded learner for every request (MVP)", async () => {
    const learner = await store.getCurrentLearner();
    expect(learner).toEqual({
      id: LEARNER_ID,
      email: "learner@example.com",
      name: "Test Learner",
    });
  });
});

describe("sessions", () => {
  it("creates a session for a user", async () => {
    const session = await store.createSession(LEARNER_ID, "How F=ma works");
    expect(session.userId).toBe(LEARNER_ID);
    expect(session.knowledgePoint).toBe("How F=ma works");
  });

  it("lists a user's sessions, newest first, scoped to that user", async () => {
    const sessions = await store.listSessions(LEARNER_ID);
    const ids = sessions.map((s) => s.id);
    expect(ids).toContain(SESSION_A);
    expect(ids).toContain(SESSION_B);
    expect(ids.indexOf(SESSION_B)).toBeLessThan(ids.indexOf(SESSION_A));
    expect(sessions.every((s) => s.userId === LEARNER_ID)).toBe(true);
  });

  it("returns null for a session the user does not own", async () => {
    expect(await store.getSession(OTHER_ID, SESSION_A)).toBeNull();
  });

  it("updates knowledge_point (the one mutable column)", async () => {
    const updated = await store.setKnowledgePoint(
      LEARNER_ID,
      SESSION_A,
      "Newton's second law",
    );
    expect(updated?.knowledgePoint).toBe("Newton's second law");
    expect(await store.getSession(LEARNER_ID, SESSION_A)).toMatchObject({
      knowledgePoint: "Newton's second law",
    });
  });

  it("refuses to update another user's session", async () => {
    await expect(store.setKnowledgePoint(OTHER_ID, SESSION_A, "hijack")).rejects.toBeInstanceOf(
      store.StoreError,
    );
  });
});

describe("session_messages (append-only turn log)", () => {
  it("appends turns and reads them back in id (truth) order", async () => {
    await store.appendTurn(LEARNER_ID, SESSION_A, "intake", "explain F=ma", {
      type: "narrow",
      text: "Newton's second law, intro level",
    });
    await store.appendTurn(LEARNER_ID, SESSION_A, "probing", "ANSWER:2", {
      type: "question",
      text: "What does mass measure?",
      options: ["a", "b"],
    });

    const log = await store.getTurnLog(LEARNER_ID, SESSION_A);
    expect(log.map((m) => m.type)).toEqual(["intake", "probing"]);
    expect(log[0].request).toBe("explain F=ma");
    expect(log[0].response).toEqual({
      type: "narrow",
      text: "Newton's second law, intro level",
    });
    expect(log[1].response).toEqual({
      type: "question",
      text: "What does mass measure?",
      options: ["a", "b"],
    });
  });

  it("scopes reads by user: another user's log is empty", async () => {
    expect(await store.getTurnLog(OTHER_ID, SESSION_A)).toEqual([]);
  });

  it("refuses to append to a session the user does not own", async () => {
    await expect(
      store.appendTurn(OTHER_ID, SESSION_A, "intake", "x", { type: "narrow" }),
    ).rejects.toBeInstanceOf(store.StoreError);
  });
});

describe("raw_messages (UI projection)", () => {
  it("upserts the UIMessage[] projection and reads it back", async () => {
    const first = [{ id: "m1", role: "user", parts: [] }];
    await store.saveRawMessages(LEARNER_ID, SESSION_A, first);
    expect(await store.getRawMessages(LEARNER_ID, SESSION_A)).toEqual({
      messages: first,
      updatedAt: expect.anything(),
    });
  });

  it("replaces the projection on the next turn", async () => {
    const second = [
      { id: "m1", role: "user", parts: [] },
      { id: "m2", role: "assistant", parts: [] },
    ];
    await store.saveRawMessages(LEARNER_ID, SESSION_A, second);
    expect(await store.getRawMessages(LEARNER_ID, SESSION_A)).toEqual({
      messages: second,
      updatedAt: expect.anything(),
    });
  });

  it("scopes reads by user and refuses another user's writes", async () => {
    expect(await store.getRawMessages(OTHER_ID, SESSION_A)).toBeNull();
    await expect(
      store.saveRawMessages(OTHER_ID, SESSION_A, []),
    ).rejects.toBeInstanceOf(store.StoreError);
  });
});
