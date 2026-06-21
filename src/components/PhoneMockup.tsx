import { useEffect, useRef, useState } from "react";
import { IPhoneMockup } from "react-device-mockup";

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

const SANS = "var(--font-sans)";

export type ThemeName = "light" | "dark";
export interface ClipMap {
  light: string;
  dark: string;
}

/* ============================================================================
   ScreenshotFrame — a current real-app screenshot (founder-approved curated set,
   public/screens/gallery/) composited inside a consistent iPhone-15 device frame
   (react-device-mockup, dynamic island). Used by the "See Gymbo in action" static
   gallery. Perf: WebP srcset + PNG fallback via <picture>, native lazy-load +
   async decode. The screenshots are light-mode captures, so the light screen pops
   against the charcoal section while the dark bezel reads as a subtle device edge.
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
  return (
    <div
      className={className}
      style={{ filter: "drop-shadow(0 24px 48px rgba(0,0,0,.45)) drop-shadow(0 6px 14px rgba(0,0,0,.3))", lineHeight: 0, ...style }}
    >
      <IPhoneMockup screenWidth={screenWidth} screenType="island" frameColor="#1a1a1a" hideStatusBar hideNavBar>
        <picture>
          <source
            type="image/webp"
            srcSet={`${base}-360.webp 360w, ${base}-540.webp 540w, ${base}-720.webp 720w`}
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
      </IPhoneMockup>
    </div>
  );
}

export function DemoFrame({
  clip,
  poster,
  theme,
  maxWidth = 300,
  label,
  comingSoon,
  className = "",
  style,
}: {
  clip: ClipMap;
  poster: ClipMap;
  theme: ThemeName;
  /** max rendered width in px (clips are 9:16 portrait) */
  maxWidth?: number;
  label?: string;
  /** optional "coming soon" overlay tag */
  comingSoon?: string;
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

        {comingSoon && (
          <span
            data-coming-soon
            style={{
              position: "absolute",
              top: "6%",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 5,
              whiteSpace: "nowrap",
              borderRadius: 999,
              background: "#f59e0b",
              color: "#1a1a1a",
              fontFamily: SANS,
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.04em",
              padding: "4px 10px",
              boxShadow: "0 1px 2px rgba(0,0,0,.1), 0 8px 24px -6px rgba(0,0,0,.18)",
            }}
          >
            {comingSoon}
          </span>
        )}
      </div>
    </div>
  );
}
