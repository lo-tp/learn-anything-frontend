import { Root } from "@/views/root";
import { getCurrentLearner, listSessions } from "@/lib/dummy-sessions";

/**
 * Render per request, not as a build-time snapshot — the History is scoped to
 * the current learner, resolved at request time (see `getCurrentLearner`).
 */
export const dynamic = "force-dynamic";

/**
 * Home route: resolve the current learner and hand them their History. The
 * home page in `views/root.tsx` owns the interactive logic and renders it from
 * pure components. The shared frame is applied by the root layout.
 */
export default function Home() {
  const { id } = getCurrentLearner();
  return <Root initialSessions={listSessions(id)} />;
}
