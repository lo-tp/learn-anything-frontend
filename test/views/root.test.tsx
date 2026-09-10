// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { Root } from "@/views/root";
import { createSession } from "@/lib/api-client";
import type { SessionSummary } from "@/lib/dummy-sessions";

// The new-session dialog creates sessions through the typed backend client;
// stub that module (openapi-fetch binds `fetch` at client-creation time, so
// stubbing the global fetch after import never intercepts it).
vi.mock("@/lib/api-client", () => ({
  createSession: vi.fn(),
  clarifySession: vi.fn(),
  startProbe: vi.fn(),
  answerProbe: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

const mockCreateSession = vi.mocked(createSession);

beforeEach(() => {
  mockCreateSession.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

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

  it("opens the new-session dialog from the 'Start New Session' CTA", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(json([]))));
    render(<Root initialSessions={[session()]} />);
    fireEvent.click(
      screen.getByRole("button", { name: /Start New Session/ }),
    );
    expect(
      await screen.findByRole("heading", { name: "Start New Session" }),
    ).toBeTruthy();
  });

  it("opens the new-session dialog from the empty-state CTA", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(json([]))));
    render(<Root initialSessions={[]} />);
    fireEvent.click(
      screen.getByRole("button", { name: /Start New Session/ }),
    );
    expect(
      await screen.findByRole("heading", { name: "Start New Session" }),
    ).toBeTruthy();
  });

  it("refetches the History when the dialog accepts a new session", async () => {
    const fresh: SessionSummary = {
      id: "s-newton",
      knowledgePoint: "Newton's second law of motion",
      createdAt: "2025-10-25T11:00:00.000Z",
      stage: "probing",
    };
    // The dialog creates the session through the typed backend client. A
    // non-probing advanced phase skips the probe loop and confirms directly.
    mockCreateSession.mockResolvedValue({
      session_id: fresh.id,
      phase: "planning",
      narrowed_goal: fresh.knowledgePoint,
    });
    // The re-fetch after accept returns the new session on top.
    const fetchMock = vi.fn(() => Promise.resolve(json([fresh, session()])));
    vi.stubGlobal("fetch", fetchMock);

    render(<Root initialSessions={[session()]} />);
    fireEvent.click(
      screen.getByRole("button", { name: /Start New Session/ }),
    );
    const textarea = await screen.findByLabelText(
      "What would you like to explore or learn?",
    );
    fireEvent.change(textarea, {
      target: {
        value:
          "I want to master Newton's second law of motion and how force, mass, and acceleration fit together.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    // The phase advanced past clarifying: the confirm step replaces Send,
    // and only Confirm hands off (triggering the re-fetch).
    const confirm = await screen.findByRole("button", { name: /Confirm/ });
    fireEvent.click(confirm);

    // The accepted session appears at the top — only possible through the
    // re-fetch, since it was not in initialSessions.
    expect(await screen.findByText("Newton's second law of motion")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1); // the re-fetch (createSession goes through the stubbed client)
  });
});
