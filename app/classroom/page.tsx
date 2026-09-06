import { ClassroomView } from "@/views/classroom";

/**
 * Classroom route: static shell — the presentational server view carries the
 * slide deck itself (map #41), so the page just mounts the view. The shared
 * frame is applied by the root layout.
 */
export default function Classroom() {
  return <ClassroomView />;
}
