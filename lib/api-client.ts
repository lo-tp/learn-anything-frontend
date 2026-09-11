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
  const detail = (error as { detail?: { msg: string }[] } | undefined)?.detail;
  return new ApiError(
    detail?.map((d) => d.msg).join(" ") ?? `Request failed (${status ?? "unknown"})`,
    status,
  );
}

/** `GET /sessions` — list sessions (newest first), optionally filtered by phase(s). */
export async function listSessions(phases?: Phase[]): Promise<SessionList> {
  const { data, error, response } = await api.GET("/sessions", {
    params: { query: { phase: phases } },
  });
  if (!data) throw describeError(error, response?.status);
  return data;
}

/** `POST /sessions` — create a session and make the first Clarify call. */
export async function createSession(goal: string): Promise<ClarifyResult> {
  const { data, error, response } = await api.POST("/sessions", {
    body: { goal },
  });
  if (!data) throw describeError(error, response?.status);
  return data;
}

/** `POST /sessions/{session_id}/clarify` — resume the Clarify loop with an answer. */
export async function clarifySession(
  sessionId: string,
  answer: string,
): Promise<ClarifyResult> {
  const { data, error, response } = await api.POST(
    "/sessions/{session_id}/clarify",
    { params: { path: { session_id: sessionId } }, body: { answer } },
  );
  if (!data) throw describeError(error, response?.status);
  return data;
}

/** `GET /sessions/{session_id}` — full session state (phase, goal, progress). */
export async function getSession(sessionId: string): Promise<SessionState> {
  const { data, error, response } = await api.GET("/sessions/{session_id}", {
    params: { path: { session_id: sessionId } },
  });
  if (!data) throw describeError(error, response?.status);
  return data;
}

/** `POST /sessions/{session_id}/probe` — start the probe: fetch the first question. */
export async function startProbe(sessionId: string): Promise<ProbeOut> {
  const { data, error, response } = await api.POST(
    "/sessions/{session_id}/probe",
    { params: { path: { session_id: sessionId } }, body: {} },
  );
  if (!data) throw describeError(error, response?.status);
  return data;
}

/**
 * `POST /sessions/{session_id}/probe` — submit the answer to the active
 * probe question. `selectedIndex` is 0-based, matching the backend's
 * `correct_index` convention (the UI shows 1-based option numbers).
 */
export async function answerProbe(
  sessionId: string,
  questionId: string,
  selectedIndex: number,
): Promise<ProbeOut> {
  const { data, error, response } = await api.POST(
    "/sessions/{session_id}/probe",
    {
      params: { path: { session_id: sessionId } },
      body: { question_id: questionId, selected_index: selectedIndex },
    },
  );
  if (!data) throw describeError(error, response?.status);
  return data;
}

/** `POST /sessions/{session_id}/plan/generate` — trigger plan generation. */
export async function generatePlan(sessionId: string): Promise<PlanOut> {
  const { data, error, response } = await api.POST(
    "/sessions/{session_id}/plan/generate",
    { params: { path: { session_id: sessionId } } },
  );
  if (!data) throw describeError(error, response?.status);
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
    },
  );
  if (!data) throw describeError(error, response?.status);
  return data;
}

/**
 * `POST /sessions/{session_id}/plan/approve` — approve the plan and
 * transition the session to `generating` (202 response).
 */
export async function approvePlan(sessionId: string): Promise<ApproveOut> {
  const { data, error, response } = await api.POST(
    "/sessions/{session_id}/plan/approve",
    { params: { path: { session_id: sessionId } } },
  );
  if (!data) throw describeError(error, response?.status);
  return data;
}

/**
 * `GET /sessions/{session_id}/materials` — poll material generation
 * progress with full content.
 */
export async function getMaterials(sessionId: string): Promise<MaterialsOut> {
  const { data, error, response } = await api.GET(
    "/sessions/{session_id}/materials",
    { params: { path: { session_id: sessionId } } },
  );
  if (!data) throw describeError(error, response?.status);
  return data;
}
