// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderWithLocale } from "@/test/test-utils";import { PhaseIndicator } from "@/components/phase-indicator";
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
    renderWithLocale(<PhaseIndicator phase={null} />);
    expect(screen.getByText("Ready")).toBeTruthy();
    expect(screen.getByRole("status", { name: /ready/i })).toBeTruthy();
  });

  it("renders the label for every backend phase", () => {
    for (const [phase, label] of Object.entries(PHASES)) {
      cleanup();
      renderWithLocale(<PhaseIndicator phase={phase as Phase} />);
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("exposes a status role whose accessible name names the phase", () => {
    renderWithLocale(<PhaseIndicator phase="probing" />);
    expect(screen.getByRole("status", { name: /probing/i })).toBeTruthy();
  });

  it("keeps the label but shows a spinner while a request is in flight", () => {
    renderWithLocale(<PhaseIndicator phase="clarifying" pending />);
    const status = screen.getByRole("status", { name: /clarifying/i });
    // The phase label is still visible…
    expect(screen.getByText("Clarifying")).toBeTruthy();
    // …and the chip carries the spinning loader.
    expect(status.querySelector(".animate-spin")).toBeTruthy();
  });

  it("shows no spinner when idle", () => {
    renderWithLocale(<PhaseIndicator phase="probing" />);
    expect(
      screen.getByRole("status", { name: /probing/i }).querySelector(
        ".animate-spin",
      ),
    ).toBeNull();
  });

  it("labels phases from the zh catalog under the zh locale", () => {
    renderWithLocale(<PhaseIndicator phase="clarifying" />, { locale: "zh" });
    expect(screen.getByText("澄清目标")).toBeTruthy();
  });
});
