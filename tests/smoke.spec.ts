import { test, expect } from '@playwright/test';

/**
 * Smoke + Wave 3 acceptance [F] for getgymbo.com.
 * Runs on both the `desktop` and `mobile` (Pixel 5) projects (see playwright.config.ts).
 * Covers: page renders / no JS errors, nav + hero, pricing, waitlist CTA, footer,
 * plus the current static product imagery and no layout break.
 * getgymbo.com is LIGHT ONLY (gy-uesmd, founder ruling 2026-08-12) — there is
 * no global theme toggle or dark palette.
 */

const IGNORE = [
  'analytics.getgymbo.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'favicon',
  'og-image',
  'Failed to load resource',
  'net::ERR',
];

test('page renders with no JS errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (IGNORE.some((s) => text.includes(s))) return;
    errors.push(`console: ${text}`);
  });

  await page.goto('/');
  await expect(page).toHaveTitle(/gymbo/i);
  await page.waitForTimeout(800);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('nav and hero render with the headline', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav).toBeVisible();
  await expect(nav.getByText('Get Gymbo', { exact: true })).toBeVisible();

  const h1 = page.locator('h1');
  await expect(h1).toContainText(/fitness business/i);
  await expect(h1).toContainText(/from your phone/i);
});

// gy-dyu6r.9: the source/dist gate checks exact asset identity; these browser
// assertions prove that all three user-visible slots render the contract.
test('hero and all six gallery screens render approved photoreal device assets', async ({ page }) => {
  await page.goto('/');
  const hero = page.getByTestId('hero-device-art').locator('img:visible');
  await expect(hero).toBeVisible();
  await expect(hero).toHaveAttribute('src', /hero-three-panel-1200\.png/);
  expect(await hero.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);

  const gallery = page.getByTestId('gallery-device-art');
  await expect(gallery).toHaveCount(6);
  for (let index = 0; index < 6; index += 1) {
    const frame = gallery.nth(index);
    await frame.scrollIntoViewIfNeeded();
    await expect(frame.locator('img').last()).toHaveAttribute('src', /iphone-frame-single\.png/);
    await expect.poll(() => frame.locator('img').first().evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);

    const geometry = await frame.evaluate((element) => {
      const aperture = element.querySelector<HTMLElement>('[data-testid="gallery-screen-aperture"]');
      const screen = aperture?.querySelector<HTMLImageElement>('img');
      if (!aperture || !screen) throw new Error('gallery aperture contract missing');
      const style = getComputedStyle(aperture);
      const apertureBox = aperture.getBoundingClientRect();
      const screenBox = screen.getBoundingClientRect();
      return {
        radiusX: Number.parseFloat(style.borderTopLeftRadius.split(' ')[0]),
        radiusY: Number.parseFloat(style.borderTopLeftRadius.split(' ')[1] || style.borderTopLeftRadius),
        expectedRadius: apertureBox.width * 0.1656,
        aperture: { left: apertureBox.left, top: apertureBox.top, right: apertureBox.right, bottom: apertureBox.bottom },
        screen: { left: screenBox.left, top: screenBox.top, right: screenBox.right, bottom: screenBox.bottom },
      };
    });
    expect(Math.abs(geometry.radiusX - geometry.expectedRadius)).toBeLessThan(1);
    expect(Math.abs(geometry.radiusY - geometry.expectedRadius)).toBeLessThan(1);
    expect(geometry.screen.left).toBeGreaterThanOrEqual(geometry.aperture.left - 0.5);
    expect(geometry.screen.top).toBeGreaterThanOrEqual(geometry.aperture.top - 0.5);
    expect(geometry.screen.right).toBeLessThanOrEqual(geometry.aperture.right + 0.5);
    expect(geometry.screen.bottom).toBeLessThanOrEqual(geometry.aperture.bottom + 0.5);
  }
});

test('all four pillar demos lazy-load and advance as muted looping inline video', async ({ page }) => {
  await page.goto('/');
  const demos = page.getByTestId('pillar-demo');
  await expect(demos).toHaveCount(4);
  const expected = [
    ['log-payment', 'light'],
    ['schedule', 'dark'],
    ['branded-statement', 'light'],
    ['build-workout', 'light'],
  ] as const;

  for (let index = 0; index < expected.length; index += 1) {
    const [id, theme] = expected[index];
    const demo = demos.nth(index);
    await expect(demo).toHaveAttribute('data-demo-id', id);
    await demo.scrollIntoViewIfNeeded();
    const video = demo.locator('video');
    await expect(video).toHaveCount(1);
    await expect(video.locator('source')).toHaveAttribute('src', `/demos/${id}-${theme}.mp4`);
    const playback = await video.evaluate((element: HTMLVideoElement) => ({
      muted: element.muted,
      loop: element.loop,
      playsInline: element.playsInline,
      autoplay: element.autoplay,
      preload: element.preload,
    }));
    expect(playback).toEqual({ muted: true, loop: true, playsInline: true, autoplay: true, preload: 'metadata' });
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime), { timeout: 10000 }).toBeGreaterThan(0.05);
  }
});

test('reduced motion renders all four matching posters without autoplay', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('video')).toHaveCount(0);
  const posters = page.getByTestId('pillar-demo-poster');
  await expect(posters).toHaveCount(4);
  const expected = [
    '/demos/log-payment-light.png',
    '/demos/schedule-dark.png',
    '/demos/branded-statement-light.png',
    '/demos/build-workout-light.png',
  ];
  for (let index = 0; index < expected.length; index += 1) {
    await expect(posters.nth(index)).toHaveAttribute('src', expected[index]);
  }
});

