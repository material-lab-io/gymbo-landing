# assets-src — device-art sources and provenance

Everything here remains outside `public/`, so Vite does not copy source files
into `dist/`. Selected, optimized derivatives are promoted to `public/mockups/`
only when the approved composition requires them.

## Why

The source directory preserves the licensed artwork and the reproducible
composition pipeline. Founder correction gy-dyu6r (2026-08-24) restored the
photoreal MockupWorld phone treatment to the hero and gallery while keeping the
four Forge pillars screen-only.

Contents:

- `mockups/` — the three-iPhone MockupWorld raster (`hero-three-panel*`) and the
  punched single-phone frame (`iphone-frame-single*`). Approved optimized
  derivatives listed in PR #97 ship from `public/mockups/`; source-size and
  alternate PNG exports remain here only.
- `demos/` — the pre-composed pillar demo clips. Each `.mp4` is a fully-composed
  scene with the bezel, a title upper-third and a caption lower-third burnt into
  the video, so they cannot be cropped into compliance. They are kept as the
  SOURCE for the screen-only motion loops (gy-39v87), which will re-render the
  same journeys with no device and no baked captions.
- `hero-demo.mp4` / `hero-demo-poster.png` — the old stand-in hero clip.
- `legacy-bezel-pipeline/` — was `scripts/gy-7yhkh/`, the builder that composited
  screenshots into the mockup and punched the frame aperture. It is preserved
  as the licensed composition/provenance pipeline and is run deliberately when
  the approved hero art must be refreshed from current screenshot masters.

`scripts/check-photoreal-device.mjs` fails CI unless the approved hero/gallery
assets and rendered contract are present in both source and built output.
