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
 *    (.reveal-on-scroll in App.tsx) and the pillar demo videos lazy-mount on
 *    a SECOND IntersectionObserver (PhoneMockup.tsx DemoFrame, rootMargin
 *    "250px 0px"). A capture that doesn't actually scroll a section into
 *    view renders it EMPTY.
 *
 * The pillar demo clips are live, looping <video> elements — the flake risk
 * for any pixel-diff baseline. They're frozen (paused + seeked to frame 0)
 * right before every screenshot rather than accepting a wide diff threshold.
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

/** gy-cjdtw: a looping <video>'s decoded frame is NON-DETERMINISTIC across gt2
 * runs — even after seeking to frame 0, two separate runs (and the 3 physical
 * gt2 runners) decode subtly different pixels, so the demo-clip region can never
 * be reliably matched by a pixel baseline (seeking-to-0 was the previous, still-
 * flaky attempt: pillar-revenue-mobile diffed 16k px purely inside the video).
 *
 * Instead, swap each demo <video> for its own POSTER — a static PNG of the SAME
 * composed scene (phone frame, rounded corners, aperture edges AND the app
 * screen). The snapshot becomes deterministic while EVERYTHING stays GATED:
 * nothing is masked, so the frame/corner/aperture-edge regression class (round-7
 * F3) is still fully checked, along with all surrounding copy and layout. The
 * poster is the video's own `poster` attribute, rendered at the identical box so
 * the page layout is pixel-unchanged. */
async function freezeVideos(page: Page) {
  await page.evaluate(async () => {
    const decode = (img: HTMLImageElement) =>
      img.decode ? img.decode().catch(() => {}) : Promise.resolve();
    for (const v of Array.from(document.querySelectorAll('video'))) {
      v.pause();
      const poster = v.getAttribute('poster');
      if (!poster) continue;
      const img = document.createElement('img');
      img.src = poster;
      img.setAttribute('aria-hidden', 'true');
      // Mirror the video's box so the poster's baked-in frame + the surrounding
      // layout land pixel-identical to the live element.
      img.className = v.className;
      const style = v.getAttribute('style');
      if (style) img.setAttribute('style', style);
      v.replaceWith(img);
      await decode(img);
    }
  });
}

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
 * size, not a still-pending/broken placeholder) — covers the hero device
 * screenshot and the gallery's real-app screenshots. */
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

/** If this section lazy-mounts a demo <video> (DemoFrame's own
 * IntersectionObserver), give it a moment to actually attach before we try
 * to freeze it. */
async function waitVideoMounted(locator: Locator) {
  const video = locator.locator('video').first();
  if (await video.count()) {
    await video.waitFor({ state: 'attached', timeout: 10000 });
  }
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
      await waitVideoMounted(locator);
      await freezeVideos(page);
      await expect(locator).toHaveScreenshot(`${section.name}-light.png`);
    });
  }

  // gy-wh9li.3: a ZOOMED top-left corner of the first "See Gymbo in action"
  // phone. The full-section gallery snapshot is too low-res to catch a subtly
  // wrong aperture radius (the elliptical-vs-circular corner Kaushik flagged, and
  // that gy-oooc9 missed by checking the number not the curve). This dedicated
  // corner clip fails loudly if the screenshot edge stops tracing the bezel.
  // Runs in both projects (desktop + mobile).
  test('gallery-phone-corner', async ({ page }) => {
    const gallery = page.getByTestId('gallery-section');
    await revealSection(page, gallery);
    await waitImagesLoaded(gallery);
    const phone = page.getByTestId('screenshot-frame').first();
    await expect(phone).toBeVisible();
    // revealSection ends scrolled to the section BOTTOM, so pull the first phone
    // fully back into the viewport before clipping its top-left corner.
    await phone.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    const box = await phone.boundingBox();
    if (!box) throw new Error('gallery phone frame has no bounding box');
    await expect(page).toHaveScreenshot('gallery-phone-corner-light.png', {
      clip: { x: Math.max(0, box.x), y: Math.max(0, box.y), width: 96, height: 96 },
    });
  });
});
