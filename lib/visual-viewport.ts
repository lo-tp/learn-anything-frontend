/**
 * The visual viewport — the room on the screen the browser leaves the app.
 *
 * iOS Safari is the reason this module exists (#230). When its software
 * keyboard opens, only the *visual* viewport shrinks: the layout viewport
 * keeps its full height, and with it `100dvh` and every `position: fixed`
 * surface. A full-bleed sheet therefore stays as tall as it was, its bottom
 * half now under the keyboard — and because this app's surfaces scroll in their
 * own panes, no amount of scrolling inside one of them can pull that bottom
 * back into sight: a pane's scroll never moves the visual viewport. The
 * reported case was exactly that, on the Session intake sheet, where the field
 * being filled and the action beside it went out of sight.
 *
 * The fix is to state the real room once and size every full-bleed surface
 * from it. This module measures `window.visualViewport` — its height, and how
 * far the browser has panned the layout viewport beneath the screen — and
 * publishes it as the two properties `app/globals.css` declares
 * (`--visual-viewport-height`, `--visual-viewport-offset-top`), which the shell
 * (`<body>`, the TopBar) and the sheet primitive (`components/ui/dialog.tsx`)
 * are sized from. A surface that keeps its own scroll — the intake sheet's
 * record — subscribes here and re-pins when the room changes.
 *
 * A plain DOM authority rather than React state, in the shape of
 * `lib/auth-events.ts`: the measure belongs to the page, not to any view, and
 * the page's one measurement is shared by every holder —
 * `components/visual-viewport.tsx` keeps it running, listeners join it.
 */

/** The two properties the measure is published as. */
const HEIGHT_PROPERTY = "--visual-viewport-height";
const OFFSET_PROPERTY = "--visual-viewport-offset-top";

/** The room a full-bleed surface is allowed to take, in px. */
export type VisualViewportMeasure = {
  heightPx: number;
  offsetTopPx: number;
  /**
   * How much shorter the room is than the layout viewport offers — the software
   * keyboard, in practice. `0` means the room is the whole viewport.
   *
   * It is a measure of *size*, not position: a browser that pans the page after
   * a focused field moves the room without taking any of it, and this stays the
   * same. Stated as a *state* rather than a change on purpose (#230). A surface
   * that only reacts to the room *shrinking* never learns that the keyboard was
   * already up when it mounted, and that is how a sheet opened straight from a
   * focused field leaves its open ask under the keyboard with nothing left to
   * move it.
   */
  roomTakenByBrowserPx: number;
};

/** Sub-pixel disagreement between the two viewports is measurement noise — a
 *  browser reports odd heights mid-transition — not a keyboard. */
const ROOM_TOLERANCE_PX = 1;

/** How much shorter the room is than the layout viewport. */
function roomTakenByBrowser(innerHeight: number, heightPx: number): number {
  const taken = innerHeight - heightPx;
  return taken > ROOM_TOLERANCE_PX ? Math.round(taken) : 0;
}

/** What a measurement reads: the layout viewport, and — where the browser
 *  reports one — the visual viewport inside it. */
export type VisualViewportSource = {
  innerHeight: number;
  visualViewport?: { height: number; offsetTop: number } | null;
};

/**
 * The measurement rule.
 *
 * The visual viewport *is* the room, so it wins wherever it is reported — but
 * it is never allowed to claim more than the layout viewport has (a browser
 * mid-transition reports nonsense), and an empty room is not a surface a sheet
 * could be sized to: `null` means "keep what is already published".
 */
export function measureVisualViewport(
  source: VisualViewportSource,
): VisualViewportMeasure | null {
  const room = source.visualViewport;
  if (room) {
    const heightPx = Math.min(source.innerHeight, room.height);
    if (!(heightPx > 0)) return null;
    // Panning the layout viewport down leaves its top above the screen; the
    // room starts at the edge the browser has not covered.
    return {
      heightPx,
      offsetTopPx: Math.max(0, room.offsetTop),
      roomTakenByBrowserPx: roomTakenByBrowser(source.innerHeight, heightPx),
    };
  }
  // No visual-viewport API: the layout viewport is the only room there is, and
  // `100dvh` already describes it. Nothing is covering it — and a browser that
  // resizes the layout viewport itself (the `interactive-widget=resizes-content`
  // behaviour Android offers) reports a room equal to it, so "the keyboard is
  // up" there reads only from the room changing. That is the holder's business;
  // this function reports what the two viewports actually say.
  return source.innerHeight > 0
    ? { heightPx: source.innerHeight, offsetTopPx: 0, roomTakenByBrowserPx: 0 }
    : null;
}

/** State the measure where every full-bleed surface can read it. */
function publishVisualViewport(
  target: HTMLElement,
  measure: VisualViewportMeasure,
): void {
  target.style.setProperty(HEIGHT_PROPERTY, `${measure.heightPx}px`);
  target.style.setProperty(OFFSET_PROPERTY, `${measure.offsetTopPx}px`);
}

type Listener = (measure: VisualViewportMeasure) => void;

const listeners = new Set<Listener>();
/** The measure the page currently has, and the holder count that decides
 *  whether the browser is being listened to at all. */
let current: VisualViewportMeasure | null = null;
let holders = 0;
let detached: (() => void) | null = null;

function measureNow(): VisualViewportMeasure | null {
  if (typeof window === "undefined") return null;
  return measureVisualViewport(window);
}

/** Measure, publish, and tell every holder. An unmeasurable room leaves the
 *  published value alone rather than replacing it with nothing. */
function measureAndEmit(): void {
  const measure = measureNow();
  if (measure === null) return;
  current = measure;
  publishVisualViewport(document.documentElement, measure);
  for (const listener of [...listeners]) listener(measure);
}

/**
 * Listen to the room. `resize` is the keyboard opening or closing; `scroll` is
 * the browser panning the layout viewport to chase a focused field — either
 * one moves the room the app has. Where there is no visual-viewport API, the
 * window's own resize is the only signal there is.
 */
function attach(): () => void {
  if (typeof window === "undefined") return () => {};
  const room = window.visualViewport;
  if (room) {
    room.addEventListener("resize", measureAndEmit);
    room.addEventListener("scroll", measureAndEmit);
    return () => {
      room.removeEventListener("resize", measureAndEmit);
      room.removeEventListener("scroll", measureAndEmit);
    };
  }
  window.addEventListener("resize", measureAndEmit);
  return () => window.removeEventListener("resize", measureAndEmit);
}

/** Hold the measurement: the first holder installs the browser listeners, the
 *  last one takes them back off. Measuring is a separate step so that a
 *  subscriber is never told the same measure twice. */
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
 * Measure the room and keep measuring it until the returned function runs.
 * Mounted once for the page by `components/visual-viewport.tsx`; idempotent,
 * so mounting it twice holds the same measurement.
 */
export function startVisualViewport(): () => void {
  const release = retain();
  if (current === null) measureAndEmit();
  return release;
}

/**
 * Follow the room: the listener is called with the current measure first, then
 * on every change to it. Returns the unsubscribe, which also releases the
 * measurement — a listener never leaves browser listeners behind.
 */
export function onVisualViewportChange(listener: Listener): () => void {
  listeners.add(listener);
  const release = retain();
  // A holder joining a measurement that is already running is told where the
  // room is; the first holder starts that measurement, which reports it.
  if (current === null) measureAndEmit();
  else listener(current);
  return () => {
    listeners.delete(listener);
    release();
  };
}
