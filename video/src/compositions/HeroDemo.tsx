import React from 'react';
import { Img, staticFile, interpolate, Easing, useCurrentFrame } from 'remotion';

/**
 * HeroDemo — 390×844, 450 frames, 30fps (15 seconds)
 *
 * Scene 1 (0–149):   Schedule screen
 * Scene 2 (150–299): Punch card
 * Scene 3 (300–449): Balance / client list
 *
 * Screenshots are captured by `npm run capture` and stored in public/screens/.
 * No spring() physics — all interpolate() → zero jitter.
 */

const FADE = 15; // fade-in / fade-out duration in frames
const HOLD = 10; // hold before fade-out begins

const easeIn  = Easing.out(Easing.cubic);
const easeOut = Easing.in(Easing.cubic);

/** Fade in: 0→1 over FADE frames starting at `start` */
const fadeIn = (frame: number, start: number) =>
  interpolate(frame, [start, start + FADE], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: easeIn,
  });

/** Fade out: 1→0 over FADE frames ending at `end - HOLD` */
const fadeOut = (frame: number, end: number) =>
  interpolate(frame, [end - HOLD - FADE, end - HOLD], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: easeOut,
  });

/**
 * Combined opacity for a scene.
 * isLast=true skips fade-out (last scene stays visible to end).
 */
const sceneOpacity = (frame: number, start: number, end: number, isLast = false) =>
  Math.min(fadeIn(frame, start), isLast ? 1 : fadeOut(frame, end));

/**
 * Subtle ken-burns: scale 1.00→1.04 linearly across the scene.
 * No easing → no oscillation possible.
 */
const kenBurns = (frame: number, start: number, end: number) =>
  1 + 0.04 * interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

export const HeroDemo: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#1a1a1a',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Scene 1 — Schedule */}
      <div style={{ position: 'absolute', inset: 0, opacity: sceneOpacity(frame, 0, 149) }}>
        <Img
          src={staticFile('screens/schedule.png')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${kenBurns(frame, 0, 149)})`,
            transformOrigin: 'center top',
          }}
        />
      </div>

      {/* Scene 2 — Punch card */}
      <div style={{ position: 'absolute', inset: 0, opacity: sceneOpacity(frame, 150, 299) }}>
        <Img
          src={staticFile('screens/punchcard.png')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${kenBurns(frame, 150, 299)})`,
            transformOrigin: 'center center',
          }}
        />
      </div>

      {/* Scene 3 — Balance (stays visible to end) */}
      <div style={{ position: 'absolute', inset: 0, opacity: sceneOpacity(frame, 300, 449, true) }}>
        <Img
          src={staticFile('screens/balance.png')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${kenBurns(frame, 300, 449)})`,
            transformOrigin: 'center bottom',
          }}
        />
      </div>
    </div>
  );
};
