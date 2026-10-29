import { test, expect, type Page } from '@playwright/test';

/**
 * gy-e9h9y N1 + N2 + N3 (designer ruling + pm scope OK, 29 Oct): the CTA hierarchy holds per SCREEN.
 *
 * The rule: at most ONE filled amber CTA in any viewport, and on a page whose primary conversion is
 * WhatsApp the filled one is never the waitlist when a WhatsApp CTA can hold the spot.
 *   N1  the nav "Request access" is the secondary (outline) visual, same 44px target
 *   N2  the phone sticky bar is the WhatsApp primary: a real <a target=_blank>, whatsapp_cta_click,
 *       hidden while the cta-section is in view
 *   N3  the gallery "Request access" is the secondary visual
 *   N4  pricing tier buttons STAY filled (a plan choice, not page chrome)   -- excluded below
 *   N5  the cta-section form submit STAYS filled (the submit of the form you are filling)
 *       -- it is a plain <button type=submit>, carries no data-cta, so it is not counted below
 *
 * 🔴 WHAT THIS GUARDS THAT NOTHING ELSE DOES: the per-screen rule. Each CTA looks right on its own;
 * the failure designer found was only visible by counting what shares a screen (nav + sticky bar +
 * form submit were all filled on one phone screen). So the count is taken per viewport at several
 * scroll positions, not per component.
 */

const WA_HREF = /^https:\/\/wa\.me\/918050131733\b/;

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 768;

/**
 * Count the visible, in-viewport [data-cta] controls with a filled amber/marigold background.
 * Pricing cards are excluded (N4, a plan card's own action) EXCEPT when the pricing section is the
 * screen being read: there the Monthly card's filled button is one of the filled CTAs sharing the
 * screen, and the sticky bar must not be a second (designer P1 on #316, 393 pricing).
 */
async function filledAmberInViewport(page: Page, { includePricing = false } = {}): Promise<string[]> {
  return page.evaluate((includePricing) => {
    const out: string[] = [];
    for (const el of document.querySelectorAll('[data-cta]')) {
      if (!includePricing && el.getAttribute('data-cta-location') === 'pricing') continue;
      const r = el.getBoundingClientRect();
      const inView = r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
      if (!inView) continue;
      const m = getComputedStyle(el).backgroundColor.match(/\d+(\.\d+)?/g);
      if (!m) continue;
      const [rr, g, b, a = '1'] = m.map(Number);
      // amber #f59e0b (245,158,11) and marigold #fbbf24 (251,191,36): high red, mid-high green, low blue.
      if (Number(a) > 0.5 && rr >= 230 && g >= 140 && b <= 60) out.push(`${el.getAttribute('data-cta')}:${el.getAttribute('data-cta-location')}`);
    }
    return out;
  }, includePricing);
}

async function settle(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500); // the bar's 300ms slide
}

for (const loc of ['nav', 'gallery'] as const) {
  test(`${loc} "Request access" is the secondary (outline) visual, not a filled amber (gy-e9h9y ${loc === 'nav' ? 'N1' : 'N3'})`, async ({ page }) => {
    await page.goto('/');
    const cta = page.locator(`[data-cta="waitlist"][data-cta-location="${loc}"]`).first();
    await cta.scrollIntoViewIfNeeded();
    const s = await cta.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        bg: cs.backgroundColor,
        border: cs.borderTopWidth,
        weight: cs.fontWeight,
        height: el.getBoundingClientRect().height,
        arrow: !!el.querySelector('svg'),
      };
    });
    expect(s.bg, `${loc}: transparent background`).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    expect(s.border, `${loc}: 1px border`).toBe('1px');
    expect(s.weight, `${loc}: weight 500, no arrow`).toBe('500');
    expect(s.arrow, `${loc}: the arrow stays on the primary only`).toBe(false);
    if (loc === 'nav') expect(s.height, 'nav: same 44px target as before').toBeGreaterThanOrEqual(43.5);
  });
}

test('the nav "Request access" still reveals the capture and tracks waitlist_cta_click{nav} (N1 changed the look, not the behaviour)', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__tracked = [];
    (window as any).umami = { track: (name: string, data: unknown) => (window as any).__tracked.push({ name, data }) };
  });
  await page.goto('/');
  await page.locator('[data-cta="waitlist"][data-cta-location="nav"]').click();
  await expect(page.locator('[role="group"][aria-label="Request access"]').first()).toBeVisible();
  const tracked = (await page.evaluate(() => (window as any).__tracked)).filter((e: { name: string }) => e.name === 'waitlist_cta_click');
  expect(tracked).toContainEqual({ name: 'waitlist_cta_click', data: { location: 'nav' } });
});

