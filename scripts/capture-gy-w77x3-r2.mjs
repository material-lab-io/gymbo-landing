/**
 * gy-w77x3 ROUND 2 -- the captures for designer's consolidated 05:4xZ criteria,
 * taken at the head that adds B1 + B2. D7's script (capture-gy-w77x3-d7.mjs) is
 * left as it was: it is the record of the head designer FAILED.
 *
 * Frames, 375x812 (Pixel 5) unless marked @1280:
 *   E1  sticky bar before the capture exists
 *   E2  sticky panel open, keyboard down            (B1: one "Request access")
 *   E3  sticky panel open, simulated keyboard up    (K1 caveat as in D7)
 *   E4  nav panel open                 + @1280
 *   E5  pricing panel open             + @1280
 *   E6  footer form
 *   E7  nav panel open, then scrolled one screen    + @1280   (B2b)
 *   E8  sticky panel open, then scrolled one screen           (B2b)
 *   E9  each overlay after a CLICK on its close control       (+ nav @1280)
 *   E9f each overlay after ESCAPE: focus ring on the opener, full frame plus a
 *       close-up clip around the opener so the ring is legible  (+ nav @1280)
 *   H1  the pricing cluster at 375, panel open (hint wraps, not clipped)
 *
 * 🔴 THE FRAMES ARE FOR EYES; THE LOG IS FOR THE PROPERTIES A FRAME CANNOT
 * SHOW. r2-log.json records, per frame, the DOM facts each B-criterion turns
 * on: how many "Request access" buttons the open bar holds and whether the pill
 * is in the DOM (B1), the close control's box and name (B2a), whether a panel
 * is still mounted after dismiss (B2a), and which element holds focus and
 * whether it matches :focus-visible (B2c). A ring in a still frame could be a
 * hover state; the log says what it is.
 *
 * Light only. The site is light-only by founder ruling (gy-uesmd) and D7
 * byte-compared light vs dark for every frame (identical); this round does not
 * re-litigate that, and says so rather than implying it re-checked.
 */
import { chromium, devices } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const PORT = process.env.PW_PORT || '4199';
const BASE = `http://localhost:${PORT}`;
const OUT = 'evidence/gy-w77x3-r2';
const KEYBOARD_PX = 336;
const CTA = (loc) => `[data-cta="waitlist"][data-cta-location="${loc}"]`;
const PANEL = '[role="group"][aria-label="Request access"]';
const CLOSE = '[data-waitlist-close]';
const SHOT = { animations: 'disabled', caret: 'hide' };

mkdirSync(OUT, { recursive: true });
const log = [];

// Same settle() contract as D7, including the R-B match-count assertion: a
// neutraliser that matches nothing must stop the run, not pass silently.
const settle = async (page) => {
  await page.addStyleTag({
    content:
      '*,*::before,*::after{transition:none!important;animation-duration:0s!important;animation-delay:0s!important}' +
      '.reveal-on-scroll{opacity:1!important;transform:none!important}',
  });
  const n = await page.evaluate(() => document.querySelectorAll('.reveal-on-scroll').length);
  if (n === 0) throw new Error('settle(): .reveal-on-scroll matched nothing; frames would be mid-animation. Fix before trusting this run.');
  // Wait for pending images, but BOUNDED: a loading="lazy" image below the
  // fold never starts loading, so an unbounded wait hangs forever (it did, on
  // the 1280 E9f frame). A capped wait is only honest if it says it capped, so
  // the count still pending is recorded against the frame.
  settle.pendingImages = await page.evaluate(() => {
    const pending = [...document.images].filter((i) => !i.complete);
    return Promise.race([
      Promise.all(pending.map((i) => new Promise((r) => { i.onload = i.onerror = r; }))).then(() => 0),
      new Promise((r) => setTimeout(() => r([...document.images].filter((i) => !i.complete).length), 3000)),
    ]);
  });
  await page.waitForTimeout(300);
};
const shot = async (page, name, clip) => {
  await settle(page);
  if (settle.pendingImages) log.push({ id: `${name}:pendingImages`, count: settle.pendingImages });
  await page.screenshot({ path: `${OUT}/${name}.png`, ...SHOT, ...(clip ? { clip } : {}) });
};

