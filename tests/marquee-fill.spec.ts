import { test, expect } from '@playwright/test';

/**
 * gy-1vd9qy.10.2: the "Your brand, everywhere" marquee never shows an empty band. The track scrolls by -50% (a loop of two identical
 * halves), so at the END of the cycle the right edge of the last chip must still reach the viewport. Removing chips that have no
 * user surface (Your own URL, Brand theming) shortened the half and left ~670px empty at 1440; this holds the fix.
 * The animation is seeked, not waited for: the check reads the geometry at 99.9% of the cycle.
 */
test.use({ reducedMotion: 'no-preference' });

for (const width of [393, 1440, 2000]) {
  test(`marquee fills the viewport at the end of its loop at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const track = page.locator('.marquee-track');
    await track.scrollIntoViewIfNeeded();
    const names = await track.locator('> span').evaluateAll((els) => els.map((e) => (e.textContent ?? '').trim()));
    const half = names.length / 2;
    expect(names.length % 2, 'the track is two halves').toBe(0);
    expect(names.slice(0, half), 'the two halves are identical, so -50% loops seamlessly').toEqual(names.slice(half));
    const right = await track.evaluate((t) => {
      const a = t.getAnimations()[0];
      a.pause();
      a.currentTime = Number(a.effect!.getTiming().duration) * 0.999;
      const last = t.lastElementChild as HTMLElement;
      return last.getBoundingClientRect().right;
    });
    expect(right, 'the last chip still reaches the right edge at the end of the cycle').toBeGreaterThanOrEqual(width - 1);
  });
}
