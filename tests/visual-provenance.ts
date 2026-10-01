import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { Locator, TestInfo } from '@playwright/test';
// @ts-expect-error — plain .mjs, no type declarations; see the file for why
// the decision logic lives there instead of here.
import { decideProvenance, fingerprintPayload } from '../scripts/visual-provenance-core.mjs';

/**
 * gy-h2z6x: a committed visual baseline (.png) carries no record of which
 * commit or rendered content it was captured against, so a STALE baseline is
 * byte-for-byte indistinguishable from a current one — the only thing that
 * caught the real near-miss (gy-tjqwg's "Join the waitlist" baselines staged
 * on top of main's "Request access") was a human reading pixels for an
 * unrelated reason.
 *
 * This writes a sidecar `<name>.provenance.json` next to every baseline PNG,
 * at the exact path `toHaveScreenshot` resolves internally
 * (testInfo.snapshotPath), so it travels WITH the artefact rather than living
 * in a README or commit message that a `git commit -a` never looks at.
 *
 * The sidecar records a content fingerprint (section text + image src/alt),
 * not just a commit sha: an old baseline re-merged or cherry-picked onto a new
 * tree still resolves as an "ancestor commit", so sha ancestry alone cannot
 * catch the near-miss. The fingerprint is recomputed from the LIVE page on
 * every verifying run and compared to what's recorded — a mismatch REFUSES
 * before any pixel comparison runs, rather than silently diffing stale bytes.
 */

export interface BaselineProvenance {
  commit: string;
  viewport: string;
  contentFingerprint: string;
}

function currentCommit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

/** Content fingerprint: normalized text + sorted img src/alt pairs, scoped to
 * the section locator. Independent of styling/pixels on purpose — it exists
 * to catch "this baseline was captured against different CONTENT", which is
 * the gy-tjqwg failure mode, as a check orthogonal to the pixel diff.
 * Hashing itself is scripts/visual-provenance-core.mjs's fingerprintPayload,
 * shared so a browser run and the node:test unit tests hash identically; this
 * half only extracts {text, imgs} from the live DOM. */
export async function fingerprintSection(locator: Locator): Promise<string> {
  const { text, imgs }: { text: string; imgs: string[] } = await locator.evaluate((el) => {
    const text = el.textContent || '';
    const imgs = Array.from(el.querySelectorAll('img')).map(
      (img) => `${img.getAttribute('src') ?? ''}|${img.getAttribute('alt') ?? ''}`,
    );
    return { text, imgs };
  });
  return fingerprintPayload(text, imgs);
}

function sidecarPathFor(testInfo: TestInfo, snapshotName: string): string {
  const pngPath = testInfo.snapshotPath(snapshotName);
  if (!pngPath.endsWith('.png')) {
    throw new Error(`expected a .png snapshot path, got ${pngPath}`);
  }
  return pngPath.slice(0, -'.png'.length) + '.provenance.json';
}

/**
 * Call BEFORE `expect(...).toHaveScreenshot(name)`.
 *
 * In a capturing run (`--update-snapshots=all` or `=changed`, which is what
 * refresh-visual-baselines.yml passes) it (re)writes the sidecar — but only
 * when the fingerprint actually changed, so a refresh that touches no
 * content doesn't bump every baseline's recorded commit for free.
 *
 * In every other run (the deploy gate's default "missing" mode included) it
 * VERIFIES: missing sidecar or mismatched fingerprint both throw, refusing
 * the comparison outright rather than letting toHaveScreenshot silently
 * pixel-diff against a baseline nothing has vouched for.
 */
export async function recordOrVerifyProvenance(
  testInfo: TestInfo,
  snapshotName: string,
  locator: Locator,
  viewport: string,
): Promise<void> {
  const sidecarPath = sidecarPathFor(testInfo, snapshotName);
  const liveFingerprint = await fingerprintSection(locator);
  const existingRecord: BaselineProvenance | null = existsSync(sidecarPath)
    ? JSON.parse(readFileSync(sidecarPath, 'utf8'))
    : null;

  const result = decideProvenance({
    mode: testInfo.config.updateSnapshots,
    existingRecord,
    liveFingerprint,
    viewport,
    currentCommit: currentCommit(),
  });

  if (result.action === 'write') {
    writeFileSync(sidecarPath, JSON.stringify(result.record, null, 2) + '\n');
  } else if (result.action === 'throw') {
    const detail =
      existingRecord != null
        ? ` (recorded fingerprint ${existingRecord.contentFingerprint.slice(0, 12)}…, live fingerprint ${liveFingerprint.slice(0, 12)}…, sidecar ${sidecarPath})`
        : ` (expected sidecar ${sidecarPath})`;
    throw new Error(`${result.message} [baseline: ${snapshotName}]${detail}`);
  }
  // 'skip' and 'pass' both do nothing further — the pixel comparison proceeds.
}
