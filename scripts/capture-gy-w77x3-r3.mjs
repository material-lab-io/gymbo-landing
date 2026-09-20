/**
 * gy-w77x3 ROUND 3 -- frames owed at the B5/B6/B7 head (designer 10:3xZ +
 * 10:4xZ addendum). Rounds 1-2 (d7, r2) stay as they were.
 *
 *   B5a  sticky panel open, then the nav CTA tapped: ONE form, the nav's
 *   B5b  nav panel open: no sticky bar in frame
 *   B5c  Escape from B5a: focus ring on the nav CTA (plus close-up)
 *   K1   keyboard-focus crop of every CTA in designer's table, at 375 and
 *        1440 (the sticky pill at 375 only, since the bar is md:hidden)
 *   K2   pricing Annual reached by Tab at 375, full frame, with its box and
 *        the bar's top in the log
 *   K3   one crop per ring colour with its ground: the K1 crops are padded
 *        24px so the ground on every side is in frame (charcoal on bone: nav,
 *        sticky, hero; bone on dark: gallery, pricing Monthly; charcoal on
 *        amber card: pricing Annual)
 *
 * r3-log.json carries the computed facts per frame: visible forms/submits,
 * sticky bar present, the focused element, :focus-visible, and the computed
 * outline (style, width, colour). A crop shows a ring; the log says it is
 * the outline and not a hover shadow.
 */
import { chromium, devices } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const PORT = process.env.PW_PORT || '4199';
const BASE = `http://localhost:${PORT}`;
const OUT = 'evidence/gy-w77x3-r3';
const CTA = (loc) => `[data-cta="waitlist"][data-cta-location="${loc}"]`;
const PANEL = '[role="group"][aria-label="Request access"]';
const SHOT = { animations: 'disabled', caret: 'hide' };
mkdirSync(OUT, { recursive: true });
const log = [];

