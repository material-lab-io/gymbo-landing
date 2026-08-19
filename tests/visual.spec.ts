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
 * gy-k095b: there are no <video> elements on the site any more. Under the
 * founder's no-bezel rule (gy-r4nzh) the pillar demo clips — which had the
 * device frame and captions burnt into the video — were replaced by real
 * screenshots in bezel-less ScreenCards. That deletes this file's single
 * largest flake source (gy-cjdtw: a looping video's decoded frame is
 * non-deterministic across the 3 gt2 runners), along with the poster-swap
 * workaround it needed. Everything captured now is static images and DOM.
 */

const SECTIONS = [
  { name: 'hero', testId: 'hero-section' },
  { name: 'pillar-revenue', testId: 'pillar-revenue' },
  { name: 'pillar-organized', testId: 'pillar-organized' },
  { name: 'pillar-brand', testId: 'pillar-brand' },
  { name: 'pillar-workouts', testId: 'pillar-workouts' },
  { name: 'gallery', testId: 'gallery-section' },
  { name: 'pricing', testId: 'pricing-section' },
  { name: 'footer-cta', testId: 'footer-cta-section' },
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
}

/** Wait for every <img> inside the locator to finish loading (real natural
 * size, not a still-pending/broken placeholder) — covers every ScreenCard on
 * the page: the hero trio, the four pillar screens, and the gallery strip. */
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
    content: `
      nav[aria-label="Main navigation"] { visibility: hidden !important; }
      .fixed.bottom-0 { visibility: hidden !important; }
    `,
  });
}

test.describe('visual baselines', () => {
  test.beforeEach(async ({ page }) => {
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
      await expect(locator).toHaveScreenshot(`${section.name}-light.png`);
    });
  }

  // A ZOOMED top-left corner of the first "See Gymbo in action" card. The
  // full-section snapshot is too low-res to catch what goes wrong at a card
  // edge: originally a subtly wrong FRAME APERTURE radius (gy-wh9li.3 — the
  // elliptical-vs-circular corner Kaushik flagged, which gy-oooc9 missed by
  // checking the number instead of the curve).
  //
  // gy-k095b: the aperture is gone with the device frame, but the corner is
  // still the right place to look — it is where a bezel would come BACK
  // visually. This clip now gates the ScreenCard's own contract: the Forge
  // radius actually clips the screenshot, and there is no frame edge, notch
  // or device rail between the card boundary and the app's own pixels.
  // Runs in both projects (desktop + mobile).
  test('gallery-card-corner', async ({ page }) => {
    const gallery = page.getByTestId('gallery-section');
    await revealSection(page, gallery);
    await waitImagesLoaded(gallery);
    const card = page.getByTestId('screen-card').first();
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
