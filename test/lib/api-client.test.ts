import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewCardIn } from "@/lib/api-client";

// `openapi-fetch` binds `fetch` at client-creation time, so stub the global
// fetch *before* the dynamic import below. Likewise the client reads
// `process.env.NEXT_PUBLIC_BACKEND_URL` at creation time — pin it so the
// request URL is absolute and assertable.
const BACKEND = "http://backend.test";
process.env.NEXT_PUBLIC_BACKEND_URL = BACKEND;
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const {
  ApiError,
  adjustPlan,
  answerProbe,
  answerReviewCard,
  approvePlan,
  clarifySession,
  createSession,
  getMe,
  getMaterials,
  generatePlan,
  getSession,
  getReviewDue,
  getReviewSummary,
  listSessions,
  logoutAuth,
  postReviewCard,
  registerAuth,
  startProbe,
  updateMe,
  handleUnauthorized,
} = await import("@/lib/api-client");

afterEach(() => {
  fetchMock.mockReset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// The suite's afterEach un-stubs globals; `reviewFetch` reads the global
// `fetch` at call time (openapi-fetch captured its own at import), so the
// stub must be alive for every test, not just the first.
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
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

  it("redirects to login on a 401 (and still throws)", async () => {
    vi.stubGlobal("window", { location: { pathname: "/en", href: "" } });
    fetchMock.mockResolvedValue(json({ detail: "Not authenticated" }, 401));
    const err = await listSessions().catch((e) => e);
    expect(window.location.href).toBe("/en/login?next=%2Fen");
    expect(err).toBeInstanceOf(ApiError);
  });
});

describe("describeError edge cases", () => {
  it("falls back to 'Request failed (<status>)' when the detail is neither an array nor a string", async () => {
    fetchMock.mockResolvedValue(json({ detail: null }, 500));
    const err = await listSessions().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe("Request failed (500)");
  });

  it("falls back to the no-detail message when the body is not JSON", async () => {
    // reviewFetch handles raw fetch responses: a 500 with a non-JSON body
    // makes `res.json()` reject, and the `.catch(() => null)` lands in the
    // "no detail" fallback.
    fetchMock.mockResolvedValue(
      new Response("internal explosion", { status: 500 }),
    );
    const err = await getReviewSummary().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe("Request failed (500)");
  });
});

describe("handleUnauthorized", () => {
  it("is a no-op without a window (server side)", () => {
    // This file runs in the node environment — no stubbed `window` here,
    // so the SSR guard returns before touching `window.location`.
    expect(() => handleUnauthorized()).not.toThrow();
  });

  it("falls back to the `en` prefix when the path has no locale prefix", () => {
    vi.stubGlobal("window", { location: { pathname: "/", href: "" } });
    handleUnauthorized();
    expect(window.location.href).toBe("/en/login?next=%2F");
  });
});

const SESSIONS = {
  session_id: "s-1",
  phase: "probing",
  narrowed_goal: "Newton's second law of motion",
};

describe("session endpoints", () => {
  it("createSession POSTs the goal", async () => {
    fetchMock.mockResolvedValue(json(SESSIONS));
    const result = await createSession("learn F = ma");
    expect(fetchMock.mock.calls[0][0].url).toBe(`${BACKEND}/sessions`);
    expect(result).toEqual(SESSIONS);
  });

  it("clarifySession posts the answer for the session", async () => {
    fetchMock.mockResolvedValue(json(SESSIONS));
    await clarifySession("s-1", "the elastic ones");
    expect(fetchMock.mock.calls[0][0].url).toBe(`${BACKEND}/sessions/s-1/clarify`);
  });

  it("getSession GETs the full session state", async () => {
    fetchMock.mockResolvedValue(json(SESSIONS));
    await getSession("s-1");
    expect(fetchMock.mock.calls[0][0].url).toBe(`${BACKEND}/sessions/s-1`);
  });

  it("startProbe signals the start with a null answers body", async () => {
    fetchMock.mockResolvedValue(json({ phase: "probing", questions: [] }));
    await startProbe("s-1");
    // openapi-fetch wraps the call in a Request; the body is on it.
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(await request.clone().text()).toBe('{"answers":null}');
  });

  it("answerProbe posts the combined answers", async () => {
    fetchMock.mockResolvedValue(json({ phase: "probing", questions: [] }));
    await answerProbe("s-1", [{ question_id: "q1", selected_index: 1 }]);
    expect(fetchMock.mock.calls[0][0].url).toBe(`${BACKEND}/sessions/s-1/probe`);
  });

  it("generatePlan triggers plan generation", async () => {
    fetchMock.mockResolvedValue(json({ phase: "reviewing" }));
    await generatePlan("s-1");
    expect(fetchMock.mock.calls[0][0].url).toBe(`${BACKEND}/sessions/s-1/plan/generate`);
  });

  it("adjustPlan posts the free-text adjustment", async () => {
    fetchMock.mockResolvedValue(json({ phase: "reviewing" }));
    await adjustPlan("s-1", "drop the last step");
    expect(fetchMock.mock.calls[0][0].url).toBe(`${BACKEND}/sessions/s-1/plan/adjust`);
  });

  it("approvePlan approves the plan", async () => {
    fetchMock.mockResolvedValue(json({ phase: "generating" }));
    await approvePlan("s-1");
    expect(fetchMock.mock.calls[0][0].url).toBe(`${BACKEND}/sessions/s-1/plan/approve`);
  });

  it("redirects to login on a 401 (and still throws)", async () => {
    vi.stubGlobal("window", { location: { pathname: "/en", href: "" } });
    fetchMock.mockResolvedValue(json({ detail: "Not authenticated" }, 401));
    const err = await createSession("learn F = ma").catch((e) => e);
    expect(window.location.href).toBe("/en/login?next=%2Fen");
    expect(err).toBeInstanceOf(ApiError);
  });

  it("throws an ApiError on a non-401 failure for every session endpoint", async () => {
    // A fresh Response per call — a body can only be read once.
    fetchMock.mockImplementation(
      () => Promise.resolve(json({ detail: [{ msg: "boom" }] }, 500)),
    );
    const endpoints: Array<Promise<unknown>> = [
      clarifySession("s-1", "answer"),
      getSession("s-1"),
      startProbe("s-1"),
      answerProbe("s-1", []),
      generatePlan("s-1"),
      adjustPlan("s-1", "tighten"),
      approvePlan("s-1"),
    ];
    const errors = await Promise.all(
      endpoints.map((promise) => promise.catch((e) => e)),
    );
    errors.forEach((err) => {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as { message: string }).message).toBe("boom");
    });
  });
});

