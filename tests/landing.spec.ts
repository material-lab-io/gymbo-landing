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

    // Desktop nav links (use .first() to avoid mobile menu duplicates)
    const featuresLink = nav.locator('.hidden.md\\:flex a[href="#features"]');
    const pricingLink = nav.locator('.hidden.md\\:flex a[href="#pricing"]');
    await expect(featuresLink).toHaveText(/features/i);
    await expect(pricingLink).toHaveText(/pricing/i);

    // CTA button links to waitlist (desktop: inline button, mobile: in hamburger menu)
    const waitlistLinks = nav.locator('a[href="#waitlist"]');
    await expect(waitlistLinks).toHaveCount(2); // desktop + mobile menu
  });

  test('hero section has headline and CTA', async ({ page }) => {
    await page.goto('/');
    const h1 = page.locator('h1');
    await expect(h1).toContainText('run your training business');
    await expect(h1).toContainText('from one app');

    // Hero CTA points to waitlist
    const hero = page.locator('.hero');
    const heroCTA = hero.locator('a[href="#waitlist"]').first();
    await expect(heroCTA).toBeVisible();
    await expect(heroCTA).toHaveText(/join the beta/i);

    // Eyebrow
    await expect(hero.locator('.eyebrow')).toContainText(/for independent trainers/i);

    // TestFlight badge
    await expect(hero.locator('text=currently on testflight')).toBeVisible();
  });

  test('problem section has stats', async ({ page }) => {
    await page.goto('/');
    const problem = page.locator('#problem');
    await expect(problem).toBeVisible();

    // Headline
    await expect(problem.locator('h2')).toContainText(/whatsapp works/i);

    // 3 stat cards
    const statCards = problem.locator('.bg-\\[\\#242424\\]');
    await expect(statCards).toHaveCount(3);

    // Stat labels
    await expect(problem.locator('text=where the system breaks')).toBeVisible();
    await expect(problem.locator('text=hrs/week')).toBeVisible();
    await expect(problem.locator('text=per missed or double-booked session')).toBeVisible();
  });

  test('features section has 6 cards with outcome tags', async ({ page }) => {
    await page.goto('/');
    const featuresSection = page.locator('#features');
    await expect(featuresSection).toBeVisible();

    const cards = featuresSection.locator('.feature-card');
    await expect(cards).toHaveCount(6);

    // Verify card titles
    const expectedTitles = [
      'smart scheduling',
      'payment tracking',
      'client crm',
      'client insights',
      'ai assistant',
      'qr profile card',
    ];
    for (const title of expectedTitles) {
      await expect(featuresSection.locator('h3', { hasText: title })).toBeVisible();
    }

    // Outcome tags exist
    const tags = featuresSection.locator('.outcome-tag');
    await expect(tags).toHaveCount(6);
  });

  test('how-it-works has 3 steps', async ({ page }) => {
    await page.goto('/');
    const howSection = page.locator('#how');
    await expect(howSection).toBeVisible();

    // 3 step circle numbers
    const stepCircles = howSection.locator('.rounded-full.border-2');
    await expect(stepCircles).toHaveCount(3);
    await expect(stepCircles.nth(0)).toHaveText('1');
    await expect(stepCircles.nth(1)).toHaveText('2');
    await expect(stepCircles.nth(2)).toHaveText('3');

    // Step titles
    await expect(howSection.locator('h3', { hasText: 'add your clients' })).toBeVisible();
    await expect(howSection.locator('h3', { hasText: 'schedule the week' })).toBeVisible();
    await expect(howSection.locator('h3', { hasText: 'log, track, get paid' })).toBeVisible();
  });

  test('pricing section has 3 plan cards', async ({ page }) => {
    await page.goto('/');
    const pricingSection = page.locator('#pricing');
    await expect(pricingSection).toBeVisible();

    // Section headline
    await expect(pricingSection.locator('h2')).toContainText(/less than the cost/i);

    // 3 pricing cards
    const cards = pricingSection.locator('.feature-card');
    await expect(cards).toHaveCount(3);

    // Best value badge
    await expect(pricingSection.locator('text=best value')).toBeVisible();

    // Beta callout
    await expect(pricingSection.locator('text=free during beta')).toBeVisible();

    // Referral callout
    await expect(pricingSection.locator('text=refer a trainer')).toBeVisible();
  });

  test('social proof section has Sarfaraz testimonial', async ({ page }) => {
    await page.goto('/');
    const socialProof = page.locator('#social-proof');
    await expect(socialProof).toBeVisible();

    // Sarfaraz testimonial
    await expect(socialProof.locator('blockquote')).toBeVisible();
    await expect(socialProof.locator('text=sarfaraz')).toBeVisible();

    // Trust badges
    await expect(socialProof.locator('text=ios native')).toBeVisible();
    await expect(socialProof.locator('text=upi payments')).toBeVisible();
    await expect(socialProof.locator('text=built for india')).toBeVisible();
  });

  test('faq section has 6 accordion items', async ({ page }) => {
    await page.goto('/');
    const faqSection = page.locator('#faq');
    await expect(faqSection).toBeVisible();

    const items = faqSection.locator('.faq-item');
    await expect(items).toHaveCount(6);

    // Check a question is visible
    await expect(faqSection.locator('text=is gymbo only for iphone')).toBeVisible();
  });

  test('faq accordion expands on click', async ({ page }) => {
    await page.goto('/');
    // Wait for GSAP to initialize and set FAQ answers to height: 0
    await page.waitForTimeout(1000);

    const firstQuestion = page.locator('.faq-question').first();
    const firstAnswer = page.locator('.faq-answer').first();

    // Answer should be collapsed (height: 0)
    const initialHeight = await firstAnswer.evaluate(el => el.offsetHeight);
    expect(initialHeight).toBe(0);

    // Click to expand
    await firstQuestion.click();
    await page.waitForTimeout(500);

    // Answer should now be visible
    const expandedHeight = await firstAnswer.evaluate(el => el.offsetHeight);
    expect(expandedHeight).toBeGreaterThan(0);
  });

  test('final CTA section exists', async ({ page }) => {
    await page.goto('/');
    const finalCTA = page.locator('#final-cta');
    await expect(finalCTA).toBeVisible();

    await expect(finalCTA.locator('h2')).toContainText(/your clients deserve better/i);
    await expect(finalCTA.locator('a[href="#waitlist"]')).toBeVisible();
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

  test('footer has copyright, privacy, terms, and contact', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();

    await expect(footer.locator('text=© 2026 material lab')).toBeVisible();
    await expect(footer.locator('a[href="/privacy"]')).toBeVisible();
    await expect(footer.locator('a[href="/terms"]')).toBeVisible();
    await expect(footer.locator('a[href="mailto:damini@materiallab.io"]')).toBeVisible();
  });

  test('no web app references remain', async ({ page }) => {
    await page.goto('/');
    const appLinks = page.locator('a[href="https://app.getgymbo.com"]');
    await expect(appLinks).toHaveCount(0);
  });
});
