import { useEffect, useRef, useState } from "react";

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
  poster: string;
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
            poster={poster}
            aria-label={label}
            data-theme-variant={theme}
            style={{ width: "100%", height: "auto", display: "block" }}
          >
            <source src={src} type="video/mp4" />
          </video>
        ) : (
          <img src={poster} alt={label || ""} loading="lazy" style={{ width: "100%", height: "auto", display: "block" }} />
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
