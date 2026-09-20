import { useEffect, useRef, useState } from "react";
import { SHADOW } from "../forge-ui";

export type ThemeName = "light" | "dark";
export interface ClipMap {
  light: string;
  dark: string;
}

/* Measured from the licensed MockupWorld single-iPhone asset. The aperture is
   a real alpha cut-out, so the screenshot mask must follow these coordinates
   and use the same circular radius on both axes. */
const FRAME_W = 1538;
const FRAME_H = 3191;
const HOLE = { x: 60, y: 51, w: 1417, h: 3088 };
const HOLE_PCT = {
  left: (HOLE.x / FRAME_W) * 100,
  top: (HOLE.y / FRAME_H) * 100,
  width: (HOLE.w / FRAME_W) * 100,
  height: (HOLE.h / FRAME_H) * 100,
};
const APERTURE_RADIUS_RATIO = 0.1656;
const APERTURE_RADIUS_CQW = (HOLE_PCT.width / 100) * APERTURE_RADIUS_RATIO * 100;
const FRAME_SRC = "/mockups/iphone-frame-single.png";
const FRAME_SRCSET = "/mockups/iphone-frame-single-520.webp 520w, /mockups/iphone-frame-single-720.webp 720w, /mockups/iphone-frame-single-1080.webp 1080w";

export function ScreenshotFrame({
  slug,
  alt,
  screenWidth = 232,
  className = "",
  style,
}: {
  slug: string;
  alt: string;
  screenWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const base = `/screens/gallery/${slug}`;
  const frameWidth = Math.round(screenWidth / (HOLE_PCT.width / 100));
  return (
    <div
      data-testid="gallery-device-art"
      data-frame-contract="screenshot-frame"
      className={className}
      style={{
        position: "relative",
        filter: SHADOW.elevation4Filter,
        lineHeight: 0,
        aspectRatio: `${FRAME_W} / ${FRAME_H}`,
        width: `min(${frameWidth}px, calc(100vw - 28px))`,
        containerType: "inline-size",
        ...style,
      }}
    >
      <div
        data-testid="gallery-screen-aperture"
        style={{
          position: "absolute",
          left: `${HOLE_PCT.left}%`,
          top: `${HOLE_PCT.top}%`,
          width: `${HOLE_PCT.width}%`,
          height: `${HOLE_PCT.height}%`,
          overflow: "hidden",
          /* cqw resolves to pixels from the rendered frame width, so a mobile
             cap cannot stretch the circular radius into an ellipse. */
          borderRadius: `${APERTURE_RADIUS_CQW}cqw`,
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
          loading="lazy"
          decoding="async"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", pointerEvents: "none" }}
        />
      </picture>
    </div>
  );
}

export function DemoFrame({
  demoId,
  clip,
  poster,
  theme,
  maxWidth = 300,
  label,
  className = "",
  style,
}: {
  demoId: string;
  clip: ClipMap;
  poster: ClipMap;
  theme: ThemeName;
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
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "250px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const src = theme === "dark" ? clip.dark : clip.light;
  const posterSrc = theme === "dark" ? poster.dark : poster.light;

  useEffect(() => {
    const video = videoRef.current;
    if (video && inView && !reduced) {
      video.load();
      video.play().catch(() => {});
    }
  }, [src, inView, reduced]);

  const showVideo = inView && !reduced;

  return (
    <div
      ref={rootRef}
      data-testid="pillar-demo"
      data-demo-id={demoId}
      className={className}
      style={{ position: "relative", lineHeight: 0, ...style }}
    >
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
          <img
            data-testid="pillar-demo-poster"
            src={posterSrc}
            alt={label || ""}
            loading="lazy"
            decoding="async"
            style={{ width: "100%", height: "auto", display: "block" }}
          />
        )}
      </div>
    </div>
  );
}
