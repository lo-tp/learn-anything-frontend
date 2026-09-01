import { describe, expect, it } from "vitest";
import {
  listSessions,
  getCurrentLearner,
  MVP_LEARNER_ID,
  STAGES,
  type Stage,
} from "../lib/dummy-sessions";

describe("dummy session store", () => {
  it("seeds the four fixture sessions for the MVP learner", () => {
    const sessions = listSessions(MVP_LEARNER_ID);
    expect(sessions.map((s) => s.knowledgePoint)).toEqual([
      "React Hooks Deep Dive",
      "System Design Patterns",
      "Advanced TypeScript",
      "GraphQL API Setup",
    ]);
    expect(sessions.map((s) => s.stage)).toEqual([
      "probing",
      "review",
      "complete",
      "executing",
    ] satisfies Stage[]);
  });

  it("returns them sorted by createdAt, most recent first", () => {
    const createdAt = listSessions(MVP_LEARNER_ID).map((s) => s.createdAt);
    expect([...createdAt].sort((a, b) => b.localeCompare(a))).toEqual(createdAt);
    expect(new Set(createdAt).size).toBe(createdAt.length);
  });

  it("matches the /api/sessions contract shape", () => {
    for (const s of listSessions(MVP_LEARNER_ID)) {
      expect(Object.keys(s).sort()).toEqual(
        ["createdAt", "id", "knowledgePoint", "stage"],
      );
      expect(STAGES).toContain(s.stage);
      expect(Number.isNaN(new Date(s.createdAt).getTime())).toBe(false);
    }
  });

  it("scopes the list to the current learner — others get an empty History", () => {
    expect(listSessions(getCurrentLearner().id).length).toBeGreaterThan(0);
    expect(listSessions("00000000-0000-0000-0000-000000000002")).toEqual([]);
  });
});
