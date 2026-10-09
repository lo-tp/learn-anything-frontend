import { Frame } from "@/components/frame";

/**
 * The app route group layout: wraps all app pages in the shared frame
 * (top bar + content) — including the visitor-accessible root and personal
 * list (#148). The login page lives outside this group and renders bare
 * (no top bar).
 */
export default function AppLayout({
  children,
}: { children: React.ReactNode }) {
  return <Frame>{children}</Frame>;
}
