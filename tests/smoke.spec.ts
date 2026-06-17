import { test, expect } from '@playwright/test';

/**
 * Smoke gate for the Forge redesign (gy-9bmwm.7/.8/.9).
 * Intentionally lean: page renders, no JS errors, key CTAs/links resolve,
 * pricing numbers present. The full structural Playwright rewrite is a
 * fast-follow after this ships live.
 */

// External resources that can fail in local/preview and are not our concern.
const IGNORE = [
  'analytics.getgymbo.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'favicon',
  'og-image',
  'Failed to load resource',
  'net::ERR',
];

test('page renders with no JS errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (IGNORE.some((s) => text.includes(s))) return;
    errors.push(`console: ${text}`);
  });

  await page.goto('/');
  await expect(page).toHaveTitle(/gymbo/i);
  await page.waitForTimeout(800);

  expect(errors, errors.join('\n')).toEqual([]);
});

test('nav and hero render with the headline', async ({ page }) => {
  await page.goto('/');

  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav).toBeVisible();
  await expect(nav.getByText('get gymbo', { exact: true })).toBeVisible();

  const h1 = page.locator('h1');
  await expect(h1).toContainText(/fitness business/i);
  await expect(h1).toContainText(/from your phone/i);
});

test('pricing shows the three plans and numbers', async ({ page }) => {
  await page.goto('/');
  const pricing = page.locator('#pricing');
  await pricing.scrollIntoViewIfNeeded();

  await expect(pricing.getByText('flexible', { exact: true })).toBeVisible();
  await expect(pricing.getByText('quarterly', { exact: true })).toBeVisible();
  await expect(pricing.getByText('annual', { exact: true })).toBeVisible();

  for (const amount of ['₹400', '₹300', '₹200']) {
    await expect(pricing.getByText(amount, { exact: true })).toBeVisible();
  }
});

test('waitlist CTA section and form resolve', async ({ page }) => {
  await page.goto('/');
  const cta = page.locator('#cta');
  await cta.scrollIntoViewIfNeeded();
  await expect(cta).toBeVisible();

  // waitlist email field + submit present
  await expect(cta.locator('input[type="email"]')).toBeVisible();
  await expect(cta.getByText(/talk to the founder/i)).toBeVisible();
});

test('footer present, and no web-app references remain', async ({ page }) => {
  await page.goto('/');
  const footer = page.locator('footer');
  await footer.scrollIntoViewIfNeeded();
  await expect(footer.getByText(/2026 Material Lab/i)).toBeVisible();

  await expect(page.locator('a[href="https://app.getgymbo.com"]')).toHaveCount(0);
});
