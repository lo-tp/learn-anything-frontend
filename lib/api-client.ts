import createClient from "openapi-fetch";
import type { components, paths } from "@/types/api";

/**
 * Typed client for the learn-anything backend API.
 *
 * Types come from `types/api.d.ts`, which is generated from the backend's
 * OpenAPI spec via `npm run generate:types` (run it after the spec changes —
 * never hand-edit the generated file).
 *
 * Note: this talks to the *backend* (`NEXT_PUBLIC_BACKEND_URL` in .env).
 *
 * The client runs in the browser, so the origin must be a `NEXT_PUBLIC_`-prefixed
 * var: Next.js only inlines those into the client bundle. An unprefixed
 * `process.env.BACKEND_URL` is `undefined` at runtime here, and openapi-fetch
 * would fall back to a relative URL (the current page origin) instead of the
 * backend.
 */
export const api = createClient<paths>({
  baseUrl: process.env.NEXT_PUBLIC_BACKEND_URL,
});

/** Named schema types, lifted out of the generated `components.schemas`. */
export type GoalIn = components["schemas"]["GoalIn"];
export type ClarifyIn = components["schemas"]["ClarifyIn"];
export type ClarifyResult = components["schemas"]["ClarifyResult"];
export type SessionState = components["schemas"]["SessionState"];
export type Phase = components["schemas"]["Phase"];
export type ProbeOut = components["schemas"]["ProbeOut"];
export type SessionList = components["schemas"]["SessionList"];
export type SessionListItem = components["schemas"]["SessionListItem"];
export type ProbeQuestionOut = components["schemas"]["ProbeQuestionOut"];
export type AnswerIn = components["schemas"]["AnswerIn"];
export type PlanOut = components["schemas"]["PlanOut"];
export type PlanBody = components["schemas"]["PlanBody"];
export type StepOut = components["schemas"]["StepOut"];
export type ApproveOut = components["schemas"]["ApproveOut"];
export type MaterialsOut = components["schemas"]["MaterialsOut"];
export type MaterialOut = components["schemas"]["MaterialOut"];
export type SlideItem = components["schemas"]["SlideItem"];
export type QuestionItem = components["schemas"]["QuestionItem"];

/** Thrown when the backend answers with a declared error (e.g. 422). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** 422 validation errors from the backend, flattened to messages. */
function describeError(
  error: unknown,
  status?: number,
): ApiError {
  const raw = (error as { detail?: unknown } | undefined)?.detail;
  let message: string;
  if (Array.isArray(raw)) {
    message = raw
      .map((d) => (d as { msg?: string }).msg)
      .filter(Boolean)
      .join(" ");
  } else if (typeof raw === "string") {
    message = raw;
  } else {
    message = "";
  }
  return new ApiError(
    message || `Request failed (${status ?? "unknown"})`,
    status,
  );
}

/** `POST /auth/register` — create an account. 409 = email already in use. */
export async function registerAuth(
  email: string,
  password: string,
  displayName?: string | null,
): Promise<components["schemas"]["UserOut"]> {
  const { data, error, response } = await api.POST("/auth/register", {
    body: { email, password, display_name: displayName ?? null },
    credentials: "include",
  });
  if (!data) {
    if (response?.status === 401) handleUnauthorized();
    throw describeError(error, response?.status);
  }
  return data;
}

/** `POST /auth/login` — sign in. 401 = invalid credentials. */
export async function loginAuth(
  email: string,
  password: string,
): Promise<void> {
  const { data, error, response } = await api.POST("/auth/login", {
    body: { email, password },
    credentials: "include",
  });
  if (!data) {
    throw describeError(error, response?.status);
  }
}

/** `GET /auth/me` — current user's profile. */
export async function getMe(): Promise<components["schemas"]["UserOut"]> {
  const { data, error, response } = await api.GET("/auth/me", {
    credentials: "include",
  });
  if (!data) {
    if (response?.status === 401) handleUnauthorized();
    throw describeError(error, response?.status);
  }
  return data;
}

/** `PATCH /auth/me` — update display name. */
export async function updateMe(
  displayName: string,
): Promise<components["schemas"]["UserOut"]> {
  const { data, error, response } = await api.PATCH("/auth/me", {
    body: { display_name: displayName },
    credentials: "include",
  });
  if (!data) {
    if (response?.status === 401) handleUnauthorized();
    throw describeError(error, response?.status);
  }
  return data;
}

