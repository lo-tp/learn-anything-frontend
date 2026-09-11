import type { PhaseContext } from "./types";

/**
 * The Confirm phase: the legacy step for post-plan phases
 * (`generating` / `executing` / `complete`). The textarea is hidden and the
 * footer offers a single **Confirm** button that calls `onAccept` and
 * closes the dialog.
 */
export function useConfirmPhase(ctx: PhaseContext) {
  const { onAccept, close } = ctx;

  function confirm() {
    onAccept();
    close();
  }

  return { confirm };
}
