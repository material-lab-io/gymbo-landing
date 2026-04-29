import { test, expect } from '@playwright/test';

test.describe('landing page', () => {

  test('page loads with correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/gymbo/i);
  });

  test('nav is visible with correct links', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();

    // Desktop nav links
    const featuresLink = nav.locator('a[href="#features"]');
    const howLink = nav.locator('a[href="#how"]');
    await expect(featuresLink).toHaveText(/features/i);
    await expect(howLink).toHaveText(/how it works/i);

    // CTA button links to web app
    const ctaLink = nav.locator('a[href="https://app.getgymbo.com"]');
    await expect(ctaLink).toBeVisible();
  });

  test('hero section has headline and CTA', async ({ page }) => {
    await page.goto('/');
    const h1 = page.locator('h1');
    await expect(h1).toContainText('your gym');
    await expect(h1).toContainText('your rules');

    // Hero CTA points to app
    const heroCTA = page.locator('section').first().locator('a[href="https://app.getgymbo.com"]');
    await expect(heroCTA).toBeVisible();
  });

  test('features section has 6 cards', async ({ page }) => {
    await page.goto('/');
    const featuresSection = page.locator('#features');
    await expect(featuresSection).toBeVisible();

    const cards = featuresSection.locator('.feature-card');
    await expect(cards).toHaveCount(6);

    // Verify card titles
    const expectedTitles = [
      'punch cards',
      'balances & billing',
      'payments',
      'ai assistant',
      'schedule',
      'coach profile',
    ];
    for (const title of expectedTitles) {
      await expect(featuresSection.locator('h3', { hasText: title })).toBeVisible();
    }
  });

  test('how-it-works has 3 steps', async ({ page }) => {
    await page.goto('/');
    const howSection = page.locator('#how');
    await expect(howSection).toBeVisible();

    // 3 step numbers
    await expect(howSection.locator('text=01')).toBeVisible();
    await expect(howSection.locator('text=02')).toBeVisible();
    await expect(howSection.locator('text=03')).toBeVisible();

    // Step titles
    await expect(howSection.locator('h3', { hasText: 'add your clients' })).toBeVisible();
    await expect(howSection.locator('h3', { hasText: 'log sessions' })).toBeVisible();
    await expect(howSection.locator('h3', { hasText: 'get paid' })).toBeVisible();
  });

  test('mobile apps section shows greyed-out badges', async ({ page }) => {
    await page.goto('/');
    const mobileSection = page.locator('#mobile');
    await expect(mobileSection).toBeVisible();

    // Badges should have opacity-40 (greyed out)
    const badges = mobileSection.locator('.opacity-40');
    await expect(badges).toHaveCount(2);

    await expect(mobileSection.locator('text=google play')).toBeVisible();
    await expect(mobileSection.locator('text=app store')).toBeVisible();
  });

  test('footer has copyright, privacy, terms, and app link', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();

    await expect(footer.locator('text=© 2026 gymbo')).toBeVisible();
    await expect(footer.locator('a[href="/privacy"]')).toBeVisible();
    await expect(footer.locator('a[href="/terms"]')).toBeVisible();
    await expect(footer.locator('a[href="https://app.getgymbo.com"]')).toBeVisible();
  });

  test('social proof section has testimonial', async ({ page }) => {
    await page.goto('/');
    const socialProof = page.locator('#social-proof');
    await expect(socialProof).toBeVisible();

    // Tiger testimonial
    await expect(socialProof.locator('blockquote')).toBeVisible();
    await expect(socialProof.locator('text=tiger')).toBeVisible();
  });

  test('bottom CTA section exists', async ({ page }) => {
    await page.goto('/');
    const ctaSection = page.locator('#try');
    await expect(ctaSection).toBeVisible();
    await expect(ctaSection.locator('a[href="https://app.getgymbo.com"]')).toBeVisible();
  });
});
