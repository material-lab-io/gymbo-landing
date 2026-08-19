# assets-src — device-framed source art, NOT served

Everything in here is deliberately OUTSIDE `public/`, so Vite never copies it
into `dist/` and none of it can reach getgymbo.com.

## Why

Founder rule gy-r4nzh (Kaushik, 2026-08-14, standing, site-wide): getgymbo.com
shows REAL app screenshots with NO phone bezels or device frames. "Bezels give
away AI" — the device chrome reads as AI-generated/fake.

These files all carry a device frame, so none of them may ship:

- `mockups/` — the three-iPhone MockupWorld raster (`hero-three-panel*`) and the
  punched single-phone frame (`iphone-frame-single*`) the old hero and gallery
  composited into.
- `demos/` — the pre-composed pillar demo clips. Each `.mp4` is a fully-composed
  scene with the bezel, a title upper-third and a caption lower-third burnt into
  the video, so they cannot be cropped into compliance. They are kept as the
  SOURCE for the screen-only motion loops (gy-39v87), which will re-render the
  same journeys with no device and no baked captions.
- `hero-demo.mp4` / `hero-demo-poster.png` — the old stand-in hero clip.
- `legacy-bezel-pipeline/` — was `scripts/gy-7yhkh/`, the builder that composited
  screenshots into the mockup and punched the frame aperture. Kept for the
  provenance record (it documents how the source SVG's transforms were composed);
  it must not be re-wired into the build.

`scripts/check-no-bezel.mjs` fails CI if any of this reappears under `src/` or in
a built `dist/`. It deliberately does NOT scan this directory — storing the
source art is fine, shipping it is not.
