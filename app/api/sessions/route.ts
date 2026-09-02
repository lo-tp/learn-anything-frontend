import { NextResponse } from "next/server";
import {
  getCurrentLearner,
  listSessions,
  startSession,
  MAX_INTAKE_LENGTH,
} from "@/lib/dummy-sessions";

/** Render per request — the History is scoped to the current learner. */
export const dynamic = "force-dynamic";

/**
 * `GET /api/sessions` — the current learner's History from the dummy store:
 * `[{ id, knowledgePoint: string|null, createdAt: ISO, stage }]`, most recent
 * first.
 */
export function GET() {
  const { id } = getCurrentLearner();
  return NextResponse.json(listSessions(id));
}

/**
 * `POST /api/sessions` — start a session from the learner's intake
 * paragraph (`{ paragraph: string }`):
 * - `400` when the paragraph is empty or longer than `MAX_INTAKE_LENGTH` chars
 * - `200 { verdict: "narrow", feedback }` when it is too thin to probe from
 * - `200 { verdict: "accept_target", sessionId, knowledgePoint }` otherwise
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Expected a JSON body: { paragraph: string }" },
      { status: 400 },
    );
  }
  const paragraph =
    typeof body === "object" &&
    body !== null &&
    "paragraph" in body &&
    typeof (body as { paragraph: unknown }).paragraph === "string"
      ? (body as { paragraph: string }).paragraph
      : "";
  const text = paragraph.trim();
  if (text.length === 0 || text.length > MAX_INTAKE_LENGTH) {
    return NextResponse.json(
      {
        error:
          text.length > MAX_INTAKE_LENGTH
            ? `Your paragraph is over ${MAX_INTAKE_LENGTH} characters — keep it under that. ` +
              "We only need a clear sense of what you want to master."
            : "Describe what you want to learn in a short paragraph.",
      },
      { status: 400 },
    );
  }
  const { id } = getCurrentLearner();
  return NextResponse.json(startSession(id, paragraph));
}
