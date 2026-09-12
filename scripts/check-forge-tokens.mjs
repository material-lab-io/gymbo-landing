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
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { join, relative, isAbsolute, sep } from 'node:path';
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
// Evaluated lazily, below the walk()/EXT declarations — the fallback branch calls
// walk(), and reading it here crashed with "Cannot access 'EXT' before
// initialization" the moment a run took that branch.
const readTokenSources = () =>
  FROM_PRODUCER ? producerCss : walk(VENDORED).map((f) => readFileSync(f, 'utf8'));
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

// Alpha literals appear in BOTH spellings in this tree — `0.14` and `.14`, and
// `0.6` vs a hypothetical `0.60`. Measured: 12 sites at .14 split across the two
// forms. Compare numerically, or half the instances read as off-scale and the
// rule silently under-reports exactly where it matters most.
const normAlpha = (a) => String(Number(a));

const norm = (h) => {
  h = h.toLowerCase().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return '#' + h.slice(0, 6);
};

// Build the token table from the SSOT.
const tokens = new Map(); // normalised hex -> token name
for (const src of readTokenSources()) {
  for (const m of src.matchAll(/(--g-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    const k = norm(m[2]);
    if (!tokens.has(k)) tokens.set(k, m[1]);
  }
}

// ============================================================================
// ALPHA-AWARE RULE — gy-73h3j, the open half of gy-1phkc AC4.
//
// gy-1phkc imported the 7 alpha tokens (whisper .04, hairline .08, subtle .14,
// muted .22, veil .6, surface .7, scrim .75) but did NOT migrate the literals.
// This repo hand-writes the alpha scale as raw rgba() at exactly those steps.
//
// 🔴 WHY THIS RULE COULD NOT HAVE BEEN WRITTEN BEFORE gy-1phkc, and why it can
// now: matching rgba() needs a statement of WHICH alpha steps are sanctioned.
// Before the producer shipped the alpha scale as named tokens, inventing that
// list here would have been the gate asserting a design decision it has no
// authority to make. The steps are now a stated fact, read from the SSOT below
// rather than hardcoded — so if Forge retires a step, this rule follows.
//
// 🔴 DELIBERATELY NARROW, for the same reason the hex rule is (see header): this
// is NOT "no rgba anywhere". A literal FAILS only when BOTH halves match a
// token — the colour equals a Forge colour token AND the alpha equals a Forge
// alpha step. That pair is the alpha scale duplicated by hand, which is the
// defect. An rgba() at an off-scale alpha is REPORTED, never failed: it may be
// a legitimate one-off, and failing it is how a gate gets switched off.
// ============================================================================
const alphas = new Map(); // normalised alpha value -> alpha token name
for (const src of readTokenSources()) {
  for (const m of src.matchAll(/(--g-alpha-[a-z0-9-]+)\s*:\s*([0-9]*\.?[0-9]+)\s*;/g)) {
    const k = normAlpha(m[2]);
    if (!alphas.has(k)) alphas.set(k, m[1]);
  }
}

// rgb triple -> colour token name, derived from the same hex table so the two
// rules cannot disagree about what a token's value is.
const rgbTokens = new Map();
for (const [hex, name] of tokens) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const k = `${r},${g},${b}`;
  if (!rgbTokens.has(k)) rgbTokens.set(k, name);
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

/**
 * True when `f` is the directory `dir` itself or lives underneath it.
 *
 * 🔴 THE DEFECT THIS REPLACES — gy-swdgh, measured on main 57943e8. This test
 * used to be `f.startsWith(VENDORED)`, a STRING prefix where a PATH boundary
 * was meant. `VENDORED` is <ROOT>/src/forge with no trailing separator, so the
 * exemption also swallowed every sibling whose name merely begins with
 * "forge" — and exactly one exists: src/forge-ui.tsx, which is THE FILE THIS
 * GATE WAS WRITTEN FOR (see the header: it declared a parallel copy of the
 * brand palette). The gate reported OK over its own founding defect for its
 * whole life, and the gy-1phkc SSOT repoint carried the bug through unchanged.
 * Comparing on a path boundary is the whole fix; `..` and absolute results mean
 * "outside", and an empty result means "is the directory itself".
 */
function insideDir(f, dir) {
  const rel = relative(dir, f);
  return rel === '' || (!rel.startsWith('..' + sep) && rel !== '..' && !isAbsolute(rel));
}

// ============================================================================
// EXEMPTIONS — EACH ONE STATES WHAT IT IS FOR. (designer's standing ask, 2026-09-12,
// arising from gy-swdgh.)
//
// 🔴 WHY THIS IS A TABLE AND NOT TWO `if` LINES. The gy-swdgh defect was an
// exemption whose PURPOSE lived only in a comment: it was written to mean "the
// src/forge/ directory", was implemented as a string prefix, and silently grew to
// cover src/forge-ui.tsx — the one file the gate exists for. It then survived the
// gy-1phkc refactor because a rename carried the mechanism without the intent.
// Naming each exemption and printing what it caught makes both halves visible: if
// an exemption starts matching something it was not written for, the COUNT moves
// and the name no longer describes the set. A comment cannot do that.
// ============================================================================
const EXEMPTIONS = [
  {
    name: 'vendored-mirror',
    // FOR: src/forge/ IS the palette. It is a generated mirror of the producer and
    // is SUPPOSED to contain raw literals; flagging it would be flagging the design
    // system for being the design system. Its fidelity is enforced elsewhere, by
    // sync-forge-tokens.mjs --check, so exempting it here loses no coverage.
    // NOT FOR: anything merely NAMED like it. Containment, never a prefix.
    reason: 'the vendored mirror IS the palette; its fidelity is gated by sync-forge-tokens.mjs --check',
    test: (f) => insideDir(f, VENDORED),
  },
  {
    name: 'generated-functions-palette',
    // FOR: functions/_forge.js only. It is GENERATED from src/forge/forge.css
    // because Pages Functions run in a Worker and cannot import the site's CSS.
    // Its drift is caught by gen-functions-forge-tokens.mjs --check.
    // NOT FOR: hand-written code in functions/. That is scanned — functions/ once
    // held 48 exact duplicates under a green check (gy-aczn1).
    reason: 'generated from forge.css; drift gated by gen-functions-forge-tokens.mjs --check',
    test: (f) => f === GENERATED,
  },
];
const exemptedBy = new Map();

// gy-73h3j: colour-at-sanctioned-alpha hits, counted per (file, literal).
const alphaFound = new Map();
const alphaSites = new Map();

const errors = [];
const advisory = [];

for (const f of SCAN.flatMap((d) => walk(d))) {
  // The vendored mirror is allowed to contain literals — it IS the palette.
  // NOTE this tests VENDORED, not SSOT: since gy-1phkc the token table may be
  // sourced from the producer checkout, which lives outside this tree entirely,
  // so a startsWith(SSOT) test would no longer exempt src/forge/ and the gate
  // would flag the design system for being the design system.
  const exempt = EXEMPTIONS.find((e) => e.test(f));
  if (exempt) {
    exemptedBy.set(exempt.name, (exemptedBy.get(exempt.name) || 0) + 1);
    continue;
  }
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

    // gy-73h3j: the same question for rgba(). Fails only when the colour AND the
    // alpha BOTH name a token; anything else is reported, not failed.
    for (const m of line.matchAll(/rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*([0-9]*\.?[0-9]+)\s*\)/g)) {
      const where = `${rel}:${i + 1}`;
      const colour = rgbTokens.get(`${+m[1]},${+m[2]},${+m[3]}`);
      const alpha = alphas.get(normAlpha(m[4]));
      if (colour && alpha) {
        // Keyed WITHOUT the line number: line numbers churn on every unrelated
        // edit above, and a baseline that churns gets regenerated blindly, which
        // is how a baseline becomes an exemption list.
        const key = `${rel}|${m[0].replace(/\s+/g, '')}`;
        alphaFound.set(key, (alphaFound.get(key) || 0) + 1);
        alphaSites.set(key, `${where}  ${m[0]}  is exactly ${colour} at ${alpha}`);
      } else if (colour) {
        advisory.push(`${where}  ${m[0]}  (${colour} at an alpha OUTSIDE the Forge scale — may be a legitimate one-off)`);
      }
    }
  });
}

