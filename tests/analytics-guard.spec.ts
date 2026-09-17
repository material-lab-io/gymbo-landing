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
  // 🔴 NOTHING THIS TEST SENDS MAY REACH PRODUCTION ANALYTICS — gy-kzfg9,
  // 2026-09-18, found when wiring this spec into CI.
  //
  // The positive control below deliberately strips the guard and asserts the
  // tracker fires. As first written it let that request GO THROUGH, so every
  // run wrote one localhost pageview into production Umami: a smaller copy of
  // the exact contamination this bead exists to remove (10,985 local events
  // against 409 real ones), and it would have grown with every PR the moment
  // this spec became a gate. AC3 asks for a 7-day reconciliation; a gate that
  // injects its own events into the series being reconciled cannot be part of
  // proving it.
  //
  // So the send endpoint is ABORTED for the whole test. The `request` event
  // still fires on an aborted request, so the control keeps its meaning — it
  // observes that the tracker TRIED to send — while nothing leaves the box.
  // Registered first and matched last-registered-first by Playwright, the
  // document rewrite below still wins for documents.
  let abortedSends = 0;
  await page.route(SEND_URL, async (route) => {
    abortedSends++;
    await route.abort();
  });

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
    // 🔴 fallback(), NOT continue(). continue() sends the request to the
    // network from THIS handler and never reaches the send-abort route
    // registered above — which is how the containment assertion first read 0
    // aborts while the control happily fired a real event at production.
    // Playwright runs the most recently registered handler first, so a
    // catch-all that continues is a catch-all that silently disables every
    // earlier route.
    if (req.resourceType() !== 'document') return route.fallback();
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

  // And the containment is asserted, not assumed: every send this test provoked
  // was intercepted. If this ever reads 0 while the control above passed, the
  // abort route stopped matching and the test is writing to production again.
  expect(
    abortedSends,
    'the provoked pageview escaped to production analytics — this test must never contribute an event',
  ).toBe(sentUnguarded.length);
});
