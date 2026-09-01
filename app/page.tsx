import { Root } from "@/views/root";
import { listSessions } from "@/lib/dummy-sessions";

/**
 * Home route: runs the server-side seam for the initial History (SSR) and
 * hands it to the home page in `views/root.tsx`, which owns the interactive
 * logic and renders it from pure components. The shared frame is applied by
 * the root layout.
 */
export default function Home() {
  return <Root initialSessions={listSessions()} />;
}