if (advisory.length) {
  console.log(`\nAdvisory — ${advisory.length} literal(s) with no matching Forge token (NOT failing):`);
  for (const a of advisory.slice(0, 20)) console.log(`  ${a}`);
  if (advisory.length > 20) console.log(`  ... and ${advisory.length - 20} more`);
}

// ============================================================================
// gy-73h3j BASELINE RECONCILIATION — and why this is a gate, not an exemption.
//
// The alpha rule finds 25 pre-existing sites. Failing all 25 today would red-gate
// main on work that is BLOCKED ON A RULING, and a gate that blocks everything on
// day one gets switched off inside a week (this gate's own header says so).
//
// 🔴 WHAT IS BLOCKED, precisely, because it is not a scheduling excuse: there is
// no way to write "this colour token at this alpha token" in plain CSS. The
// mechanism would be color-mix(), and this repo uses it ZERO times today and
// declares no browserslist — so adopting it sets a NEW browser-support floor on a
// live public marketing site, and an unsupported color-mix() makes the whole
// declaration invalid and DROPPED, i.e. a border or scrim silently disappears
// rather than degrading. That is a founder-visible risk and a designer/pm call.
// The better answer is almost certainly that the PRODUCER emits composed alpha
// tokens (rgba, universally supported), after which the migration is a plain
// var() — which is exactly what gy-73h3j AC2 asks for, and is a hint that AC2
// already presupposed tokens that do not exist yet. Escalated, not guessed.
//
// SO THIS FILE IS A COUNTED BASELINE, AND IT FAILS IN BOTH DIRECTIONS:
//   * a NEW colour-at-sanctioned-alpha literal, or one more copy of an existing
//     one, FAILS. The rule is live for all new work from today.
//   * a baseline entry that no longer exists also FAILS, with an instruction to
//     delete the line. Otherwise the list rots into a permanent exemption and the
//     migration becomes invisible again — the gy-swdgh failure mode.
// It is NOT a path exemption and NOT a suppression: every entry names an exact
// file and an exact literal, so nothing new hides behind it.
// ============================================================================
const ALPHA_BASELINE_FILE = join(ROOT, 'scripts/forge-alpha-baseline.json');
let alphaBaseline = {};
if (existsSync(ALPHA_BASELINE_FILE)) {
  alphaBaseline = JSON.parse(readFileSync(ALPHA_BASELINE_FILE, 'utf8')).sites || {};
}

