#!/usr/bin/env node
/**
 * Cross-repo Forge sync for getgymbo.com  (gy-1phkc).
 *
 * THE DEFECT THIS EXISTS FOR, measured 2026-09-09 by designer and re-verified
 * 2026-09-11 against both origin/mains (landing c18fd9c, Gymbo-v1 2656eb128):
 *
 *   getgymbo.com did not consume the Forge producer. Gymbo-v1 owns the SSOT at
 *   design-tokens/ and emits design-tokens/dist/forge.css. This repo carried its
 *   own copy at src/forge/*.css with NO sync step, NO import and NO gate
 *   comparing the two. src/forge/README.md said "GENERATED — Forge SSOT
 *   (Gymbo-v1 design-tokens/)" while nothing generated it: a file that claims to
 *   be generated and is actually hand-kept is strictly worse than an honest
 *   hand-kept file, because the claim stops anyone looking.
 *
 *   Measured divergence at those two shas:
 *     forge.css       producer 119 tokens · landing 102 · 17 producer-only · 1 same-name-different-value
 *     forge.dark.css  producer  27 tokens · landing  25 ·  2 producer-only
 *     forge.hc.css    identical
 *     --g-font-size-micro   producer 11px   landing 10px
 *   11px is the HARD MINIMUM ratified in gy-hhgqi DS2 (2026-06-23). Landing's
 *   copy sanctioned 10px — below a ratified accessibility floor. It was
 *   UNCONSUMED (zero text-[10px] in the tree), so this was a latent trap rather
 *   than a live a11y defect: the first person to size micro text from the token
 *   would have got 10px and believed they were conforming. A wrong token
 *   produces confident compliance.
 *
 *   Landing had invented NOTHING — 0 landing-only tokens in all three files.
 *   The drift was entirely one-directional: the producer moved and the copy did
 *   not.
 *
 * 🔴 WHY THIS IS A SYNC AND NOT AN EMITTER. The standing constraint from pm's
 * 2026-09-11 ruling: do NOT add a generator and leave the hand-maintained copy
 * in place. That is DUAL SOURCE and it is worse than hand-kept, because it looks
 * generated while drifting — the identical trap gy-aczn1 hit. src/forge/*.css
 * are RETIRED as hand-written files by this change and become generated
 * artifacts with recorded provenance. There is exactly one authoritative copy,
 * in Gymbo-v1, and one derived copy here that CI regenerates and diffs.
 *
 * DELIVERY: vendored + pinned sha (pm ruling 2026-09-11, over a published
 * package) — reversible, no publish infrastructure to acquire, and it keeps the
 * Cloudflare Pages build hermetic with no network fetch on the deploy path.
 *
 * USAGE
 *   node scripts/sync-forge-tokens.mjs            regenerate src/forge/*.css from the pin
 *   node scripts/sync-forge-tokens.mjs --check    regenerate in memory, diff, exit 1 on drift
 *   node scripts/sync-forge-tokens.mjs --pin <sha> repin to a producer sha and regenerate
 *
 * The producer checkout is located by $FORGE_PRODUCER_DIR (CI checks out
 * Gymbo-v1 there using the GYMBO_V1_PAT secret this repo already holds for
 * render-hero-video.yml — no new infrastructure). Locally it falls back to a
 * sibling ../gymbo or ../Gymbo-v1 checkout.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, VENDORED, PIN as pin, FILES, producerDir, readAtPin, tokensOf } from './forge-producer.mjs';

const PIN_PATH = join(VENDORED, 'forge.pin.json');

// (producerDir / readAtPin now live in scripts/forge-producer.mjs)
/**
 * 🔴 READ AT THE PINNED SHA, NEVER FROM THE WORKING TREE.
 *
 * Caught while building this: the first version read `join(dir, pin.path, file)`
 * off disk and stamped `pin.sha` into the provenance header regardless. Run
 * against a producer checkout sitting 1745 commits behind origin/main, it
 * happily reported "producer 106 tokens" and would have emitted a file headed
 * "Pinned at commit: 2656eb128" containing a DIFFERENT commit's tokens.
 *
 * That is this bead's own defect, reproduced inside its fix: an artifact whose
 * recorded provenance is decorative rather than load-bearing. A header that can
 * be wrong is worse than no header, because it is the thing the next reader
 * trusts instead of looking. So the bytes now come from `git show <sha>:<path>`
 * — the header cannot disagree with the content, because the sha in the header
 * is the sha the content was read from.
 */

