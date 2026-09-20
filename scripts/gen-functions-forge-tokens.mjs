#!/usr/bin/env node
/**
 * Generate functions/_forge.js from src/forge/forge.css.
 *
 * WHY THIS EXISTS (gy-aczn1). The three server-rendered public pages —
 * /w/<token>, /m/<id>, /m/takedown — are Cloudflare Pages Functions. They run in
 * a Worker, emit their own <style> block, and cannot import the site's CSS. So
 * they carried a hand-written copy of the brand palette: 48 hex literals that
 * EXACTLY equalled an existing Forge token. Change Forge and those three public
 * pages silently do not move.
 *
 * That is the same defect scripts/check-forge-tokens.mjs was built for after
 * src/forge-ui.tsx did it in .tsx — reproduced one directory over, in files the
 * gate could not see (it scanned src/ and only .css/.tsx/.ts).
 *
 * 🔴 A GENERATED COPY IS ONLY BETTER THAN A HAND-WRITTEN ONE IF THE HAND-WRITTEN
 * TWIN IS RETIRED. Generating this file while leaving the inline palettes in
 * place would be strictly worse than before: two copies instead of one, both
 * looking authoritative. The three inline palettes were deleted in the same
 * commit that added this generator, and check-forge-tokens.mjs now scans
 * functions/ so they cannot come back unnoticed.
 *
 * The drift risk this file itself introduces is closed by --check: CI
 * regenerates and diffs, so an edit to forge.css that is not carried here fails
 * the build rather than shipping a stale palette.
 *
 * Usage:  node scripts/gen-functions-forge-tokens.mjs           (write)
 *         node scripts/gen-functions-forge-tokens.mjs --check   (verify, exit 1 on drift)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src/forge/forge.css');
const OUT = join(ROOT, 'functions/_forge.js');

const css = readFileSync(SRC, 'utf8');

// Only the :root block, and only colour tokens. Spacing/radius tokens are not
// duplicated in these pages, so pulling them in would add weight to a page whose
// entire point is being cheap on a client's mobile data.
const rootBlock = css.slice(css.indexOf(':root'), css.indexOf('}', css.indexOf(':root')));
const tokens = [];
for (const m of rootBlock.matchAll(/(--g-color-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
  tokens.push([m[1], m[2].toLowerCase()]);
}
if (tokens.length === 0) {
  // A generator that silently emits an empty palette would take every page to
  // unstyled black-on-white and every test would still pass, because nothing
  // asserts a colour. Refuse instead.
  console.error('gen-functions-forge-tokens: parsed ZERO tokens from src/forge/forge.css — refusing to write an empty palette.');
  process.exit(2);
}

const body = `// GENERATED FILE — DO NOT EDIT.
//
// Source of truth: src/forge/forge.css
// Regenerate:     node scripts/gen-functions-forge-tokens.mjs
// Verified in CI: node scripts/gen-functions-forge-tokens.mjs --check
//
// The Pages Functions serve standalone HTML and cannot import the site's CSS,
// so the palette has to travel with them. This file is that copy, and it is
// generated precisely so it cannot drift from Forge unnoticed (gy-aczn1).
export const FORGE = {
${tokens.map(([n, v]) => `  ${JSON.stringify(n)}: ${JSON.stringify(v)},`).join('\n')}
};

// Emit ONLY the tokens a page actually uses, as :root custom properties.
// A page pulling all ${tokens.length} would ship declarations it never reads to a client on
// mobile data, which is the same instinct this whole surface exists to serve.
//
// An unknown name THROWS rather than emitting nothing: a silently-missing custom
// property falls back to the browser default and the page renders in the wrong
// colour with no error anywhere.
export function rootVars(names) {
  return names
    .map((n) => {
      const key = \`--g-color-\${n}\`;
      if (!(key in FORGE)) throw new Error(\`unknown Forge token: \${key}\`);
      return \`\${key}:\${FORGE[key]}\`;
    })
    .join(';') + ';';
}
`;

if (process.argv.includes('--check')) {
  const current = readFileSync(OUT, 'utf8');
  if (current !== body) {
    console.error('DRIFT: functions/_forge.js does not match src/forge/forge.css.');
    console.error('Run: node scripts/gen-functions-forge-tokens.mjs');
    process.exit(1);
  }
  console.log(`functions/_forge.js is in sync with src/forge/forge.css (${tokens.length} colour tokens).`);
  process.exit(0);
}

writeFileSync(OUT, body);
console.log(`wrote functions/_forge.js — ${tokens.length} colour tokens from src/forge/forge.css`);
