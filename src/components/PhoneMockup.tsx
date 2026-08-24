import { SHADOW } from "../forge-ui";

const frame = { width: 1538, height: 3191, aperture: { x: 60, y: 51, width: 1417, height: 3088 } };
const aperture = {
  left: (frame.aperture.x / frame.width) * 100,
  top: (frame.aperture.y / frame.height) * 100,
  width: (frame.aperture.width / frame.width) * 100,
  height: (frame.aperture.height / frame.height) * 100,
};

export function ScreenshotFrame({ slug, alt, screenWidth = 360 }: { slug: string; alt: string; screenWidth?: number }) {
  const base = `/screens/gallery/${slug}`;
  const width = Math.round(screenWidth / (aperture.width / 100));
  return <div data-testid="gallery-device-art" style={{ position: "relative", width: `min(${width}px, calc(100vw - 28px))`, aspectRatio: `${frame.width} / ${frame.height}`, lineHeight: 0, filter: SHADOW.elevation4Filter }}>
    <div style={{ position: "absolute", left: `${aperture.left}%`, top: `${aperture.top}%`, width: `${aperture.width}%`, height: `${aperture.height}%`, overflow: "hidden" }}>
      <picture><source type="image/webp" srcSet={`${base}-360.webp 360w, ${base}-540.webp 540w, ${base}-720.webp 720w, ${base}-1080.webp 1080w`} sizes={`${screenWidth}px`} /><img src={`${base}.png`} alt={alt} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /></picture>
    </div>
    <picture><source type="image/webp" srcSet="/mockups/iphone-frame-single-520.webp 520w, /mockups/iphone-frame-single-720.webp 720w, /mockups/iphone-frame-single-1080.webp 1080w" sizes={`${width}px`} /><img src="/mockups/iphone-frame-single.png" alt="" aria-hidden="true" loading="lazy" decoding="async" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} /></picture>
  </div>;
}