/** `POST /auth/logout` — sign out the current session. */
export async function logoutAuth(): Promise<void> {
  const { data, error, response } = await api.POST("/auth/logout", {
    credentials: "include",
  });
  if (!data) throw describeError(error, response?.status);
}

/**
 * Redirect to the login page, preserving the originally requested path as
 * the `next` query param. Called on any 401 response from an auth-gated
 * endpoint.
 */
export function handleUnauthorized(): void {
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  // Only redirect if we're not already on the login page.
  if (path.endsWith("/login")) return;
  const localePrefix = path.match(/^\/([a-z]{2})/)?.[1] ?? "en";
  const next = encodeURIComponent(path);
  // Full-page navigation is deliberate: this runs in a non-component lib
  // function (no `useRouter()`), and a hard redirect guarantees the client
  // re-runs the locale-less path resolution.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = `/${localePrefix}/login?next=${next}`;
}

/**
 * Internal: handle a 401 from an auth-gated endpoint by redirecting to the
 * login page, then re-throw the original error so the caller's catch block
 * still runs (and the redirect takes over the tab).
 */
function guardUnauthorized(response: Response | undefined, error: unknown, status?: number): ApiError {
  if (response?.status === 401) handleUnauthorized();
  return describeError(error, status);
}

/** `GET /sessions` — list sessions (newest first), optionally filtered by phase(s). */
export async function listSessions(phases?: Phase[]): Promise<SessionList> {
  const { data, error, response } = await api.GET("/sessions", {
    params: { query: { phase: phases } },
    credentials: "include",
  });
  if (!data) throw guardUnauthorized(response, error, response?.status);
  return data;
}

/** `POST /sessions` — create a session and make the first Clarify call. */
export async function createSession(goal: string): Promise<ClarifyResult> {
  const { data, error, response } = await api.POST("/sessions", {
    body: { goal },
    credentials: "include",
  });
  if (!data) throw guardUnauthorized(response, error, response?.status);
  return data;
}

/** `POST /sessions/{session_id}/clarify` — resume the Clarify loop with an answer. */
export async function clarifySession(
  sessionId: string,
  answer: string,
): Promise<ClarifyResult> {
  const { data, error, response } = await api.POST(
    "/sessions/{session_id}/clarify",
    { params: { path: { session_id: sessionId } }, body: { answer }, credentials: "include" },
  );
  if (!data) throw guardUnauthorized(response, error, response?.status);
  return data;
}

/** `GET /sessions/{session_id}` — full session state (phase, goal, progress). */
export async function getSession(sessionId: string): Promise<SessionState> {
  const { data, error, response } = await api.GET("/sessions/{session_id}", {
    params: { path: { session_id: sessionId } },
    credentials: "include",
  });
  if (!data) throw guardUnauthorized(response, error, response?.status);
  return data;
}

/**
 * `POST /sessions/{session_id}/probe` — start the probe: fetch the first
 * batch of questions. `answers` is `null` to signal the start call (the
 * backend reads `body.answers is None`).
 */
export async function startProbe(sessionId: string): Promise<ProbeOut> {
  const { data, error, response } = await api.POST(
    "/sessions/{session_id}/probe",
    { params: { path: { session_id: sessionId } }, body: { answers: null }, credentials: "include" },
  );
  if (!data) throw guardUnauthorized(response, error, response?.status);
  return data;
}

/**
 * `POST /sessions/{session_id}/probe` — submit the answers for the current
 * batch. `answers` is one entry per question in batch order; each
 * `selected_index` is 0-based, matching the backend's `correct_index`
 * convention (the UI shows 1-based option letters).
 */
export async function answerProbe(
  sessionId: string,
  answers: AnswerIn[],
): Promise<ProbeOut> {
  const { data, error, response } = await api.POST(
    "/sessions/{session_id}/probe",
    {
      params: { path: { session_id: sessionId } },
      body: { answers },
      credentials: "include",
    },
  );
  if (!data) throw guardUnauthorized(response, error, response?.status);
  return data;
}

/** `POST /sessions/{session_id}/plan/generate` — trigger plan generation. */
export async function generatePlan(sessionId: string): Promise<PlanOut> {
  const { data, error, response } = await api.POST(
    "/sessions/{session_id}/plan/generate",
    { params: { path: { session_id: sessionId } }, credentials: "include" },
  );
  if (!data) throw guardUnauthorized(response, error, response?.status);
  return data;
}