/**
 * The provenance header. This is the whole point of part 2 of the design: a
 * generated file that does not record WHAT it came from and AT WHICH COMMIT is
 * indistinguishable from a hand-edited one to the next reader — which is
 * precisely how this drifted 17 tokens without anyone noticing.
 *
 * It must be a pure function of the pin, or `--check` could never diff clean.
 * No timestamps, no hostnames, nothing that varies between two correct runs.
 */
function header(file) {
  return [
    '/* 🔴 GENERATED FILE — DO NOT EDIT BY HAND.',
    ` * Source: ${pin.repo}  ${pin.path}/${file}`,
    ` * Pinned at commit: ${pin.sha}`,
    ' *',
    ' * Regenerate:  node scripts/sync-forge-tokens.mjs',
    ' * Verify:      node scripts/sync-forge-tokens.mjs --check',
    ' *',
    ' * Edits here are erased by the next sync AND fail CI immediately. Token',
    ' * changes belong in the producer (Gymbo-v1 design-tokens/), then repin:',
    ' *   node scripts/sync-forge-tokens.mjs --pin <producer-sha>',
    ' */',
    '',
  ].join('\n');
}

function render(dir, file) {
  const css = readAtPin(dir, file);
  if (css === null) {
    console.error(
      `::error::COULD NOT READ ${pin.path}/${file} at pinned commit ${pin.sha}.\n` +
        `A shallow clone does not contain it — use fetch-depth: 0. This is an UNKNOWN, not a pass.`,
    );
    process.exit(2);
  }
  return header(file) + css;
}

const check = process.argv.includes('--check');
const pinIdx = process.argv.indexOf('--pin');

if (pinIdx !== -1) {
  const sha = process.argv[pinIdx + 1];
  if (!sha || !/^[0-9a-f]{7,40}$/.test(sha)) {
    console.error('::error::--pin requires a producer commit sha');
    process.exit(2);
  }
  pin.sha = sha;
  writeFileSync(PIN_PATH, JSON.stringify(pin, null, 2) + '\n');
  console.log(`repinned to ${sha}`);
}

const dir = producerDir();
if (!dir) {
  console.error(`::error::Forge producer checkout not found. Set FORGE_PRODUCER_DIR to a git checkout of ${pin.repo}.`);
  process.exit(2);
}
const drifted = [];

for (const file of FILES) {
  const want = render(dir, file);
  const dest = join(VENDORED, file);
  const have = existsSync(dest) ? readFileSync(dest, 'utf8') : '';
  if (want === have) continue;
  if (check) {
    drifted.push({ file, have, want });
  } else {
    writeFileSync(dest, want);
    console.log(`synced  src/forge/${file}`);
  }
}

if (!check) {
  if (!drifted.length) console.log(`\nOK  src/forge/ regenerated from ${pin.repo}@${pin.sha}`);
  process.exit(0);
}

if (!drifted.length) {
  console.log(`\nOK  src/forge/ matches ${pin.repo}@${pin.sha} exactly (${FILES.length} files).`);
  process.exit(0);
}

/**
 * Report the drift as TOKENS, not as a byte diff. A byte diff on a 13KB CSS file
 * tells a reviewer "something changed"; the whole failure this bead exists for
 * is that nobody could see WHICH tokens disagreed. Name them.
 */
const toks = tokensOf;

console.error('\n::error::Forge drift — src/forge/ does not match the pinned producer.');
for (const { file, have, want } of drifted) {
  const H = toks(have);
  const W = toks(want);
  const missing = [...W.keys()].filter((k) => !H.has(k));
  const extra = [...H.keys()].filter((k) => !W.has(k));
  const changed = [...W.keys()].filter((k) => H.has(k) && H.get(k) !== W.get(k));
  console.error(`\n  ${file}  producer ${W.size} tokens · landing ${H.size}`);
  for (const k of changed)
    console.error(`    ! ${k}\n        producer: ${W.get(k)}\n        landing : ${H.get(k)}`);
  for (const k of missing) console.error(`    + ${k}: ${W.get(k)}   MISSING from landing`);
  for (const k of extra) console.error(`    - ${k}: ${H.get(k)}   NOT IN PRODUCER (landing-invented)`);
  if (!changed.length && !missing.length && !extra.length)
    console.error('    (token sets identical — the difference is in comments or provenance header)');
}
console.error(
  `\nThe producer is authoritative. Run:  node scripts/sync-forge-tokens.mjs` +
    `\nDo NOT hand-copy values across — that closes today's diff and leaves the mechanism that produced it.`,
);
process.exit(1);
