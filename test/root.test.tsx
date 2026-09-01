// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Root } from "../views/root";
import type { SessionSummary } from "../lib/dummy-sessions";

afterEach(() => {
  cleanup();
});

function session(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: "s-1",
    knowledgePoint: "React Hooks Deep Dive",
    createdAt: new Date("2025-10-25T10:00:00").toISOString(),
    stage: "probing",
    ...overrides,
  };
}

describe("Root (home History)", () => {
  it("hides the 'My Sessions' header and shows the 'Start New Session' button in the empty state", () => {
    render(<Root initialSessions={[]} />);
    expect(screen.getByText("No sessions yet")).toBeTruthy();
    // Header hidden ⇒ the only 'Start New Session' button must be the one the
    // empty state renders at the bottom.
    expect(screen.queryByText("My Sessions")).toBeNull();
    expect(screen.getByRole("button", { name: /Start New Session/ })).toBeTruthy();
  });

  it("shows the 'My Sessions' header and session cards, not the empty state, when sessions exist", () => {
    render(<Root initialSessions={[session()]} />);
    expect(screen.getByText("My Sessions")).toBeTruthy();
    expect(screen.getByText("React Hooks Deep Dive")).toBeTruthy();
    expect(screen.queryByText("No sessions yet")).toBeNull();
  });
});
