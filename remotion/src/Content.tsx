import React, {useEffect, useRef, useState} from 'react';
import {Player, type PlayerRef} from '@remotion/player';
import {Slide, DURATION_IN_FRAMES} from './Slide';

const CONTROL_BAR = 80; // px reserved below the slide for the input
const FPS = 30;

// Renders the slide with `count` visible items.
// Owns all transition mechanics: when `count` changes, it records the
// previous target and the current frame; Slide then runs its springs on the
// event clock (rel = frame - changeFrame). No seek, no remount, no flash.
const Content: React.FC<{count: number}> = ({count}) => {
  const playerRef = useRef<PlayerRef>(null);
  // [from, to]: the counts the transition animates between.
  const [range, setRange] = useState({from: 0, to: count});
  // Frame at which the last change happened; Slide's springs start from here.
  const [changeFrame, setChangeFrame] = useState(0);

  useEffect(() => {
    if (count === range.to) return;
    // Both updates commit in one render, so the springs start at rel = 0
    // exactly where the old state had settled.
    setChangeFrame(playerRef.current?.getCurrentFrame() ?? 0);
    setRange({from: range.to, to: count});
  }, [count, range.to]);

  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const update = () =>
      setScale(
        Math.min(
          window.innerWidth / 1920,
          (window.innerHeight - CONTROL_BAR) / 1080,
        ),
      );
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return (
    <div style={{width: 1920 * scale, height: 1080 * scale}}>
      <div
        style={{
          width: 1920,
          height: 1080,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        <Player
          ref={playerRef}
          component={Slide}
          inputProps={{
            count: range.to,
            previousCount: range.from,
            changeFrame,
          }}
          durationInFrames={DURATION_IN_FRAMES}
          fps={FPS}
          compositionWidth={1920}
          compositionHeight={1080}
          style={{width: 1920, height: 1080}}
          acknowledgeRemotionLicense
          autoPlay
        />
      </div>
    </div>
  );
};

export default Content;
