import { useEffect, useRef, useState } from "react";
import { IPhoneMockup } from "react-device-mockup";

/* ============================================================================
   DemoFrame — a muted-loop app-demo video playing INSIDE the MIT react-device-
   mockup iPhone-15 frame (Wave 3 / gy-sulhp.4). Theme-aware: takes a {light,dark}
   clip map and swaps the clip when the page theme toggles. The clip is the
   stand-in public/hero-demo.mp4 now; per-journey + per-theme clips swap in from
   Wave 2 (the frame/markup stays put — that's the seam).
   Perf: lazy-load below fold (IntersectionObserver), muted/loop/playsinline,
   prefers-reduced-motion → static poster only (no autoplay).
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
  screenWidth = 224,
  label,
  comingSoon,
  className = "",
  style,
}: {
  clip: ClipMap;
  poster: string;
  theme: ThemeName;
  screenWidth?: number;
  /** accessible label / caption for the demo */
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

  // lazy: only mount/play the video when the frame nears the viewport
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

  // swap the clip variant when the theme (and thus src) changes
  useEffect(() => {
    const v = videoRef.current;
    if (v && inView && !reduced) {
      v.load();
      v.play().catch(() => {});
    }
  }, [src, inView, reduced]);

  const showVideo = inView && !reduced;

  return (
    <div
      ref={rootRef}
      className={className}
      style={{
        position: "relative",
        lineHeight: 0,
        filter: "drop-shadow(3px 22px 45px rgba(20,20,30,0.18)) drop-shadow(1px 6px 14px rgba(20,20,30,0.10))",
        ...style,
      }}
    >
      <IPhoneMockup screenWidth={screenWidth} screenType="island" frameColor="#1a1a1a" hideStatusBar hideNavBar>
        <div style={{ width: "100%", height: "100%", background: "#000", position: "relative" }}>
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
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            >
              <source src={src} type="video/mp4" />
            </video>
          ) : (
            <img src={poster} alt={label || ""} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          )}
        </div>
      </IPhoneMockup>

      {comingSoon && (
        <span
          data-coming-soon
          style={{
            position: "absolute",
            top: 10,
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
  );
}
