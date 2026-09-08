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

const ROOT = new URL('..', import.meta.url).pathname;
const SSOT = join(ROOT, 'src/forge');
const SCAN = join(ROOT, 'src');
const EXT = /\.(css|tsx|ts)$/;

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
for (const f of walk(SSOT)) {
  const src = readFileSync(f, 'utf8');
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

for (const f of walk(SCAN)) {
  if (f.startsWith(SSOT)) continue; // the SSOT is allowed to contain literals
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

console.log(`\nOK  no literal outside src/forge/ duplicates a Forge token (${tokens.size} tokens checked).`);
