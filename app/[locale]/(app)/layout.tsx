import { Frame } from "@/components/frame";

/**
 * The app route group layout: wraps all authenticated pages in the shared
 * frame (top bar + content). The login page lives outside this group and
 * renders bare (no top bar).
 */
export default function AppLayout({
  children,
}: { children: React.ReactNode }) {
  return <Frame>{children}</Frame>;
}
