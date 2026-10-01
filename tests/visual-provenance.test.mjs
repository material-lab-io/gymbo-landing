// gy-h2z6x: the visual-baseline provenance decision logic. Each case plants
// ONE defect shape and proves decideProvenance refuses it by name, because a
// fail-closed check that has never failed is unproven (same convention as
// hash-font-assets.test.mjs / internal-comments.test.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideProvenance, fingerprintPayload } from '../scripts/visual-provenance-core.mjs';

const LIVE = fingerprintPayload('Request access', ['/img.png|hero']);
const STALE = fingerprintPayload('Join the waitlist', ['/img.png|hero']);

test('HAPPY PATH: matching provenance passes (comparison proceeds)', () => {
  const r = decideProvenance({
    mode: 'missing',
    existingRecord: { commit: 'abc123', viewport: 'desktop', contentFingerprint: LIVE },
    liveFingerprint: LIVE,
    viewport: 'desktop',
    currentCommit: 'def456',
  });
  assert.equal(r.action, 'pass');
});

test('AC2/AC3 — THE REAL NEAR-MISS, REPRODUCED: a baseline captured against stale content REFUSES, not silently compares', () => {
  const r = decideProvenance({
    mode: 'missing', // the deploy gate's default mode, no --update-snapshots
    existingRecord: { commit: 'ba2398515fefb4dda2a81031570a45a5f7c1d362', viewport: 'desktop', contentFingerprint: STALE },
    liveFingerprint: LIVE, // current main renders "Request access"
    viewport: 'desktop',
    currentCommit: 'ba2398515fefb4dda2a81031570a45a5f7c1d362',
  });
  assert.equal(r.action, 'throw');
  assert.match(r.message, /PROVENANCE MISMATCH/);
});

test('AC1/AC2 — a baseline with NO sidecar at all refuses rather than silently comparing', () => {
  const r = decideProvenance({
    mode: 'missing',
    existingRecord: null,
    liveFingerprint: LIVE,
    viewport: 'desktop',
    currentCommit: 'def456',
  });
  assert.equal(r.action, 'throw');
  assert.match(r.message, /no provenance sidecar/);
});

test('"none" mode (an explicit --update-snapshots=none run) still verifies, not just the default "missing"', () => {
  const r = decideProvenance({
    mode: 'none',
    existingRecord: null,
    liveFingerprint: LIVE,
    viewport: 'desktop',
    currentCommit: 'def456',
  });
  assert.equal(r.action, 'throw');
});

test('CAPTURING, content unchanged: --update-snapshots leaves an already-correct sidecar untouched (no spurious commit bump)', () => {
  const r = decideProvenance({
    mode: 'changed', // bare --update-snapshots preset
    existingRecord: { commit: 'old-commit', viewport: 'desktop', contentFingerprint: LIVE },
    liveFingerprint: LIVE,
    viewport: 'desktop',
    currentCommit: 'new-commit',
  });
  assert.equal(r.action, 'skip');
});

test('CAPTURING, content changed: --update-snapshots writes a fresh record at the current commit', () => {
  const r = decideProvenance({
    mode: 'all',
    existingRecord: { commit: 'old-commit', viewport: 'desktop', contentFingerprint: STALE },
    liveFingerprint: LIVE,
    viewport: 'desktop',
    currentCommit: 'new-commit',
  });
  assert.equal(r.action, 'write');
  assert.deepEqual(r.record, { commit: 'new-commit', viewport: 'desktop', contentFingerprint: LIVE });
});

test('CAPTURING, no prior sidecar at all: --update-snapshots writes one', () => {
  const r = decideProvenance({
    mode: 'all',
    existingRecord: null,
    liveFingerprint: LIVE,
    viewport: 'mobile',
    currentCommit: 'new-commit',
  });
  assert.equal(r.action, 'write');
  assert.deepEqual(r.record, { commit: 'new-commit', viewport: 'mobile', contentFingerprint: LIVE });
});

test('a sidecar recorded for the WRONG viewport is treated as changed even if the fingerprint matches (mix-up guard)', () => {
  const r = decideProvenance({
    mode: 'changed',
    existingRecord: { commit: 'old-commit', viewport: 'mobile', contentFingerprint: LIVE },
    liveFingerprint: LIVE,
    viewport: 'desktop', // this run is desktop; the recorded sidecar says mobile
    currentCommit: 'new-commit',
  });
  assert.equal(r.action, 'write');
});

test('fingerprintPayload is insensitive to incidental whitespace but sensitive to real text and image changes', () => {
  assert.equal(fingerprintPayload('  Request   access  ', ['/a.png|hero']), fingerprintPayload('Request access', ['/a.png|hero']));
  assert.notEqual(fingerprintPayload('Request access', ['/a.png|hero']), fingerprintPayload('Join the waitlist', ['/a.png|hero']));
  assert.notEqual(fingerprintPayload('Request access', ['/a.png|hero']), fingerprintPayload('Request access', ['/b.png|hero']));
  assert.notEqual(fingerprintPayload('Request access', ['/a.png|hero']), fingerprintPayload('Request access', ['/a.png|different-alt']));
});

test('fingerprintPayload is order-independent over the image list (so unrelated DOM reordering does not false-positive)', () => {
  assert.equal(
    fingerprintPayload('text', ['/a.png|x', '/b.png|y']),
    fingerprintPayload('text', ['/b.png|y', '/a.png|x']),
  );
});