test.describe('phone sticky bar is the WhatsApp primary (N2)', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) >= 768, 'the sticky bar is md:hidden');

  test('past the hero the bar is a real wa.me link in a new tab, with no waitlist control inside', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, 1600));
    await settle(page);
    const bar = page.locator('[data-fixed-chrome="sticky-cta"]');
    const link = bar.locator('a[data-cta="whatsapp"][data-cta-location="footer"]');
    await expect(link, 'positive control: the bar carries the WhatsApp link').toHaveCount(1);
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', WA_HREF);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
    await expect(bar.locator('[data-cta="waitlist"]'), 'the bar no longer hosts the waitlist').toHaveCount(0);
    await expect(bar.locator('form')).toHaveCount(0);
  });

  test('tapping the bar opens WhatsApp in a new tab and fires whatsapp_cta_click{footer} before navigating', async ({ page, context }) => {
    await context.route(/wa\.me|whatsapp\.com/i, (r) => r.abort());
    await page.addInitScript(() => {
      (window as any).__tracked = [];
      (window as any).umami = { track: (name: string, data: unknown) => (window as any).__tracked.push({ name, data }) };
    });
    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, 1600));
    await settle(page);
    const popup = context.waitForEvent('page');
    await page.locator('[data-fixed-chrome="sticky-cta"] a[data-cta="whatsapp"]').click();
    await popup; // a NEW tab, not a same-tab navigation away
    const tracked = (await page.evaluate(() => (window as any).__tracked)).filter((e: { name: string }) => e.name === 'whatsapp_cta_click');
    expect(tracked).toContainEqual({ name: 'whatsapp_cta_click', data: { location: 'footer' } });
  });

  test('the bar is off-screen at the top of the page and again while the cta-section is in view', async ({ page }) => {
    await page.goto('/');
    await settle(page);
    const bar = page.locator('[data-fixed-chrome="sticky-cta"]');
    const vh = page.viewportSize()!.height;
    const offscreen = async () => (await bar.boundingBox())!.y >= vh - 1;
    expect(await offscreen(), 'hidden while the hero pair is in view').toBe(true);

    await page.evaluate(() => window.scrollTo(0, 1600));
    await settle(page);
    expect(await offscreen(), 'positive control: the bar IS shown mid-page').toBe(false);

    // gy-e9h9y designer P1 on #316: a plan choice is not the moment to push a different conversion, and
    // the amber bar over the full-amber Annual card loses its edge. Hidden while pricing is in view too.
    await page.evaluate(() => document.getElementById('pricing')!.scrollIntoView({ block: 'start' }));
    await settle(page);
    expect(await offscreen(), 'hidden while the pricing section is in view').toBe(true);

    await page.locator('#cta').scrollIntoViewIfNeeded();
    await page.evaluate(() => document.getElementById('cta')!.scrollIntoView({ block: 'start' }));
    await settle(page);
    expect(await offscreen(), 'hidden while the cta-section (its own WhatsApp link + the form) is in view').toBe(true);
  });
});

for (const where of ['top', 'middle', 'pricing', 'closing section'] as const) {
  test(`at most one filled amber CTA in the viewport: ${where} (gy-e9h9y per-screen rule)`, async ({ page }) => {
    await page.goto('/');
    await settle(page);
    if (where === 'middle') await page.evaluate(() => window.scrollTo(0, Math.floor(document.documentElement.scrollHeight / 2)));
    if (where === 'pricing') await page.evaluate(() => document.getElementById('pricing')!.scrollIntoView({ block: 'start' }));
    if (where === 'closing section') await page.evaluate(() => document.getElementById('cta')!.scrollIntoView({ block: 'start' }));
    await settle(page);
    const filled = await filledAmberInViewport(page, { includePricing: where === 'pricing' });
    expect(filled.length, `filled amber CTAs sharing this screen: ${JSON.stringify(filled)}`).toBeLessThanOrEqual(1);
    if (where === 'top') {
      // Positive control: the count is not vacuous. The hero WhatsApp primary is the one filled CTA on the first screen
      // at every width, so zero would mean the probe broke, not that the rule held.
      expect(filled, 'the hero WhatsApp primary is the one filled CTA at the top').toEqual(['whatsapp:hero']);
    }
  });
}

test('planted control: the old arrangement (nav + sticky bar + gallery all filled) would be caught by the same probe', async ({ page }) => {
  await page.goto('/');
  await settle(page);
  // Re-create the pre-N1/N2/N3 state in the DOM: fill the nav CTA amber, as it was.
  await page.evaluate(() => {
    const nav = document.querySelector('[data-cta="waitlist"][data-cta-location="nav"]') as HTMLElement;
    nav.style.background = '#f59e0b';
  });
  const filled = await filledAmberInViewport(page);
  expect(filled, 'a filled nav next to the hero WhatsApp primary must read as TWO').toEqual(expect.arrayContaining(['waitlist:nav', 'whatsapp:hero']));
  expect(filled.length).toBeGreaterThan(1);
});
