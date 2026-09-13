import { afterEach, describe, expect, it, vi } from "vitest";

// `openapi-fetch` binds `fetch` at client-creation time, so stub the global
// fetch *before* the dynamic import below. Likewise the client reads
// `process.env.NEXT_PUBLIC_BACKEND_URL` at creation time — pin it so the
// request URL is absolute and assertable.
const BACKEND = "http://backend.test";
process.env.NEXT_PUBLIC_BACKEND_URL = BACKEND;
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const { ApiError, getMaterials, getSession, listSessions } =
  await import("@/lib/api-client");

afterEach(() => {
  fetchMock.mockReset();
  vi.restoreAllMocks();
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

const MATERIALS = {
  phase: "executing",
  generated_steps: [
    {
      step_id: "st-1",
      summary: {
        step_id: "st-1",
        title: "Force, mass, acceleration",
        key_points: ["F = ma"],
      },
      items: [
        { type: "slide", slide_id: "slide-1" },
        {
          type: "question",
          id: "q-1",
          text: "What is F in F = ma?",
          options: ["Force", "Friction"],
          correct_index: 0,
          explanation: "F is the net force.",
        },
      ],
    },
  ],
};

/**
 * Server-rendered fetches must be bounded: when the backend stalls (rather
 * than refusing the connection), the page's `try/catch` only sees a *throw*,
 * not a hang, so each SSR fetch carries an abort timeout that turns a stall
 * into the fallback state in bounded time (#52).
 */
describe("server-rendered fetch timeout (#52)", () => {
  it.each([
    ["listSessions", () => listSessions()],
    ["getSession", () => getSession("s-1")],
    ["getMaterials", () => getMaterials("s-1")],
  ])("%s sends a timeout signal with the request", async (_name, call) => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    fetchMock.mockResolvedValue(json({}));

    await call();

    // a finite timeout is created and attached to the Request
    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Number));
    const request = fetchMock.mock.calls.at(-1)?.[0] as Request;
    expect(request.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("getMaterials", () => {
  it("returns the MaterialsOut for the session", async () => {
    fetchMock.mockResolvedValue(json(MATERIALS));

    const result = await getMaterials("s-1");

    const url = new URL(fetchMock.mock.calls[0][0].url);
    expect(url.origin + url.pathname).toBe(`${BACKEND}/sessions/s-1/materials`);
    expect(result).toEqual(MATERIALS);
  });

  it("throws an ApiError with the flattened detail messages on a 422", async () => {
    fetchMock.mockResolvedValue(
      json({ detail: [{ msg: "no such session" }] }, 422),
    );

    const err = await getMaterials("nope").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe("no such session");
  });
});
