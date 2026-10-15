import { test, expect, type Page } from '@playwright/test';

/**
 * Mid-funnel instrumentation (marketer brief 2026-10-14 on gy-e60uc):
 *   waitlist_form_start   first field focus, ONCE per page load
 *   waitlist_submit_error reason is a closed set; no personal data in the payload
 *
 * umami is absent off production hostnames (#110), so it is stubbed to record calls. /api/waitlist is
 * stubbed too: this proves what the FORM emits, not what the server does.
 */
async function stubUmami(page: Page) {
  await page.addInitScript(() => {
    (window as any).__tracked = [];
    (window as any).umami = { track: (name: string, data: unknown) => (window as any).__tracked.push({ name, data }) };
  });
}
const tracked = (page: Page) => page.evaluate(() => (window as any).__tracked as { name: string; data?: unknown }[]);
const footer = (page: Page) => page.locator('#cta form');

test('waitlist_form_start fires once on first field focus, not on page load or on later focus', async ({ page }) => {
  await stubUmami(page);
  await page.goto('/');
  expect(await tracked(page), 'a page load alone must not count as a form start').toEqual([]);
  await footer(page).locator('input[name="name"]').focus();
  await footer(page).locator('input[name="phone"]').focus();
  await footer(page).locator('input[name="email"]').focus();
  expect((await tracked(page)).filter((e) => e.name === 'waitlist_form_start')).toEqual([
    { name: 'waitlist_form_start', data: undefined },
  ]);
});

test('an empty submit emits waitlist_submit_error missing_contact and nothing personal', async ({ page }) => {
  await stubUmami(page);
  await page.goto('/');
  await footer(page).getByRole('button', { name: 'Request access' }).click();
  const errs = (await tracked(page)).filter((e) => e.name === 'waitlist_submit_error');
  expect(errs).toEqual([{ name: 'waitlist_submit_error', data: { reason: 'missing_contact' } }]);
});

test('a malformed email emits invalid_email and the payload carries no typed value', async ({ page }) => {
  await stubUmami(page);
  await page.goto('/');
  await footer(page).locator('input[name="name"]').fill('Zed Secretname');
  await footer(page).locator('input[name="email"]').fill('zed-not-an-email');
  await footer(page).getByRole('button', { name: 'Request access' }).click();
  const all = await tracked(page);
  expect(all.filter((e) => e.name === 'waitlist_submit_error')).toEqual([
    { name: 'waitlist_submit_error', data: { reason: 'invalid_email' } },
  ]);
  expect(JSON.stringify(all), 'no typed value may appear in any event').not.toMatch(/Zed|Secretname|not-an-email/);
});

test('a 500 emits reason server; an aborted request emits reason network', async ({ page }) => {
  await stubUmami(page);
  await page.goto('/');
  const f = footer(page);
  await f.locator('input[name="phone"]').fill('9876543210');

  await page.route('**/api/waitlist', (r) => r.fulfill({ status: 500, body: '{}' }));
  await f.getByRole('button', { name: 'Request access' }).click();
  await expect(f.getByText("Couldn't send your request just now.")).toBeVisible();

  await page.unroute('**/api/waitlist');
  await page.route('**/api/waitlist', (r) => r.abort('failed'));
  await f.getByRole('button', { name: 'Request access' }).click();
  await expect.poll(async () => (await tracked(page)).filter((e) => e.name === 'waitlist_submit_error').length).toBe(2);

  expect((await tracked(page)).filter((e) => e.name === 'waitlist_submit_error').map((e) => e.data)).toEqual([
    { reason: 'server' },
    { reason: 'network' },
  ]);
});

test('a successful submit emits waitlist_signup and NO submit_error', async ({ page }) => {
  await stubUmami(page);
  await page.route('**/api/waitlist', (r) => r.fulfill({ status: 200, body: '{}' }));
  await page.goto('/');
  await footer(page).locator('input[name="phone"]').fill('9876543210');
  await footer(page).getByRole('button', { name: 'Request access' }).click();
  await expect(footer(page).getByRole('status')).toBeVisible();
  const names = (await tracked(page)).map((e) => e.name);
  expect(names).toContain('waitlist_signup');
  expect(names).not.toContain('waitlist_submit_error');
});
