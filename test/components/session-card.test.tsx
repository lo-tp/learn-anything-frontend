// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderWithLocale } from "@/test/test-utils";import { SessionCard } from "@/components/session-card";
import type { SessionListItem } from "@/lib/api-client";

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

function session(overrides: Partial<SessionListItem> = {}): SessionListItem {
  return {
    session_id: "s-1",
    phase: "executing",
    goal: "React Hooks Deep Dive",
    narrowed_goal: null,
    created_at: new Date(NOW.getTime() - 2 * 3_600_000).toISOString(),
    ...overrides,
  };
}

describe("SessionCard", () => {
  it("links to the session's materials page", () => {
    renderWithLocale(<SessionCard session={session()} />);
    const card = screen.getByRole("link", { name: /React Hooks Deep Dive/ });
    expect(card.getAttribute("href")).toBe("/en/session/s-1");
  });

  it("shows the narrowed goal as the title when one is recorded", () => {
    renderWithLocale(<SessionCard session={session({ narrowed_goal: "Hooks, narrowed" })} />);
    expect(screen.getByText("Hooks, narrowed")).toBeTruthy();
  });

  it("falls back to the goal when no narrowed goal is recorded", () => {
    renderWithLocale(<SessionCard session={session()} />);
    expect(screen.getByText("React Hooks Deep Dive")).toBeTruthy();
  });

  it("shows the relative creation time", () => {
    renderWithLocale(<SessionCard session={session()} />);
    expect(screen.getByText("2 hrs ago")).toBeTruthy();
  });

  it("renders the neutral card — no stage label text (#46)", () => {
    renderWithLocale(<SessionCard session={session()} />);
    expect(screen.queryByText(/executing/i)).toBeNull();
    expect(screen.queryByText(/complete/i)).toBeNull();
  });
});
