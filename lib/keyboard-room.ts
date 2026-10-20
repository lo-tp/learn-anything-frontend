/**
 * What an on-screen keyboard asks of a surface's own scroll (#230).
 *
 * The disagreement between viewports is the reason this exists: iOS shrinks only
 * the *visual* viewport when its software keyboard opens, so a surface sized to
 * the layout viewport keeps the height it was given and its lower half lands
 * under the keys — and a pane's scroll never moves the screen, so nothing inside
 * such a surface can bring that half back. `lib/visual-viewport.ts` settles that
 * by measuring the real room, and The Visible-Viewport Rule sizes every
 * full-bleed surface from it: the shell, the TopBar, a sheet and the scrim behind
 * it are the room above the keys, no more and no less.
 *
 * Which is why there is nothing left to reserve. A surface sized to the room ends
 * its own bottom edge at the top edge of the keys, so it has no covered room to
 * pad out; reserving the keyboard's height *inside* such a surface moves its
 * content a keyboard further from the keys than it needs to be and leaves the pane
 * scrollable down to a blank stretch below the last item. That overshoot is what
 * the device pass on #230 showed. An earlier version of this module measured how
 * much of the layout viewport a keyboard covered so a surface could reserve it;
 * with the room measured and the surface sized to it, the measurement has no
 * consumer, and reserving twice has no honest reading.
 *
 * What a keyboard does ask is narrower, and it is a question about the surface's
 * own content: how much of it is now below the room the surface has, and
 * therefore out of reach? That number is the distance the surface's scroll has to
 * run — exactly that far, no further — and it is 0 whenever the room still shows
 * all of the content, which is the case where a keyboard asks for nothing at all.
 */

/** What a pane reports about its own content and the room it shows it through. */
export type RoomShortfallSource = {
  /** The length of the pane's content — `scrollHeight`. */
  contentHeightPx: number;
  /** The room the pane shows that content through — `clientHeight`. For a
   *  surface sized to the visible viewport this is the room above the keys. */
  visibleHeightPx: number;
};

/** A pane's own measurements are rounded, so settled content can report itself a
 *  couple of pixels longer than the room it fits in. Calling that a hidden item
 *  would scroll the pane and move the reader for nothing; leaving it is two
 *  pixels of one line. */
const SHORTFALL_TOLERANCE_PX = 2;

/**
 * How far a surface's content reaches past the room it has: what sits below the
 * bottom of its pane, out of the reader's reach, and therefore what a keyboard
 * covering that stretch is hiding.
 *
 * Measured against the room rather than against the reader's current scroll
 * position, so the same content gives the same answer whichever way the pane
 * happens to be scrolled. `0` means the room shows all of it — nothing to reach
 * for, nothing to pad, and the reader's own scroll left where they left it.
 */
export function measureRoomShortfall(source: RoomShortfallSource): number {
  const shortfall = source.contentHeightPx - source.visibleHeightPx;
  return shortfall > SHORTFALL_TOLERANCE_PX ? Math.round(shortfall) : 0;
}
