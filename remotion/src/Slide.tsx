import React from 'react';
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

export const bullets = ['first', 'second', 'third', 'fouth'];

// Long-running timeline: transitions are event-driven (see `changeFrame`),
// so the Player never has to seek or remount.
export const DURATION_IN_FRAMES = 54000; // 30 min @ 30fps

// Only the bullets whose visibility changed animate; the rest stay put.
export const Slide: React.FC<{
  count?: number;
  previousCount?: number;
  changeFrame?: number;
}> = ({count = bullets.length, previousCount = 0, changeFrame = 0}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // Frames elapsed since the count changed; the springs run on this clock.
  const rel = frame - changeFrame;

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        color: '#f8fafc',
        justifyContent: 'center',
        padding: '120px 160px',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <h1
        style={{
          fontSize: 96,
          fontWeight: 700,
          margin: 0,
          paddingBottom: 40,
          borderBottom: '4px solid #38bdf8',
          display: 'inline-block',
        }}
      >
        My Presentation
      </h1>
      <ul
        style={{
          fontSize: 64,
          lineHeight: 1.6,
          margin: 0,
          paddingLeft: 70,
          marginTop: 60,
          listStyleType: 'none',
        }}
      >
        {bullets.map((text, i) => {
          const visible = i < count;
          const wasVisible = i < previousCount;

          let opacity = visible ? 1 : 0;
          let x = 0;
          if (visible !== wasVisible) {
            const p = spring({
              frame: rel - i * 4,
              fps,
              config: {damping: 200},
              durationInFrames: 25,
            });
            if (visible) {
              opacity = p; // spring in
              x = (1 - p) * -24;
            } else {
              opacity = 1 - p; // spring out
            }
          }

          return (
            <li
              key={text}
              style={{position: 'relative', opacity, transform: `translateX(${x}px)`}}
            >
              <span
                style={{
                  position: 'absolute',
                  left: -70,
                  color: '#38bdf8',
                  fontWeight: 700,
                }}
              >
                {i + 1}.
              </span>
              {text}
            </li>
          );
        })}
      </ul>
    </AbsoluteFill>
  );
};
