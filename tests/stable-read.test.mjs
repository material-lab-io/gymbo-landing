// gy-okffji: the gallery fingerprint must not depend on how fast the runner is.
// A slow runner (anton) has not yet processed the carousel scroll event when a
// fixed-wait read happens, so the "N of M" position cue in the hashed section
// text differs from the fast runner's (gt15). stableRead reads until two
// consecutive reads agree. The runner speed is modelled as `lag`: the number of
// reads that still return the OLD cue before the page catches up.
//
// PLANTED CONTROL (AC3): with PLANT_FIXED_WAIT_READ=1 the reader under test is
// replaced by a single read, i.e. the old fixed-wait behaviour. The test named
// "FINGERPRINT IS INDEPENDENT OF RUNNER SPEED" must then FAIL; the workflow step
// runs it that way and requires that exact name in the failure output.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stableRead, fingerprintPayload } from '../scripts/visual-provenance-core.mjs';

const PLANTED = process.env.PLANT_FIXED_WAIT_READ === '1';

function pageWithLag(lag) {
  let reads = 0;
  return async () => {
    reads += 1;
    // while the page is catching up the cue keeps moving (the strip is still
    // scrolling and each scroll event re-renders it); once caught up it rests
    // on the first card. A PLATEAU on the old card is not detectable by any
    // stable-read; tests/visual.spec.ts closes that by requiring the cue to read
    // the first card before it calls the strip settled.
    const cue = reads <= lag ? `${(reads % 4) + 2} of 5` : '1 of 5';
    return { text: `See Gymbo in action. ${cue} Screens shown with sample data.`, imgs: ['/a.png|one'] };
  };
}

const reader = PLANTED ? (read) => read() : (read) => stableRead(read, { timeoutMs: 1000 });
const fp = async (lag) => {
  const { text, imgs } = await reader(pageWithLag(lag));
  return fingerprintPayload(text, imgs);
};

test('FINGERPRINT IS INDEPENDENT OF RUNNER SPEED: fast (lag 0), mid (lag 3) and slow (lag 40) runners hash the same page', async () => {
  const fast = await fp(0);
  assert.equal(await fp(3), fast, 'mid-speed runner hashed a different cue than the fast one');
  assert.equal(await fp(40), fast, 'slow runner hashed a different cue than the fast one');
});

test('a page that never stops changing fails by name instead of hashing a moving value', async () => {
  let n = 0;
  await assert.rejects(
    () => stableRead(async () => ({ n: (n += 1) }), { timeoutMs: 20, pause: () => new Promise((r) => setTimeout(r, 2)), label: 'cue' }),
    /STABLE-READ NEVER SETTLED: cue/,
  );
});

test('a page that is already stable is read exactly twice (no fixed wait, no extra cost on a fast runner)', async () => {
  let reads = 0;
  const v = await stableRead(async () => (reads += 1, 'x'), {});
  assert.equal(v, 'x');
  assert.equal(reads, 2);
});

test('the settled value is the last one, not a mid-flight one', async () => {
  const seq = ['a', 'b', 'c', 'c'];
  let i = 0;
  assert.equal(await stableRead(async () => seq[Math.min(i++, seq.length - 1)], {}), 'c');
});
