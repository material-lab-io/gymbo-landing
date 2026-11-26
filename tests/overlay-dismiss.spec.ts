import { test, expect, type Page } from '@playwright/test';

/**
 * gy-w77x3 B1 + B2 -- the two OVERLAY waitlist panels (nav, sticky bar) can be
 * closed, closing returns focus to the opener, and the sticky bar never shows
 * two "Request access" buttons at once.
 *
 * designer's FAIL at 11a0c5ce9: an overlay, once opened, could never be
 * dismissed (InlineWaitlist's state only went false -> true), and the open
 * sticky panel showed the panel's submit and the bar's pill ~20px apart, where
 * the one a thumb hit first did not submit.
 *
 * 🔴 EACH ASSERTION NAMES THE BROKEN STATE IT DISTINGUISHES, because "a panel
 * closed" is also true of a page that reloaded, and "something has focus" is
 * also true of <body>:
 *  - B1 counts buttons INSIDE THE FIXED BAR, so an off-screen pricing button
 *    with the same label cannot satisfy or fail it.
 *  - B2c asserts the focused element IS the opener, matches :focus-visible,
 *    AND has a ring actually DRAWN (computed outline, >= 2px). The third arm
 *    exists because the first capture round showed :focus-visible true with
 *    nothing on screen: the Tailwind ring is a box-shadow and the CTA's inline
 *    elevation shadow overwrote it. The state was right and the pixels were not.
 *    A dismiss that drops focus to <body> fails the first; a focus() on a node
 *    that had not rendered yet (the B1 ordering trap) leaves focus on <body>
 *    too, so it fails the same way rather than passing silently.
 * Mutation-checked before commit: see the gy-w77x3 bead comment for the arms.
 */

const CTA = (loc: string) => `[data-cta="waitlist"][data-cta-location="${loc}"]`;
const PANEL = '[role="group"][aria-label="Request access"]';
const CLOSE = '[data-waitlist-close]';
// 44px target, read from the rendered box. The half pixel is sub-pixel layout
// arithmetic (measured: 43.99999 on /compare at desktop), not a smaller button:
// the regression this guards is the 40px gallery size (h-10), which still fails.
const MIN_TARGET = 43.5;

// gy-e9h9y N2: the phone sticky bar is now the WhatsApp link, not a capture surface. This only scrolls
// past the hero and waits for the bar to settle, so the nav tests below can assert how the bar behaves.
async function showSticky(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // The bar slides in once the hero is scrolled past; scroll a screen and wait
  // for its transform to settle rather than guessing a delay.
  await page.evaluate(() => window.scrollTo(0, 1600));
  const bar = page.locator('[data-fixed-chrome="sticky-cta"]');
  await expect
    .poll(() => bar.evaluate((el) => getComputedStyle(el).transform), { timeout: 5_000 })
    .toMatch(/matrix\(1, 0, 0, 1, 0, 0\)|none/);
  return bar;
}


// RETIRED (gy-e9h9y N2, designer ruling + pm scope OK, 29 Oct): the two tests that lived here, B1 (an open
// sticky panel holds exactly one "Request access", and it submits) and B2a + B2c (the sticky panel closes from its
// control and from Escape, focus lands on the re-rendered pill), guarded the sticky bar's in-place capture. The bar
// is now the WhatsApp primary, so there is no capture, panel, pill or submit in it to guard. What remains of the
// bar's contract is asserted in tests/cta-hierarchy.spec.ts and in the B5 / B7 tests below. If a capture ever
// returns to the bar, restore these from git history (the commit that retired them is named in the bead).



/**
 * gy-w77x3 B5 (designer FAIL at 971ade6a1) -- ONE capture overlay at a time.
 *
 * Each InlineWaitlist owned its own `revealed`, so with the sticky panel open
 * the nav "Request access" (visible the whole time) opened a SECOND form over
 * the first: two forms, two submits, the page covered. The property is counted
 * on the rendered page, VISIBLE forms and VISIBLE submits, because an
 * unmounted-vs-hidden distinction is exactly what a DOM-only count gets wrong.
 */
const visibleCaptures = (page: Page) =>
  page.evaluate(() => {
    const vis = (el: Element) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && r.bottom > 0 && r.top < window.innerHeight;
    };
    const panels = [...document.querySelectorAll('[role="group"][aria-label="Request access"]')].filter(vis);
    const submits = [...document.querySelectorAll('form button[type="submit"]')].filter(
      (b) => vis(b) && b.closest('[role="group"][aria-label="Request access"]'),
    );
    return { forms: panels.length, submits: submits.length, stickyBarInDom: !!document.querySelector('[data-fixed-chrome="sticky-cta"]') };
  });


/**
 * gy-w77x3 B6 -- the pricing buttons draw a keyboard focus ring. At 971ade6a1
 * AND on main they drew NONE (computed outline none), and I had written that
 * their Tailwind ring "was never overridden" without measuring it. The ring is
 * matched to the ground it sits on: bone on the dark Monthly card, charcoal on
 * the amber Annual card. So the COLOUR is asserted too, not just its presence.
 */
