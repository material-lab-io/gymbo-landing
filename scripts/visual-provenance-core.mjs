// gy-h2z6x: the pure decision logic behind tests/visual-provenance.ts, split
// out so it can be mutation-tested with node:test (tests/visual-provenance.test.mjs)
// without needing a browser. Everything here is deterministic I/O-free logic;
// the Playwright-dependent half (computing the live fingerprint from a page,
// and the actual fs reads/writes) lives in tests/visual-provenance.ts.

import { createHash } from 'node:crypto';

/** Content fingerprint of {text, imgs} — exported so the unit tests and the
 * Playwright helper hash identically. */
export function fingerprintPayload(text, imgs) {
  const payload = JSON.stringify({ text: text.replace(/\s+/g, ' ').trim(), imgs: [...imgs].sort() });
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * @param {{mode: string, existingRecord: {commit:string,viewport:string,contentFingerprint:string}|null, liveFingerprint: string, viewport: string, currentCommit: string}} input
 * @returns {{action: 'skip'|'write'|'pass'|'throw', record?: object, message?: string}}
 */
export function decideProvenance({ mode, existingRecord, liveFingerprint, viewport, currentCommit }) {
  const capturing = mode === 'all' || mode === 'changed';

  if (capturing) {
    if (existingRecord && existingRecord.contentFingerprint === liveFingerprint && existingRecord.viewport === viewport) {
      return { action: 'skip' };
    }
    return { action: 'write', record: { commit: currentCommit, viewport, contentFingerprint: liveFingerprint } };
  }

  if (!existingRecord) {
    return {
      action: 'throw',
      message:
        `gy-h2z6x: no provenance sidecar for this baseline. A committed visual baseline must carry the ` +
        `commit + viewport + content fingerprint it was captured against; this one carries nothing, so it ` +
        `cannot be told apart from a stale one.`,
    };
  }

  if (existingRecord.contentFingerprint !== liveFingerprint) {
    return {
      action: 'throw',
      message:
        `gy-h2z6x: PROVENANCE MISMATCH — refusing to compare. The committed baseline (recorded commit ` +
        `${existingRecord.commit}, viewport ${existingRecord.viewport}) was captured against different ` +
        `rendered content than what is live on this tree right now.`,
    };
  }

  return { action: 'pass' };
}
