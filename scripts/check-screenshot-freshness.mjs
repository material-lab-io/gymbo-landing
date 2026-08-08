// Screenshot staleness gate (gy-a73px.15).
//
// Kaushik caught the same stale app screenshots on the live site twice
// (2026-08-06, 2026-08-08) with no mechanical detector — just a human
// noticing a rendering detail. This script is that mechanical, fail-closed
// detector: every screenshot actually composited into the site (the SCREENS
// map in optimize-gallery.mjs) must have a manifest entry in
// public/screens/manifest.json that is verified and not older than
// maxAgeDays. See public/screens/MANIFEST.md for the full schema + rationale.
//
// Run: node scripts/check-screenshot-freshness.mjs
// Exit 0 = all gated screenshots fresh. Exit 1 = at least one is stale,
// unverified, or missing a manifest entry — this should block deploy.

import { readFile } from "node:fs/promises";
import { SCREENS } from "./screens-map.mjs";

const MANIFEST_PATH = "public/screens/manifest.json";

const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
const maxAgeDays = manifest.maxAgeDays ?? 21;
const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
const now = Date.now();

let failed = false;
const rows = [];

for (const [slug, sourceFile] of Object.entries(SCREENS)) {
  const entry = manifest.entries?.[sourceFile];

  if (!entry) {
    failed = true;
    rows.push(`FAIL  ${slug.padEnd(12)} ${sourceFile.padEnd(34)} no manifest entry`);
    continue;
  }

  if (entry.verified !== true) {
    failed = true;
    rows.push(`FAIL  ${slug.padEnd(12)} ${sourceFile.padEnd(34)} unverified (verified: ${entry.verified})`);
    continue;
  }

  const capturedAt = Date.parse(entry.capturedAt ?? "");
  if (Number.isNaN(capturedAt)) {
    failed = true;
    rows.push(`FAIL  ${slug.padEnd(12)} ${sourceFile.padEnd(34)} invalid/missing capturedAt`);
    continue;
  }

  const ageDays = Math.floor((now - capturedAt) / (24 * 60 * 60 * 1000));
  if (now - capturedAt > maxAgeMs) {
    failed = true;
    rows.push(`FAIL  ${slug.padEnd(12)} ${sourceFile.padEnd(34)} ${ageDays}d old (max ${maxAgeDays}d)`);
    continue;
  }

  rows.push(`OK    ${slug.padEnd(12)} ${sourceFile.padEnd(34)} ${ageDays}d old`);
}

console.log(`Screenshot freshness gate (maxAgeDays=${maxAgeDays}):`);
for (const row of rows) console.log(`  ${row}`);

if (failed) {
  console.error(
    "\nFAIL: one or more gated screenshots are missing a manifest entry, unverified, or stale.\n" +
      "See public/screens/MANIFEST.md for how the capture crew backfills a real entry (gy-5xmxm)."
  );
  process.exit(1);
}

console.log("\nOK: all gated screenshots verified and fresh.");
