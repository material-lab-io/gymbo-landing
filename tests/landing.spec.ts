import { test, expect } from '@playwright/test';

test.describe('landing page', () => {

  test('page loads with correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/gymbo/i);
  });

  test('nav is visible with GYMBO logo', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav).toBeVisible();

    // GYMBO logo text
    await expect(nav.locator('text=GYMBO')).toBeVisible();

    // Join Early Access CTA
    await expect(nav.locator('text=Join Early Access').first()).toBeVisible();
  });

  test('hero has headline and screenshot', async ({ page }) => {
    await page.goto('/');
    const h1 = page.locator('h1');
    await expect(h1).toContainText('RUN');
    await expect(h1).toContainText('PHONE.');

    // Hero screenshot
    const heroImg = page.locator('img[alt="Gymbo client dashboard"]');
    await expect(heroImg).toBeVisible();
  });

  test('before and after section visible', async ({ page }) => {
    await page.goto('/');
    const problem = page.locator('#problem');
    await expect(problem).toBeVisible();

    // Before & After section title
    await expect(problem.locator('h2')).toContainText(/drop the mental load/i);

    // The Friction and The Solution labels
    await expect(problem.locator('text=The Friction')).toBeVisible();
    await expect(problem.locator('text=The Solution')).toBeVisible();
  });

  test('features section has 6 feature rows with screenshots', async ({ page }) => {
    await page.goto('/');
    const featuresSection = page.locator('#features');
    await expect(featuresSection).toBeVisible();

    // Section title
    await expect(featuresSection.locator('h2').first()).toContainText(/scale your business/i);

    // 6 feature titles
    const expectedTitles = [
      'Tap and train.',
      'Command your cash flow.',
      'Control your calendar.',
      'Command premium rates.',
      'Bill like an enterprise.',
      'Outsource the programming.',
    ];
    for (const title of expectedTitles) {
      await expect(featuresSection.locator('h3', { hasText: title })).toBeVisible();
    }

    // 6 feature screenshots
    const featureImages = featuresSection.locator('img[src^="/screens/"]');
    await expect(featureImages).toHaveCount(6);
  });

  test('pricing section has 2 plan cards', async ({ page }) => {
    await page.goto('/');
    const pricingSection = page.locator('#pricing');
    await expect(pricingSection).toBeVisible();

    // Section headline
    await expect(pricingSection.locator('h2')).toContainText(/less than the cost/i);

    // Best value badge
    await expect(pricingSection.getByText('Best value', { exact: true })).toBeVisible();

    // Plan names
    await expect(pricingSection.locator('h3', { hasText: 'Flexible' })).toBeVisible();
    await expect(pricingSection.locator('h3', { hasText: 'Annual' })).toBeVisible();
  });

  test('CTA section exists with trial button', async ({ page }) => {
    await page.goto('/');
    const cta = page.locator('#cta');
    await expect(cta).toBeVisible();

    await expect(cta.locator('h2')).toContainText(/ready to run your business/i);
    await expect(cta.locator('text=Begin Free Trial')).toBeVisible();
  });

  test('footer has copyright and contact', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();

    await expect(footer.locator('text=2026 Material Lab')).toBeVisible();
    await expect(footer.locator('a[href="mailto:damini@materiallab.io"]').first()).toBeVisible();
  });

  test('no web app references remain', async ({ page }) => {
    await page.goto('/');
    const appLinks = page.locator('a[href="https://app.getgymbo.com"]');
    await expect(appLinks).toHaveCount(0);
  });
});
