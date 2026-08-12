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

/** Freeze every <video> on the page at frame 0 so the lazy-mounted, looping
 * demo clips never produce a flaky pixel diff between runs. Setting
 * `currentTime` seeks asynchronously — the previously-playing frame is still
 * what's painted until the browser fires `seeked`, so a screenshot taken
 * right after the assignment can catch whichever frame the loop happened to
 * be on. Wait for `seeked` (or `pause` if it was already sitting on frame 0
 * and no seek is needed) before returning. */
async function freezeVideos(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      Array.from(document.querySelectorAll('video')).map(
        (v) =>
          new Promise<void>((resolve) => {
            v.pause();
            if (v.currentTime === 0 && v.readyState >= 2) {
              resolve();
              return;
            }
            v.addEventListener('seeked', () => resolve(), { once: true });
            v.currentTime = 0;
          })
      )
    )
  );
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
});
