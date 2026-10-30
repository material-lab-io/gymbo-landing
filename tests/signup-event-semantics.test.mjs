import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * gy-6smup AC1-AC3: `waitlist_signup` counts ACCEPTED SUBMITS, not leads (a duplicate fires it with no
 * row; the sameness is the gy-rh2rj anti-enumeration property). Leads = rows in public.waitlist.
 *
 * A comment alone is a hope, so this is the control: the repo may EMIT the event in exactly one place,
 * and every doc that names it must carry the "not a lead count" qualifier. A new consumer that reads
 * the event as a lead count (a script, report or function naming it) shows up here as an unlisted file.
 */
const EMIT = 'src/components/WaitlistForm.tsx';
const NAMED_OK = new Set([
  EMIT,
  'functions/api/waitlist.js',          // comment only
  'ops/umami/README.md',                // event table, qualified below
  'SETUP-BACKEND.md',                   // qualified below
  'tests/funnel-events.spec.ts',        // asserts the emit, not a count
  'tests/signup-event-semantics.test.mjs',
]);
const SKIP = new Set(['node_modules', 'dist', 'dist-ssr', '.git', 'evidence', 'review-artifacts']);

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    if (SKIP.has(n) || n.startsWith('wt-')) continue;
    const p = join(dir, n);
    statSync(p).isDirectory() ? walk(p, out) : /\.(m?[jt]sx?|md|json|ya?ml|py|sh)$/.test(n) && out.push(p);
  }
  return out;
}

test('only known files name waitlist_signup', () => {
  const hits = walk('.').filter((f) => readFileSync(f, 'utf8').includes('waitlist_signup')).map((f) => f.replace(/^\.\//, ''));
  const stray = hits.filter((f) => !NAMED_OK.has(f));
  assert.deepEqual(stray, [], `new consumer of waitlist_signup: it counts accepted submits, not leads (gy-6smup). Count rows, or add the file here with a qualifier. ${stray}`);
});

test('every doc naming the event says it is not a lead count', () => {
  for (const f of ['ops/umami/README.md', 'SETUP-BACKEND.md']) {
    const line = readFileSync(f, 'utf8').split('\n').find((l) => l.includes('waitlist_signup')) ?? '';
    assert.match(line, /not (a )?(new )?lead|NOT a lead/i, `${f}: the waitlist_signup line must state it is not a lead count`);
  }
});

test('NEG control: the unqualified old wording is rejected', () => {
  const old = '| `waitlist_signup` | Successful waitlist form submission |';
  assert.doesNotMatch(old, /not (a )?(new )?lead|NOT a lead/i);
});
