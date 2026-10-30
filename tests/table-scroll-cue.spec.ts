import { test, expect } from '@playwright/test';

/**
 * gy-gf6j6 (designer spec): the best-apps comparison table hid its Free trial column at rest,
 * on desktop AND mobile, with no cue that it scrolls.
 *   AC1  a visible scroll cue wherever the table overflows (edge shadow painted on the scroller)
 *   AC2  at 1280 the Free trial header is fully inside the scroller at rest
 *   AC4  no copy change: the test reads the column by its header text, it does not edit it
 *
 * 🔴 NEG: the AC2 measurement is the same one that FAILED on main before the fix (trial left 993 vs
 * scroller right 972). The negative control below shrinks the viewport to 900 where the table must
 * still overflow, and asserts the cue is the thing that carries the load there, so a build that
 * dropped the breakout cannot hide behind a wide viewport.
 */
const PAGE = '/blog/best-apps-for-independent-personal-trainers-in-india-2026/';

async function read(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const s = document.querySelector('.table-scroll') as HTMLElement;
    const th = [...s.querySelectorAll('th')].find((h) => /free trial/i.test(h.textContent || '')) as HTMLElement;
    const sr = s.getBoundingClientRect();
    const tr = th.getBoundingClientRect();
    return {
      overflows: s.scrollWidth > s.clientWidth + 1,
      trialRight: tr.right,
      scrollerRight: sr.right,
      cue: getComputedStyle(s).backgroundImage.includes('linear-gradient'),
      label: s.getAttribute('aria-label'),
    };
  });
}

test('1280: Free trial is visible at rest', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  const r = await read(page);
  expect(r.trialRight).toBeLessThanOrEqual(r.scrollerRight + 0.5);
});

for (const width of [390, 900]) {
  test(`${width}: where the table overflows it carries the scroll cue and keeps its label`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    const r = await read(page);
    expect(r.overflows, 'precondition: the table must overflow at this width').toBe(true);
    expect(r.cue).toBe(true);
    expect(r.label).toMatch(/scroll horizontally/i);
  });
}
