import { SHADOW } from "../forge-ui";

/* ============================================================================
   ScreenCard — the screen-only product visual used by the four Forge pillars.

   Hero and gallery use the approved photoreal device compositions restored by
   gy-dyu6r.6. Pillars deliberately remain direct screenshots: clipped to the
   Forge card radius with the Forge elevation-4 drop-shadow and no extra chrome.

   Radius is deliberately per-breakpoint (--g-radius-lg on mobile, --g-radius-xl
   at >=lg) to match the rest of the Forge card system at each size. Shadow is
   the existing SHADOW.elevation4Filter token — a filter, not box-shadow, so it
   traces the clipped rounded rect rather than a square box.
   ============================================================================ */

/** Every master is captured at iPhone 17 Pro logical resolution, light theme. */
const SCREEN_W = 1206;
const SCREEN_H = 2622;

export function ScreenCard({
  slug,
  alt,
  width,
  sizes,
  priority = false,
  className = "",
  style,
}: {
  /** basename in public/screens/gallery (e.g. "dashboard") — see scripts/screens-map.mjs */
  slug: string;
  /** empty string marks the card decorative; the surrounding copy carries the meaning */
  alt: string;
  /** rendered CSS width — a plain px number, or any CSS length (e.g. "min(38vw, 300px)") */
  width: number | string;
  /** srcset sizes hint; defaults to the width when that is a simple px number */
  sizes?: string;
  /** hero cards only: skip lazy-load and raise fetch priority (LCP candidate) */
  priority?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const base = `/screens/gallery/${slug}`;
  const resolvedSizes = sizes ?? (typeof width === "number" ? `${width}px` : "100vw");

  return (
    <div
      data-testid="screen-card"
      className={`rounded-[var(--g-radius-lg)] lg:rounded-[var(--g-radius-xl)] overflow-hidden ${className}`}
      style={{
        width,
        aspectRatio: `${SCREEN_W} / ${SCREEN_H}`,
        filter: SHADOW.elevation4Filter,
        lineHeight: 0,
        ...style,
      }}
    >
      <picture>
        <source
          type="image/webp"
          srcSet={`${base}-360.webp 360w, ${base}-540.webp 540w, ${base}-720.webp 720w, ${base}-1080.webp 1080w`}
          sizes={resolvedSizes}
        />
        <img
          src={`${base}.png`}
          alt={alt}
          {...(priority
            ? { decoding: "async" as const, fetchpriority: "high" as const }
            : { loading: "lazy" as const, decoding: "async" as const })}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </picture>
    </div>
  );
}
