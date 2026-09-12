# Photoreal device restoration — design handoff

**Bead:** `gy-dyu6r.5`  
**Decision requested:** PM approval before `gy-dyu6r.6` is made ready.  
**Scope:** landing-page hero and “See Gymbo in action” gallery only. This is a design/source handoff, not an implementation change.

## Decision

Restore the established, licensed photoreal device treatment using the MockupWorld rasters preserved at `assets-src/mockups/`. Do not recreate a phone in CSS, SVG, or generated imagery. The hero is one prepared three-phone raster; each gallery item is a current Gymbo screenshot visible through the prepared single-phone aperture. This restores physical credibility while retaining the current real screenshots, copy, ordering, pricing, CTA, favicon, light-only site, and Forge page system.

This supersedes the no-bezel presentation rule recorded in [`7856816dda`](https://github.com/material-lab-io/gymbo-landing/commit/7856816dda359347e52e82ed791d639cb81aa74d), only for the hero and gallery surface named here. Pillars remain screen-only; there is no restoration of their old baked video/demo treatment.

## Source and provenance

| Surface | Approved source | Exact served derivatives | Why this, not a substitute |
| --- | --- | --- | --- |
| Hero | `assets-src/mockups/hero-three-panel.png` (4800 × 3236 RGBA) | `hero-three-panel-800.webp`, `-1200.webp`, `-1800.webp`; PNG fallback `hero-three-panel-1200.png` | The exact three-iPhone MockupWorld composition introduced in [`d1897babe2`](https://github.com/material-lab-io/gymbo-landing/commit/d1897babe2e62378255ddbb6b7aa5bb9e4c8d3fd). It contains the approved metal, reflections, shadow, fan arrangement, and the three precomposited real Gymbo captures. |
| Gallery | `assets-src/mockups/iphone-frame-single.png` (1538 × 3191 RGBA) | `iphone-frame-single-520.webp`, `-720.webp`, `-1080.webp`; PNG fallback `iphone-frame-single.png` | The aperture-punched center phone extracted from that same MockupWorld source in [`d1897babe2`](https://github.com/material-lab-io/gymbo-landing/commit/d1897babe2e62378255ddbb6b7aa5bb9e4c8d3fd). It is the prepared real-device overlay—not a hand-built bezel. |

The earlier one-device reference is the commercially cleared MockupNest silver iPhone 17 Pro in [`5ccd4b3156`](https://github.com/material-lab-io/gymbo-landing/commit/5ccd4b315684b5ebe22e950e5e3edf73eca8d7a3). Its files were replaced by the MockupWorld set in `d1897babe2`; do **not** resurrect or approximate the retired silver asset. `7856816dda` deliberately moved the surviving MockupWorld files from `public/mockups/` to `assets-src/mockups/`; implementation must promote only the exact derivative files above back to `public/mockups/`.

## Layout contract

### Hero

The art is a single semantic product image, not three independently interactive cards. Preserve its intrinsic 4800:3236 ratio and use `object-fit: contain`—no crop, re-order, CSS rotation, or extra chip/callout overlay.

| Viewport | Placement and size | Hierarchy / content | Image behavior |
| --- | --- | --- | --- |
| 1440 px | Desktop-only art stage, right aligned and vertically centered in the hero; `width: min(46vw, 720px)` (662 px at 1440). Keep the existing text column and CTA layer above it. | Headline and CTA remain the first reading path; the three-phone composition is the supporting proof point. Its outer right edge may meet the viewport edge only if the complete raster/shadow remains visible. | `<picture>` uses 800/1200/1800 WebP candidates, 1200 PNG fallback; `sizes="(min-width: 1024px) min(46vw, 720px)"`; eager/high priority, async decode. |
| 390 px | In normal flow below the unchanged CTA group with `margin-top: 48px`, centered at `width: min(92vw, 560px)` (359 px at 390). No negative bottom bleed. | Copy and CTA lead; the complete three-phone composition stays legible as a visual overview, not a control. | Same `picture`; `sizes="min(92vw, 560px)"`; eager/high priority, async decode. |

Alt text when the mobile image is exposed: “Gymbo dashboard, balances, and payment logging shown across three phones.” The desktop duplicate is decorative (`alt=""`, `aria-hidden="true"`) so it does not repeat the same announcement. The source captures in the raster must be current approved screenshots—not synthetic, stale, or a separately captured phone photo.

### Gallery

Keep the existing six-item order, captions, carousel semantics, charcoal background, keyboard focus treatment, and current screenshot alts. Replace only the raw `ScreenCard` presentation with the prepared single-phone overlay.

* **1440 px:** retain the horizontal snap carousel. Each item has a **360 px visible screenshot aperture**; its 1538 × 3191 device overlay computes to about **391 px** wide. Keep the existing caption below and `gap-10` desktop spacing.
* **390 px:** retain one snap-centered item at a time; the same 360 px aperture produces an approximately 391 px outer overlay, intentionally using the existing edge-to-edge carousel rail (`-mx-5 px-5`). Do not shrink the screenshot to show two phones at once. Caption remains below the active visible item.
* **Aperture:** use the source geometry exactly: frame 1538 × 3191; transparent screen opening x=60, y=51, w=1417, h=3088 (3.901%, 1.598%, 92.133%, 96.773%). Put the current responsive Gymbo screenshot behind that clipped aperture and place the transparent device asset above it. Do not infer a new radius, notch, shadow, or screen crop.
* **Performance:** gallery screenshots and device overlays are native lazy loaded with async decoding. Supply the 520/720/1080 WebP `srcset` plus PNG fallback for the overlay; no data URI or oversized unresponsive source.

The screenshot `<img>` remains the accessible image and carries the existing specific alt. The overlay image is `alt="" aria-hidden="true"` and has no pointer events. The carousel remains a labelled region and each focusable item retains its visible focus indicator. Respect reduced motion: this is static imagery, so do not add animation.

## Forge constraints and non-goals

* Reuse Forge `F`, typography, layout widths, carousel, and `SHADOW.elevation4Filter`; do not introduce a new colour, radius, shadow, type scale, or spacing token. The asset contains its own licensed physical-device reflection and rail.
* Keep nav, headline, body copy, pricing, CTA behavior, favicon, gallery order, screenshot freshness contract, and light-only color behavior unchanged.
* Pillar visuals remain the current screen-only `ScreenCard` treatment. No videos, demo clips, device art, or motion work is reintroduced there.
* No modal, hover-only explanation, drag requirement, or click behavior is attached to a product image. Gallery drag/scroll remains optional; keyboard focus and native horizontal scroll continue to work.

## Replacement CI and visual-regression direction

Remove the obsolete `check-no-bezel` contract and replace it with a narrow, fail-closed **`check-photoreal-device`** contract. It must be wired before build (source) and after build (`--dist`), with a matching negative-control job. This is a specification for the implementing child, not a request to change CI in this bead.

1. **Approved-asset allowlist.** The only device files permitted in the served hero/gallery are the two exact derivative families in the source table. Fail if a served `/mockups/` device asset is missing, renamed, replaced, or comes from an unapproved family. The `assets-src` masters are provenance only; the gate must not accept an unserved master as evidence that production ships it.
2. **Rendered-surface contract.** Source must declare a named hero device-art picture and a named gallery device-art overlay (stable test ids are preferred: `hero-device-art` and `gallery-device-art`). Each must resolve to its approved `srcset` and PNG fallback. A raw `ScreenCard` is allowed in pillars only, not in the hero/gallery slots.
3. **Build-output contract.** After Vite build, assert the exact public paths exist in `dist/mockups/` and the built HTML/JS references both approved asset families. A source string alone is insufficient; this catches `public/` copy regressions.
4. **Negative controls.** Prove the gate fails for (a) missing hero three-panel asset, (b) missing gallery single-frame asset, (c) a raw screen card occupying a required hero/gallery slot, and (d) a `dist` containing raw screenshots but no approved device art. Prove it passes only for a fixture containing both authorised families and both rendered contracts.
5. **Runtime smoke and visual tests.** Replace the test that demands zero framed assets with one that verifies loaded approved hero and gallery device art, decorative overlay semantics, and no videos. Refresh baselines only after review: desktop 1440 hero shows the full three-device composition; mobile 390 shows it below CTAs; gallery shows one full photoreal framed phone at a time on mobile and the framed carousel on desktop. Retire the old bezel-less gallery-corner assertion; it checks the opposite visual rule.

## Approval checklist

- [ ] PM accepts MockupWorld `hero-three-panel` for hero and `iphone-frame-single` for gallery, rather than the retired MockupNest asset.
- [ ] PM accepts the 1440/390 hierarchy and no-crop geometry above.
- [ ] PM accepts that restoration is limited to hero + gallery; pillars stay screen-only.
- [ ] PM accepts the replacement gate and negative-control direction.
- [ ] Only after all four are accepted may PM mark `gy-dyu6r.6` ready for an implementation owner.
