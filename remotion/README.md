# Remotion PPT — interactive slide, viewable in the browser

A 1920×1080 slide built with **Remotion** components, rendered live in the
browser via **`@remotion/player`** and served by a plain **Vite** dev server
on **http://localhost:3001**. No Remotion Studio, no video export.

## What it does

- Renders a slide: title **"My Presentation"** + 4 bullet points
  (`1. first`, `2. second`, `3. third`, `4. fouth`).
- A number input at the bottom controls how many bullets are shown:
  typing `3` shows the first 3. Bullets are **always rendered** in the DOM;
  hidden ones simply have opacity 0 (they keep their layout space).
- Visibility changes animate with Remotion's `spring()` — bullets spring in
  (fade + slide) or spring out, staggered 4 frames apart, **without any
  flash, seek, or remount** (see below).
- The slide auto-scales to fit the browser window.

## Run it

```bash
npm install
npm run dev      # → http://localhost:3001
```

## Files

| File                             | Role                                                             |
|----------------------------------|------------------------------------------------------------------|
| `index.html`                     | Vite entry page; hosts `<div id="root">`                         |
| `src/main.tsx`                   | App: holds the visible-item count, renders `Content` + `Slider`  |
| `src/Content.tsx`                | `<Player>` + scaling; owns the transition state (`from/to`, `changeFrame`), takes only `count` |
| `src/Slider.tsx`                 | The number input controlling the visible item count              |
| `src/Slide.tsx`                  | The Remotion slide: layout (`AbsoluteFill`) + `spring()` motion  |
| `docs/no-flash-transitions.md`   | The reusable pattern: interactive transitions without flashing   |
| `package.json`                   | Deps: `remotion`, `@remotion/player`, `react`, `vite`            |

## How it works

### Why `@remotion/player`

`<Player>` is Remotion's official React component for rendering a composition
**inside a normal web page** (as opposed to the Studio or the CLI renderer).
It mounts the composition in an isolated context, drives frames, and gives us
the full `remotion` runtime (`useCurrentFrame`, `spring`, …) in the browser.

Props used:

| Prop                          | Why                                                              |
|-------------------------------|------------------------------------------------------------------|
| `component={Slide}`           | The composition to render (a plain React component)              |
| `inputProps={{count, previousCount, changeFrame}}` | Values passed into `Slide` as props |
| `compositionWidth/Height`     | **Not** `width`/`height` — the Player API uses these names       |
| `fps={30}`                    | Timeline settings                                                |
| `durationInFrames={54000}`    | 30-min timeline: the Player runs continuously and is **never restarted** |
| `autoPlay`, `muted`           | Start playing on load; `muted` also silences the autoplay warning |
| `acknowledgeRemotionLicense`  | Only suppresses the license console notice; no functional effect |

### The core pattern: event-driven transitions

Changing the number is a *state transition*, not a new video. The timeline
never restarts — the springs run on an **event clock**:
`rel = frame − changeFrame`, where `changeFrame` is the frame on which the
last change happened.

```tsx
// src/Content.tsx — takes only `count`; owns the transition state
const Content: React.FC<{count: number}> = ({count}) => {
  const playerRef = useRef<PlayerRef>(null);
  const [range, setRange] = useState({from: 0, to: count}); // [from, to]
  const [changeFrame, setChangeFrame] = useState(0);        // frame of last change

  useEffect(() => {
    if (count === range.to) return;
    // One batched commit: the springs start at rel = 0, exactly where the old
    // state had settled → no seek, no remount, no flash.
    setChangeFrame(playerRef.current?.getCurrentFrame() ?? 0); // sync API
    setRange({from: range.to, to: count});                    // "from" = on screen
  }, [count, range.to]);

  return (
    <Player
      ref={playerRef}
      autoPlay
      inputProps={{count: range.to, previousCount: range.from, changeFrame}}
      …
    />
  );
};

// src/main.tsx — just holds the target count
const [count, setCount] = useState(0);
return <><Content count={count} /><Slider value={count} onChange={setCount} /></>;
```

```tsx
// src/Slide.tsx
const rel = frame - changeFrame; // frames elapsed since the change
const p = spring({
  frame: rel - i * 4,            // stagger: bullet i starts 4 frames after i−1
  fps,
  config: {damping: 200},
  durationInFrames: 25,
});
```

**Why it never flashes:** at the commit where `changeFrame` and `range`
update together, the composition renders at `rel = 0` with the new props —
and that render equals what was already on screen:

| Element          | Before change | At `rel = 0` (new props) |
|------------------|---------------|--------------------------|
| unchanged        | settled       | not animated → same      |
| appearing bullet | opacity 0     | `spring(0) = 0` → 0      |
| exiting bullet   | opacity 1     | `1 − spring(0)` → 1      |

Every animation grows out of the live state. `spring()` returns 0 for
negative frames, so the stagger "before the change" simply means "not
started".

Two tempting alternatives both flash, because prop updates and seeks/remounts
are **not atomic**:

1. **Remount per transition** (`key` bump): the `<video>` is torn down and
   rebuilt; until it paints its first frame the area is transparent →
   background flash + content pop.
2. **`seekTo(0)` + `play()` in an effect**: React first re-renders at the
   *parked* end frame with the new props (springs already settled) → the
   final state blinks before the seek snaps back.

The full write-up — continuity proof, reuse checklist, caveats — is in
[`docs/no-flash-transitions.md`](docs/no-flash-transitions.md).

### The slide (`src/Slide.tsx`)

- Layout is a plain `AbsoluteFill` + inline styles (fonts/colors are just CSS;
  Remotion doesn't own styling, it owns the **timeline and motion**).
- Only bullets whose visibility **changed** (`visible !== wasVisible`) go
  through the spring; the rest get static styles and never move.
- The same `p` serves both directions: entrance uses `opacity = p` (plus an
  `x` slide from −24 px), exit uses `opacity = 1 − p`.
- Hidden bullets keep `opacity: 0` instead of unmounting, so the layout never
  jumps and the DOM tree stays stable.

### Scaling

The Player is fixed at 1920×1080 inside a wrapper that is `transform:
scale()`-ed by `min(vw/1920, (vh − 80)/1080)`, rescaled on `resize`. The 80px
reserve keeps the input bar clear of the slide.

## Gotchas (this exact stack)

1. `@remotion/player` has **no default export** — `import Player from …`
   crashes the whole app at module load (page goes blank). Use
   `import {Player} from '@remotion/player'`.
2. Player dimension props are `compositionWidth` / `compositionHeight`;
   passing `width`/`height` throws `'compositionHeight' must be a number…`.
3. The Player re-renders the composition at the **current frame** whenever
   `inputProps` change — that's exactly why new props must render the current
   on-screen state (the continuity table above), and why you never change
   props and seek/remount separately.
4. `spring()` is a pure function of the frame number: 0 for negative frames,
   1 after settling. That single property is what makes one formula serve
   entrance, exit, and stagger.
5. **Don't `loop`** the timeline: a wrap-around resets `frame` to 0, making
   `rel` negative forever after (springs freeze at their start).
