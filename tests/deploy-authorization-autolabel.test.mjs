import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PENDING_LABEL, REQUIRED_CHECKS, judge, run } from '../scripts/deploy-authorization-autolabel.mjs';

const pr = (over = {}) => ({ number: 245, draft: false, base: { ref: 'main' }, labels: [], head: { sha: 'aaa' }, ...over });
const ok = (name, at = '2026-09-26T10:00:00Z') => ({ name, conclusion: 'success', status: 'completed', started_at: at });
const allGreen = () => REQUIRED_CHECKS.map((n) => ok(n));

test('the required list is exactly the two checks branch protection names on main', () => {
  assert.deepEqual(REQUIRED_CHECKS, ['deploy', 'Runner policy (self-hosted only)']);
});

test('POSITIVE: a non-draft PR to main with every required check success is green', () => {
  assert.deepEqual(judge(pr(), allGreen()), { green: true, reasons: [] });
});

test('NEGATIVE: a draft is never labelled, even with every check green', () => {
  const v = judge(pr({ draft: true }), allGreen());
  assert.equal(v.green, false);
  assert.deepEqual(v.reasons, ['draft']);
});

test('NEGATIVE: one required check red is not green, and the reason names it', () => {
  const runs = [ok('deploy'), { name: 'Runner policy (self-hosted only)', conclusion: 'failure', status: 'completed' }];
  const v = judge(pr(), runs);
  assert.equal(v.green, false);
  assert.match(v.reasons[0], /Runner policy \(self-hosted only\)" is failure/);
});

test('NEGATIVE: an ABSENT required check is not green (absent must not read as green)', () => {
  const v = judge(pr(), [ok('deploy'), ok('audit'), ok('scope')]);
  assert.equal(v.green, false);
  assert.match(v.reasons.join(), /"Runner policy \(self-hosted only\)" is absent/);
});

test('NEGATIVE: cancelled, skipped and in-progress are not green', () => {
  for (const conclusion of ['cancelled', 'skipped', null]) {
    const runs = [{ name: 'deploy', conclusion, status: conclusion ? 'completed' : 'in_progress' }, ok('Runner policy (self-hosted only)')];
    assert.equal(judge(pr(), runs).green, false, String(conclusion));
  }
});

test('a substring is not a match: "deploy-preview" does not satisfy "deploy"', () => {
  const v = judge(pr(), [ok('deploy-preview'), ok('Runner policy (self-hosted only)')]);
  assert.equal(v.green, false);
});

test('a rerun: the NEWEST run of a name decides', () => {
  const rerunGreen = [{ name: 'deploy', conclusion: 'failure', started_at: '2026-09-26T09:00:00Z' }, ok('deploy', '2026-09-26T10:00:00Z'), ok('Runner policy (self-hosted only)')];
  const rerunRed = [ok('deploy', '2026-09-26T09:00:00Z'), { name: 'deploy', conclusion: 'failure', started_at: '2026-09-26T10:00:00Z' }, ok('Runner policy (self-hosted only)')];
  assert.equal(judge(pr(), rerunGreen).green, true);
  assert.equal(judge(pr(), rerunRed).green, false);
});

test('already labelled PRs are left alone (no duplicate event resets the wait clock)', () => {
  assert.equal(judge(pr({ labels: [{ name: PENDING_LABEL }] }), allGreen()).green, false);
});

// a fake GitHub that records every write, so "labelling is the ONLY write" is an assertion, not a hope
const fake = ({ prs, checks, failLabel = false }) => {
  const writes = [];
  const request = async (url, options = {}) => {
    if (options.method && options.method !== 'GET') {
      writes.push(`${options.method} ${url.split('/repos/x/y')[1]} ${options.body}`);
      if (failLabel) throw new Error('403 Resource not accessible by integration');
      return {};
    }
    if (url.includes('/pulls?')) return prs;
    const sha = /commits\/([^/]+)\/check-runs/.exec(url)?.[1];
    if (sha) { if (checks[sha] instanceof Error) throw checks[sha]; return { check_runs: checks[sha] }; }
    throw new Error(`unexpected GET ${url}`);
  };
  return { request, writes };
};
const env = { GITHUB_REPOSITORY: 'x/y' };

test('run: labels only the green non-draft PR; its ONLY write is one label POST', async () => {
  const g = fake({
    prs: [pr({ number: 1, head: { sha: 'g' } }), pr({ number: 2, draft: true, head: { sha: 'g' } }), pr({ number: 3, head: { sha: 'r' } })],
    checks: { g: allGreen(), r: [ok('deploy'), { name: 'Runner policy (self-hosted only)', conclusion: 'failure' }] },
  });
  const r = await run({ request: g.request, env });
  assert.deepEqual(r.labelled, [1]);
  assert.deepEqual(r.skipped.map((s) => s.number).sort(), [2, 3]);
  assert.equal(g.writes.length, 1);
  assert.match(g.writes[0], /^POST \/issues\/1\/labels .*deploy-authorization-pending/);
});

test('run: a 403 on the label is an error, never a silent "labelled"', async () => {
  const g = fake({ prs: [pr({ head: { sha: 'g' } })], checks: { g: allGreen() }, failLabel: true });
  const r = await run({ request: g.request, env });
  assert.deepEqual(r.labelled, []);
  assert.match(r.errors[0], /could not label #245/);
});

test('run: an unreadable check list is an error and the PR is not labelled', async () => {
  const g = fake({ prs: [pr({ head: { sha: 'g' } })], checks: { g: new Error('500') } });
  const r = await run({ request: g.request, env });
  assert.deepEqual(r.labelled, []);
  assert.match(r.errors[0], /could not read checks of #245/);
});

test('the workflow can write labels and nothing else, runs self-hosted, never checks out a PR head', () => {
  const y = readFileSync(new URL('../.github/workflows/deploy-authorization-autolabel.yml', import.meta.url), 'utf8').replace(/^\s*#.*$/gm, '');
  assert.doesNotMatch(y, /contents:\s*write/);
  assert.match(y, /runs-on: \[self-hosted, gt2\]/);
  assert.doesNotMatch(y, /ubuntu-latest|macos-latest|windows-latest/);
  assert.doesNotMatch(y, /^\s*pull_request(_target)?:/m);
  assert.match(y, /ref: main/);
});
