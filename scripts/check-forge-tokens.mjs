#!/usr/bin/env node
/**
 * Forge token-drift gate for getgymbo.com.
 *
 * THE DEFECT THIS EXISTS FOR, measured 2026-09-06: src/forge-ui.tsx declared a
 * parallel copy of the brand palette as JS string literals — marigold #fbbf24,
 * charcoal #0a0a0a, bone #f0f0eb and 8 more. 11 of its 12 hardcoded values were
 * VERBATIM COPIES of a token that already existed in src/forge/forge.css, feeding
 * 111 call sites. Change the Forge palette and that copy silently does not move.
 * src/theme.css's own header meanwhile claimed "Nothing brand-colored is
 * hardcoded" — a comment asserting a protection the code did not have.
 *
 * THE RULE, deliberately narrow so it has no false positives:
 *   a raw colour literal outside src/forge/ that EXACTLY EQUALS the value of an
 *   existing Forge token is an error, and the message names the token to use.
 *
 * It does not moralise about every hex in the tree. A literal with no matching
 * token may be a legitimate one-off (or a gap in Forge) and is REPORTED, not
 * failed — that distinction is what keeps this gate quiet enough to stay
 * believed. Widening it to "no hex anywhere" would have flagged ~100 sites on
 * day one and been switched off within a week.
 *
 * 🔴 KNOWN COVERAGE LIMIT, stated so nobody reads a green here as "no drift".
 * This checks HEX literals only. The tree also carries ~90 rgba() literals, some
 * of which are alpha variants of Forge colours — rgba(240,240,235,0.22) is
 * --g-color-neutral-dark-fg at 22%. Matching those needs a rule about which
 * alpha steps are sanctioned, which Forge does not currently express, so
 * inventing one here would be this gate asserting a design decision it has no
 * authority to make. Tracked separately; a clean run means "no hex duplicates a
 * token", not "no drift exists".
 *
 * Exits 1 on drift, 0 when clean. `--list` prints the token table and exits 0.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ROOT, VENDORED, PIN, FILES, producerDir, readAtPin } from './forge-producer.mjs';


// 🔴 SSOT REPOINTED AT THE PRODUCER — gy-1phkc, pm ruling 2026-09-11.
//
// This used to read `const SSOT = join(ROOT, 'src/forge')`, i.e. this repo's own
// vendored copy. That made the gate UNFALSIFIABLE in the dimension that mattered:
// it asked "is this file internally consistent?" and could never ask "does it
// match the design system?". A green meant the local copy agreed with itself.
// It did so while the copy was missing 17 producer tokens and carried
// --g-font-size-micro: 10px against the producer's ratified 11px floor.
//
// The token table is now built from the PRODUCER's emitted CSS when a producer
// checkout is available (CI always provides one). src/forge/ is a generated
// mirror of exactly that, enforced byte-for-byte by
// `sync-forge-tokens.mjs --check` in the same job — so the fallback below is a
// convenience for local runs without a Gymbo-v1 checkout, not a second source
// of truth. If they ever disagree, the sync gate fails first and this gate's
// answer is moot.
// The token table is read from the producer AT THE PINNED SHA (see
// scripts/forge-producer.mjs for why the pin, not the worktree). src/forge/ is a
// generated mirror of exactly those bytes, enforced by
// `sync-forge-tokens.mjs --check` in the same CI job — so the local fallback
// below is a convenience for developers without a Gymbo-v1 checkout, not a
// second source of truth. CI asserts the fallback was NOT taken.
const PRODUCER_DIR = producerDir();
const producerCss = PRODUCER_DIR ? FILES.map((f) => readAtPin(PRODUCER_DIR, f)) : [];
const FROM_PRODUCER = producerCss.length > 0 && producerCss.every((c) => c !== null);
const tokenSources = FROM_PRODUCER
  ? producerCss
  : walk(VENDORED).map((f) => readFileSync(f, 'utf8'));
// 🔴 functions/ JOINED THIS LIST IN gy-aczn1, AND THE OMISSION WAS NOT COSMETIC.
// The three Cloudflare Pages Functions serve PUBLIC pages — /w/<token>, /m/<id>,
// /m/takedown — and this gate scanned src/ and only .css/.tsx/.ts, so it was
// blind to them twice over: wrong directory, wrong extension. Measured
// 2026-09-09: 48 hex literals in functions/ each EXACTLY equal to an existing
// token, while this gate reported green. A green here meant "src/ has no
// duplicates", never "the site has no duplicates".
// Proven as a differential, not read off the source: the same literal (#fbbf24)
// seeded in src/theme.css exited 1 and named the token; seeded in
// functions/w/[token].js it exited 0.
const SCAN = [join(ROOT, 'src'), join(ROOT, 'functions')];
// functions/_forge.js is GENERATED from src/forge/forge.css and is exempt for the
// same reason src/forge/ is: it IS the palette, not a copy that drifted from it.
// Its own drift is caught by `gen-functions-forge-tokens.mjs --check` in CI, so
// exempting it here does not create an unwatched hole.
const GENERATED = join(ROOT, 'functions/_forge.js');
const EXT = /\.(css|tsx|ts|js)$/;

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (EXT.test(p)) out.push(p);
  }
  return out;
}

const norm = (h) => {
  h = h.toLowerCase().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return '#' + h.slice(0, 6);
};

// Build the token table from the SSOT.
const tokens = new Map(); // normalised hex -> token name
for (const src of tokenSources) {
  for (const m of src.matchAll(/(--g-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    const k = norm(m[2]);
    if (!tokens.has(k)) tokens.set(k, m[1]);
  }
}

if (process.argv.includes('--list')) {
  console.log(`Forge token table (${tokens.size} colour tokens):`);
  for (const [hex, name] of [...tokens].sort()) console.log(`  ${hex}  ${name}`);
  process.exit(0);
}

/**
 * Replace comment bodies with spaces, preserving every newline and column so
 * reported line numbers stay true.
 *
 * A first version of this gate skipped lines whose trimmed text STARTED with
 * '*', '//' or '/*'. That is a line-prefix heuristic, not comment handling, and
 * it produced 3 false positives out of 5 findings on the first run — including
 * one against this gate's own documentation, where a block comment explaining
 * the defect quotes the offending hex. A gate that flags its own explanation is
 * a gate somebody deletes.
 *
 * Known limit, stated rather than hidden: this does not parse strings, so a hex
 * inside a string that itself contains a comment marker could still confuse it.
 * The '//' rule ignores a match preceded by ':' so URLs survive.
 */
