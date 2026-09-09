#!/usr/bin/env node
// gy-a2xps.9 — fail if the media pages' inlined design tokens drift from Forge.
//
// WHY THIS EXISTS. functions/m/*.js inline their CSS because a Cloudflare Pages
// Function cannot import the app's hashed Vite bundle. That makes a SECOND COPY
// of the token values, and a hand-kept second copy is exactly the dual-source
// problem this rig has been burned by: the copy does not fail, it drifts, and
// the public page slowly stops looking like Gymbo while every test stays green.
//
// So the copy is CHECKED. src/forge/forge.css is the SSOT; this reads the token
// values out of it and asserts the inlined literals still match.
//
// IT HAS A POSITIVE CONTROL. A scanner that finds nothing because its regex is
// wrong reports the same clean exit as one that found no drift. So it first
// proves it can read a known token out of forge.css, and refuses to pass if it
// cannot -- a zero it cannot substantiate is a failure, not a pass.
import { readFileSync } from "node:fs";

const forge = readFileSync("src/forge/forge.css", "utf8");

// token name in forge.css -> the value we inlined, per theme.
const EXPECT = {
  "--g-color-neutral-light-0":  "#fafaf7",
  "--g-color-neutral-light-1":  "#eaeae5",
  "--g-color-neutral-light-3":  "#dcdcd9",
  "--g-color-neutral-light-fg": "#1a1a1a",
  "--g-color-grey-muted-fg-light": "#555555",
  "--g-color-brand-amber-text-light": "#92400e",
  "--g-color-status-destructive-light": "#b80f34",
  "--g-color-neutral-dark-0":  "#0a0a0a",
  "--g-color-neutral-dark-1":  "#141414",
  "--g-color-neutral-dark-3":  "#2c2c2e",
  "--g-color-neutral-dark-fg": "#f0f0eb",
  "--g-color-grey-muted-fg-dark": "#b8b8b8",
  "--g-color-brand-marigold-500": "#fbbf24",
  "--g-color-status-destructive-dark": "#ff6961",
  "--g-color-brand-amber-500": "#f59e0b",
};

const read = (name) => {
  const m = forge.match(new RegExp(`${name}\\s*:\\s*([^;]+);`));
  return m ? m[1].trim().toLowerCase() : null;
};

// POSITIVE CONTROL, first and unconditional.
const control = read("--g-color-neutral-light-0");
if (control !== "#fafaf7") {
  console.error(
    `FAIL (positive control): could not read --g-color-neutral-light-0 out of ` +
    `src/forge/forge.css (got ${control}). The parser is broken or the file moved, ` +
    `so a clean run below would prove NOTHING. Refusing to pass.`);
  process.exit(2);
}

let bad = 0;
for (const [token, inlined] of Object.entries(EXPECT)) {
  const actual = read(token);
  if (actual === null) {
    console.error(`FAIL ${token}: not found in forge.css. It was renamed or removed; the media page is now painting a colour the design system no longer defines.`);
    bad++;
  } else if (actual !== inlined.toLowerCase()) {
    console.error(`FAIL ${token}: forge.css says ${actual}, functions/m/*.js inlines ${inlined}.`);
    bad++;
  }
}

if (bad) {
  console.error(`\n${bad} token(s) drifted. Update the inlined CSS in functions/m/[id].js and functions/m/takedown.js to match src/forge/forge.css.`);
  process.exit(1);
}
console.log(`OK: ${Object.keys(EXPECT).length} inlined tokens match src/forge/forge.css (positive control passed).`);
