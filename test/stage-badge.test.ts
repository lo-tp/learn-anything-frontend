import { describe, expect, it } from "vitest";
import { STAGES } from "../lib/dummy-sessions";
import { STAGE_BADGES } from "../components/session-card";

describe("STAGE_BADGES", () => {
  it("covers exactly the real stage vocabulary — nothing more, nothing less", () => {
    expect(Object.keys(STAGE_BADGES).sort()).toEqual([...STAGES].sort());
  });

  it("gives every stage a label and an icon", () => {
    for (const stage of STAGES) {
      const badge = STAGE_BADGES[stage];
      expect(badge.label.length).toBeGreaterThan(0);
      expect(badge.icon).toBeDefined();
    }
  });
});