function blankComments(src) {
  let out = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  out = out.replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
  return out;
}

const errors = [];
const advisory = [];

for (const f of SCAN.flatMap((d) => walk(d))) {
  // The vendored mirror is allowed to contain literals — it IS the palette.
  // NOTE this tests VENDORED, not SSOT: since gy-1phkc the token table may be
  // sourced from the producer checkout, which lives outside this tree entirely,
  // so a startsWith(SSOT) test would no longer exempt src/forge/ and the gate
  // would flag the design system for being the design system.
  if (f.startsWith(VENDORED)) continue;
  if (f === GENERATED) continue;    // generated FROM the SSOT; drift caught by --check
  const rel = relative(ROOT, f);
  const lines = blankComments(readFileSync(f, 'utf8')).split('\n');
  lines.forEach((line, i) => {

    for (const m of line.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
      const hex = norm(m[0]);
      const tok = tokens.get(hex);
      const where = `${rel}:${i + 1}`;
      if (tok) errors.push(`${where}  ${m[0]}  is exactly ${tok} — use var(${tok})`);
      else advisory.push(`${where}  ${m[0]}  (no matching Forge token)`);
    }
  });
}

if (advisory.length) {
  console.log(`\nAdvisory — ${advisory.length} literal(s) with no matching Forge token (NOT failing):`);
  for (const a of advisory.slice(0, 20)) console.log(`  ${a}`);
  if (advisory.length > 20) console.log(`  ... and ${advisory.length - 20} more`);
}

if (errors.length) {
  console.error(`\n::error::Forge token drift — ${errors.length} literal(s) duplicate an existing token:`);
  for (const e of errors) console.error(`  ${e}`);
  console.error('\nThese are copies of the design system, not decisions. Point them at the token.');
  process.exit(1);
}

console.log(
  `\nOK  no literal outside src/forge/ duplicates a Forge token (${tokens.size} tokens checked, ` +
    `table built from ${FROM_PRODUCER ? `the PRODUCER ${PIN.repo}@${PIN.sha.slice(0, 9)}` : 'the local vendored mirror — NO producer checkout found'}).`,
);