if (process.argv.includes('--write-alpha-baseline')) {
  const sites = {};
  for (const k of [...alphaFound.keys()].sort()) sites[k] = alphaFound.get(k);
  writeFileSync(
    ALPHA_BASELINE_FILE,
    JSON.stringify(
      {
        _comment:
          'gy-73h3j. Pre-existing colour-token-at-Forge-alpha-step literals, PENDING A MECHANISM RULING (see check-forge-tokens.mjs). Each key is file|literal, each value a count. DO NOT add entries to silence a new finding: the rule is live for new work. Delete an entry when its site is migrated — a stale entry FAILS the gate on purpose.',
        sites,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`wrote ${Object.keys(sites).length} baseline entries`);
  process.exit(0);
}

for (const [k, n] of [...alphaFound].sort()) {
  const allowed = alphaBaseline[k] || 0;
  if (n > allowed) {
    const extra = n - allowed;
    errors.push(
      `${alphaSites.get(k)} — ${extra} instance(s) beyond the gy-73h3j baseline (${allowed}). Do not add a baseline entry: use the ruled mechanism, or get the ruling.`,
    );
  }
}
for (const k of Object.keys(alphaBaseline)) {
  const n = alphaFound.get(k) || 0;
  if (n < alphaBaseline[k]) {
    errors.push(
      `${k} — baseline expects ${alphaBaseline[k]} instance(s), found ${n}. MIGRATED? Then delete this entry from scripts/forge-alpha-baseline.json so the list cannot rot into an exemption.`,
    );
  }
}

// 🔴 PRINT WHAT EACH EXEMPTION ACTUALLY CAUGHT. An exemption that quietly widens is
// the gy-swdgh defect; a moving count is the cheapest possible tell, and it costs
// two lines of output. If a name stops describing its set, that is visible here
// BEFORE it hides a real duplicate.
console.log('\nExemptions applied (each states what it is for — see EXEMPTIONS in this file):');
for (const e of EXEMPTIONS) {
  console.log(`  ${e.name}: ${exemptedBy.get(e.name) || 0} file(s) — ${e.reason}`);
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