/**
 * `POST /sessions/{session_id}/plan/adjust` — submit a free-text adjustment
 * and get the regenerated plan.
 */
export async function adjustPlan(
  sessionId: string,
  adjustment: string,
): Promise<PlanOut> {
  const { data, error, response } = await api.POST(
    "/sessions/{session_id}/plan/adjust",
    {
      params: { path: { session_id: sessionId } },
      body: { adjustment },
      credentials: "include",
    },
  );
  if (!data) throw guardUnauthorized(response, error, response?.status);
  return data;
}

/**
 * `POST /sessions/{session_id}/plan/approve` — approve the plan and
 * transition the session to `generating` (202 response).
 */
export async function approvePlan(sessionId: string): Promise<ApproveOut> {
  const { data, error, response } = await api.POST(
    "/sessions/{session_id}/plan/approve",
    { params: { path: { session_id: sessionId } }, credentials: "include" },
  );
  if (!data) throw guardUnauthorized(response, error, response?.status);
  return data;
}

/**
 * `GET /sessions/{session_id}/materials` — poll material generation
 * progress with full content.
 */
export async function getMaterials(sessionId: string): Promise<MaterialsOut> {
  const { data, error, response } = await api.GET(
    "/sessions/{session_id}/materials",
    { params: { path: { session_id: sessionId } }, credentials: "include" },
  );
  if (!data) throw guardUnauthorized(response, error, response?.status);
  return data;
}

// ── Review (spaced repetition) ──────────────────────────────────────────────
// Types match the agreed §3.9 shape; once the backend is live and
// `npm run generate:types` runs, these can be lifted to `components["schemas"]`.
// The review paths are not yet in the generated OpenAPI spec, so these use
// raw `fetch` (the same transport `openapi-fetch` wraps).

export type ReviewQuestionIn = {
  text: string;
  options: string[];
  correct_index: number;
  explanation: string;
};

export type ReviewCardIn = {
  source: string;
  session_id: string;
  question_id: string;
  question: ReviewQuestionIn;
  step_id?: string | null;
  selected_index?: number | null;
};

export type ReviewQuestionOut = {
  text: string;
  options: string[];
  correct_index: number;
  explanation: string;
};

export type ReviewCardOut = {
  id: number;
  source: string;
  question: ReviewQuestionOut;
  session_id: string;
  step_id: string | null;
  due_at: string;
};

/**
 * The learner's self-rated confidence in having known the answer. Maps
 * 1:1 onto the FSRS ratings the scheduler is driven by (#115/#116).
 */
export type ReviewConfidence = "again" | "hard" | "good" | "easy";

export type ReviewAnswerIn = {
  confidence: ReviewConfidence;
};

export type ReviewAnswerOut = {
  due_at: string;
  interval_days: number;
  lapses: number;
};

/** Internal: raw fetch against the backend with review-path error handling. */
async function reviewFetch<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}${path}`, {
    method,
    credentials: "include",
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const error: unknown = await res.json().catch(() => null);
    throw guardUnauthorized(res, error, res.status);
  }
  return (await res.json()) as T;
}

/**
 * `POST /review/cards` — record a missed question.
 * Material misses are fired from the client (fire-and-forget); probe misses
 * are recorded server-side.
 */
export async function postReviewCard(
  body: ReviewCardIn,
): Promise<ReviewCardOut> {
  return reviewFetch<ReviewCardOut>("POST", "/review/cards", body);
}

/** `GET /review/due` — the current user's due review cards, ordered by due_at. */
export async function getReviewDue(limit = 20): Promise<ReviewCardOut[]> {
  const qs = limit !== 20 ? `?limit=${limit}` : "";
  return reviewFetch<ReviewCardOut[]>("GET", `/review/due${qs}`);
}

/**
 * `POST /review/cards/{card_id}/answer` — record the learner's confidence
 * (again/hard/good/easy), updating the card's FSRS state. Returns the new
 * due date, the derived interval, and the lapse count.
 */
export async function answerReviewCard(
  cardId: number,
  confidence: ReviewConfidence,
): Promise<ReviewAnswerOut> {
  return reviewFetch<ReviewAnswerOut>(
    "POST",
    `/review/cards/${cardId}/answer`,
    { confidence } satisfies ReviewAnswerIn,
  );
}

