import createClient from "openapi-fetch";
import type { components, paths } from "@/types/api";

/**
 * Typed client for the learn-anything backend API.
 *
 * Types come from `types/api.d.ts`, which is generated from the backend's
 * OpenAPI spec via `npm run generate:types` (run it after the spec changes —
 * never hand-edit the generated file).
 *
 * Note: this talks to the *backend* (`NEXT_PUBLIC_BACKEND_URL` in .env), not
 * the Next.js `/api/sessions` dummy-store route — the two have different
 * shapes (e.g. backend takes `{ goal }`, the dummy route takes `{ paragraph }`).
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
