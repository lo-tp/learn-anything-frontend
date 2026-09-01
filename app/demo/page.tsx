import { Frame } from "@/components/frame";
import { SessionShell } from "@/components/session-shell";

/**
 * Placeholder session page — the same shell as `/` until the real session
 * route lands (later tickets on map #11).
 */
export default function Demo() {
  return (
    <Frame>
      <SessionShell />
    </Frame>
  );
}
