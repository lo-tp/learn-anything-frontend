import { Session } from "@/views/session";
import { getMaterials, getSession } from "@/lib/api-client";

/**
 * Render per request, not as a build-time snapshot — the session state and
 * its materials are resolved against the backend at request time (#47).
 */
export const dynamic = "force-dynamic";

/**
 * Session route: resolve the session state and its generated materials in
 * parallel (each tolerating its own failure — the backend may be
 * unreachable, or the session/materials may not exist yet) and hand both to
 * the session view, which owns the deck and the generation polling. The
 * view renders the friendly not-found / not-ready states itself, so there is
 * no `notFound()`. The shared frame is applied by the root layout.
 */
export default async function SessionPage({
  params,
}: PageProps<"/session/[sessionId]">) {
  const { sessionId } = await params;

  const [sessionResult, materialsResult] = await Promise.allSettled([
    getSession(sessionId),
    getMaterials(sessionId),
  ]);

  return (
    <Session
      sessionId={sessionId}
      initialSession={
        sessionResult.status === "fulfilled" ? sessionResult.value : null
      }
      initialMaterials={
        materialsResult.status === "fulfilled" ? materialsResult.value : null
      }
    />
  );
}
