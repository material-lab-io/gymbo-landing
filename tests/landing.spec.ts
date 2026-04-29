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

    // CTA button links to waitlist (not web app)
    const ctaLink = nav.locator('a[href="#waitlist"]');
    await expect(ctaLink).toBeVisible();
    await expect(ctaLink).toHaveText(/join the beta/i);
  });

  test('hero section has headline and CTA', async ({ page }) => {
    await page.goto('/');
    const h1 = page.locator('h1');
    await expect(h1).toContainText('your gym');
    await expect(h1).toContainText('your rules');

    // Hero CTA points to waitlist
    const heroCTA = page.locator('section').first().locator('a[href="#waitlist"]');
    await expect(heroCTA).toBeVisible();
    await expect(heroCTA).toHaveText(/join the beta/i);
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

  test('mobile apps section: iOS active, Android greyed', async ({ page }) => {
    await page.goto('/');
    const mobileSection = page.locator('#mobile');
    await expect(mobileSection).toBeVisible();

    // Only Android badge should be greyed out (opacity-40)
    const greyedBadges = mobileSection.locator('.opacity-40');
    await expect(greyedBadges).toHaveCount(1);

    // iOS badge is an active link to #waitlist
    const iosBadge = mobileSection.locator('a[href="#waitlist"]');
    await expect(iosBadge).toBeVisible();

    await expect(mobileSection.locator('text=google play')).toBeVisible();
    await expect(mobileSection.locator('text=app store')).toBeVisible();
  });

  test('footer has copyright, privacy, terms, and beta link', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();

    await expect(footer.locator('text=© 2026 gymbo')).toBeVisible();
    await expect(footer.locator('a[href="/privacy"]')).toBeVisible();
    await expect(footer.locator('a[href="/terms"]')).toBeVisible();
    await expect(footer.locator('a[href="#waitlist"]')).toBeVisible();

    // No web app link
    await expect(footer.locator('a[href="https://app.getgymbo.com"]')).toHaveCount(0);
  });

  test('social proof section has testimonial', async ({ page }) => {
    await page.goto('/');
    const socialProof = page.locator('#social-proof');
    await expect(socialProof).toBeVisible();

    // Tiger testimonial
    await expect(socialProof.locator('blockquote')).toBeVisible();
    await expect(socialProof.locator('text=tiger')).toBeVisible();
  });

  test('waitlist form exists with required fields', async ({ page }) => {
    await page.goto('/');
    const waitlistSection = page.locator('#waitlist');
    await expect(waitlistSection).toBeVisible();

    const form = waitlistSection.locator('form#waitlist-form');
    await expect(form).toBeVisible();

    // Required fields
    await expect(form.locator('input[name="name"]')).toBeVisible();
    await expect(form.locator('input[name="email"]')).toBeVisible();
    await expect(form.locator('input[name="phone"]')).toBeVisible();
    await expect(form.locator('button[type="submit"]')).toBeVisible();
  });

  test('waitlist form submit shows confirmation', async ({ page }) => {
    await page.goto('/');
    const form = page.locator('form#waitlist-form');

    // Fill in form
    await form.locator('input[name="name"]').fill('test trainer');
    await form.locator('input[name="email"]').fill('test@example.com');

    // Submit — no Supabase key so graceful degradation shows success
    await form.locator('button[type="submit"]').click();

    // Form should hide, success message should show
    await expect(form).toBeHidden();
    await expect(page.locator('#waitlist-success')).toBeVisible();
  });

  test('no web app references remain', async ({ page }) => {
    await page.goto('/');
    // Ensure no links to app.getgymbo.com exist
    const appLinks = page.locator('a[href="https://app.getgymbo.com"]');
    await expect(appLinks).toHaveCount(0);
  });
});
