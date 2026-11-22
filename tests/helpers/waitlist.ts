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
  await trigger.click();
  const form = page.locator(PANEL).first().locator('form');
  await expect(form).toBeVisible();
  return form;
}
