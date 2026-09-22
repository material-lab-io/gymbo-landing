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
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
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

// ============================================================================
// COMMITTED IMAGE ASSETS — gy-rosvo. THE RULE HERE IS DELIBERATELY INVERTED.
//
// 🔴 THE GAP THIS CLOSES, and it was a DOUBLE blind, not the single one filed.
// The bead reported that EXT excluded .svg. That was true and it was only half:
// SCAN is [src, functions] and every committed .svg lives in public/. So the
// brand marks were out of scope by EXTENSION *and* by DIRECTORY. Adding .svg to
// EXT alone would have changed NOTHING while looking exactly like a fix — the
// same fail-open shape as gy-swdgh and gy-aczn1 before it.
//
// 🔴 WHY THE SOURCE RULE CANNOT BE REUSED HERE, measured before it was written.
// Above, a hex that EQUALS a token is the error ("use var(--token)"). Applying
// that to these files would have emitted "#ff9800 is exactly --g-color-mark-amber
// — use var(--g-color-mark-amber)" against all three SVGs. That advice is WRONG:
// every one of them is referenced as a standalone file (src=/href= in App.tsx,
// PageShell.tsx, CompareWellnessZ.tsx and index.html — checked, none is inlined),
// and a CSS custom property does not resolve inside an SVG loaded that way. The
// gate would have demanded a change that breaks the asset, gone red across the
// asset tree on day one, and been switched off by the next person — which AC4 of
// gy-rosvo names as worse than the gap.
//
// So for a standalone asset the polarity flips:
//   a hex that EQUALS a current Forge token is CORRECT — it IS the brand value,
//   pinned to the palette, and it is the only way an un-inlined SVG can express it;
//   a hex that matches NO token is the DEFECT — the asset has drifted off the
//   palette, or the palette moved and the asset did not follow.
//
// That second half is the protection the tree did not have. forge.css line 29-30
// already declares the binding in prose ("Backs ... gymbo-mark-amber-ff9800.svg");
// this makes the binding enforceable. Change --g-color-mark-amber in Forge and
// these files stop matching, fail, and NAME THEMSELVES.
//
// The FILENAME is checked on the same rule, because gy-rosvo found the hex is
// carried in both places (gymbo-mark-amber-ff9800.svg) and a filename that still
// advertises a retired colour is a stale claim a reader will believe.
//
// 🔴 KNOWN COVERAGE LIMIT, stated because I tried to claim more and the gate
// correctly refused me. The token table is keyed by HEX VALUE, not token name, so
// this asks "is this colour still SOMEWHERE in the palette?" and not "is this the
// specific token that backs this file?". The mark colour is deliberately declared
// twice — --g-color-mark-amber in forge.css and --g-mark-on-dark in forge.dark.css,
// same value by the FORGE §7 ground-naming rule. So:
//   CAUGHT  — the value is retired from the palette entirely, or someone hand-edits
//             an asset to an off-palette colour. Proven: retiring #ff9800 from both
//             files fails the gate and names favicon.svg and the amber mark, both
//             untouched, including the filename claim.
//   NOT CAUGHT — a PARTIAL move where --g-color-mark-amber changes but the same hex
//             survives under --g-mark-on-dark. The asset would then be pinned to a
//             token that no longer backs it and this gate stays green.
// Closing that needs a declared file->token binding, which forge.css currently
// states only in prose ("Backs ... gymbo-mark-amber-ff9800.svg"). Deliberately not
// invented here: that is a Forge authoring decision, and this gate has no authority
// to assert one. A green here means "every asset colour is a live palette value",
// never "every asset is pinned to its intended token".
// ============================================================================
const ASSET_SCAN = [join(ROOT, 'public')];
const ASSET_EXT = /\.svg$/;

function walkMatching(dir, re, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walkMatching(p, re, out);
    else if (re.test(p)) out.push(p);
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
for (const src of readTokenSources()) {
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
  });
}

// --- COMMITTED ASSET SCAN (see the ASSET_SCAN block above for the inverted rule) ---
const assetErrors = [];
let assetFiles = 0;
let assetHexOk = 0;
for (const dir of ASSET_SCAN) {
  if (!existsSync(dir)) continue;
  for (const f of walkMatching(dir, ASSET_EXT)) {
    assetFiles++;
    const rel = relative(ROOT, f);
    const lines = readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const m of line.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
        const hex = norm(m[0]);
        if (tokens.has(hex)) assetHexOk++;
        else
          assetErrors.push(
            `${rel}:${i + 1}  ${m[0]}  matches NO Forge token — a brand asset has drifted off the palette`,
          );
      }
    });
    // The filename carries the colour too (gymbo-mark-amber-ff9800.svg).
    for (const m of (rel.split('/').pop() || '').matchAll(/\b[0-9a-fA-F]{6}\b/g)) {
      if (!tokens.has(norm(m[0])))
        assetErrors.push(
          `${rel}  filename advertises ${m[0]}, which matches NO Forge token — stale colour in the name`,
        );
      else assetHexOk++;
    }
  }
}
console.log(
  `\nCommitted assets scanned (${ASSET_EXT.source}) — ${assetFiles} file(s), ` +
    `${assetHexOk} colour reference(s) pinned to a live token, ${assetErrors.length} off-palette.`,
);
if (assetErrors.length) for (const e of assetErrors) errors.push(e);

if (advisory.length) {
  console.log(`\nAdvisory — ${advisory.length} literal(s) with no matching Forge token (NOT failing):`);
  for (const a of advisory.slice(0, 20)) console.log(`  ${a}`);
  if (advisory.length > 20) console.log(`  ... and ${advisory.length - 20} more`);
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
