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

async function openSticky(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // The bar slides in once the hero is scrolled past; scroll a screen and wait
  // for its transform to settle rather than guessing a delay.
  await page.evaluate(() => window.scrollTo(0, 1600));
  const bar = page.locator('[data-fixed-chrome="sticky-cta"]');
  await expect
    .poll(() => bar.evaluate((el) => getComputedStyle(el).transform), { timeout: 5_000 })
    .toMatch(/matrix\(1, 0, 0, 1, 0, 0\)|none/);
  await bar.locator(CTA('footer')).click();
  await expect(bar.locator(PANEL)).toBeVisible();
  return bar;
}

async function openNav(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  const nav = page.locator('nav').filter({ has: page.locator(CTA('nav')) }).first();
  await nav.locator(CTA('nav')).click();
  await expect(nav.locator(PANEL)).toBeVisible();
  return nav;
}

test.describe('sticky bar (phone only)', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) >= 768, 'the sticky bar is md:hidden');

  test('B1: while the sticky panel is open, the bar holds exactly one "Request access", and it submits', async ({ page }) => {
    const bar = await openSticky(page);
    const labelled = bar.getByRole('button', { name: 'Request access', exact: true });
    await expect(labelled, 'exactly one Request access inside the open bar').toHaveCount(1);
    expect(
      await labelled.evaluate((b) => (b as HTMLButtonElement).type === 'submit' && !!b.closest('form')),
      'the one remaining Request access must be the form submit, not the trigger pill',
    ).toBe(true);
    // Unmounted, not hidden: a visually hidden pill is still a button to a
    // screen reader, and designer's B1 counts the rendered page.
    await expect(bar.locator(CTA('footer')), 'the trigger pill must not be in the DOM while open').toHaveCount(0);
  });

  test('B2a + B2c: the sticky panel closes from its control and from Escape, and focus lands on the RE-RENDERED pill', async ({ page }) => {
    let bar = await openSticky(page);
    const close = bar.locator(CLOSE);
    await expect(close).toHaveAccessibleName('Close');
    const box = (await close.boundingBox())!;
    expect(box.width, 'close target width').toBeGreaterThanOrEqual(MIN_TARGET);
    expect(box.height, 'close target height').toBeGreaterThanOrEqual(MIN_TARGET);
    await close.click();
    await expect(bar.locator(PANEL)).toHaveCount(0);
    await expect(bar.locator(CTA('footer')), 'the pill comes back after close').toHaveCount(1);

    // Keyboard arm, the one E9f captures: Escape from inside the panel.
    bar = await openSticky(page);
    await page.keyboard.press('Escape');
    await expect(bar.locator(PANEL)).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return 'none';
        const cs = getComputedStyle(el);
        const drawn = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2;
        return `${el.getAttribute('data-cta-location')}|${el.matches(':focus-visible')}|ring=${drawn}`;
      }))
      .toBe('footer|true|ring=true');
  });
});

for (const url of ['/', '/compare/gymbo-vs-wellnessz/']) {
  test(`B2a + B2c: the nav panel on ${url} closes from its control and from Escape, focus returns to the nav button`, async ({ page }) => {
    let nav = await openNav(page, url);
    const close = nav.locator(CLOSE);
    await expect(close).toHaveAccessibleName('Close');
    const box = (await close.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(MIN_TARGET);
    expect(box.height).toBeGreaterThanOrEqual(MIN_TARGET);
    await close.click();
    await expect(nav.locator(PANEL)).toHaveCount(0);

    nav = await openNav(page, url);
    await page.keyboard.press('Escape');
    await expect(nav.locator(PANEL)).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return 'none';
        const cs = getComputedStyle(el);
        const drawn = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2;
        return `${el.getAttribute('data-cta-location')}|${el.matches(':focus-visible')}|ring=${drawn}`;
      }))
      .toBe('nav|true|ring=true');
  });
}

test('B2a: the INLINE panels (hero, gallery, pricing) have no close control -- they scroll away with the page', async ({ page }) => {
  const checked: string[] = [];
  for (const loc of ['hero', 'gallery', 'pricing']) {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const cta = page.locator(CTA(loc)).first();
    await cta.scrollIntoViewIfNeeded();
    await cta.click();
    // One reveal per fresh page load, so the only open panel is this one.
    const panel = page.locator(PANEL).first();
    await expect(panel, `${loc}: positive control -- the panel must actually be open`).toBeVisible();
    await expect(page.locator(CLOSE), `${loc}: an inline panel must not carry a close control`).toHaveCount(0);
    checked.push(loc);
  }
  expect(checked).toEqual(['hero', 'gallery', 'pricing']);
});

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

