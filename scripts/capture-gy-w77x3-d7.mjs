/**
 * gy-w77x3 D7 — the eyes-on captures designer asked for (AC6; gy-kui2r's gate
 * applies because this is founder-reported affordance work).
 *
 * E1 the sticky bar as the visitor first sees it, BEFORE the capture exists
 * E2 expanded, keyboard DOWN
 * E3 expanded, keyboard UP — K1 satisfied in the frame
 * E4 nav reveal open
 * E5 pricing reveal open
 * E6 the footer form, still reachable by scrolling, unchanged
 *
 * Phone viewport (375x812, Pixel 5 UA). Every reveal records scrollY before and
 * after the tap into d7-scroll-log.json, because "the page did not move" is the
 * property and a screenshot alone cannot show it.
 *
 * 🔴 ON "LIGHT + DARK". This site is LIGHT ONLY by founder ruling (gy-uesmd):
 * no [data-theme="dark"] rule ships anywhere in the bundle. So "dark" is not a
 * second rendering to review — it is a claim to verify. Each frame is therefore
 * captured twice, once with colorScheme 'light' and once with 'dark', and the
 * two files are byte-compared. Identical bytes ARE the dark evidence.
 *
 * 🔴 ON E3, AND THIS IS THE ONE LIMIT WORTH READING. Headless Chromium has no
 * software keyboard, so a REAL keyboard-up frame needs a device. What this
 * script does instead is drive the exact input the code reacts to: it replaces
 * window.visualViewport with a shim reporting a 336px-shorter visual viewport
 * and fires 'resize', which is what a real keyboard does to that API, then
 * clips the frame to the visible region so what you see is what the visitor
 * sees above the keyboard. It exercises useKeyboardInset and proves the bar
 * clears the intrusion. It does NOT prove a real keyboard fires the event on a
 * real phone. That residue is named in the bead, not hidden here.
 */
import { chromium, devices } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';

const PORT = process.env.PW_PORT || '4199';
const BASE = `http://localhost:${PORT}`;
const OUT = 'evidence/gy-w77x3-d7';
const KEYBOARD_PX = 336; // a typical Android/iOS portrait keyboard on a 812px-tall phone

mkdirSync(OUT, { recursive: true });
const log = [];

// 🔴 ANIMATIONS OFF, AND IT IS NOT COSMETIC. A first pass left them running and
// the E4 frame came out byte-different between the light and dark runs — which
// would have read as "a dark variant exists" on the one frame where that claim
// is the evidence. Captured twice in the SAME scheme it was also different, so
// the difference was the marquee's position, not the colour scheme. Freezing
// animations makes the dark comparison mean what it says.
const SHOT = { animations: 'disabled', caret: 'hide' };

// 🔴 A FRAME THAT IS NOT REPRODUCIBLE CANNOT CARRY THE DARK CLAIM. Freezing CSS
// animations was not enough on its own: the reveal-on-scroll entry state is
// driven by an IntersectionObserver in JS, and a lazily-decoded image above the
// fold moves everything under it. So each page also gets the entry animation
// forced to its end state, and every capture waits for every image to finish.
// Without this the light/dark comparison reports a difference that is a
// half-loaded photo, not a theme — which is worse than no comparison, because
// it looks like evidence.
const settle = async (page) => {
  await page.addStyleTag({
    content:
      '*,*::before,*::after{transition:none!important;animation-duration:0s!important;animation-delay:0s!important}' +
      '.reveal-on-scroll{opacity:1!important;transform:none!important}',
  });

  // 🔴 R-B (designer, 2026-09-18): ANY selector-based neutralizer MUST ASSERT ITS
  // MATCH COUNT, because a selector matching nothing is indistinguishable from
  // one that found nothing to hide — it fails open and silent.
  //
  // This script is the SECOND instance of that rule and I found it by sweeping
  // for the first. `.reveal-on-scroll` is a STYLE CLASS, i.e. exactly the hook
  // R-A says not to depend on: rename it in a restyle and these captures quietly
  // start including mid-animation frames again. Not hypothetical — that is the
  // specific failure settle() was written to fix, where the light and dark runs
  // differed BETWEEN RUNS and would have read as "a dark variant exists" on the
  // one frame where that comparison IS the evidence.
  //
  // It throws rather than warns: a capture that cannot be trusted must not reach
  // evidence/ at all, because the file outlives the console.
  const revealCount = await page.evaluate(() => document.querySelectorAll('.reveal-on-scroll').length);
  if (revealCount === 0) {
    throw new Error(
      'settle(): .reveal-on-scroll matched nothing. The entry-animation hook was renamed or dropped, ' +
        'so these frames may capture mid-animation state and the light/dark byte comparison is worthless. ' +
        'Fix the selector before trusting any capture from this run.',
    );
  }
  await page.evaluate(() =>
    Promise.all(
      [...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; })),
    ),
  );
  await page.waitForTimeout(300);
};
const shot = async (page, name, scheme, clip) => {
  await settle(page);
  return page.screenshot({ path: `${OUT}/${name}-${scheme}.png`, ...SHOT, ...(clip ? { clip } : {}) });
};