const facts = (page) =>
  page.evaluate(({ PANEL, CLOSE }) => {
    const a = document.activeElement;
    const close = document.querySelector(CLOSE);
    const r = close?.getBoundingClientRect();
    const bar = document.querySelector('[data-fixed-chrome="sticky-cta"]');
    return {
      scrollY: Math.round(window.scrollY),
      panelsMounted: document.querySelectorAll(PANEL).length,
      close: close ? { name: close.getAttribute('aria-label'), w: +r.width.toFixed(2), h: +r.height.toFixed(2) } : null,
      focus: a ? { tag: a.tagName, location: a.getAttribute('data-cta-location'), focusVisible: a.matches(':focus-visible') } : null,
      barRequestAccess: bar
        ? [...bar.querySelectorAll('button')].filter((b) => b.textContent?.trim() === 'Request access').map((b) => (b.closest('form') ? 'submit' : 'pill'))
        : null,
      barPillInDom: bar ? !!bar.querySelector('[data-cta-location="footer"]') : null,
    };
  }, { PANEL, CLOSE });

const record = async (page, id) => log.push({ id, ...(await facts(page)) });

// The opener close-up for E9f: a clip around the element that holds focus, so
// a 2px ring is legible without zooming a full phone frame.
const focusClip = (page) =>
  page.evaluate(() => {
    const r = document.activeElement.getBoundingClientRect();
    const pad = 16;
    return { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), width: r.width + pad * 2, height: r.height + pad * 2 };
  });

const browser = await chromium.launch();

async function phone(initScript) {
  const ctx = await browser.newContext({ ...devices['Pixel 5'], viewport: { width: 375, height: 812 }, colorScheme: 'light', baseURL: BASE });
  const page = await ctx.newPage();
  if (initScript) await page.addInitScript(...initScript);
  return page;
}
async function desktop() {
  const ctx = await browser.newContext({ ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, colorScheme: 'light', baseURL: BASE });
  return ctx.newPage();
}
async function load(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
}
async function stickyOpen(page) {
  await load(page);
  await page.evaluate(() => window.scrollTo(0, Math.round(window.innerHeight * 1.2)));
  await page.waitForTimeout(600);
  await page.locator(CTA('footer')).click();
  await page.waitForTimeout(500);
}
async function navOpen(page) {
  await load(page);
  await page.locator(CTA('nav')).click();
  await page.waitForTimeout(500);
}

// ── E1 / E2 (B1)
{
  const p = await phone();
  await load(p);
  await p.evaluate(() => window.scrollTo(0, Math.round(window.innerHeight * 1.2)));
  await p.waitForTimeout(600);
  await record(p, 'E1');
  await shot(p, 'E1-sticky-bar-before');
  await p.locator(CTA('footer')).click();
  await p.waitForTimeout(500);
  await record(p, 'E2');
  await shot(p, 'E2-sticky-open-keyboard-down');
}

// ── E3, simulated keyboard (same shim and caveat as D7)
{
  const p = await phone([(kb) => {
    const listeners = [];
    const vv = { height: window.innerHeight, width: window.innerWidth, offsetTop: 0, offsetLeft: 0, scale: 1,
      addEventListener: (t, f) => listeners.push([t, f]), removeEventListener: () => {}, dispatchEvent: () => {} };
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
    window.__kbUp = () => { vv.height = window.innerHeight - kb; listeners.filter(([t]) => t === 'resize').forEach(([, f]) => f()); };
  }, KEYBOARD_PX]);
  await stickyOpen(p);
  await p.evaluate(() => window.__kbUp());
  await p.waitForTimeout(400);
  await record(p, 'E3');
  await settle(p);
  await p.screenshot({ ...SHOT, path: `${OUT}/E3-sticky-open-keyboard-up.png`, clip: { x: 0, y: 0, width: 375, height: 812 - KEYBOARD_PX } });
}

