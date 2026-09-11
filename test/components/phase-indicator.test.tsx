// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PhaseIndicator } from "@/components/phase-indicator";
import type { Phase } from "@/lib/api-client";

/** Every backend phase and the label the chip shows for it. */
const PHASES: Record<Phase, string> = {
  clarifying: "Clarifying",
  probing: "Probing",
  planning: "Planning",
  reviewing: "Reviewing",
  generating: "Generating",
  executing: "Executing",
  complete: "Complete",
  error: "Error",
};

afterEach(() => {
  cleanup();
});

describe("PhaseIndicator", () => {
  it("shows a neutral Ready state before any session exists", () => {
    render(<PhaseIndicator phase={null} />);
    expect(screen.getByText("Ready")).toBeTruthy();
    expect(screen.getByRole("status", { name: /ready/i })).toBeTruthy();
  });

  it("renders the label for every backend phase", () => {
    for (const [phase, label] of Object.entries(PHASES)) {
      cleanup();
      render(<PhaseIndicator phase={phase as Phase} />);
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("exposes a status role whose accessible name names the phase", () => {
    render(<PhaseIndicator phase="probing" />);
    expect(screen.getByRole("status", { name: /probing/i })).toBeTruthy();
  });

  it("keeps the label but shows a spinner while a request is in flight", () => {
    render(<PhaseIndicator phase="clarifying" pending />);
    const status = screen.getByRole("status", { name: /clarifying/i });
    // The phase label is still visible…
    expect(screen.getByText("Clarifying")).toBeTruthy();
    // …and the chip carries the spinning loader.
    expect(status.querySelector(".animate-spin")).toBeTruthy();
  });

  it("shows no spinner when idle", () => {
    render(<PhaseIndicator phase="probing" />);
    expect(
      screen.getByRole("status", { name: /probing/i }).querySelector(
        ".animate-spin",
      ),
    ).toBeNull();
  });
});
