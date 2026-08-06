import { test, expect } from '@playwright/test';

/**
 * Smoke + Wave 3 acceptance [F] for getgymbo.com.
 * Runs on both the `desktop` and `mobile` (Pixel 5) projects (see playwright.config.ts).
 * Covers: page renders / no JS errors, nav + hero, pricing, waitlist CTA, footer,
 * AND Wave 3: demo videos present, theme toggle swaps theme + clip variant,
 * coming-soon overlays render, no layout break.
 */

const IGNORE = [
  'analytics.getgymbo.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'favicon',
  'og-image',
  'hero-demo.mp4', // stand-in clip may 416/range-fail under preview; not a code error
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
  await expect(nav.getByText('Get Gymbo', { exact: true })).toBeVisible();

  const h1 = page.locator('h1');
  await expect(h1).toContainText(/fitness business/i);
  await expect(h1).toContainText(/from your phone/i);
});

test('demo videos play inside device frames', async ({ page }) => {
  await page.goto('/');
  // hero demo is above the fold → its video mounts (lazy IntersectionObserver)
  await expect(page.locator('video').first()).toBeVisible();
  const v = page.locator('video').first();
  await expect(v).toHaveJSProperty('muted', true);
  await expect(v).toHaveJSProperty('loop', true);
});

test('theme toggle swaps theme and demo variant', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'light');

  await expect(page.locator('video[data-theme-variant="light"]').first()).toBeVisible();

  await page.locator('[data-theme-toggle]').click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('video[data-theme-variant="dark"]').first()).toBeVisible();
});

test('coming-soon bullets render inline, not as demo-frame badges', async ({ page }) => {
  await page.goto('/');
  // gy-jaooz: "travel-aware" / "AI navigate" badges were removed from the pillar
  // demo artwork; the not-yet-shipped items now live as normal bullets with a
  // "coming soon" tag after the sentence.
  await page.locator('#why').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-coming-soon]')).toHaveCount(0);
  await expect(page.getByText(/travel-aware/i)).toHaveCount(0);
  await expect(page.getByText('coming soon').first()).toBeVisible();
});

test('pricing shows the two plans and numbers', async ({ page }) => {
  await page.goto('/');
  const pricing = page.locator('#pricing');
  await pricing.scrollIntoViewIfNeeded();
  await expect(pricing.getByText('Monthly', { exact: true })).toBeVisible();
  await expect(pricing.getByText('Annual', { exact: true })).toBeVisible();
  // Quarterly was dropped in the 2026-07-18 founder pricing lock.
  await expect(pricing.getByText('Quarterly', { exact: true })).toHaveCount(0);
  for (const amount of ['₹399', '₹250']) {
    await expect(pricing.getByText(amount, { exact: true })).toBeVisible();
  }
});

test('waitlist CTA section and form resolve', async ({ page }) => {
  await page.goto('/');
  const cta = page.locator('#cta');
  await cta.scrollIntoViewIfNeeded();
  await expect(cta).toBeVisible();
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