test('a pre-seeded dark localStorage value is ignored — site is light only (gy-uesmd)', async ({ page }) => {
  // Regression for the founder-visible bug: gy-31moh removed the theme
  // toggle but left the no-flash script + dark palette in place, so anyone
  // with a stale gymbo-theme='dark' from before the toggle was removed got
  // stuck on a dark site with no way to escape it. Both are now deleted
  // outright — getgymbo.com never reads gymbo-theme and never sets
  // data-theme, so a pre-seeded 'dark' value must have zero effect.
  await page.addInitScript(() => localStorage.setItem('gymbo-theme', 'dark'));
  await page.goto('/');
  const html = page.locator('html');
  await expect(html).not.toHaveAttribute('data-theme', /.+/);
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(250, 250, 247)'); // --c-bg #fafaf7
});

test('pillar-organized keeps its fixed dark accent band (unrelated to page theme)', async ({ page }) => {
  // PILLARS[].dark is a per-section design constant (charcoal accent band),
  // independent of the removed global theme system — this is NOT dark mode.
  //
  // The organized pillar also selects the dark clip variant so the baked scene
  // blends into this fixed charcoal band; this remains independent of page theme.
  await page.goto('/');
  const pillar = page.locator('[data-testid="pillar-organized"]');
  await pillar.scrollIntoViewIfNeeded();
  await expect(pillar).toBeVisible();
  await expect(pillar.locator('xpath=..')).toHaveCSS('background-color', 'rgb(10, 10, 10)'); // F.charcoal #0a0a0a
  await expect(pillar.locator('video')).toHaveAttribute('data-theme-variant', 'dark');
});

test('retired demo-frame badges are absent', async ({ page }) => {
  await page.goto('/');
  // gy-jaooz: "travel-aware" / "AI navigate" badges were removed from the pillar
  // demo artwork; the not-yet-shipped items now live as normal bullets with a
  // "coming soon" tag after the sentence.
  await page.locator('#why').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-coming-soon]')).toHaveCount(0);
  await expect(page.getByText(/travel-aware/i)).toHaveCount(0);
  await expect(page.getByText('coming soon')).toHaveCount(0);
});

test('pricing shows the two plans and numbers', async ({ page }) => {
  await page.goto('/');
  const pricing = page.locator('#pricing');
  await pricing.scrollIntoViewIfNeeded();
  await expect(pricing.getByText('Monthly', { exact: true })).toBeVisible();
  await expect(pricing.getByText('Annual', { exact: true })).toBeVisible();
  // Quarterly was dropped in the 2026-07-18 founder pricing lock.
  await expect(pricing.getByText('Quarterly', { exact: true })).toHaveCount(0);
  for (const amount of ['₹399', '₹250']) {
    await expect(pricing.getByText(amount, { exact: true })).toBeVisible();
  }
});

test('gallery controls make the fourth product screen discoverable', async ({ page }) => {
  await page.goto('/');
  const gallery = page.getByRole('region', { name: 'See Gymbo in action gallery' });
  await gallery.scrollIntoViewIfNeeded();
  const previous = page.getByRole('button', { name: 'Show previous Gymbo screen' });
  const next = page.getByRole('button', { name: 'Show next Gymbo screen' });

  await expect(page.getByText('1 of 6', { exact: true })).toBeVisible();
  await expect(previous).toBeDisabled();
  for (let step = 2; step <= 4; step += 1) {
    await next.click();
    await expect(page.getByText(`${step} of 6`, { exact: true })).toBeVisible();
  }

  const workouts = gallery.locator('[data-gallery-index="3"]');
  await expect(workouts).toBeInViewport();
  await expect(workouts.getByText('Build and assign workouts', { exact: true })).toBeVisible();
  await expect(previous).toBeEnabled();
});

test('waitlist CTA section and form resolve', async ({ page }) => {
  await page.goto('/');
  const cta = page.locator('#cta');
  await cta.scrollIntoViewIfNeeded();
  await expect(cta).toBeVisible();
  await expect(cta.locator('input[type="email"]')).toBeVisible();
  await expect(cta.getByText(/talk to the founder/i)).toBeVisible();
});

test('footer present, and no web-app references remain', async ({ page }) => {
  await page.goto('/');
  const footer = page.locator('footer');
  await footer.scrollIntoViewIfNeeded();
  await expect(footer.getByText(/2026 Material Lab/i)).toBeVisible();
  await expect(page.locator('a[href="https://app.getgymbo.com"]')).toHaveCount(0);
});

test('hero subheadline uses sans-serif, not the heading serif (gy-a73px.3)', async ({ page }) => {
  await page.goto('/');
  const h1 = page.locator('h1');
  const subheadline = page.locator('p', { hasText: 'Track revenue, stay organized' });
  await expect(subheadline).toBeVisible();

  const h1Family = await h1.evaluate((el) => getComputedStyle(el).fontFamily);
  const subFamily = await subheadline.evaluate((el) => getComputedStyle(el).fontFamily);

  expect(h1Family).toContain('Merriweather');
  expect(subFamily).toContain('Open Sans');
  expect(subFamily).not.toContain('Merriweather');
});
