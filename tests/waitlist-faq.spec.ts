import { test, expect } from '@playwright/test';
import { openWaitlistForm, IPHONE_FAQ, REVEAL, PANEL } from './helpers/waitlist';

/**
 * gy-1vd9qy.10.4 (option A): the waitlist is the SECONDARY path. Its one entry on the home page is the iPhone FAQ answer
 * ("Tell me when the iPhone app is out"), which reveals the same capture panel in place; the permanent footer form, the nav / hero /
 * gallery / pricing "Request access" buttons and the /compare/ waitlist cluster are gone. These replace the reveal-per-location cases that
 * lived in inline-waitlist.spec.ts (deleted with the CTAs they exercised); the form BEHAVIOUR tests there now open the form through
 * tests/helpers/waitlist.ts.
 */

test('the home page has exactly one waitlist CTA (the iPhone FAQ link), wired to reveal, and no permanent footer capture', async ({ page }) => {
  await page.goto('/');
  const ctas = await page.$$eval('[data-cta="waitlist"]', (els) => els.map((e) => [e.getAttribute('data-cta-location'), e.getAttribute('data-cta-behaviour')]));
  expect(ctas, 'positive control: the FAQ waitlist CTA must exist, and it is the only one').toEqual([['cta-section', 'reveal']]);
  await expect(page.locator('#cta form')).toHaveCount(0);
  await expect(page.locator('form:has(input[name="phone"])')).toHaveCount(0);
});

test('the compare page carries no waitlist CTA: its CTAs are Start free and the founder', async ({ page }) => {
  await page.goto('/compare/gymbo-vs-wellnessz/');
  await expect(page.locator('[data-cta="waitlist"]')).toHaveCount(0);
  await expect(page.locator('a[data-cta="start-free"]').first()).toBeVisible();
});

test('tapping the FAQ waitlist link reveals the capture in place WITHOUT scrolling the page (gy-becxi, kept for the one CTA left)', async ({ page }) => {
  await page.goto('/');
  const item = page.locator('details.faq', { hasText: IPHONE_FAQ }).first();
  await item.scrollIntoViewIfNeeded();
  await item.locator('summary').click();
  const cta = item.locator(REVEAL);
  await expect(cta).toBeVisible();
  await page.waitForLoadState('networkidle');
  await expect.poll(async () => { const a = await page.evaluate(() => window.scrollY); await page.waitForTimeout(200); return a === (await page.evaluate(() => window.scrollY)); }).toBe(true);
  const before = await page.evaluate(() => window.scrollY);
  await cta.click();
  const panel = page.locator(PANEL).first();
  await expect(panel.locator('input[type="email"]')).toBeVisible();
  // a focused field below the fold may nudge the page by up to the panel's own height; it must not jump to the footer
  const after = await page.evaluate(() => window.scrollY);
  const panelH = (await panel.boundingBox())?.height ?? 0;
  expect(Math.abs(after - before), 'the reveal must not chase the capture').toBeLessThanOrEqual(panelH + 320);
});

test('the revealed capture posts to /api/waitlist and confirms', async ({ page }) => {
  await page.goto('/');
  const posts: string[] = [];
  await page.route('**/api/waitlist', async (route) => { posts.push(route.request().url()); await route.fulfill({ status: 200, body: '{}' }); });
  const form = await openWaitlistForm(page);
  await form.locator('input[type="email"]').fill('gy-1vd9qy-control@example.invalid');
  await form.locator('button[type="submit"]').click();
  await expect.poll(() => posts.length).toBe(1);
  expect(new URL(posts[0]).pathname).toBe('/api/waitlist');
  await expect(page.locator(PANEL).first().getByText(/request received/i)).toBeVisible();
});

test('tapping it emits waitlist_cta_click { location: cta-section } and no signup_cta_click', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__tracked = [];
    (window as any).umami = { track: (name: string, data: unknown) => (window as any).__tracked.push({ name, data }) };
  });
  await page.goto('/');
  await openWaitlistForm(page);
  const tracked = await page.evaluate(() => (window as any).__tracked);
  expect(tracked).toContainEqual({ name: 'waitlist_cta_click', data: { location: 'cta-section' } });
  expect(tracked.filter((e: { name: string }) => e.name === 'signup_cta_click')).toEqual([]);
});

for (const [w, h] of [[360, 654], [390, 718], [412, 789], [1440, 900]] as const) {
  test(`${w}x${h}: the revealed capture fits inside the viewport width and its submit is reachable`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    const form = await openWaitlistForm(page);
    const box = (await page.locator(PANEL).first().boundingBox())!;
    expect(box.x, 'left edge inside the viewport').toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, 'right edge inside the viewport').toBeLessThanOrEqual(w + 0.5);
    const submit = form.locator('button[type="submit"]');
    await submit.scrollIntoViewIfNeeded();
    await expect(submit).toBeInViewport();
    const email = await form.locator('input[type="email"]').evaluate((el: HTMLInputElement) => {
      const cs = getComputedStyle(el);
      const ctx = document.createElement('canvas').getContext('2d')!;
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const avail = el.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      return ctx.measureText(el.placeholder).width <= avail;
    });
    expect(email, 'the email placeholder must not clip').toBe(true);
  });
}
