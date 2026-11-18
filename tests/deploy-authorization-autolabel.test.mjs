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
  assert.match(y, /runs-on: \[self-hosted, pool\]/);
  assert.doesNotMatch(y, /ubuntu-latest|macos-latest|windows-latest/);
  assert.doesNotMatch(y, /^\s*pull_request(_target)?:/m);
  assert.match(y, /ref: main/);
});

// gy-wjtz4b (ci-diet): the hourly cron was the only path for a draft marked ready. Now that path is an EVENT: gate-selftest.yml runs on
// ready_for_review and its completion fires this workflow. Each link below is checked by name, so cutting any one goes red.
test('a draft marked ready is labelled by an event, not by an hourly cron: the wiring holds', () => {
  const read = (f) => readFileSync(new URL(`../.github/workflows/${f}`, import.meta.url), 'utf8').replace(/^\s*#.*$/gm, '');
  const auto = read('deploy-authorization-autolabel.yml');
  const gate = read('gate-selftest.yml');
  const sources = /workflow_run:\s*\n\s*workflows:\s*\[([^\]]*)\]/.exec(auto)?.[1] ?? '';
  assert.match(sources, /"Gate Self-Test \(negative controls\)"/, 'autolabel no longer listens to Gate Self-Test, so ready_for_review fires nothing');
  assert.match(gate, /^name: Gate Self-Test \(negative controls\)$/m, 'the display name workflow_run matches on changed');
  const types = /\n  pull_request:\s*\n(?:\s*#[^\n]*\n)*\s*types:\s*\[([^\]]*)\]/.exec(gate)?.[1] ?? '';
  assert.match(types, /\bready_for_review\b/, 'gate-selftest does not run on ready_for_review, so a draft marked ready waits for the daily cron');
  for (const t of ['opened', 'synchronize', 'reopened']) assert.match(types, new RegExp(`\\b${t}\\b`), `gate-selftest lost the default type ${t}`);
  const crons = [...auto.matchAll(/- cron: "([^"]+)"/g)].map((m) => m[1]);
  assert.equal(crons.length, 1, 'exactly one safety cron');
  const [min, hour] = crons[0].split(/\s+/);
  assert.match(min, /^\d+$/, 'cron minute is fixed');
  assert.match(hour, /^\d+$/, `the safety cron runs at most daily, got "${crons[0]}" (hourly on the CI pool is what gy-wjtz4b removed)`);
});

// gy-wjtz4b.1 (tester follow-up on #341): the chain above only holds while gate-selftest runs on EVERY pull_request. A paths / paths-ignore
// filter on its pull_request trigger would skip it on most PRs, so nothing fires the autolabel for a draft marked ready, and nothing goes red:
// the PR just never reaches the deploy-authorisation queue until the daily safety cron. Checked on the `on:` block of the real file; the planted
// controls below are in-memory copies (never written into scripts/, gy-e5kk2z).
export function gateSelftestTriggerProblems(yml) {
  const text = yml.replace(/^\s*#.*$/gm, '');
  const on = /^on:\s*\n([\s\S]*?)^\S/m.exec(text + '\nEND\n')?.[1];
  if (on === undefined) return ['gate-selftest.yml: no top-level `on:` block found (cannot check the trigger autolabel depends on)'];
  const pr = /^ {2}pull_request:[^\n]*\n((?: {4,}[^\n]*\n|\s*\n)*)/m.exec(on);
  if (!pr) return ['gate-selftest.yml: no pull_request trigger, so a draft marked ready fires nothing for autolabel'];
  return [...pr[1].matchAll(/^ {4}(paths|paths-ignore):/gm)].map((m) =>
    `gate-selftest.yml: its pull_request trigger has a ${m[1]} filter, so most PRs skip it and autolabel is never fired for a draft marked ready (gy-wjtz4b.1)`);
}

test('gate-selftest pull_request trigger has no paths / paths-ignore filter (autolabel depends on it, gy-wjtz4b.1)', () => {
  assert.deepEqual(gateSelftestTriggerProblems(readFileSync(new URL('../.github/workflows/gate-selftest.yml', import.meta.url), 'utf8')), []);
});

test('planted: a paths or paths-ignore filter on gate-selftest pull_request is named; one on another trigger or in a comment is not', () => {
  const real = readFileSync(new URL('../.github/workflows/gate-selftest.yml', import.meta.url), 'utf8');
  const types = '    types: [opened, synchronize, reopened, ready_for_review]\n';
  assert.ok(real.includes(types), 'the real file changed shape: update this control');
  const withPaths = real.replace(types, types + "    paths:\n      - 'src/**'\n");
  const withIgnore = real.replace(types, types + "    paths-ignore:\n      - '**/*.md'\n");
  assert.match(gateSelftestTriggerProblems(withPaths).join('\n'), /has a paths filter/);
  assert.match(gateSelftestTriggerProblems(withIgnore).join('\n'), /has a paths-ignore filter/);
  const commented = real.replace(types, types + "    # paths:\n    #   - 'src/**'\n");
  assert.deepEqual(gateSelftestTriggerProblems(commented), [], 'a commented-out filter is not a filter');
  const noPr = real.replace(/^ {2}pull_request:\n(?: {4,}[^\n]*\n)*/m, '');
  assert.match(gateSelftestTriggerProblems(noPr).join('\n'), /no pull_request trigger/);
});
