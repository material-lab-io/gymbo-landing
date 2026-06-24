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

if (failures.length) {
  console.error(`\nconsole-check: ${failures.length}/${paths.length} page(s) have console errors → gate FAIL`);
  process.exit(1);
}
console.log(`\nconsole-check: all ${paths.length} pages clean`);
