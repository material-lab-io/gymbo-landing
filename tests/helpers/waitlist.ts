import { expect, type Locator, type Page } from '@playwright/test';

/**
 * gy-1vd9qy.10.4 (option A): the waitlist capture is no longer a permanent footer form. Its one home is the iPhone FAQ answer
 * ("Is there an iPhone app?" -> "Tell me when the iPhone app is out"), which reveals the same capture panel in place. Specs that test the
 * FORM's behaviour (shape errors, focus, a11y, funnel events) open it here and get the form locator back.
 */
export const IPHONE_FAQ = 'Is there an iPhone app?';
export const REVEAL = '[data-cta="waitlist"][data-cta-location="cta-section"]';
export const PANEL = '[role="group"][aria-label="Request access"]';

export async function openWaitlistForm(page: Page): Promise<Locator> {
  await page.waitForLoadState('domcontentloaded');
  const item = page.locator('details.faq', { hasText: IPHONE_FAQ }).first();
  await item.scrollIntoViewIfNeeded();
  if (!(await item.evaluate((el) => (el as HTMLDetailsElement).open))) await item.locator('summary').click();
  const trigger = item.locator(REVEAL);
  await expect(trigger).toBeVisible();
  const form = page.locator(PANEL).first().locator('form');
  // The tap can land before React has hydrated the button (a loaded runner): retry the tap until the panel is up instead of failing on the first miss.
  await expect(async () => {
    if (!(await form.isVisible())) await trigger.click();
    await expect(form).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
  return form;
}
