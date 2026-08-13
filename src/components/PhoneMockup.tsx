import { useEffect, useRef, useState } from "react";
import { SHADOW } from "../forge-ui";

/* ============================================================================
   DemoFrame — a real, pre-composed Swift app-demo clip (Wave 2). Each clip is a
   FULLY-COMPOSED 9:16 scene: the iPhone frame, caption, and a theme-matched
   background are all baked in (light/dark variants), so it renders BARE — a plain
   muted-loop <video> that blends into the page (NO device wrapper, NO CSS shadow,
   which would halo the blended rectangle). The clip IS the treatment.
   Theme-aware: swaps the -light/-dark variant on toggle.
   Perf: lazy-load below fold (IntersectionObserver), muted/loop/playsinline,
   prefers-reduced-motion → static poster (no autoplay).
   ============================================================================ */

export type ThemeName = "light" | "dark";
export interface ClipMap {
  light: string;
  dark: string;
}

/* Single-device frame geometry — the front/center phone cut out of Kaushik's
   MockupWorld three-iPhone mockup (gy-dfl55.14; same source as the hero's
   HeroThreePanel in App.tsx), with its "Change-This" screen aperture punched
   to a transparent hole (scripts/gy-7yhkh/build-hero.mjs → buildSingleFrame).
   Frame canvas 1538×3191; aperture at (60,51)-(1477,3139) within it. */
const FRAME_W = 1538;
const FRAME_H = 3191;
const HOLE = { x: 60, y: 51, w: 1417, h: 3088 };
const HOLE_PCT = {
  left: (HOLE.x / FRAME_W) * 100,
  top: (HOLE.y / FRAME_H) * 100,
  width: (HOLE.w / FRAME_W) * 100,
  height: (HOLE.h / FRAME_H) * 100,
};
const FRAME_SRC = "/mockups/iphone-frame-single.png";
const FRAME_SRCSET = "/mockups/iphone-frame-single-520.webp 520w, /mockups/iphone-frame-single-720.webp 720w, /mockups/iphone-frame-single-1080.webp 1080w";

/* ============================================================================
   ScreenshotFrame — a current real-app screenshot (founder-approved curated set,
   public/screens/gallery/) composited inside Kaushik's photoreal iPhone frame
   (replaces react-device-mockup — never a hand-built device, gy-7yhkh). Used by
   the "See Gymbo in action" static gallery. Perf: WebP srcset + PNG fallback via
   <picture>, native lazy-load + async decode. The screenshots are light-mode
   captures, so the light screen pops against the charcoal section while the
   dark bezel reads as a subtle device edge.
   ============================================================================ */
export function ScreenshotFrame({
  slug,
  alt,
  screenWidth = 232,
  className = "",
  style,
}: {
  /** basename in public/screens/gallery (e.g. "dashboard") */
  slug: string;
  alt: string;
  /** screen width in px (device frame adds bezel) */
  screenWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const base = `/screens/gallery/${slug}`;
  const frameWidth = Math.round(screenWidth / (HOLE_PCT.width / 100));
  return (
    <div
      className={className}
      style={{ position: "relative", filter: SHADOW.elevation4Filter, lineHeight: 0, aspectRatio: `${FRAME_W} / ${FRAME_H}`, width: frameWidth, ...style }}
    >
      <div
        style={{
          position: "absolute",
          left: `${HOLE_PCT.left}%`,
          top: `${HOLE_PCT.top}%`,
          width: `${HOLE_PCT.width}%`,
          height: `${HOLE_PCT.height}%`,
          overflow: "hidden",
          /* gy-oooc9: the frame's punched aperture in iphone-frame-single.png
             is a real rounded corner (R=234.7px on a 1417px-wide aperture,
             measured directly from the asset's alpha channel — a 299-point
             circle fit, residual std 2.5px). This div's square corners were
             clipping the screenshot past that curve, showing as a protruding
             square notch over the rounded bezel. 16.56% is that measured
             radius expressed as a % of this div's own width (which scales
             with screenWidth), not a hand-tuned value. */
          borderRadius: "16.56%",
        }}
      >
        <picture>
          <source
            type="image/webp"
            srcSet={`${base}-360.webp 360w, ${base}-540.webp 540w, ${base}-720.webp 720w, ${base}-1080.webp 1080w`}
            sizes={`${screenWidth}px`}
          />
          <img
            src={`${base}.png`}
            alt={alt}
            loading="lazy"
            decoding="async"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </picture>
      </div>
      <picture>
        <source type="image/webp" srcSet={FRAME_SRCSET} sizes={`${frameWidth}px`} />
        <img
          src={FRAME_SRC}
          alt=""
          aria-hidden="true"
          decoding="async"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", pointerEvents: "none" }}
        />
      </picture>
    </div>
  );
}

export function DemoFrame({
  clip,
  poster,
  theme,
  maxWidth = 300,
  label,
  className = "",
  style,
}: {
  clip: ClipMap;
  poster: ClipMap;
  theme: ThemeName;
  /** max rendered width in px (clips are 9:16 portrait) */
  maxWidth?: number;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setInView(true);
            io.disconnect();
          }
        });
      },
      { rootMargin: "250px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const src = theme === "dark" ? clip.dark : clip.light;
  const posterSrc = theme === "dark" ? poster.dark : poster.light;

  useEffect(() => {
    const v = videoRef.current;
    if (v && inView && !reduced) {
      v.load();
      v.play().catch(() => {});
    }
  }, [src, inView, reduced]);

  const showVideo = inView && !reduced;

  return (
    <div ref={rootRef} className={className} style={{ position: "relative", lineHeight: 0, ...style }}>
      <div style={{ position: "relative", maxWidth, margin: "0 auto" }}>
        {showVideo ? (
          <video
            ref={videoRef}
            muted
            loop
            playsInline
            autoPlay
            preload="metadata"
            poster={posterSrc}
            aria-label={label}
            data-theme-variant={theme}
            style={{ width: "100%", height: "auto", display: "block" }}
          >
            <source src={src} type="video/mp4" />
          </video>
        ) : (
          <img src={posterSrc} alt={label || ""} loading="lazy" style={{ width: "100%", height: "auto", display: "block" }} />
        )}
      </div>
    </div>
  );
}
