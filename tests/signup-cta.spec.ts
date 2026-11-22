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
