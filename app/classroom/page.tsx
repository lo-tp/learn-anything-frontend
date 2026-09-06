import { ClassroomView, type Slide } from "@/views/classroom";

const SLIDES: Slide[] = [
  { id: "s1", title: "Momentum & Energy in Collisions" },
  { id: "s2", title: "Where Did the Kinetic Energy Go?" },
  { id: "s3", title: "Identifying Collision Types" },
  { id: "s4", title: "1D Elastic Collision Math" },
  { id: "s5", title: "Interactive: 1D Collision Simulator" },
];

/**
 * Classroom route: static shell — resolves the sample slides and hands them
 * to the presentational server view. The shared frame is applied by the root
 * layout.
 */
export default function Classroom() {
  return <ClassroomView slides={SLIDES} />;
}
