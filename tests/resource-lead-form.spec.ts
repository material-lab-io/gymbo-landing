import { test, expect } from '@playwright/test';

/**
 * gy-hqvr4 — the Resource 1 (Workout Builder Starter Pack) capture form.
 *
 * Route-stubs POST /api/resource-lead rather than hitting the real RPC (no prod write, per
 * gy-hqvr4 AC5/AC6 — no live/test send is authorized by that bead). This file proves the
 * CLIENT's contract: it sends the shape functions/api/resource-lead.js expects, and it treats
 * `access_granted !== true` as a refusal even on a 2xx response — the same rule the server
 * itself enforces (gy-p3ebo AC3's "the gate is the server's answer, never the request's").
 *
 * NOT covered here, left for tester/AC6: a real backend-outage distinct from a validation
 * refusal, and the server-side consent/attribution negative controls, which live in
 * tests/resource-lead.test.mjs against the handler itself.
 */

const PAGE = '/resources/workout-builder-starter-pack/';

test('refuses a malformed email without calling the API', async ({ page }) => {
  let called = false;
  await page.route('**/api/resource-lead', (route) => {
    called = true;
    route.fulfill({ status: 200, body: '{}' });
  });

  await page.goto(PAGE);
  await page.getByLabel('Your email').fill('not-an-email');
  await page.getByRole('button', { name: 'Send me the starter pack' }).click();

  await expect(page.getByRole('alert')).toHaveText(/doesn't look right/);
  expect(called).toBe(false);
});

test('refuses submit when delivery consent is unchecked, and names the fix', async ({ page }) => {
  let called = false;
  await page.route('**/api/resource-lead', (route) => {
    called = true;
    route.fulfill({ status: 200, body: '{}' });
  });

  await page.goto(PAGE);
  await page.getByLabel('Your email').fill('trainer@example.invalid');
  // Delivery consent checkbox left unticked on purpose.
  await page.getByRole('button', { name: 'Send me the starter pack' }).click();

  await expect(page.getByRole('alert')).toHaveText(/check the box/);
  expect(called).toBe(false);
});

test('a 2xx response with access_granted !== true is treated as a refusal, not success', async ({ page }) => {
  await page.route('**/api/resource-lead', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, resource_lead_id: 'x', access_granted: false }) }),
  );

  await page.goto(PAGE);
  await page.getByLabel('Your email').fill('trainer@example.invalid');
  await page.getByLabel(/I consent to Gymbo sending/).check();
  await page.getByRole('button', { name: 'Send me the starter pack' }).click();

  // The error state's mailto fallback is the tell that this did NOT read as success.
  await expect(page.getByRole('alert')).toContainText('damini@materiallab.io');
});

test('a consented valid submission sends the exact contract and shows the success state', async ({ page }) => {
  let sentBody: Record<string, unknown> | null = null;
  await page.route('**/api/resource-lead', (route) => {
    sentBody = route.request().postDataJSON();
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, resource_lead_id: 'rl_test', access_granted: true }) });
  });

  await page.goto(PAGE);
  await page.getByLabel('Your email').fill('trainer@example.invalid');
  await page.getByLabel(/I consent to Gymbo sending/).check();
  await page.getByRole('button', { name: 'Send me the starter pack' }).click();

  await expect(page.getByRole('status')).toContainText('Check your email');

  expect(sentBody).not.toBeNull();
  expect(sentBody!.resource_id).toBe('workout-builder-starter-pack');
  expect(sentBody!.email).toBe('trainer@example.invalid');
  expect(sentBody!.delivery_consent).toBe(true);
  expect(sentBody!.delivery_consent_notice_version).toBeTruthy();
  // Marketing consent is unchecked by default (gy-p3ebo AC7): absent/false, never implied true.
  expect(sentBody!.marketing_consent).toBe(false);
  // v1 is email-only (marketer AC8, 2026-09-22) — no name field is ever sent.
  expect(sentBody!.name).toBeUndefined();
});
