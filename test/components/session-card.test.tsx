// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SessionCard, STAGE_BADGES } from "@/components/session-card";
import type { SessionSummary, Stage } from "@/lib/dummy-sessions";

// Pin the clock so timeAgo's output is deterministic.
const NOW = new Date("2025-10-25T12:00:00");

beforeEach(() => {
  // Pin Date only — faking setTimeout/etc. would stall React's scheduler.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

function session(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: "s-1",
    knowledgePoint: "React Hooks Deep Dive",
    createdAt: new Date(NOW.getTime() - 2 * 3_600_000).toISOString(),
    stage: "probing",
    ...overrides,
  };
}

describe("SessionCard", () => {
  it("links to the classroom page", () => {
    render(<SessionCard session={session()} />);
    const card = screen.getByRole("link", { name: /React Hooks Deep Dive/ });
    expect(card.getAttribute("href")).toBe("/classroom");
  });

  it("shows the knowledge point as the title", () => {
    render(<SessionCard session={session()} />);
    expect(screen.getByText("React Hooks Deep Dive")).toBeTruthy();
  });

  it("shows a muted 'New session' title when no knowledge point is recorded yet", () => {
    render(<SessionCard session={session({ knowledgePoint: null })} />);
    const title = screen.getByText("New session");
    expect(title).toBeTruthy();
    expect(title.className).toContain("text-on-surface-variant");
  });

  it("shows the relative creation time", () => {
    render(<SessionCard session={session()} />);
    expect(screen.getByText("2 hrs ago")).toBeTruthy();
  });

  it("renders the stage badge label", () => {
    render(<SessionCard session={session()} />);
    expect(screen.getByText("Probing")).toBeTruthy();
  });

  it("renders a badge for every stage in the real vocabulary", () => {
    for (const stage of Object.keys(STAGE_BADGES) as Stage[]) {
      cleanup();
      render(<SessionCard session={session({ stage })} />);
      expect(screen.getByText(STAGE_BADGES[stage].label)).toBeTruthy();
    }
  });
});
