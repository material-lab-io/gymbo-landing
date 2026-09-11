#!/usr/bin/env node
/**
 * gy-9ggf3 — every choice a visitor can pick must be FULLY READABLE.
 *
 * THE DEFECT THIS EXISTS FOR, measured on the live takedown form 2026-09-09:
 * the Reason <select> clipped its longest option — "It shows me and I did not
 * agree to this use", the one an actual rightsholder picks — at 390px. An
 * earlier fix (select{padding-right:36px}) stopped the option COLLIDING with the
 * native chevron but never made it FIT, so it was cut cleanly instead of
 * messily, which reads as deliberate.
 *
 * 🔴 WHY THE OBVIOUS CHECK DOES NOT WORK. For a natively-clipped <select> the
 * browser reports NO OVERFLOW: scrollWidth === clientWidth (measured: 324 ===
 * 324 while the text needed 299.4px in a 276px box). Any guard written as
 * `scrollWidth > clientWidth` PASSES this defect. The only thing that catches it
 * is measuring the option's text in the control's own computed font against the
 * padded box — which is what this does.
 *
 * It also checks ordinary labels, where scrollWidth IS meaningful.
 *
 * FAIL-CLOSED: if it finds nothing measurable it exits 2 rather than 0. A check
 * that passes because the page changed shape underneath it is the failure this
 * repo keeps finding.
 *
 * Usage: node scripts/check-option-text-fits.mjs <url> [width]
 */
import { chromium } from 'playwright';

const url = process.argv[2];
const width = Number(process.argv[3] || 390);
if (!url) {
  console.error('usage: check-option-text-fits.mjs <url> [width]');
  process.exit(2);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const res = await page.goto(url, { waitUntil: 'networkidle' });
if (!res || !res.ok()) {
  console.error(`REFUSING: ${url} returned ${res ? res.status() : 'no response'} — nothing was measured.`);
  await browser.close();
  process.exit(2);
}

const report = await page.evaluate(() => {
  const measured = [];
  const canvas = document.createElement('canvas').getContext('2d');
  const fontOf = (el) => {
    const cs = getComputedStyle(el);
    return { font: `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, cs };
  };

  // <select>: the browser hides the overflow, so measure the TEXT.
  for (const sel of document.querySelectorAll('select')) {
    const { font, cs } = fontOf(sel);
    canvas.font = font;
    const avail = sel.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    for (const opt of sel.options) {
      const w = canvas.measureText(opt.text).width;
      measured.push({ kind: 'option', control: sel.name || sel.id, text: opt.text,
                      available: +avail.toFixed(1), needed: +w.toFixed(1), fits: w <= avail });
    }
  }

  // Anything that can clip its own text horizontally. Labels and radio text wrap
  // by default, so a failure here is a real one (nowrap / fixed width / ellipsis).
  for (const el of document.querySelectorAll('label, legend, button, .radio-row')) {
    if (!el.textContent.trim()) continue;
    const clipped = el.scrollWidth > el.clientWidth + 1;
    measured.push({ kind: el.tagName.toLowerCase(), control: el.id || el.className || '',
                    text: el.textContent.trim().slice(0, 60),
                    available: el.clientWidth, needed: el.scrollWidth, fits: !clipped });
  }
  return measured;
});

await browser.close();

if (report.length === 0) {
  console.error(`REFUSING: found no options, labels or buttons on ${url} at ${width}px. ` +
    `A check with nothing to measure must not report success.`);
  process.exit(2);
}

const bad = report.filter((r) => !r.fits);
const opts = report.filter((r) => r.kind === 'option').length;
console.log(`measured ${report.length} item(s) at ${width}px on ${url}  (${opts} select option(s))`);
for (const b of bad) {
  console.error(`  TOO WIDE  [${b.kind} ${b.control}]  needs ${b.needed}px in ${b.available}px  "${b.text}"`);
}
if (bad.length) {
  console.error(`\n${bad.length} item(s) cannot be read in full at ${width}px.`);
  process.exit(1);
}
console.log('OK  every option and label fits.');
