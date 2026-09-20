# assets-src — device-art sources and provenance

Everything here remains outside `public/`, so Vite does not copy source files
into `dist/`. Selected, optimized derivatives are promoted to `public/mockups/`
only when the approved composition requires them.

## Why

The source directory preserves the licensed artwork and the reproducible
composition pipeline. Founder correction gy-dyu6r.9 (2026-08-24) restored the
complete photoreal system: corrected hero art, framed gallery screenshots, and
the four approved light/dark pillar demo scenes.

Contents:

- `mockups/` — the three-iPhone MockupWorld raster (`hero-three-panel*`) and the
  punched single-phone frame (`iphone-frame-single*`). Approved optimized
  derivatives listed in PR #97 ship from `public/mockups/`; source-size and
  alternate PNG exports remain here only.
- `demos/` — the pre-composed pillar demo clips and reduced-motion posters. The
  approved log-payment, schedule, branded-statement, and build-workout light/
  dark variants are promoted byte-for-byte to `public/demos/`.
- `hero-demo.mp4` / `hero-demo-poster.png` — the old stand-in hero clip.
- `legacy-bezel-pipeline/` — was `scripts/gy-7yhkh/`, the builder that composited
  screenshots into the mockup and punched the frame aperture. It is preserved
  as the licensed composition/provenance pipeline and is run deliberately when
  the approved hero art must be refreshed from current screenshot masters.

`scripts/check-photoreal-device.mjs` fails CI unless the exact corrected hero,
all demo/poster variants, gallery frame, measured mask geometry, rendered
contract, and self-hosted workflow policy are present in source and build.
