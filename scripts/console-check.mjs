// Console-error gate (gy-kefk3 #1): load every route in a headless browser and
// fail on OUR JS errors (uncaught exceptions + React/hydration console errors).
// Routes are discovered from the generated sitemap, so new pages are covered
// automatically. Third-party resource-load noise (fonts/analytics/CDN, favicon)
// is filtered out so a CDN hiccup can't flake the deploy gate.
// Usage: node scripts/console-check.mjs <base-url>
import { chromium } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:8788";

const sitemap = await fetch(`${base}/sitemap.xml`).then((r) => r.text());
const paths = [...sitemap.matchAll(/<loc>https:\/\/getgymbo\.com(\/[^<]*)<\/loc>/g)].map((m) => m[1]);
if (paths.length === 0) {
  console.error("console-check: no routes found in sitemap — aborting");
  process.exit(1);
}

// Ignore third-party / network noise — we only gate on our own JS errors.
const ignore = (t) =>
  /failed to load resource|net::err|err_|favicon|fonts\.g(oogle|static)apis|analytics\.getgymbo|the server responded with a status/i.test(t);

const browser = await chromium.launch();
const failures = [];
// gy-pvi8y: tracked separately from `failures`/`paths` on purpose. The
// dark-seed check below is a single extra assertion, not one of the
// sitemap routes -- folding its failure into `failures` while reporting
// against `paths.length` produced impossible counts like "23/22 pages"
// (23 failures against a 22-page denominator that never counted this
// check in the first place).
let darkSeedFailed = null;

// Light-only theme invariant, dark-seed case (gy-ruxbj, PM scope addition
// 2026-08-12 — "the one that matters"). Kaushik was served a dark site
// because a runtime theme-flip script read a pre-existing localStorage
// value with no way to escape it (gy-31moh removed the toggle, not the
// flip). Pre-seed localStorage BEFORE the app boots and assert the site
// still renders light — this is the one check that would have caught the
// actual incident; a plain page-load check (no seeded storage) never would.
{
  const themePage = await browser.newPage();
  await themePage.addInitScript(() => localStorage.setItem("theme", "dark"));
  await themePage.goto(base + "/", { waitUntil: "load", timeout: 30000 });
  await themePage.waitForTimeout(300);
  const bg = await themePage.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const htmlDark = await themePage.evaluate(() => document.documentElement.getAttribute("data-theme") === "dark");
  await themePage.close();
  // Light token is #FAFAF7 -> rgb(250, 250, 247). Allow the whole FAFAFx
  // family (a couple of points of anti-aliasing/rounding slack) rather than
  // an exact string match.
  const m = bg.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  const isLight = m && Number(m[1]) > 240 && Number(m[2]) > 240 && Number(m[3]) > 235;
  if (htmlDark || !isLight) {
    darkSeedFailed = "/ (dark-seeded)";
    console.error(`FAIL / with localStorage theme="dark" pre-seeded — rendered dark (bg=${bg}, data-theme dark=${htmlDark})`);
  } else {
    console.log(`OK   / stays light even with localStorage theme="dark" pre-seeded (bg=${bg})`);
  }
}

for (const p of paths) {
  const page = await browser.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !ignore(m.text())) errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  const resp = await page
    .goto(base + p, { waitUntil: "load", timeout: 30000 })
    .catch((e) => {
      errors.push(`goto failed: ${e.message}`);
      return null;
    });
  if (resp && resp.status() >= 400) errors.push(`HTTP ${resp.status()}`);
  await page.waitForTimeout(700); // let hydration settle
  await page.close();
  if (errors.length) {
    failures.push(p);
    console.error(`FAIL ${p}`);
    errors.forEach((e) => console.error(`     ${e}`));
  } else {
    console.log(`OK   ${p}`);
  }
}
await browser.close();

if (darkSeedFailed) console.error(`\nconsole-check: dark-seed invariant FAILED (${darkSeedFailed})`);
if (failures.length) {
  console.error(`console-check: ${failures.length}/${paths.length} page(s) have console errors → gate FAIL`);
}
if (darkSeedFailed || failures.length) process.exit(1);
console.log(`\nconsole-check: all ${paths.length} pages clean, dark-seed invariant holds`);
