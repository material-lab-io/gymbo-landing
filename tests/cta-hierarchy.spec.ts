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
      if (el.closest('nav')) continue; // option A: the nav Start free pill is deliberate chrome, not counted against the per-screen rule
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

// gy-1vd9qy.10.4 (option A, designer-picked): the nav is a quiet Log in text link next to the amber Start free pill. The old "one filled amber CTA per
// viewport" rule (gy-e9h9y N1/N3) is now "one filled amber CTA per screen, NOT counting the nav Start free pill", because option A draws the nav pill
// and the hero Start free on the same first screen on purpose. The nav and gallery "Request access" outline tests and the nav reveal test went
// with those buttons (the waitlist's only entry is now the iPhone FAQ link, covered by tests/waitlist-faq.spec.ts).
test('nav: Log in is a plain text link (no fill, no border) and Start free is the amber pill, both 44px targets (option A)', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  const login = nav.locator('a[data-cta="log-in"]');
  const start = nav.locator('a[data-cta="start-free"]');
  await expect(login).toHaveCount(1);
  await expect(start).toHaveCount(1);
  const l = await login.evaluate((el) => { const cs = getComputedStyle(el); return { bg: cs.backgroundColor, border: cs.borderTopWidth, h: el.getBoundingClientRect().height }; });
  expect(l.bg, 'Log in has no fill').toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
  expect(l.border, 'Log in has no border').toBe('0px');
  expect(l.h, 'Log in keeps a 44px target').toBeGreaterThanOrEqual(43.5);
  const st = await start.evaluate((el) => ({ bg: getComputedStyle(el).backgroundColor, h: el.getBoundingClientRect().height }));
  expect(st.bg, 'Start free is filled').not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
  expect(st.h).toBeGreaterThanOrEqual(43.5);
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
    // gy-sk86p2.3 L3 (Damini 26 Nov: every Start free button is yellow) outranks the one-per-screen rule inside pricing only:
    // the two plan buttons may share a screen, and nothing else filled (the sticky bar) may join them.
    if (where === 'pricing') expect(filled.filter((f) => f !== 'start-free:pricing'), `only the two plan buttons are filled here: ${JSON.stringify(filled)}`).toEqual([]);
    else expect(filled.length, `filled amber CTAs sharing this screen: ${JSON.stringify(filled)}`).toBeLessThanOrEqual(1);
    if (where === 'top') {
      // Positive control: the count is not vacuous. The hero Start free is the one filled CTA on the first screen
      // at every width, so zero would mean the probe broke, not that the rule held.
      expect(filled, 'the hero Start free is the one filled CTA at the top (the nav pill is not counted)').toEqual(['start-free:hero']);
    }
  });
}

test('planted control: a second filled CTA on the first screen (the hero outline WhatsApp filled amber) would be caught by the same probe', async ({ page }) => {
  await page.goto('/');
  await settle(page);
  await page.evaluate(() => {
    const wa = document.querySelector('[data-cta="whatsapp"][data-cta-location="hero"]') as HTMLElement;
    wa.style.background = '#f59e0b';
  });
  const filled = await filledAmberInViewport(page);
  expect(filled, 'a filled WhatsApp next to the hero Start free must read as TWO').toEqual(expect.arrayContaining(['start-free:hero', 'whatsapp:hero']));
  expect(filled.length).toBeGreaterThan(1);
});
