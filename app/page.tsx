import { Frame } from "@/components/frame";
import { HistoryView } from "@/components/history-view";
import { listSessions } from "@/lib/dummy-sessions";

/**
 * Home = the learner's History: the server-side fetch of the dummy store,
 * rendered inside the shared frame.
 */
export default function Home() {
  return (
    <Frame>
      <HistoryView initialSessions={listSessions()} />
    </Frame>
  );
}
