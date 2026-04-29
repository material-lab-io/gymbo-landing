import { test, expect } from '@playwright/test';

test.describe('visual regression', () => {

  test('full page — desktop', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'desktop only');
    await page.goto('/');
    // Wait for GSAP animations to settle
    await page.waitForTimeout(2000);
    await expect(page).toHaveScreenshot('full-page-desktop.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });

  test('full page — mobile', async ({ page }) => {
    test.skip(test.info().project.name !== 'mobile', 'mobile only');
    await page.goto('/');
    await page.waitForTimeout(2000);
    await expect(page).toHaveScreenshot('full-page-mobile.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });

  test('hero section — desktop', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'desktop only');
    await page.goto('/');
    await page.waitForTimeout(2000);
    const hero = page.locator('section').first();
    await expect(hero).toHaveScreenshot('hero-desktop.png', {
      maxDiffPixelRatio: 0.01,
    });
  });

  test('features grid — desktop', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'desktop only');
    await page.goto('/');
    await page.waitForTimeout(1000);
    const features = page.locator('#features');
    await features.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    await expect(features).toHaveScreenshot('features-desktop.png', {
      maxDiffPixelRatio: 0.03,
    });
  });
});
