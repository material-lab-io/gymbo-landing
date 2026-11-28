import { test, expect } from '@playwright/test';

/**
 * gy-1vd9qy.10.4 / .11.1 (pm scope add 22 Nov): every Start free link on the home page fires Umami "signup_cta_click" with { position },
 * goes to the app sign-up with ?src=landing, and carries data-cta-position. waitlist_cta_click is untouched. The 6 home CTAs are
 * nav, hero, gallery, pricing-free, pricing-pro and final.
 */
const SIGNUP = 'https://app.getgymbo.com/signup?src=landing';
const POSITIONS = ['nav', 'hero', 'gallery', 'pricing-free', 'pricing-pro', 'final'];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__tracked = [];
    (window as any).umami = { track: (name: string, data: unknown) => (window as any).__tracked.push({ name, data }) };
  });
  // the click must not leave the page under test
  await page.route('https://app.getgymbo.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>app</title>' }));
});

test('the home page has exactly the 6 Start free CTAs, each with its position and the sign-up URL', async ({ page }) => {
  await page.goto('/');
  const found = await page.$$eval('a[data-cta="start-free"]', (as) => as.map((a) => [a.getAttribute('data-cta-position'), a.getAttribute('href')]));
  expect(found.map((f) => f[0]).sort()).toEqual([...POSITIONS].sort());
  for (const [, href] of found) expect(href).toBe(SIGNUP);
});

for (const position of POSITIONS) {
  test(`clicking the ${position} Start free fires signup_cta_click { position: "${position}" } and no waitlist event`, async ({ page }) => {
    await page.goto('/');
    const cta = page.locator(`a[data-cta="start-free"][data-cta-position="${position}"]`);
    await cta.scrollIntoViewIfNeeded();
    // keep the page (and its tracked list): the click handler has already run by the time this document-level listener cancels the navigation
    await page.evaluate(() => document.addEventListener('click', (e) => e.preventDefault()));
    await cta.click();
    const tracked = await page.evaluate(() => (window as any).__tracked);
    expect(tracked).toContainEqual({ name: 'signup_cta_click', data: { position } });
    expect(tracked.filter((e: { name: string }) => e.name === 'waitlist_cta_click')).toEqual([]);
  });
}

test('NEGATIVE CONTROL: without umami the click is a plain navigation and nothing throws', async ({ page }) => {
  await page.addInitScript(() => { delete (window as any).umami; });
  await page.goto('/');
  await page.locator('a[data-cta="start-free"][data-cta-position="hero"]').click();
  await expect(page).toHaveURL(/app\.getgymbo\.com\/signup/);
});

/**
 * gy-ufxgo.11 AC3: using a Start free link forwards the visitor's RESOLVED source, never a raw value. The rendered href stays the
 * bare SIGNUP (asserted above); it is rewritten when the link is used. Each test is a fresh context, so first touch is this visit.
 */
async function hrefAfterClick(page: import('@playwright/test').Page, path: string) {
  await page.goto(path);
  const cta = page.locator('a[data-cta="start-free"][data-cta-position="hero"]');
  await page.evaluate(() => document.addEventListener('click', (e) => e.preventDefault()));
  await cta.click();
  return new URL((await cta.getAttribute('href'))!);
}

test('gy-ufxgo.11: an Instagram arrival (/ig target) forwards utm_source=instagram to sign-up', async ({ page }) => {
  const url = await hrefAfterClick(page, '/?utm_source=instagram&utm_medium=social&utm_campaign=bio');
  expect(Object.fromEntries(url.searchParams)).toEqual({ src: 'landing', utm_source: 'instagram' });
});

test('gy-ufxgo.11: a visit with no signal forwards utm_source=unknown to sign-up', async ({ page }) => {
  const url = await hrefAfterClick(page, '/');
  expect(Object.fromEntries(url.searchParams)).toEqual({ src: 'landing', utm_source: 'unknown' });
});

test('gy-ufxgo.11: a referral arrival (/r/ target) forwards referral but never the code', async ({ page }) => {
  const url = await hrefAfterClick(page, '/?utm_source=referral&utm_medium=referral&utm_campaign=priya-jan');
  expect(Object.fromEntries(url.searchParams)).toEqual({ src: 'landing', utm_source: 'referral', utm_medium: 'referral' });
  expect(url.toString()).not.toContain('priya-jan');
});

test('gy-ufxgo.11: a name in utm_source is never carried to sign-up', async ({ page }) => {
  const url = await hrefAfterClick(page, '/?utm_source=damini-rathi');
  expect(url.searchParams.get('utm_source')).toBe('unknown');
  expect(url.toString()).not.toContain('damini');
});
