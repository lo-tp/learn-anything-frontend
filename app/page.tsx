import { HistoryView } from "@/components/history-view";
import { listSessions } from "@/lib/dummy-sessions";

/**
 * Home = the learner's History: the server-side fetch of the dummy store.
 * The shared frame is applied by the root layout.
 */
export default function Home() {
  return <HistoryView initialSessions={listSessions()} />;
}
