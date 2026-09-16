#!/usr/bin/env node
/**
 * Is the pinned Forge producer commit still current?  (gy-1phkc AC3)
 *
 * 🔴 WHY THIS EXISTS AND WHY IT IS NOT OPTIONAL. designer's design stated the
 * binding condition on the vendored-and-pinned delivery pm chose:
 *
 *   "the gate must ALSO fail when that sha falls behind the producer's head, or
 *    (a) degrades into exactly today's defect with extra steps."
 *
 * sync-forge-tokens.mjs --check proves src/forge/ matches THE PIN. It cannot
 * prove the pin matches the PRODUCER. Without this second question, a pin left
 * untouched for six months reports green forever while Forge moves — which is
 * the original defect wearing a provenance header.
 *
 * 🔴 THE RULE IS DELIBERATELY NARROW, for the reason check-forge-tokens.mjs
 * states in its own header: a gate has to be quiet enough to stay believed.
 * Gymbo-v1 takes many commits a day and almost none touch design-tokens/dist.
 * Failing on "the pin is N commits behind HEAD" would fire constantly on
 * changes that cannot possibly affect a token, and would be switched off inside
 * a week. So the question asked here is the one that matters:
 *
 *   do the EMITTED DIST FILES differ between the pinned sha and producer HEAD?
 *
 * Behind by 400 commits with byte-identical dist output is FINE and passes.
 * Behind by one commit that changed a token FAILS. The failure names the tokens.
 *
 * Requires a producer checkout with history (fetch-depth: 0) at
 * $FORGE_PRODUCER_DIR. Exits 0 clean, 1 on a stale pin, 2 if it could not look.
 *
 * 🔴 EXIT 2 IS NOT A PASS. "Could not look" must never be reported as "nothing
 * there" — the producer checkout being absent or shallow is an UNKNOWN, and CI
 * treats it as a failure rather than letting a missing input read as a green.
 */
import { execFileSync } from 'node:child_process';
import { PIN as pin, FILES, producerDir, readAtPin, tokensOf } from './forge-producer.mjs';

const dir = producerDir();

if (!dir) {
  console.error('::error::COULD NOT LOOK — no producer checkout found. Set FORGE_PRODUCER_DIR.');
  process.exit(2);
}

const git = (...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8' });

let head;
try {
  head = git('rev-parse', 'HEAD').trim();
  // Prove the pinned commit is actually present. A shallow clone silently lacks
  // it, and `git show` on a missing object must not be mistaken for "no change".
  git('cat-file', '-e', `${pin.sha}^{commit}`);
} catch (e) {
  console.error(
    `::error::COULD NOT LOOK — pinned commit ${pin.sha} is not present in the producer checkout ` +
      `at ${dir}. A shallow clone cannot answer this question; use fetch-depth: 0.`,
  );
  process.exit(2);
}

if (head === pin.sha) {
  console.log(`OK  pin is exactly producer HEAD (${head.slice(0, 9)}).`);
  process.exit(0);
}

/**
 * 🔴 REFUSE TO ANSWER ON A DIVERGENT CHECKOUT — caught while testing this.
 *
 * Run against a producer checkout whose main was 1745 commits STALE, this script
 * cheerfully reported "--g-alpha-whisper retired in producer" for 13 tokens and
 * "--g-font-size-micro: 11px -> 10px", i.e. it described the design system as
 * having deleted the alpha family. Every word of that was backwards: those
 * tokens were ADDED after the checkout's HEAD. It was comparing the pin against
 * an OLDER commit and narrating the difference as forward motion.
 *
 * "I am looking at the wrong tree" is an UNKNOWN and must be reported as one. A
 * confident, precise, wrong report is worse than an error, because it gets acted
 * on — someone would have repinned BACKWARDS onto the stale sha and called it a
 * sync. So: the pin must be an ancestor of HEAD, or this exits 2 without
 * reporting a single token.
 */
try {
  execFileSync('git', ['-C', dir, 'merge-base', '--is-ancestor', pin.sha, head]);
} catch {
  console.error(
    `::error::COULD NOT LOOK — the pinned commit is NOT an ancestor of the producer checkout's HEAD.\n` +
      `  pinned : ${pin.sha}\n  HEAD   : ${head}\n` +
      `This checkout is stale, divergent, or on the wrong branch, so any "changed/added/retired" ` +
      `report from it would be backwards. Refusing to report. Fetch the producer's default branch ` +
      `(fetch-depth: 0) and re-run.`,
  );
  process.exit(2);
}

const at = (sha, f) => readAtPin(dir, f, sha);
const toks = tokensOf;

const stale = [];
for (const f of FILES) {
  const a = at(pin.sha, f);
  const b = at(head, f);
  if (a === b) continue;
  const A = toks(a);
  const B = toks(b);
  stale.push({
    f,
    changed: [...B.keys()].filter((k) => A.has(k) && A.get(k) !== B.get(k)).map((k) => `${k}: ${A.get(k)} -> ${B.get(k)}`),
    added: [...B.keys()].filter((k) => !A.has(k)),
    removed: [...A.keys()].filter((k) => !B.has(k)),
  });
}

const behind = git('rev-list', '--count', `${pin.sha}..${head}`).trim();

if (!stale.length) {
  console.log(
    `OK  pin is ${behind} commit(s) behind producer HEAD, but the emitted token files are ` +
      `byte-identical. Nothing to repin.`,
  );
  process.exit(0);
}

console.error(
  `\n::error::STALE FORGE PIN — the producer's emitted tokens have changed since the pinned commit.` +
    `\n  pinned : ${pin.sha}\n  HEAD   : ${head}  (${behind} commits ahead)`,
);
for (const s of stale) {
  console.error(`\n  ${s.f}:`);
  for (const c of s.changed) console.error(`    ! ${c}`);
  for (const k of s.added) console.error(`    + ${k}  new in producer`);
  for (const k of s.removed) console.error(`    - ${k}  retired in producer`);
}
console.error(`\nRepin and resync:\n  node scripts/sync-forge-tokens.mjs --pin ${head}\n`);
process.exit(1);