const settle = async (page) => {
  await page.addStyleTag({
    content:
      '*,*::before,*::after{transition:none!important;animation-duration:0s!important;animation-delay:0s!important}' +
      '.reveal-on-scroll{opacity:1!important;transform:none!important}',
  });
  const n = await page.evaluate(() => document.querySelectorAll('.reveal-on-scroll').length);
  if (n === 0) throw new Error('settle(): .reveal-on-scroll matched nothing; fix before trusting frames.');
  await page.evaluate(() => {
    const pending = [...document.images].filter((i) => !i.complete);
    return Promise.race([
      Promise.all(pending.map((i) => new Promise((r) => { i.onload = i.onerror = r; }))),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
  });
  await page.waitForTimeout(300);
};

const facts = (page) =>
  page.evaluate(({ PANEL }) => {
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
    };
    const a = document.activeElement;
    const cs = a ? getComputedStyle(a) : null;
    const ab = a?.getBoundingClientRect();
    const bar = document.querySelector('[data-fixed-chrome="sticky-cta"]');
    const bb = bar?.getBoundingClientRect();
    return {
      visibleForms: [...document.querySelectorAll(PANEL)].filter(vis).length,
      visibleSubmits: [...document.querySelectorAll(`${PANEL} button[type="submit"]`)].filter(vis).length,
      stickyBarInDom: !!bar,
      barTop: bb && bb.top < innerHeight ? Math.round(bb.top) : null,
      focus: a && a !== document.body
        ? {
            what: a.getAttribute('data-cta-location') || a.getAttribute('name') || a.getAttribute('type') || a.tagName,
            focusVisible: a.matches(':focus-visible'),
            outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor} offset ${cs.outlineOffset}`,
            top: Math.round(ab.top),
            bottom: Math.round(ab.bottom),
          }
        : 'body',
    };
  }, { PANEL });

const crop = async (page, name, pad = 24) => {
  const clip = await page.evaluate((pad) => {
    const r = document.activeElement.getBoundingClientRect();
    return { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), width: Math.min(innerWidth, r.width + pad * 2), height: r.height + pad * 2 };
  }, pad);
  await page.screenshot({ ...SHOT, path: `${OUT}/${name}.png`, clip });
};

const browser = await chromium.launch();
const ctxFor = (w) =>
  w === 375
    ? browser.newContext({ ...devices['Pixel 5'], viewport: { width: 375, height: 812 }, colorScheme: 'light', baseURL: BASE })
    : browser.newContext({ ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, colorScheme: 'light', baseURL: BASE });

async function fresh(w) {
  const ctx = await ctxFor(w);
  const p = await ctx.newPage();
  await p.goto('/');
  await p.waitForLoadState('networkidle');
  return p;
}

// ── B5a / B5c (375)
{
  const p = await fresh(375);
  await p.evaluate(() => window.scrollTo(0, Math.round(innerHeight * 1.2)));
  await p.waitForTimeout(600);
  await p.locator(CTA('footer')).click();
  await p.waitForTimeout(400);
  log.push({ id: 'B5a-before-nav-tap', ...(await facts(p)) });
  await p.locator(`nav ${CTA('nav')}`).first().click();
  await p.waitForTimeout(500);
  log.push({ id: 'B5a', ...(await facts(p)) });
  await settle(p);
  await p.screenshot({ ...SHOT, path: `${OUT}/B5a-sticky-open-then-nav-tapped.png` });
  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);
  log.push({ id: 'B5c', ...(await facts(p)) });
  await settle(p);
  await p.screenshot({ ...SHOT, path: `${OUT}/B5c-after-escape.png` });
  await crop(p, 'B5c-after-escape-closeup', 16);
}

// ── B5b (375): nav open, scrolled so the bar WOULD show
{
  const p = await fresh(375);
  await p.locator(CTA('nav')).click();
  await p.waitForTimeout(400);
  await p.mouse.wheel(0, 1600);
  await p.waitForTimeout(600);
  log.push({ id: 'B5b', ...(await facts(p)) });
  await settle(p);
  await p.screenshot({ ...SHOT, path: `${OUT}/B5b-nav-open-scrolled-no-sticky-bar.png` });
}

// ── K1 / K3: keyboard focus on every CTA in designer's table
const SET = [
  ['nav', CTA('nav')],
  ['hero-waitlist', CTA('hero')],
  ['gallery', CTA('gallery')],
  ['sticky-pill', CTA('footer')],
  ['footer-submit', '#cta form button[type="submit"]'],
  ['pricing-monthly', `${CTA('pricing')} >> nth=0`],
  ['pricing-annual', `${CTA('pricing')} >> nth=1`],
];
for (const w of [375, 1440]) {
  for (const [name, sel] of SET) {
    if (name === 'sticky-pill' && w !== 375) continue;
    const p = await fresh(w);
    if (name === 'sticky-pill') {
      await p.evaluate(() => window.scrollTo(0, Math.round(innerHeight * 1.2)));
      await p.waitForTimeout(600);
    }
    await settle(p);
    await p.keyboard.press('Shift'); // keyboard modality
    await p.locator(sel).first().focus();
    await p.waitForTimeout(300);
    log.push({ id: `K1-${name}@${w}`, ...(await facts(p)) });
    await crop(p, `K1-${name}@${w}`);
  }
}

// ── K2: Annual reached by TAB at 375, entering pricing from above
{
  const p = await fresh(375);
  await p.evaluate(() => {
    const sec = document.querySelector('#pricing');
    sec.scrollIntoView({ block: 'start' });
    sec.setAttribute('tabindex', '-1');
    sec.focus({ preventScroll: true });
  });
  await p.waitForTimeout(600);
  for (let i = 0; i < 6; i++) {
    await p.keyboard.press('Tab');
    await p.waitForTimeout(200);
    const f = await facts(p);
    log.push({ id: `K2-tab${i + 1}`, ...f });
    const isAnnual = await p.evaluate(() => {
      const all = [...document.querySelectorAll('[data-cta-location="pricing"]')];
      return document.activeElement === all[1];
    });
    if (isAnnual) {
      await settle(p);
      await p.screenshot({ ...SHOT, path: `${OUT}/K2-annual-focused-by-tab-375.png` });
      break;
    }
  }
}

await browser.close();
writeFileSync(`${OUT}/r3-log.json`, JSON.stringify(log, null, 2));
console.log(JSON.stringify(log, null, 2));
