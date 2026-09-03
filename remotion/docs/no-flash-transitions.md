# Interactive Remotion transitions without flashing

How to animate state changes in a long-lived `<Player>` (browser app) so the
new animation grows out of the current frame — with **no blank frames, no
content jumps, no final-state blink**.

Reference implementation: [`src/main.tsx`](../src/main.tsx) +
[`src/Slide.tsx`](../src/Slide.tsx) in this repo.

## The problem

You have an always-mounted Remotion `<Player>` and interactive state (e.g.
"show N bullets"). When the state changes, you want the affected elements to
spring to their new positions. Two obvious approaches both flash:

### ❌ Approach 1: remount with `key` to replay from frame 0

```tsx
<Player key={transition} inputProps={...} autoPlay />
// bump `transition` on state change
```

- The `<video>` element is torn down and rebuilt; until the new element paints
  its first frame, the area is **transparent** → you see the page background
  flash through.
- Even with a background behind it, all DOM content pops out during that gap.

### ❌ Approach 2: keep mounted, then `seekTo(0)` + `play()`

```tsx
useEffect(() => {
  playerRef.current?.seekTo(0);
  playerRef.current?.play();
}, [state]);
```

- State changes commit as **new `inputProps` rendered at the *current* frame**
  (usually the end frame, where the springs are already settled). For 1–2
  frames the *final* state is visible **before** the seek snaps back to 0.
- Root cause: **prop updates and imperative seeks are not atomic.** Any scheme
  of "apply new props, then restart the timeline" (or "restart, then apply
  props") paints an intermediate frame that belongs to neither the old nor the
  new animation.

## ✅ The pattern: event-driven springs on a long timeline

Stop thinking of a transition as *"play this short clip from frame 0"*.
Think of it as *"the world changed at frame F; everything is a pure function of
(current frame − F)"*. The timeline then **never restarts**.

### 1. One long-running timeline

Give the composition a duration far longer than any single transition and let
it play continuously:

```tsx
export const DURATION_IN_FRAMES = 54000; // 30 min @ 30fps
```

The Player simply runs forward. It is never paused, seeked, or remounted after
initial load.

### 2. Pass the change time as an input, not just the change

```tsx
// App state
const [range, setRange] = useState({from: 0, to: 4});
const [changeFrame, setChangeFrame] = useState(0); // frame of last change

const setBullets = (n: number) => {
  if (n === range.to) return;
  // Both updates commit in ONE render (React batches them), so the composition
  // never sees "new state at old change time" or "old state at new change time".
  setChangeFrame(playerRef.current?.getCurrentFrame() ?? 0); // sync API
  setRange({from: range.to, to: n});
};
```

```tsx
<Player
  ref={playerRef}
  inputProps={{count: range.to, previousCount: range.from, changeFrame}}
  autoPlay
  ...
/>
```

`getCurrentFrame()` on the `PlayerRef` is synchronous, so you can read the
"now" inside the event handler.

### 3. Run the springs on the event clock in the composition

```tsx
const Slide = ({count, previousCount, changeFrame = 0}) => {
  const frame = useCurrentFrame();
  const rel = frame - changeFrame; // frames elapsed since the change

  // for each element whose state changed:
  const p = spring({
    frame: rel - i * 4,      // stagger per element
    fps,
    config: {damping: 200},
    durationInFrames: 25,
  });
};
```

`spring()` returns 0 for negative frames, so staggering "before the change"
just means "not started yet".

## Why this is flash-free (the continuity argument)

At the exact commit where `changeFrame` and `range` update together, the
composition renders **at the current frame with the new props**, where
`rel = 0`. For the animation to be seamless, that render must equal what was
already on screen:

| Element | Before change (settled) | At `rel = 0` with new props |
|---|---|---|
| Unchanged, visible | opacity 1 | not animated → opacity 1 ✓ |
| Unchanged, hidden | opacity 0 | not animated → opacity 0 ✓ |
| Appearing | opacity 0 | `spring(0) = 0` → opacity 0 ✓ |
| Disappearing | opacity 1 | `1 - spring(0) = 1` → opacity 1 ✓ |

Every element starts its spring **exactly where the old state ended**, so the
"flash" you would have seen is literally the current frame. Then the timeline
keeps advancing and the springs unfold.

Generalized rule: *whenever an input change makes an element newly animatable,
its animation value at `rel = 0` must equal the element's previous settled
value* (`spring(0) = 0`, so fade/scale-from-identity animations satisfy this
for free). If you animate properties whose "start" is not the old settled
value (e.g. a spring that starts from a displaced position), compute the start
from `from`, not a constant.

## Checklist for reuse

1. **One Player, mounted once.** Never `key`-remount it; never `seekTo` on
   state changes.
2. **Long timeline**, `autoPlay`, duration ≫ any interaction session.
3. State change = **one batched render** of `{new values, changeFrame}`, where
   `changeFrame = playerRef.current.getCurrentFrame()` (sync).
4. Composition animates on the **event clock** `rel = frame - changeFrame`;
   stagger with `rel - i * k`.
5. Verify the **continuity table**: for every element, value at `rel = 0`
   under new props == value at the last frame under old props.
6. Keep "unchanged" elements **out of the spring entirely** (branch on
   `visible !== wasVisible`), otherwise every state change re-animates the
   whole scene.

## Caveats

- **Changes mid-animation:** if the user changes state while a spring is in
  flight, `from` is the previous *target*, not the in-flight position, so a
  partially-animated element can pop to its animation start. For most UIs this
  is fine (1.5s settles); if not, either debounce input until settled or pass
  the actual current visual position as part of the state.
- **Don't `loop`** this timeline. A wrap-around resets `frame` to 0, making
  `rel` negative forever after the wrap (springs would freeze at their start
  value). If you need a bounded session, stop the player at the end and
  relaunch the app, or handle `playerDidLoop` by re-basing `changeFrame`.
- **`rel` goes negative only before the change** (or never, if `changeFrame`
  starts at 0). `spring(frame < 0) = 0` is what makes that safe.
- All timing stays **deterministic**: every frame is a pure function of
  `(frame, inputProps)`, so the same code renders identically in the CLI
  renderer if you ever export to video.