test.describe('B5: one capture overlay at a time (phone)', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) >= 768, 'the sticky bar only exists below md');

  test('sticky open, then the nav CTA: exactly one form (the nav one), sticky bar gone, Escape returns focus to the nav CTA', async ({ page }) => {
    await openSticky(page);
    await page.locator(`nav ${CTA('nav')}`).first().click();
    await page.waitForTimeout(300);
    expect(await visibleCaptures(page)).toEqual({ forms: 1, submits: 1, stickyBarInDom: false });
    await expect(page.locator(`nav ${PANEL}`), 'the one open form must be the NAV panel').toBeVisible();
    const focusedInNav = await page.evaluate(() => !!document.activeElement?.closest('nav [role="group"]') && document.activeElement?.tagName === 'INPUT');
    expect(focusedInNav, 'focus moves to the nav panel first field').toBe(true);

    await page.keyboard.press('Escape');
    await expect(page.locator(PANEL)).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return 'none';
        const cs = getComputedStyle(el);
        return `${el.getAttribute('data-cta-location')}|${el.matches(':focus-visible')}|ring=${cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2}`;
      }))
      .toBe('nav|true|ring=true');
    expect((await visibleCaptures(page)).stickyBarInDom, 'the sticky bar returns once the nav panel closes').toBe(true);
  });

  test('nav open, then scroll: the sticky bar is not rendered, so its pill cannot open a second form', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.locator(CTA('nav')).click();
    await expect(page.locator(PANEL)).toBeVisible();
    await page.mouse.wheel(0, 1600);
    await page.waitForTimeout(600);
    expect(await visibleCaptures(page)).toEqual({ forms: 1, submits: 1, stickyBarInDom: false });
    await expect(page.locator(CTA('footer')), 'no sticky pill to tap while the nav panel is open').toHaveCount(0);
  });
});

/**
 * gy-w77x3 B6 -- the pricing buttons draw a keyboard focus ring. At 971ade6a1
 * AND on main they drew NONE (computed outline none), and I had written that
 * their Tailwind ring "was never overridden" without measuring it. The ring is
 * matched to the ground it sits on: bone on the dark Monthly card, charcoal on
 * the amber Annual card. So the COLOUR is asserted too, not just its presence.
 */
test('B6: both pricing buttons draw a focus ring in the colour of their ground', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const buttons = page.locator(CTA('pricing'));
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
    'true|solid|true|rgb(240, 240, 235)', // Monthly: bone ring, dark card ground
    'true|solid|true|rgb(10, 10, 10)', // Annual: charcoal ring, amber card ground
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

  test('Tab from pricing through the footer form: no focused control is obscured by the bar', async ({ page }) => {
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
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(150);
      const r = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const bar = document.querySelector('[data-fixed-chrome="sticky-cta"]') as HTMLElement | null;
        const box = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const ring = cs.outlineStyle === 'none' ? 0 : parseFloat(cs.outlineWidth) + parseFloat(cs.outlineOffset || '0');
        const barBox = bar?.getBoundingClientRect();
        const barOnScreen = !!barBox && barBox.top < window.innerHeight && getComputedStyle(bar!).display !== 'none';
        const label = el.getAttribute('data-cta-location') ?? el.getAttribute('name') ?? (el as HTMLButtonElement).type ?? el.tagName;
        return {
          label: `${label}${el.closest('#cta') ? '@footer' : ''}`,
          bottom: Math.round(box.bottom + ring),
          barTop: barOnScreen ? Math.round(barBox!.top) : null,
          inFooterForm: !!el.closest('#cta form'),
          isSubmit: (el as HTMLButtonElement).type === 'submit',
          inBar: !!el.closest('[data-fixed-chrome="sticky-cta"]'),
        };
      });
      visited.push(r.label);
      if (r.barTop !== null && !r.inBar && r.bottom > r.barTop) obscured.push(`${r.label}: bottom ${r.bottom} > bar top ${r.barTop}`);
      if (r.inFooterForm && r.isSubmit) break;
      await page.keyboard.press('Tab');
    }
    expect(visited.filter((v) => v === 'pricing').length, `positive control: both pricing buttons visited (${visited.join(', ')})`).toBe(2);
    expect(visited.some((v) => v.endsWith('@footer')), `positive control: the walk reached the footer form (${visited.join(', ')})`).toBe(true);
    expect(obscured, 'a focused control hidden behind the sticky bar fails WCAG 2.4.11').toEqual([]);
  });
});