test('B6: both pricing Start free buttons draw a focus ring in the colour of their ground', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const buttons = page.locator('a[data-cta="start-free"][data-cta-location="pricing"]');
  await expect(buttons, 'positive control: two pricing buttons').toHaveCount(2);
  const seen: string[] = [];
  for (let i = 0; i < 2; i++) {
    const b = buttons.nth(i);
    await b.scrollIntoViewIfNeeded();
    await page.keyboard.press('Shift'); // keyboard modality, so :focus-visible applies to the focus below
    await b.focus();
    seen.push(
      await b.evaluate((el) => {
        const cs = getComputedStyle(el);
        const card = el.closest('[class*="rounded"]')?.parentElement?.querySelector('h3')?.textContent ?? '';
        return `${el.matches(':focus-visible')}|${cs.outlineStyle}|${parseFloat(cs.outlineWidth) >= 2}|${cs.outlineColor}|${card}`;
      }),
    );
  }
  expect(seen.map((s) => s.split('|').slice(0, 4).join('|'))).toEqual([
    'true|solid|true|rgb(255, 255, 255)', // Free: bone ring (--g-color-neutral-dark-fg, #fff in token set B; was #f0f0eb), dark card ground
    'true|solid|true|rgb(255, 255, 255)', // Pro: the same bone ring: since gy-sk86p2.3 both cards are dark (a marigold edge marks Pro)
  ]);
});

/**
 * gy-w77x3 B7 -- WCAG 2.4.11. Below md the fixed sticky bar covers the bottom
 * of the viewport. Tabbing onto the pricing Annual button parked it at y
 * 852-900 under a bar whose top was 832: fully hidden. Walk the real Tab order
 * from the Monthly button through the footer form, and after EVERY Tab require
 * the focused control, ring included, to sit fully above the bar whenever the
 * bar is on screen. The walk must actually reach Annual and the footer submit;
 * a walk that stopped early would pass vacuously.
 */
test.describe('B7: focus is never hidden behind the sticky bar (phone)', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) >= 768, 'the sticky bar only exists below md');

  test('Tab from pricing through the footer links: no focused control is obscured by the bar', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Enter pricing the way a keyboard user does: the section scrolled to the
    // top of the viewport and focus arriving from ABOVE, so Tab has to scroll
    // each button into view itself. A first version called monthly.focus(),
    // which parked Monthly mid-screen with Annual already visible. Tab then
    // never scrolled, and with the padding REMOVED the Annual stop still read
    // clean (bottom 434 < bar 731). The walk has to start where designer's did.
    await page.evaluate(() => {
      const sec = document.querySelector('#pricing') as HTMLElement;
      sec.scrollIntoView({ block: 'start' });
      sec.setAttribute('tabindex', '-1');
      sec.focus({ preventScroll: true });
    });
    await page.waitForTimeout(600);
    await page.keyboard.press('Tab');

    const obscured: string[] = [];
    const visited: string[] = [];
    for (let i = 0; i < 70; i++) {
      await page.waitForTimeout(150);
      const r = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const bar = document.querySelector('[data-fixed-chrome="sticky-cta"]') as HTMLElement | null;
        const box = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const ring = cs.outlineStyle === 'none' ? 0 : parseFloat(cs.outlineWidth) + parseFloat(cs.outlineOffset || '0');
        const barBox = bar?.getBoundingClientRect();
        const barOnScreen = !!barBox && barBox.top < window.innerHeight && getComputedStyle(bar!).display !== 'none';
        const label = el.getAttribute('data-cta-location') ?? el.getAttribute('name') ?? el.tagName;
        return {
          label: `${label}${el.closest('footer') ? '@footer' : ''}`,
          bottom: Math.round(box.bottom + ring),
          barTop: barOnScreen ? Math.round(barBox!.top) : null,
          inFooterForm: !!el.closest('footer'),
          isSubmit: false,
          inBar: !!el.closest('[data-fixed-chrome="sticky-cta"]'),
        };
      });
      visited.push(r.label);
      if (r.barTop !== null && !r.inBar && r.bottom > r.barTop) obscured.push(`${r.label}: bottom ${r.bottom} > bar top ${r.barTop}`);
      if (r.inFooterForm && visited.filter((v) => v.endsWith('@footer')).length >= 4) break;
      await page.keyboard.press('Tab');
    }
    expect(visited.filter((v) => v === 'pricing').length, `positive control: both pricing buttons visited (${visited.join(', ')})`).toBe(2);
    expect(visited.some((v) => v.endsWith('@footer')), `positive control: the walk reached the footer links (${visited.join(', ')})`).toBe(true);
    expect(obscured, 'a focused control hidden behind the sticky bar fails WCAG 2.4.11').toEqual([]);
  });
});

/**
 * Post-merge live Tab pass (gy-w77x3, 10:4xZ): the panel's close control, the
 * gallery arrows and the logo button matched :focus-visible and DREW NOTHING
 * on getgymbo.com. The close control is #162's own. Every keyboard-reachable
 * icon control must draw a computed outline, not just match the pseudo-class.
 */
test('icon controls (gallery dots, logo) draw a focus ring', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const ring = (sel: string) =>
    page.locator(sel).first().evaluate((el) => {
      const cs = getComputedStyle(el);
      return `${el.matches(':focus-visible')}|${cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2}`;
    });
  const seen: Record<string, string> = {};
  for (const sel of ['[aria-label="Gymbo, back to top"]', '[data-testid="gallery-dot"]']) {
    await page.keyboard.press('Shift');
    await page.locator(sel).first().focus();
    seen[sel] = await ring(sel);
  }
  expect(seen).toEqual({
    '[aria-label="Gymbo, back to top"]': 'true|true',
    '[data-testid="gallery-dot"]': 'true|true',
  });
});
