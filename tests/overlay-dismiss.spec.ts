import { test, expect, type Page } from '@playwright/test';

/**
 * gy-w77x3 B1 + B2 -- the two OVERLAY waitlist panels (nav, sticky bar) can be
 * closed, closing returns focus to the opener, and the sticky bar never shows
 * two "Request access" buttons at once.
 *
 * designer's FAIL at 11a0c5ce9: an overlay, once opened, could never be
 * dismissed (InlineWaitlist's state only went false -> true), and the open
 * sticky panel showed the panel's submit and the bar's pill ~20px apart, where
 * the one a thumb hit first did not submit.
 *
 * 🔴 EACH ASSERTION NAMES THE BROKEN STATE IT DISTINGUISHES, because "a panel
 * closed" is also true of a page that reloaded, and "something has focus" is
 * also true of <body>:
 *  - B1 counts buttons INSIDE THE FIXED BAR, so an off-screen pricing button
 *    with the same label cannot satisfy or fail it.
 *  - B2c asserts the focused element IS the opener, matches :focus-visible,
 *    AND has a ring actually DRAWN (computed outline, >= 2px). The third arm
 *    exists because the first capture round showed :focus-visible true with
 *    nothing on screen: the Tailwind ring is a box-shadow and the CTA's inline
 *    elevation shadow overwrote it. The state was right and the pixels were not.
 *    A dismiss that drops focus to <body> fails the first; a focus() on a node
 *    that had not rendered yet (the B1 ordering trap) leaves focus on <body>
 *    too, so it fails the same way rather than passing silently.
 * Mutation-checked before commit: see the gy-w77x3 bead comment for the arms.
 */

const CTA = (loc: string) => `[data-cta="waitlist"][data-cta-location="${loc}"]`;
const PANEL = '[role="group"][aria-label="Request access"]';
const CLOSE = '[data-waitlist-close]';
// 44px target, read from the rendered box. The half pixel is sub-pixel layout
// arithmetic (measured: 43.99999 on /compare at desktop), not a smaller button:
// the regression this guards is the 40px gallery size (h-10), which still fails.
const MIN_TARGET = 43.5;

async function openSticky(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // The bar slides in once the hero is scrolled past; scroll a screen and wait
  // for its transform to settle rather than guessing a delay.
  await page.evaluate(() => window.scrollTo(0, 1600));
  const bar = page.locator('[data-fixed-chrome="sticky-cta"]');
  await expect
    .poll(() => bar.evaluate((el) => getComputedStyle(el).transform), { timeout: 5_000 })
    .toMatch(/matrix\(1, 0, 0, 1, 0, 0\)|none/);
  await bar.locator(CTA('footer')).click();
  await expect(bar.locator(PANEL)).toBeVisible();
  return bar;
}

async function openNav(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  const nav = page.locator('nav').filter({ has: page.locator(CTA('nav')) }).first();
  await nav.locator(CTA('nav')).click();
  await expect(nav.locator(PANEL)).toBeVisible();
  return nav;
}

test.describe('sticky bar (phone only)', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) >= 768, 'the sticky bar is md:hidden');

  test('B1: while the sticky panel is open, the bar holds exactly one "Request access", and it submits', async ({ page }) => {
    const bar = await openSticky(page);
    const labelled = bar.getByRole('button', { name: 'Request access', exact: true });
    await expect(labelled, 'exactly one Request access inside the open bar').toHaveCount(1);
    expect(
      await labelled.evaluate((b) => (b as HTMLButtonElement).type === 'submit' && !!b.closest('form')),
      'the one remaining Request access must be the form submit, not the trigger pill',
    ).toBe(true);
    // Unmounted, not hidden: a visually hidden pill is still a button to a
    // screen reader, and designer's B1 counts the rendered page.
    await expect(bar.locator(CTA('footer')), 'the trigger pill must not be in the DOM while open').toHaveCount(0);
  });

  test('B2a + B2c: the sticky panel closes from its control and from Escape, and focus lands on the RE-RENDERED pill', async ({ page }) => {
    let bar = await openSticky(page);
    const close = bar.locator(CLOSE);
    await expect(close).toHaveAccessibleName('Close');
    const box = (await close.boundingBox())!;
    expect(box.width, 'close target width').toBeGreaterThanOrEqual(MIN_TARGET);
    expect(box.height, 'close target height').toBeGreaterThanOrEqual(MIN_TARGET);
    await close.click();
    await expect(bar.locator(PANEL)).toHaveCount(0);
    await expect(bar.locator(CTA('footer')), 'the pill comes back after close').toHaveCount(1);

    // Keyboard arm, the one E9f captures: Escape from inside the panel.
    bar = await openSticky(page);
    await page.keyboard.press('Escape');
    await expect(bar.locator(PANEL)).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return 'none';
        const cs = getComputedStyle(el);
        const drawn = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2;
        return `${el.getAttribute('data-cta-location')}|${el.matches(':focus-visible')}|ring=${drawn}`;
      }))
      .toBe('footer|true|ring=true');
  });
});

for (const url of ['/', '/compare/gymbo-vs-wellnessz/']) {
  test(`B2a + B2c: the nav panel on ${url} closes from its control and from Escape, focus returns to the nav button`, async ({ page }) => {
    let nav = await openNav(page, url);
    const close = nav.locator(CLOSE);
    await expect(close).toHaveAccessibleName('Close');
    const box = (await close.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(MIN_TARGET);
    expect(box.height).toBeGreaterThanOrEqual(MIN_TARGET);
    await close.click();
    await expect(nav.locator(PANEL)).toHaveCount(0);

    nav = await openNav(page, url);
    await page.keyboard.press('Escape');
    await expect(nav.locator(PANEL)).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return 'none';
        const cs = getComputedStyle(el);
        const drawn = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2;
        return `${el.getAttribute('data-cta-location')}|${el.matches(':focus-visible')}|ring=${drawn}`;
      }))
      .toBe('nav|true|ring=true');
  });
}

test('B2a: the INLINE panels (hero, gallery, pricing) have no close control -- they scroll away with the page', async ({ page }) => {
  const checked: string[] = [];
  for (const loc of ['hero', 'gallery', 'pricing']) {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const cta = page.locator(CTA(loc)).first();
    await cta.scrollIntoViewIfNeeded();
    await cta.click();
    // One reveal per fresh page load, so the only open panel is this one.
    const panel = page.locator(PANEL).first();
    await expect(panel, `${loc}: positive control -- the panel must actually be open`).toBeVisible();
    await expect(page.locator(CLOSE), `${loc}: an inline panel must not carry a close control`).toHaveCount(0);
    checked.push(loc);
  }
  expect(checked).toEqual(['hero', 'gallery', 'pricing']);
});
