import { afterEach, describe, expect, it, vi } from "vitest";

// `openapi-fetch` binds `fetch` at client-creation time, so stub the global
// fetch *before* the dynamic import below. Likewise the client reads
// `process.env.NEXT_PUBLIC_BACKEND_URL` at creation time — pin it so the
// request URL is absolute and assertable.
const BACKEND = "http://backend.test";
process.env.NEXT_PUBLIC_BACKEND_URL = BACKEND;
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const { ApiError, listSessions } = await import("@/lib/api-client");

afterEach(() => {
  fetchMock.mockReset();
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const LIST = {
  sessions: [
    {
      session_id: "s-1",
      phase: "executing",
      goal: "System Design Patterns",
      narrowed_goal: null,
      created_at: "2025-10-25T10:00:00.000Z",
    },
  ],
};

describe("listSessions", () => {
  it("sends the phase filter as repeated query params and returns the SessionList", async () => {
    fetchMock.mockResolvedValue(json(LIST));
    const result = await listSessions(["executing", "complete"]);
    const url = new URL(fetchMock.mock.calls[0][0].url);
    expect(url.origin + url.pathname).toBe(`${BACKEND}/sessions`);
    expect(url.searchParams.getAll("phase")).toEqual(["executing", "complete"]);
    expect(result).toEqual(LIST);
  });

  it("omits the phase query params when no phases are given", async () => {
    fetchMock.mockResolvedValue(json(LIST));
    await listSessions();
    const url = new URL(fetchMock.mock.calls[0][0].url);
    expect(url.search).toBe("");
  });

  it("throws an ApiError with the flattened detail messages on a 422", async () => {
    fetchMock.mockResolvedValue(
      json({ detail: [{ msg: "phase: bad" }, { msg: "and this" }] }, 422),
    );
    const err = await listSessions(["executing"]).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe("phase: bad and this");
  });
});
