import { NextResponse } from "next/server";
import { listSessions } from "@/lib/dummy-sessions";

/**
 * `GET /api/sessions` — the learner's History from the dummy store:
 * `[{ id, knowledgePoint: string|null, createdAt: ISO, stage }]`,
 * most recent first.
 */
export function GET() {
  return NextResponse.json(listSessions());
}
