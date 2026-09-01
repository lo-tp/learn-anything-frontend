import { NextResponse } from "next/server";
import { getCurrentLearner, listSessions } from "@/lib/dummy-sessions";

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