// ── E4 / E7 / E9 / E9f for the nav, at both widths
for (const [mk, sfx] of [[phone, ''], [desktop, '@1280']]) {
  const p = await mk();
  await navOpen(p);
  await record(p, `E4${sfx}`);
  await shot(p, `E4-nav-open${sfx}`);
  const h = await p.evaluate(() => window.innerHeight);
  await p.mouse.wheel(0, h);
  await p.waitForTimeout(600);
  await record(p, `E7${sfx}`);
  await shot(p, `E7-nav-open-scrolled-one-screen${sfx}`);

  await navOpen(p);
  await p.locator(CLOSE).click();
  await p.waitForTimeout(400);
  await record(p, `E9-nav${sfx}`);
  await shot(p, `E9-nav-after-close-click${sfx}`);

  await navOpen(p);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);
  await record(p, `E9f-nav${sfx}`);
  await shot(p, `E9f-nav-after-escape${sfx}`);
  await p.screenshot({ ...SHOT, path: `${OUT}/E9f-nav-after-escape-closeup${sfx}.png`, clip: await focusClip(p) });
}

// ── E8 / E9 / E9f for the sticky bar (phone only; md:hidden)
{
  const p = await phone();
  await stickyOpen(p);
  await p.mouse.wheel(0, 812);
  await p.waitForTimeout(600);
  await record(p, 'E8');
  await shot(p, 'E8-sticky-open-scrolled-one-screen');

  await stickyOpen(p);
  await p.locator(CLOSE).click();
  await p.waitForTimeout(400);
  await record(p, 'E9-sticky');
  await shot(p, 'E9-sticky-after-close-click');

  await stickyOpen(p);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);
  await record(p, 'E9f-sticky');
  await shot(p, 'E9f-sticky-after-escape');
  await p.screenshot({ ...SHOT, path: `${OUT}/E9f-sticky-after-escape-closeup.png`, clip: await focusClip(p) });
}

// ── E5 + H1 pricing, E6 footer
for (const [mk, sfx] of [[phone, ''], [desktop, '@1280']]) {
  const p = await mk();
  await load(p);
  const price = p.locator(CTA('pricing')).first();
  await price.scrollIntoViewIfNeeded();
  await p.waitForTimeout(700);
  await price.click();
  await p.waitForTimeout(500);
  await record(p, `E5${sfx}`);
  await shot(p, `E5-pricing-open${sfx}`);
  if (!sfx) {
    // H1: the pricing CLUSTER itself, so the hint's wrap is legible.
    const panel = p.locator(PANEL).first();
    const hint = await panel.evaluate((el) => {
      const h = el.querySelector('[id]:not(input)');
      const input = el.querySelector('input[type="email"]');
      const id = input?.getAttribute('aria-describedby');
      const t = id ? document.getElementById(id) : null;
      return t ? { text: t.textContent.trim(), scrollW: t.scrollWidth, clientW: t.clientWidth, lines: Math.round(t.getBoundingClientRect().height / parseFloat(getComputedStyle(t).lineHeight)) } : { missing: true, h: !!h };
    });
    log.push({ id: 'H1', panelInnerWidth: await panel.evaluate((el) => el.clientWidth), hint });
    await settle(p);
    await panel.screenshot({ ...SHOT, path: `${OUT}/H1-pricing-cluster-375.png` });
  }
}
{
  const p = await phone();
  await load(p);
  await p.locator('#cta').scrollIntoViewIfNeeded();
  await p.waitForTimeout(700);
  await shot(p, 'E6-footer-form');
}

await browser.close();
writeFileSync(`${OUT}/r2-log.json`, JSON.stringify(log, null, 2));
console.log(JSON.stringify(log, null, 2));
