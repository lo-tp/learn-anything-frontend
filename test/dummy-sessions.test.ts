import { describe, expect, it } from "vitest";
import { listSessions, STAGES, type Stage } from "../lib/dummy-sessions";

describe("dummy session store", () => {
  it("seeds the four fixture sessions", () => {
    const sessions = listSessions();
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
    const createdAt = listSessions().map((s) => s.createdAt);
    expect([...createdAt].sort((a, b) => b.localeCompare(a))).toEqual(createdAt);
    expect(new Set(createdAt).size).toBe(createdAt.length);
  });

  it("matches the /api/sessions contract shape", () => {
    for (const s of listSessions()) {
      expect(Object.keys(s).sort()).toEqual(
        ["createdAt", "id", "knowledgePoint", "stage"],
      );
      expect(STAGES).toContain(s.stage);
      expect(Number.isNaN(new Date(s.createdAt).getTime())).toBe(false);
    }
  });
});
