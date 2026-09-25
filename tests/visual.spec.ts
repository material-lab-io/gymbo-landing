import { test, expect, type Locator, type Page } from '@playwright/test';

/**
 * Visual regression baselines (gy-a73px.1 — Wave 0 safety net for round 3).
 *
 * Captures hero, the 4 why-pillars, the "See Gymbo in action" gallery,
 * pricing, and the footer CTA — on both Playwright projects (desktop /
 * mobile). getgymbo.com is LIGHT ONLY (gy-uesmd, founder ruling
 * 2026-08-12) — there is no global theme toggle, so there is only one
 * baseline set per section now (the former dark baselines are deleted).
 *
 * The one trap this file works around (see the bead for the full writeup):
 *  - Below-the-fold content is gated on IntersectionObserver
 *    (.reveal-on-scroll in App.tsx). A capture that doesn't actually scroll a
 *    section into view renders it EMPTY.
 *
 * Pillars use motion in production. Visual snapshots freeze those videos on
 * their matching posters through reduced motion, keeping the baseline stable
 * while smoke tests independently prove real playback advances.
 */

const SECTIONS = [
  { name: 'hero', testId: 'hero-section' },
  { name: 'pillar-revenue', testId: 'pillar-revenue' },
  { name: 'pillar-organized', testId: 'pillar-organized' },
  { name: 'pillar-brand', testId: 'pillar-brand' },
  { name: 'pillar-workouts', testId: 'pillar-workouts' },
  { name: 'gallery', testId: 'gallery-section' },
  { name: 'pricing', testId: 'pricing-section' },
  // snapTop: see sectionClip. footer-cta is the only section that sits between two sections of a DIFFERENT ground
  // (bone above, the bordered footer below), so it is the only one where a fractional edge paints another section's
  // row into the baseline.
  { name: 'footer-cta', testId: 'footer-cta-section', snapTop: true },
] as const;

/** Scroll fully through a section (top, then bottom) and wait for every
 * .reveal-on-scroll descendant to pick up `is-visible` before we screenshot
 * it — otherwise IO-gated content captures empty. Scrolling only to the
 * section's top (scrollIntoViewIfNeeded) isn't enough for sections taller
 * than the viewport: a Reveal near the bottom (e.g. a closing CTA) never
 * crosses the IO threshold. */
async function revealSection(page: Page, locator: Locator) {
  await locator.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(50); // let the first IO batch land before the next jump
  await locator.evaluate((el) => el.scrollIntoView({ block: 'end' }));
  await locator.evaluate((el) =>
    new Promise<void>((resolve, reject) => {
      const deadline = Date.now() + 10000;
      const settled = () => {
        const targets = el.matches('.reveal-on-scroll')
          ? [el]
          : Array.from(el.querySelectorAll('.reveal-on-scroll'));
        return targets.every((t) => t.classList.contains('is-visible'));
      };
      const tick = () => {
        if (settled()) return resolve();
        if (Date.now() > deadline) return reject(new Error('reveal-on-scroll never settled in time'));
        requestAnimationFrame(tick);
      };
      tick();
    })
  );
}

/** The gallery's screenshot cards sit in a horizontally-scrolling
 * `.carousel` strip (overflow-x: auto) — cards past the first one are laid
 * out to the right of the viewport, so native `loading="lazy"` on their
 * <img> never fires from a purely vertical scroll. Drag the strip across and
 * back so every card's image starts loading before we wait on it. */
async function scrollHorizontalCarousels(page: Page, locator: Locator) {
  const hasCarousel = await locator.locator('.carousel').count();
  if (!hasCarousel) return;
  await locator.evaluate((el) => {
    el.querySelectorAll<HTMLElement>('.carousel').forEach((c) => {
      c.scrollLeft = c.scrollWidth;
    });
  });
  await page.waitForTimeout(200);
  await locator.evaluate((el) => {
    el.querySelectorAll<HTMLElement>('.carousel').forEach((c) => {
      c.scrollLeft = 0;
    });
  });
  await page.waitForTimeout(200); // let the position cue resync to the first card
}

/** Wait for every <img> inside the locator to finish loading (real natural
 * size, not a still-pending/broken placeholder) — covers the static hero,
 * reduced-motion pillar posters, and the gallery strip. */
async function waitImagesLoaded(locator: Locator) {
  await locator.evaluate((el) =>
    Promise.all(
      Array.from(el.querySelectorAll('img')).map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
        });
      })
    )
  );
}

/** The sticky top nav and the mobile fixed bottom CTA bar sit OUTSIDE every
 * captured section, but for a section taller than the viewport, Playwright's
 * element-screenshot capture scrolls and stitches multiple frames — and a
 * `position: sticky`/`fixed` element gets re-painted into each frame,
 * producing a ghosted double-nav in the diff. Neutralize both (visibility
 * only, so layout/scroll offsets are unaffected) before capturing. */
