import { test, expect } from '@playwright/test';

/**
 * Smoke + Wave 3 acceptance [F] for getgymbo.com.
 * Runs on both the `desktop` and `mobile` (Pixel 5) projects (see playwright.config.ts).
 * Covers: page renders / no JS errors, nav + hero, pricing, waitlist CTA, footer,
 * plus the current static product imagery and no layout break.
 * getgymbo.com is LIGHT ONLY (gy-uesmd, founder ruling 2026-08-12) — there is
 * no global theme toggle or dark palette.
 */

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
  await expect(nav.getByText('Get Gymbo', { exact: true })).toBeVisible();

  const h1 = page.locator('h1');
  await expect(h1).toContainText(/fitness business/i);
  await expect(h1).toContainText(/from your phone/i);
});

// gy-dyu6r.6: the source/dist gate checks the approved asset allowlist; this
// test checks that the same contract actually renders and loads in a browser.
test('hero and gallery render the approved photoreal device assets', async ({ page }) => {
  await page.goto('/');
  const hero = page.getByTestId('hero-device-art').locator('img:visible');
  await expect(hero).toBeVisible();
  await expect(hero).toHaveAttribute('src', /hero-three-panel-1200\.png/);
  expect(await hero.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  const gallery = page.getByTestId('gallery-device-art').first();
  await gallery.scrollIntoViewIfNeeded();
  await expect(gallery.locator('img').last()).toHaveAttribute('src', /iphone-frame-single\.png/);
  await expect.poll(() => gallery.locator('img').first().evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  expect(await page.locator('video').count()).toBe(0);
});

test('a pre-seeded dark localStorage value is ignored — site is light only (gy-uesmd)', async ({ page }) => {
  // Regression for the founder-visible bug: gy-31moh removed the theme
  // toggle but left the no-flash script + dark palette in place, so anyone
  // with a stale gymbo-theme='dark' from before the toggle was removed got
  // stuck on a dark site with no way to escape it. Both are now deleted
  // outright — getgymbo.com never reads gymbo-theme and never sets
  // data-theme, so a pre-seeded 'dark' value must have zero effect.
  await page.addInitScript(() => localStorage.setItem('gymbo-theme', 'dark'));
  await page.goto('/');
  const html = page.locator('html');
  await expect(html).not.toHaveAttribute('data-theme', /.+/);
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(250, 250, 247)'); // --c-bg #fafaf7
});

test('pillar-organized keeps its fixed dark accent band (unrelated to page theme)', async ({ page }) => {
  // PILLARS[].dark is a per-section design constant (charcoal accent band),
  // independent of the removed global theme system — this is NOT dark mode.
  //
  // gy-k095b: this used to assert `video[data-theme-variant="dark"]` — it proved
  // the band by way of the demo clip's light/dark variant, which is gone with the
  // videos. Assert the band itself, which is what the test was ever about and
  // survives the next change to how the visual is rendered.
  await page.goto('/');
  const pillar = page.locator('[data-testid="pillar-organized"]');
  await pillar.scrollIntoViewIfNeeded();
  await expect(pillar).toBeVisible();
  await expect(pillar.locator('xpath=..')).toHaveCSS('background-color', 'rgb(10, 10, 10)'); // F.charcoal #0a0a0a
});

test('retired demo-frame badges are absent', async ({ page }) => {
  await page.goto('/');
  // gy-jaooz: "travel-aware" / "AI navigate" badges were removed from the pillar
  // demo artwork; the not-yet-shipped items now live as normal bullets with a
  // "coming soon" tag after the sentence.
  await page.locator('#why').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-coming-soon]')).toHaveCount(0);
  await expect(page.getByText(/travel-aware/i)).toHaveCount(0);
  await expect(page.getByText('coming soon')).toHaveCount(0);
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

test('gallery controls make the fourth product screen discoverable', async ({ page }) => {
  await page.goto('/');
  const gallery = page.getByRole('region', { name: 'See Gymbo in action gallery' });
  await gallery.scrollIntoViewIfNeeded();
  const previous = page.getByRole('button', { name: 'Show previous Gymbo screen' });
  const next = page.getByRole('button', { name: 'Show next Gymbo screen' });

  await expect(page.getByText('1 of 6', { exact: true })).toBeVisible();
  await expect(previous).toBeDisabled();
  for (let step = 2; step <= 4; step += 1) {
    await next.click();
    await expect(page.getByText(`${step} of 6`, { exact: true })).toBeVisible();
  }

  const workouts = gallery.locator('[data-gallery-index="3"]');
  await expect(workouts).toBeInViewport();
  await expect(workouts.getByText('Build and assign workouts', { exact: true })).toBeVisible();
  await expect(previous).toBeEnabled();
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

test('hero subheadline uses sans-serif, not the heading serif (gy-a73px.3)', async ({ page }) => {
  await page.goto('/');
  const h1 = page.locator('h1');
  const subheadline = page.locator('p', { hasText: 'Track revenue, stay organized' });
  await expect(subheadline).toBeVisible();

  const h1Family = await h1.evaluate((el) => getComputedStyle(el).fontFamily);
  const subFamily = await subheadline.evaluate((el) => getComputedStyle(el).fontFamily);

  expect(h1Family).toContain('Merriweather');
  expect(subFamily).toContain('Open Sans');
  expect(subFamily).not.toContain('Merriweather');
});
