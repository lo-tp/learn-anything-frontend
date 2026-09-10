import { describe, expect, it } from "vitest";
import { timeAgo } from "@/lib/time";

const NOW = new Date("2025-10-25T12:00:00");
const iso = (d: Date) => d.toISOString();

describe("timeAgo", () => {
  it("buckets under a minute as 'just now'", () => {
    expect(timeAgo(iso(new Date(NOW.getTime() - 30_000)), NOW)).toBe("just now");
    expect(timeAgo(iso(new Date(NOW.getTime() - 59_000)), NOW)).toBe("just now");
  });

  it("buckets under an hour as 'N min ago'", () => {
    expect(timeAgo(iso(new Date(NOW.getTime() - 5 * 60_000)), NOW)).toBe(
      "5 min ago",
    );
    expect(timeAgo(iso(new Date(NOW.getTime() - 59 * 60_000)), NOW)).toBe(
      "59 min ago",
    );
  });

  it("buckets the previous calendar day as 'Yesterday'", () => {
    expect(timeAgo(iso(new Date("2025-10-24T12:00:00")), NOW)).toBe("Yesterday");
    // Even a few hours back on yesterday's date.
    expect(timeAgo(iso(new Date("2025-10-24T01:00:00")), NOW)).toBe("Yesterday");
  });

  it("buckets the same day, past an hour, as 'N hrs ago'", () => {
    expect(timeAgo(iso(new Date("2025-10-25T10:00:00")), NOW)).toBe("2 hrs ago");
  });

  it("renders older sessions as 'Mon D', adding the year once it differs", () => {
    expect(timeAgo(iso(new Date("2025-10-24T00:00:00")), new Date("2025-12-01T12:00:00"))).toBe(
      "Oct 24",
    );
    expect(
      timeAgo(iso(new Date("2024-10-24T12:00:00")), NOW),
    ).toBe("Oct 24, 2024");
  });
});