async function neutralizeFixedChrome(page: Page) {
  await page.addStyleTag({
    content: `[data-fixed-chrome] { visibility: hidden !important; }`,
  });

  // 🔴 A NEUTRALIZER THAT MATCHES NOTHING FAILS SILENTLY, AND IT DID — gy-w77x3,
  // 2026-09-18. This used to select `.fixed.bottom-0`. D1 moved `bottom-0` out
  // of the sticky bar's className and into its inline style (same computed 0px;
  // the offset now tracks the keyboard), the selector stopped matching, and the
  // bar painted into the footer-cta capture: a 27,712px / 12% diff that looked
  // exactly like an intentional design change. It would have been RATIFIED by a
  // baseline refresh — permanently baking a fixed bar into the reference, and
  // leaving every other tall section's capture ghosted too.
  //
  // Two changes, and the second is the one that matters. The selector is now a
  // dedicated attribute, so it survives any restyling of HOW the position is
  // written. And the match is COUNTED: hiding is best-effort and CSS that
  // selects nothing throws nothing, so the only way this can fail loudly is if
  // the test asserts it found what it came for.
  const found = await page.evaluate(() =>
    [...document.querySelectorAll('[data-fixed-chrome]')].map((el) => el.getAttribute('data-fixed-chrome')),
  );
  expect(
    found,
    'the fixed-chrome neutralizer matched nothing to hide — its hook was renamed or dropped, and every section capture below is now ghosted with the nav and/or the sticky bar',
  ).toContain('nav');
  expect(found.length, 'expected at least the nav to carry data-fixed-chrome').toBeGreaterThan(0);
}

/**
 * gy-e60uc.3 (designer, 2026-09-25): THE EDGES OF THE footer-cta BASELINE WERE OTHER SECTIONS.
 * An element screenshot rounds the element's box OUTWARD. The section above ends at a fractional offset (measured top
 * 10606.42 on the phone, 9171.78 on desktop), so the captured row 0 was the bone (250,250,247) bottom edge of the
 * previous section, not this section's charcoal; and the footer below starts with a 1px lighter top border that
 * painted into the last row ((23,23,23) instead of (10,10,10)). That bakes a dependency on whatever sits above and
 * below into the reference: the next change to either would red this baseline with a one-row diff nobody could
 * explain.
 *
 * The clip is STRICTLY INSIDE the section on both edges: from the first row fully inside (ceil of the top) to the last
 * row fully inside (floor of the bottom). It costs at most two rows against the outward-rounded capture (phone 721 ->
 * 719, desktop 805 -> 803) and every pixel in it now belongs to this section. Opt-in per section rather than the
 * default, so no other baseline moves; a section with no fractional neighbour needs nothing.
 */
async function sectionClip(locator: Locator) {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const top = r.top + window.scrollY;
    const bottom = r.bottom + window.scrollY;
    return { x: Math.floor(r.left), y: Math.ceil(top), width: Math.ceil(r.width), height: Math.floor(bottom) - Math.ceil(top) };
  });
}

test.describe('visual baselines', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await neutralizeFixedChrome(page);
  });

  for (const section of SECTIONS) {
    test(`${section.name}`, async ({ page }) => {
      const locator = page.getByTestId(section.testId);
      await expect(locator).toBeVisible();
      await revealSection(page, locator);
      await scrollHorizontalCarousels(page, locator);
      await waitImagesLoaded(locator);
      if ('snapTop' in section && section.snapTop) {
        // Measure AFTER the reveal and image waits, when the layout has stopped moving.
        const clip = await sectionClip(locator);
        await expect(page).toHaveScreenshot(`${section.name}-light.png`, { clip, fullPage: true });
      } else {
        await expect(locator).toHaveScreenshot(`${section.name}-light.png`);
      }
    });
  }

  // A ZOOMED top-left corner of the first "See Gymbo in action" card. The
  // full-section snapshot is too low-res to catch what goes wrong at a card
  // edge: originally a subtly wrong FRAME APERTURE radius (gy-wh9li.3 — the
  // elliptical-vs-circular corner Kaushik flagged, which gy-oooc9 missed by
  // checking the number instead of the curve).
  //
  // The approved photoreal frame restores its aperture; this clip keeps the
  // physical frame edge and current screenshot crop under visual review.
  // Runs in both projects (desktop + mobile).
  test('gallery-card-corner', async ({ page }) => {
    const gallery = page.getByTestId('gallery-section');
    await revealSection(page, gallery);
    await waitImagesLoaded(gallery);
    const card = gallery.getByTestId('gallery-device-art').first();
    await expect(card).toBeVisible();
    // revealSection ends scrolled to the section BOTTOM, so pull the first card
    // fully back into the viewport before clipping its top-left corner.
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    const box = await card.boundingBox();
    if (!box) throw new Error('gallery screen card has no bounding box');
    await expect(page).toHaveScreenshot('gallery-card-corner-light.png', {
      clip: { x: Math.max(0, box.x), y: Math.max(0, box.y), width: 96, height: 96 },
    });
  });
});