describe("auth endpoints", () => {
  it("registerAuth redirects to login on a 401 (and still throws)", async () => {
    vi.stubGlobal("window", { location: { pathname: "/en", href: "" } });
    fetchMock.mockResolvedValue(json({ detail: "invalid" }, 401));
    const err = await registerAuth("a@b.c", "password123").catch((e) => e);
    expect(window.location.href).toBe("/en/login?next=%2Fen");
    expect(err).toBeInstanceOf(ApiError);
  });

  it("getMe throws on a non-401 failure", async () => {
    fetchMock.mockResolvedValue(json({ detail: [{ msg: "x" }] }, 500));
    const err = await getMe().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe("x");
  });

  it("getMe redirects to login on a 401 (and still throws)", async () => {
    vi.stubGlobal("window", { location: { pathname: "/en", href: "" } });
    fetchMock.mockResolvedValue(json({ detail: "Not authenticated" }, 401));
    const err = await getMe().catch((e) => e);
    expect(window.location.href).toBe("/en/login?next=%2Fen");
    expect(err).toBeInstanceOf(ApiError);
  });

  it("updateMe throws an ApiError on failure", async () => {
    fetchMock.mockResolvedValue(json({ detail: "nope" }, 422));
    const err = await updateMe("Bob").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe("nope");
  });

  it("logoutAuth throws an ApiError on failure", async () => {
    fetchMock.mockResolvedValue(json({ detail: "nope" }, 500));
    const err = await logoutAuth().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe("nope");
  });
});

describe("review endpoints", () => {
  const CARD: ReviewCardIn & { id: number; due_at: string } = {
    id: 1,
    source: "material",
    session_id: "s-1",
    step_id: null,
    question_id: "q-1",
    question: { text: "t", options: ["a"], correct_index: 0, explanation: "e" },
    due_at: "2025-10-25T00:00:00Z",
  };

  it("postReviewCard posts the card with a content-type header", async () => {
    fetchMock.mockResolvedValue(json(CARD));
    await postReviewCard(CARD);
    const init = fetchMock.mock.calls[0][1];
    expect(init.headers["content-type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify(CARD));
  });

  it("getReviewDue omits the limit param at the default", async () => {
    fetchMock.mockResolvedValue(json([CARD]));
    await getReviewDue();
    expect(fetchMock.mock.calls[0][0]).toBe(`${BACKEND}/review/due`);
  });

  it("getReviewDue appends a custom limit", async () => {
    fetchMock.mockResolvedValue(json([CARD]));
    await getReviewDue(5);
    expect(fetchMock.mock.calls[0][0]).toBe(`${BACKEND}/review/due?limit=5`);
  });

  it("answerReviewCard posts the confidence", async () => {
    fetchMock.mockResolvedValue(json({ due_at: "", interval_days: 2, lapses: 0 }));
    await answerReviewCard(7, "hard");
    expect(fetchMock.mock.calls[0][0]).toBe(`${BACKEND}/review/cards/7/answer`);
  });

  it("getReviewSummary GETs the summary", async () => {
    fetchMock.mockResolvedValue(json({ due_count: 1, total_active: 3 }));
    await getReviewSummary();
    expect(fetchMock.mock.calls[0][0]).toBe(`${BACKEND}/review/summary`);
  });

  it("redirects to login on a 401 (and still throws)", async () => {
    vi.stubGlobal("window", { location: { pathname: "/en", href: "" } });
    fetchMock.mockResolvedValue(json({ detail: "Not authenticated" }, 401));
    const err = await getReviewDue().catch((e) => e);
    expect(window.location.href).toBe("/en/login?next=%2Fen");
    expect(err).toBeInstanceOf(ApiError);
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
