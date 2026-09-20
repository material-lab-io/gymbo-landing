import { test, expect } from '@playwright/test';

/**
 * App Review guideline 1.5 (pm, 2026-09-18): getgymbo.com is the app's Support
 * URL and must show a visible contact method. The appstore audit (PR #1331)
 * saw none. The address WAS in the footer, but Cloudflare's zone-wide email
 * obfuscation serves "[email protected]" to any reader without JavaScript.
 *
 * Vite preview has no Cloudflare in front of it, so these tests pin what we
 * control: the served HTML carries the contact as text AND the email_off
 * wrapper that tells Cloudflare to leave it alone. The live check after deploy
 * is the proof that Cloudflare honours it.
 */
const ADDRESS = 'damini@materiallab.io';

test('served HTML (no JavaScript) shows a labelled support contact inside email_off', async ({ request }) => {
  const html = await (await request.get('/')).text();
  const footer = html.slice(html.indexOf('<!--email_off--><footer'), html.indexOf('</footer><!--/email_off-->'));
  expect(footer.length, 'the footer must sit inside email_off, or Cloudflare obfuscates the address').toBeGreaterThan(0);
  expect(footer).toContain(`id="support"`);
  expect(footer).toMatch(new RegExp(`Support: <a href="mailto:${ADDRESS}"[^>]*>${ADDRESS}</a>`));
});

test('the contact is visible with JavaScript OFF, and "Support" points at it', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('/');
  const support = page.locator('#support');
  await expect(support).toBeVisible();
  await expect(support).toContainText(`Support: ${ADDRESS}`);
  await expect(page.locator('footer a', { hasText: /^Support$/ })).toHaveAttribute('href', '#support');
  await ctx.close();
});

test('with JavaScript ON the page hydrates cleanly around the email_off comments', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#support')).toContainText(`Support: ${ADDRESS}`);
  expect(errors.filter((e) => /hydrat|did not match|Minified React error/i.test(e))).toEqual([]);
});

// designer (#190): the link differs from its "Support:" label by colour alone
// (1.32:1), which fails WCAG 1.4.1. The underline is the non-colour cue.
test('the support mailto is distinguishable from its label by more than colour', async ({ page }) => {
  await page.goto('/');
  const deco = await page.locator('#support a').evaluate((el) => getComputedStyle(el).textDecorationLine);
  expect(deco).toContain('underline');
});

/**
 * designer EYES-ON FAIL at f8dc62a68: on a phone the support line was NEVER
 * visible. Tapping "Support" lands at max scroll with the line under the fixed
 * sticky bar, and the hit-test returns the bar. Asserted at 375 and 390, the
 * way designer measured it: the line is inside the viewport AND the point at
 * the centre of the link hit-tests to the link itself, not to whatever covers it.
 */
for (const width of [375, 390]) {
  test(`at ${width}px, after tapping Support the contact is on screen and not covered`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width, height: 812 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.locator('footer a', { hasText: /^Support$/ }).click();
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => {
      const a = document.querySelector('#support a') as HTMLElement;
      const box = a.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      const bar = document.querySelector('[data-fixed-chrome="sticky-cta"]')?.getBoundingClientRect();
      return { inViewport: box.top >= 0 && box.bottom <= innerHeight, hitIsLink: hit === a || a.contains(hit), top: Math.round(box.top), bottom: Math.round(box.bottom), barTop: bar ? Math.round(bar.top) : null };
    });
    expect(r, JSON.stringify(r)).toMatchObject({ inViewport: true, hitIsLink: true });
    await ctx.close();
  });
}
