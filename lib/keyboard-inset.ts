/**
 * The keyboard inset — how much of the screen the on-screen keyboard covers.
 *
 * iOS Safari is why this exists (#230): when its software keyboard opens, only
 * the *visual* viewport shrinks. The layout viewport keeps its full height, and
 * with it `100dvh` and every `position: fixed` surface, so a sheet keeps the
 * height it was given and its lower half lands under the keyboard — and no
 * scroll inside one of this app's own panes can bring that half back, because a
 * pane's scroll never moves the screen.
 *
 * So the answer is not to make a surface shorter than the page. It is to give
 * the surface's own scrolling enough room to bring the thing being answered
 * above the keyboard, and to run that scroll when the keyboard arrives — and to
 * do that only where the keyboard actually leaves something of the surface's
 * content out of sight (#230). A keyboard that takes a stretch of screen the
 * surface was never using asks for nothing.
 *
 * `measureKeyboardInset` states how much room the keyboard covers;
 * `onKeyboardInsetChange` keeps that number current for whoever acts on it;
 * `measureRoomShortfall` states whether the surface's own content reaches past
 * the room it has, which is the part the keyboard is hiding.
 */

/** What a browser reports about its viewports. */
export type KeyboardInsetSource = {
  innerHeight: number;
  visualViewport?: { height: number; scale: number } | null;
};

/** Below this, the two viewports disagreeing is measurement noise — a browser
 *  reports odd heights mid-transition — not a keyboard. */
const INSET_TOLERANCE_PX = 1;
/** A zoomed page shrinks its visual viewport too, and that is not a keyboard. */
const SCALE_TOLERANCE = 0.01;

/** How much of the layout viewport the keyboard covers, in px. */
export function measureKeyboardInset(source: KeyboardInsetSource): number {
  const visual = source.visualViewport;
  if (!visual || Math.abs(visual.scale - 1) > SCALE_TOLERANCE) return 0;
  const covered = source.innerHeight - visual.height;
  return covered > INSET_TOLERANCE_PX ? Math.round(covered) : 0;
}

/** What one surface's own scroll says about the room it was given. */
export type RoomShortfallSource = {
  /** The length of the surface's content, as its own node reports it —
   *  `scrollHeight`, padding included. */
  contentHeightPx: number;
  /** The room the surface shows that content through — `clientHeight`. For a
   *  surface sized to the visible viewport this is the room above the keys. */
  visibleHeightPx: number;
  /** The room the surface reserved for itself at its own bottom. The content
   *  ends above that padding, so it is not something the keyboard is hiding —
   *  and subtracting it is what keeps a reservation from becoming its own
   *  reason to keep reserving. */
  reservedPx: number;
};

/** A pane's own measurements are rounded, so a settled record can report itself
 *  a couple of pixels longer than the room it fits in. Calling that a hidden
 *  item would pad the record and move the reader for nothing; leaving it is two
 *  pixels of one line. */
const SHORTFALL_TOLERANCE_PX = 2;

/**
 * How far a surface's content reaches past the room it has: what sits below the
 * bottom of its pane, out of the reader's reach.
 *
 * This is the test a surface acts on (#230). A full-bleed surface is sized to
 * the room the keyboard leaves, so its pane's bottom edge is the top edge of
 * the keys: the content that reaches past the pane's room is exactly the content
 * the keyboard is hiding, and the content that does not is entirely above the
 * keys already — nothing to reserve room for, and nothing to scroll. Measured
 * against the room rather than against the reader's current scroll position, so
 * the same record gives the same answer whichever way the pane happens to be
 * scrolled.
 */
export function measureRoomShortfall(source: RoomShortfallSource): number {
  const shortfall =
    source.contentHeightPx - source.reservedPx - source.visibleHeightPx;
  return shortfall > SHORTFALL_TOLERANCE_PX ? Math.round(shortfall) : 0;
}

type Listener = (insetPx: number) => void;

const listeners = new Set<Listener>();
/** The inset the page currently has, and the holder count that decides whether
 *  the browser is being listened to at all. */
let current: number | null = null;
let holders = 0;
let detached: (() => void) | null = null;

function measureNow(): number | null {
  if (typeof window === "undefined") return null;
  return measureKeyboardInset(window);
}

/** Measure and tell every holder. */
function measureAndEmit(): void {
  const inset = measureNow();
  if (inset === null) return;
  current = inset;
  for (const listener of [...listeners]) listener(inset);
}

/**
 * Listen to the room: `resize` is a keyboard opening or closing. Where a browser
 * reports no visual viewport there is nothing to measure it from, and the
 * window's own resize is the only signal — a browser that shrinks its layout
 * viewport for the keyboard (what `interactive-widget=resizes-content` asks of
 * Chrome) leaves nothing to reserve, because its surfaces are already the room
 * the learner has. The measure reports `0` and the surface does nothing extra.
 */
function attach(): () => void {
  if (typeof window === "undefined") return () => {};
  const visual = window.visualViewport;
  if (visual) {
    visual.addEventListener("resize", measureAndEmit);
    return () => visual.removeEventListener("resize", measureAndEmit);
  }
  window.addEventListener("resize", measureAndEmit);
  return () => window.removeEventListener("resize", measureAndEmit);
}

/** Hold the measurement: the first holder installs the browser's listeners, the
 *  last one takes them back off. */
function retain(): () => void {
  holders += 1;
  if (holders === 1) detached = attach();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders -= 1;
    if (holders === 0) {
      detached?.();
      detached = null;
      current = null;
    }
  };
}

/**
 * Follow the keyboard inset: the listener is called with what the room is now,
 * then on every change to it. Stated as a *value* rather than as a change on
 * purpose (#230): a surface that only reacts to the inset *growing* never learns
 * a keyboard was already up before it mounted, and that is how a sheet opened
 * from a field the learner was already typing in leaves its open ask under the
 * keyboard with nothing left to move it.
 *
 * Returns the unsubscribe, which also releases the measurement — a follower never
 * leaves browser listeners behind, and a cleanup that runs twice (React Strict
 * Mode) is inert rather than a second release. Several followers hold one
 * measurement: the browser is listened to once, whoever needs it last lets it go.
 */
export function onKeyboardInsetChange(listener: Listener): () => void {
  listeners.add(listener);
  const release = retain();
  if (current === null) measureAndEmit();
  else listener(current);
  return () => {
    listeners.delete(listener);
    release();
  };
}