for (const scheme of ['light', 'dark']) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    ...devices['Pixel 5'],
    viewport: { width: 375, height: 812 },
    colorScheme: scheme,
    baseURL: BASE,
  });
  const page = await ctx.newPage();

  const scrollY = () => page.evaluate(() => window.scrollY);
  const record = async (id, before) => log.push({ id, scheme, scrollBefore: before, scrollAfter: await scrollY() });

  // ── E1/E2/E3: the sticky bar. It only exists past 0.8 viewports of scroll
  // (App.tsx onScroll), so getting it on screen at all requires scrolling —
  // that is the visitor's own journey, not a scroll the tap caused. Every
  // assertion below about "the page did not move" is measured across the TAP.
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => window.scrollTo(0, Math.round(window.innerHeight * 1.2)));
  await page.waitForTimeout(600);
  await shot(page, 'E1-sticky-bar-before', scheme);

  const bar = page.locator('[data-cta="waitlist"][data-cta-location="footer"]');
  const b4 = await scrollY();
  await bar.click();
  await page.waitForTimeout(500);
  await record('E2', b4);
  await shot(page, 'E2-sticky-expanded-keyboard-down', scheme);

  // E3 — see the header note. The shim is installed BEFORE the page loads, so
  // useKeyboardInset subscribes to IT and not to the real object; __kbUp() then
  // fires the same 'resize' a real keyboard fires. A first pass installed the
  // shim after load and the bar reported bottom:0px — the effect was still
  // holding the original visualViewport, so the frame would have shown the bar
  // sitting exactly where it sits with no keyboard and I would have captured a
  // passing K1 that proved nothing.
  const p1b = await ctx.newPage();
  await p1b.addInitScript((kb) => {
    const listeners = [];
    const vv = {
      height: window.innerHeight,
      width: window.innerWidth,
      offsetTop: 0,
      offsetLeft: 0,
      scale: 1,
      addEventListener: (t, f) => listeners.push([t, f]),
      removeEventListener: () => {},
      dispatchEvent: () => {},
    };
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
    window.__kbUp = () => {
      vv.height = window.innerHeight - kb;
      listeners.filter(([t]) => t === 'resize').forEach(([, f]) => f());
    };
  }, KEYBOARD_PX);
  await p1b.goto('/');
  await p1b.waitForLoadState('networkidle');
  await p1b.evaluate(() => window.scrollTo(0, Math.round(window.innerHeight * 1.2)));
  await p1b.waitForTimeout(600);
  await p1b.locator('[data-cta="waitlist"][data-cta-location="footer"]').click();
  await p1b.waitForTimeout(400);
  const beforeKb = await p1b.evaluate(() => getComputedStyle(document.querySelector('[data-cta-location="footer"]').closest('div.fixed')).bottom);
  await p1b.evaluate(() => window.__kbUp());
  await p1b.waitForTimeout(400);
  const inset = await p1b.evaluate(() => getComputedStyle(document.querySelector('[data-cta-location="footer"]').closest('div.fixed')).bottom);
  log.push({ id: 'E3', scheme, keyboardPx: KEYBOARD_PX, barBottomBeforeKeyboard: beforeKb, barBottomWithKeyboard: inset });
  await settle(p1b);
  await p1b.screenshot({
    ...SHOT,
    path: `${OUT}/E3-sticky-expanded-keyboard-up-${scheme}.png`,
    clip: { x: 0, y: 0, width: 375, height: 812 - KEYBOARD_PX },
  });

  // ── E4 nav reveal, from a fresh load and NOT scrolled.
  const p2 = await ctx.newPage();
  await p2.goto('/');
  await p2.waitForLoadState('networkidle');
  const nav = p2.locator('[data-cta="waitlist"][data-cta-location="nav"]');
  const n4 = await p2.evaluate(() => window.scrollY);
  await nav.click();
  await p2.waitForTimeout(500);
  log.push({ id: 'E4', scheme, scrollBefore: n4, scrollAfter: await p2.evaluate(() => window.scrollY) });
  await settle(p2);
  await p2.screenshot({ ...SHOT, path: `${OUT}/E4-nav-reveal-${scheme}.png` });

  // ── E5 pricing reveal. Scroll the card into view first (the visitor's own
  // scroll), then measure across the tap.
  const p3 = await ctx.newPage();
  await p3.goto('/');
  await p3.waitForLoadState('networkidle');
  const price = p3.locator('[data-cta="waitlist"][data-cta-location="pricing"]').first();
  await price.scrollIntoViewIfNeeded();
  await p3.waitForTimeout(700);
  const r4 = await p3.evaluate(() => window.scrollY);
  await price.click();
  await p3.waitForTimeout(500);
  log.push({ id: 'E5', scheme, scrollBefore: r4, scrollAfter: await p3.evaluate(() => window.scrollY) });
  await settle(p3);
  await p3.screenshot({ ...SHOT, path: `${OUT}/E5-pricing-reveal-${scheme}.png` });

  // ── E6 the footer form, unchanged and still reachable by scrolling.
  const p4 = await ctx.newPage();
  await p4.goto('/');
  await p4.waitForLoadState('networkidle');
  await p4.locator('#cta').scrollIntoViewIfNeeded();
  await p4.waitForTimeout(700);
  await settle(p4);
  await p4.screenshot({ ...SHOT, path: `${OUT}/E6-footer-form-${scheme}.png` });

  await browser.close();
}

// The dark evidence is a comparison, not a claim.
const FRAMES = ['E1-sticky-bar-before', 'E2-sticky-expanded-keyboard-down', 'E3-sticky-expanded-keyboard-up', 'E4-nav-reveal', 'E5-pricing-reveal', 'E6-footer-form'];
const darkDiff = FRAMES.map((f) => {
  const l = readFileSync(`${OUT}/${f}-light.png`);
  const d = readFileSync(`${OUT}/${f}-dark.png`);
  return { frame: f, identical: l.equals(d), lightBytes: l.length, darkBytes: d.length };
});
writeFileSync(`${OUT}/d7-scroll-log.json`, JSON.stringify({ log, darkDiff }, null, 2));
console.log(JSON.stringify({ log, darkDiff }, null, 2));
