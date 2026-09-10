import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/** Walk the checkout for .html files without adding a dependency. */
function htmlFiles(dir = '.'): string[] {
  const skip = new Set(['node_modules', 'dist', 'build', '.git', 'test-results', 'playwright-report']);
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...htmlFiles(full));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

/**
 * gy-kzfg9 — the production Umami tracker must never fire off getgymbo.com.
 *
 * WHAT WENT WRONG. The tracking tag carried no `data-domains`, so it fired on
 * every hostname — including the `npm run preview` server THIS TEST SUITE spins
 * up on localhost. Over 2026-08-07..09-06 that put 10,985 events into production
 * analytics against 409 real ones: 96.4% of all recorded pageviews were our own
 * CI and local runs. The founder's daily report published those numbers.
 *
 * The fingerprint was unambiguous once the raw events were read rather than the
 * aggregates: hostname localhost/127.0.0.1, one urlPath (/), and an even split
 * between the two viewports this config declares (1280x800 and 375x812).
 *
 * WHY A BEHAVIOURAL TEST AND NOT ONLY A GREP. Asserting the attribute is present
 * only proves someone typed it. The second test proves the tracker actually stays
 * silent on localhost, and its POSITIVE CONTROL proves the test could have caught
 * a regression — an absence with no positive control is not evidence.
 */

const PROD_HOSTS = ['getgymbo.com', 'www.getgymbo.com'];
const SEND_URL = /analytics\.getgymbo\.com\/api\/send/;

test('every Umami tag is scoped to the production hostnames', () => {
  const files = htmlFiles().filter((f) =>
    readFileSync(f, 'utf8').includes('analytics.getgymbo.com/script.js'));

  expect(files.length, 'no tracked HTML found — the glob is wrong, not the site').toBeGreaterThan(0);

  for (const file of files) {
    const tag = readFileSync(file, 'utf8').match(/<script[^>]*analytics\.getgymbo\.com[^>]*>/);
    expect(tag, `${file}: tracking tag not matched`).not.toBeNull();
    const domains = tag![0].match(/data-domains="([^"]*)"/);
    expect(domains, `${file}: tracking tag has no data-domains, so it fires on localhost`).not.toBeNull();
    const list = domains![1].split(',').map((s) => s.trim());
    expect(list.sort()).toEqual([...PROD_HOSTS].sort());
  }
});

test('the tracker stays silent on localhost, and would not have without the guard', async ({ page }) => {
  // --- SUBJECT: the site exactly as it ships, served from localhost ---
  const sentAsShipped: string[] = [];
  page.on('request', (r) => {
    if (SEND_URL.test(r.url())) sentAsShipped.push(r.url());
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(sentAsShipped, 'the production tracker fired from localhost').toEqual([]);

  // --- POSITIVE CONTROL: same page, guard stripped. It MUST fire. ---
  // Without this, a silent subject proves nothing: a blocked CDN, a failed
  // script load or a typo'd URL would all "pass" the assertion above.
  const sentUnguarded: string[] = [];
  await page.route('**/*', async (route) => {
    const req = route.request();
    if (req.resourceType() !== 'document') return route.continue();
    const res = await route.fetch();
    const body = (await res.text()).replace(/\sdata-domains="[^"]*"/g, '');
    return route.fulfill({ response: res, body });
  });
  page.on('request', (r) => {
    if (SEND_URL.test(r.url())) sentUnguarded.push(r.url());
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(
    sentUnguarded.length,
    'positive control failed: with data-domains removed the tracker still did not fire, ' +
      'so this test cannot detect a regression — check that script.js is reachable from CI',
  ).toBeGreaterThan(0);
});
