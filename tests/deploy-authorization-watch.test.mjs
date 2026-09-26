import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THRESHOLD_MS, classifyPending, PENDING_LABEL } from '../scripts/deploy-authorization-watch.mjs';

const issue = { number: 196 };
const labeled = (created_at) => [{ event: 'labeled', label: { name: PENDING_LABEL }, created_at }];

test('waits below the one-hour authorisation threshold', () => {
  const now = Date.parse('2026-09-21T12:59:59Z');
  const row = classifyPending(issue, labeled('2026-09-21T12:00:01Z'), now);
  assert.equal(row.state, 'waiting');
  assert.equal(row.ageMs, THRESHOLD_MS - 2000);
});

test('POSITIVE CONTROL — an hour-old pending label becomes overdue', () => {
  const now = Date.parse('2026-09-21T13:00:00Z');
  const row = classifyPending(issue, labeled('2026-09-21T12:00:00Z'), now);
  assert.equal(row.state, 'overdue');
});

test('fails closed when the pending-label event is absent', () => {
  const row = classifyPending(issue, [{ event: 'labeled', label: { name: 'unrelated' }, created_at: '2026-09-21T12:00:00Z' }]);
  assert.equal(row.state, 'could-not-look');
  assert.equal(row.since, null);
});

// ===== gy-e9wa6 (pm 2026-09-25): an OVERDUE request must conclude RED =====
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DEFAULT_THRESHOLD_MS, OVERDUE_LABEL, TEST_LABEL, classifyPending as classify, describeUnlabelled, evaluate, resolveThreshold, run, shouldNotify,
} from '../scripts/deploy-authorization-watch.mjs';

const NOW = Date.parse('2026-09-25T12:00:00Z');
const ago = (min) => new Date(NOW - min * 60000).toISOString();
const row = (number, ageMin, thresholdMs = DEFAULT_THRESHOLD_MS) => classify({ number, labels: [] }, labeled(ago(ageMin)), NOW, thresholdMs);

test('evaluate: an OVERDUE row is RED and names the PR and its age', () => {
  const r = evaluate([row(196, 75)]);
  assert.equal(r.exitCode, 1);
  assert.match(r.errors[0], /OVERDUE: #196 \(75 min\)/);
  assert.match(r.errors[0], /threshold/);
});

test('evaluate NEGATIVE CONTROL: a PR under the threshold is GREEN, and so is a mix that has nothing overdue', () => {
  assert.equal(evaluate([row(196, 59)]).exitCode, 0);
  assert.equal(evaluate([row(196, 5), row(197, 30)]).exitCode, 0);
});

test('evaluate: ONE overdue among several waiting is still RED (the run does not average)', () => {
  const r = evaluate([row(1, 5), row(2, 61), row(3, 30)]);
  assert.equal(r.exitCode, 1);
  assert.match(r.errors[0], /#2 \(61 min\)/);
  assert.doesNotMatch(r.errors[0], /#1 |#3 /);
});

test('evaluate: could-not-look stays RED, and is a different message from overdue', () => {
  const r = evaluate([classify({ number: 9 }, [])]);
  assert.equal(r.exitCode, 1);
  assert.match(r.errors[0], /Could not determine when #9/);
  assert.doesNotMatch(r.errors[0], /OVERDUE/);
});

test('evaluate: the EMPTY SET is green but says what it does and does not prove', () => {
  const r = evaluate([]);
  assert.equal(r.exitCode, 0);
  assert.match(r.notes[0], /EMPTY SET/);
  assert.match(r.notes[0], /NOT that authorisation requests are being made/);
});

test('threshold: default, a dispatch override, and refusing a bad override instead of falling back', () => {
  assert.equal(resolveThreshold({}).thresholdMs, DEFAULT_THRESHOLD_MS);
  assert.equal(resolveThreshold({ DEPLOY_AUTH_THRESHOLD_MINUTES: '' }).thresholdMs, DEFAULT_THRESHOLD_MS);
  const d = resolveThreshold({ DEPLOY_AUTH_THRESHOLD_MINUTES: '2', GITHUB_EVENT_NAME: 'workflow_dispatch' });
  assert.equal(d.thresholdMs, 2 * 60000);
  assert.match(d.note, /TEST-ONLY threshold 2 min/);
  for (const bad of ['0', '-5', 'abc', 'NaN', 'Infinity']) {
    assert.throws(() => resolveThreshold({ DEPLOY_AUTH_THRESHOLD_MINUTES: bad, GITHUB_EVENT_NAME: 'workflow_dispatch' }), /positive number/, bad);
  }
});

test('threshold: on a SCHEDULED run the override is IGNORED and said so (production clock is never faked)', () => {
  for (const event of ['schedule', 'push', 'pull_request', undefined]) {
    const r = resolveThreshold({ DEPLOY_AUTH_THRESHOLD_MINUTES: '1', GITHUB_EVENT_NAME: event });
    assert.equal(r.thresholdMs, DEFAULT_THRESHOLD_MS, String(event));
    assert.match(r.note, /IGNORED/);
  }
});

// --- run(): the whole flow against a stubbed GitHub ---
const fakeGithub = ({ pending = [], events = {}, open = [], failOpen = false, failPost = null } = {}) => {
  const calls = [];
  const request = async (url, options = {}) => {
    calls.push({ url, method: options.method ?? 'GET', body: options.body ? JSON.parse(options.body) : null });
    if (url.includes('/issues?state=open')) return pending;
    if (/\/issues\/\d+\/events/.test(url)) return events[Number(url.match(/issues\/(\d+)\/events/)[1])] ?? [];
    if (url.includes('/pulls?state=open')) { if (failOpen) throw new Error('boom'); return open; }
    if (failPost && (options.method ?? 'GET') === 'POST' && url.endsWith(failPost.suffix)) throw new Error(failPost.message);
    return null;
  };
  return { request, calls };
};
const pr = (number, labels = []) => ({ number, pull_request: {}, labels: labels.map((name) => ({ name })) });
const env = (extra = {}) => ({ GITHUB_REPOSITORY: 'o/r', GITHUB_EVENT_NAME: 'schedule', ...extra });

test('run POSITIVE CONTROL: a pending PR older than the threshold -> labelled overdue, commented, and the run is RED', async () => {
  const gh = fakeGithub({ pending: [pr(196, [PENDING_LABEL])], events: { 196: labeled(ago(75)) } });
  const r = await run({ request: gh.request, env: env(), now: NOW });
  assert.equal(r.evaluation.exitCode, 1);
  assert.deepEqual(r.actions, ['label:196', 'comment:196']);
  assert.ok(gh.calls.some((c) => c.method === 'POST' && c.url.endsWith('/issues/196/labels') && c.body.labels[0] === OVERDUE_LABEL));
  assert.ok(gh.calls.some((c) => c.method === 'POST' && c.url.endsWith('/issues/196/comments') && /also RED/.test(c.body.body)));
});

test('run NEGATIVE CONTROL: a pending PR UNDER the threshold -> no label, no comment, GREEN', async () => {
  const gh = fakeGithub({ pending: [pr(196, [PENDING_LABEL])], events: { 196: labeled(ago(30)) } });
  const r = await run({ request: gh.request, env: env(), now: NOW });
  assert.equal(r.evaluation.exitCode, 0);
  assert.deepEqual(r.actions, []);
  assert.equal(gh.calls.filter((c) => c.method === 'POST').length, 0);
});

test('run: an already-overdue PR does not get a second label or comment, but the run STAYS RED every hour until it is resolved', async () => {
  const gh = fakeGithub({ pending: [pr(196, [PENDING_LABEL, OVERDUE_LABEL])], events: { 196: labeled(ago(600)) } });
  const r = await run({ request: gh.request, env: env(), now: NOW });
  assert.equal(r.evaluation.exitCode, 1);
  assert.deepEqual(r.actions, []);
});

test('run: a CONTROL PR (test label) turns the run red but does NOT @-mention the founder', async () => {
  const p = pr(300, [PENDING_LABEL, TEST_LABEL]);
  assert.equal(shouldNotify(p, { state: 'overdue' }), false);
  assert.equal(shouldNotify(pr(300, [PENDING_LABEL]), { state: 'overdue' }), true);
  assert.equal(shouldNotify(pr(300, [PENDING_LABEL]), { state: 'waiting' }), false);
  const gh = fakeGithub({ pending: [p], events: { 300: labeled(ago(90)) } });
  const r = await run({ request: gh.request, env: env(), now: NOW });
  assert.equal(r.evaluation.exitCode, 1);
  assert.deepEqual(r.actions, ['label:300']);
});

test('run: the threshold override is honoured on dispatch (2 min) and IGNORED on a schedule (same 5-minute-old PR)', async () => {
  const setup = () => fakeGithub({ pending: [pr(1, [PENDING_LABEL])], events: { 1: labeled(ago(5)) } });
  const dispatch = await run({ request: setup().request, env: env({ GITHUB_EVENT_NAME: 'workflow_dispatch', DEPLOY_AUTH_THRESHOLD_MINUTES: '2' }), now: NOW });
  assert.equal(dispatch.evaluation.exitCode, 1);
  assert.ok(dispatch.evaluation.notes.some((n) => /TEST-ONLY threshold 2 min/.test(n)));
  const scheduled = await run({ request: setup().request, env: env({ GITHUB_EVENT_NAME: 'schedule', DEPLOY_AUTH_THRESHOLD_MINUTES: '2' }), now: NOW });
  assert.equal(scheduled.evaluation.exitCode, 0, 'a schedule must not be able to shorten the real hour');
  assert.ok(scheduled.evaluation.notes.some((n) => /IGNORED/.test(n)));
});

test('run: an event list without the pending label -> could-not-look -> RED, with no label or comment posted', async () => {
  const gh = fakeGithub({ pending: [pr(7, [PENDING_LABEL])], events: { 7: [] } });
  const r = await run({ request: gh.request, env: env(), now: NOW });
  assert.equal(r.evaluation.exitCode, 1);
  assert.deepEqual(r.actions, []);
});

test('run: the unlabelled-PR count names the PRs this watcher is blind to; drafts and labelled PRs are excluded', async () => {
  const open = [
    { number: 196, draft: false, created_at: ago(3 * 1440), labels: [] },
    { number: 165, draft: false, created_at: ago(9 * 1440), labels: [] },
    { number: 200, draft: true, created_at: ago(5 * 1440), labels: [] },
    { number: 250, draft: false, created_at: ago(60), labels: [{ name: PENDING_LABEL }] },
  ];
  const r = await run({ request: fakeGithub({ open }).request, env: env(), now: NOW });
  const note = r.evaluation.notes.find((n) => /INVISIBLE to this watcher/.test(n));
  assert.match(note, /2 open non-draft PR\(s\)/);
  assert.match(note, /#196, #165/);
  assert.doesNotMatch(note, /#200|#250/);
  assert.match(note, /oldest 9 day/);
  assert.equal(r.evaluation.exitCode, 0, 'informational: it must not turn a healthy run red');
  assert.equal(describeUnlabelled([]), null);
});

test('run: if listing open PRs fails the run goes RED (AC6 rides on that read, so a gap there can hide an armed PR)', async () => {
  const r = await run({ request: fakeGithub({ failOpen: true }).request, env: env(), now: NOW });
  assert.equal(r.evaluation.exitCode, 1);
  assert.ok(r.evaluation.errors.some((e) => /could not list open PRs/.test(e)));
});

// ===== gy-e9wa6.1 AC4 / AC6 =====
import { GRANTED_LABEL, armedWithoutGrant } from '../scripts/deploy-authorization-watch.mjs';

test('AC4: the overdue comment never @-mentions anyone, and names pm as the authoriser', () => {
  const src = readFileSync(new URL('../scripts/deploy-authorization-watch.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /@kaushik/i);
  assert.match(src, /authoriser is pm/);
});

const armed = (number, labels = [], base = 'main') => ({ number, draft: false, created_at: ago(30), base: { ref: base }, labels, auto_merge: { enabled_by: { login: 'x' } } });

test('AC6 POSITIVE: an open PR to main with auto-merge armed and no grant turns the run RED and names it', async () => {
  const open = [armed(196)];
  const r = await run({ request: fakeGithub({ open }).request, env: env(), now: NOW });
  assert.equal(r.evaluation.exitCode, 1);
  assert.match(r.evaluation.errors.join('\n'), /AUTO-MERGE ARMED without a recorded grant: #196/);
});

test('AC6 NEGATIVE: armed WITH the grant label, unarmed, and armed-to-another-base are all left green', async () => {
  const open = [armed(1, [{ name: GRANTED_LABEL }]), { ...armed(2), auto_merge: null }, armed(3, [], 'release')];
  const r = await run({ request: fakeGithub({ open }).request, env: env(), now: NOW });
  assert.equal(r.evaluation.exitCode, 0);
  assert.deepEqual(armedWithoutGrant(open), []);
});

// --- the real CLI: the EXIT CODE is the product, so drive the script itself with a stubbed fetch ---
const scratch = mkdtempSync(join(tmpdir(), 'gymbo-auth-watch-'));
process.on('exit', () => rmSync(scratch, { recursive: true, force: true }));
const SCRIPT = new URL('../scripts/deploy-authorization-watch.mjs', import.meta.url).pathname;
function cli(ageMin, extraEnv = {}) {
  const shim = join(scratch, `shim-${Math.random().toString(36).slice(2)}.mjs`);
  const pending = [{ number: 196, pull_request: {}, labels: [{ name: PENDING_LABEL }] }];
  const events = [{ event: 'labeled', label: { name: PENDING_LABEL }, created_at: new Date(Date.now() - ageMin * 60000).toISOString() }];
  writeFileSync(shim, `globalThis.fetch = async (url, o = {}) => { const j = (x) => ({ ok: true, status: 200, json: async () => x, text: async () => '' });
    if (String(url).includes('/events')) return j(${JSON.stringify(events)});
    if (String(url).includes('/pulls?')) return j([]);
    if ((o.method ?? 'GET') === 'GET') return j(${JSON.stringify(pending)});
    return j({}); };`);
  return spawnSync(process.execPath, ['--import', shim, SCRIPT], { encoding: 'utf8', env: { PATH: process.env.PATH, GITHUB_REPOSITORY: 'o/r', GH_TOKEN: 't', GITHUB_EVENT_NAME: 'schedule', ...extraEnv } });
}

test('CLI POSITIVE CONTROL: the real script EXITS 1 on an overdue PR and prints an ::error:: naming it', () => {
  const r = cli(75);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stderr, /::error::OVERDUE: #196 \(7\d min\)/);
});

test('CLI NEGATIVE CONTROL: the real script EXITS 0 under the threshold', () => {
  const r = cli(20);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /OK: checked 1 pending public-site PR/);
});

test('CLI: a 5-minute-old PR is GREEN on a schedule with an override set, and RED on dispatch with it', () => {
  assert.equal(cli(5, { DEPLOY_AUTH_THRESHOLD_MINUTES: '1' }).status, 0);
  assert.equal(cli(5, { DEPLOY_AUTH_THRESHOLD_MINUTES: '1', GITHUB_EVENT_NAME: 'workflow_dispatch' }).status, 1);
});

test('CLI: a malformed override on dispatch is refused with a non-zero exit, not silently defaulted', () => {
  const r = cli(5, { DEPLOY_AUTH_THRESHOLD_MINUTES: 'soon', GITHUB_EVENT_NAME: 'workflow_dispatch' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /positive number/);
});

// --- the workflow wiring ---
test('WORKFLOW: threshold_minutes is a dispatch input only, is handed to the script via env, and the runner is self-hosted', () => {
  const yml = readFileSync(new URL('../.github/workflows/deploy-authorization-watch.yml', import.meta.url), 'utf8');
  assert.match(yml, /schedule:\s*\n\s*- cron: "0 \* \* \* \*"/);
  assert.match(yml, /workflow_dispatch:\s*\n\s*inputs:\s*\n\s*threshold_minutes:/);
  assert.match(yml, /DEPLOY_AUTH_THRESHOLD_MINUTES: \$\{\{ inputs\.threshold_minutes \}\}/);
  assert.match(yml, /runs-on: \[self-hosted, gt2\]/);
  assert.match(yml, /TEST ONLY/);
  assert.doesNotMatch(yml, /DEPLOY_AUTH_THRESHOLD_MINUTES: ["']?\d/, 'no hardcoded override');
});

// ===== 2026-09-25: the first REAL overdue PR (control PR 227) made the label POST return 403 and the run went red for
// the wrong reason. An action failure must never stop the OVERDUE evaluation from being reported. =====
const FORBIDDEN = 'POST https://api.github.com/repos/o/r/issues/227/labels: 403 {"message":"Resource not accessible by integration"}';

test('run: a 403 on the LABEL POST does not stop the evaluation: the run reports OVERDUE AND the failed action, both RED', async () => {
  const gh = fakeGithub({ pending: [pr(227, [PENDING_LABEL])], events: { 227: labeled(ago(90)) }, failPost: { suffix: '/issues/227/labels', message: FORBIDDEN } });
  const r = await run({ request: gh.request, env: env(), now: NOW });
  assert.equal(r.evaluation.exitCode, 1);
  assert.ok(r.evaluation.errors.some((e) => /OVERDUE: #227 \(90 min\)/.test(e)), 'the OVERDUE error must still be reported');
  assert.ok(r.evaluation.errors.some((e) => /could not label #227: .*403/.test(e)), 'the failed label must be reported, not swallowed');
  assert.ok(!r.actions.includes('label:227'));
  assert.ok(r.actions.includes('comment:227'), 'the comment is attempted on its own, independent of the label');
});

test('run: a failing COMMENT is reported too, and the label that succeeded is still recorded', async () => {
  const gh = fakeGithub({ pending: [pr(227, [PENDING_LABEL])], events: { 227: labeled(ago(90)) }, failPost: { suffix: '/issues/227/comments', message: 'POST .../comments: 403' } });
  const r = await run({ request: gh.request, env: env(), now: NOW });
  assert.equal(r.evaluation.exitCode, 1);
  assert.ok(r.actions.includes('label:227'));
  assert.ok(r.evaluation.errors.some((e) => /could not comment #227/.test(e)));
  assert.ok(r.evaluation.errors.some((e) => /OVERDUE: #227/.test(e)));
});

test('run: with NO action failure there is no could-not-label noise (the report is exact)', async () => {
  const gh = fakeGithub({ pending: [pr(227, [PENDING_LABEL])], events: { 227: labeled(ago(90)) } });
  const r = await run({ request: gh.request, env: env(), now: NOW });
  assert.equal(r.evaluation.errors.filter((e) => /could not/.test(e)).length, 0);
});

function cliWith403(ageMin) {
  const shim = join(scratch, `shim403-${Math.random().toString(36).slice(2)}.mjs`);
  const pending = [{ number: 227, pull_request: {}, labels: [{ name: PENDING_LABEL }, { name: TEST_LABEL }] }];
  const events = [{ event: 'labeled', label: { name: PENDING_LABEL }, created_at: new Date(Date.now() - ageMin * 60000).toISOString() }];
  writeFileSync(shim, `globalThis.fetch = async (url, o = {}) => { const j = (x) => ({ ok: true, status: 200, json: async () => x, text: async () => '' });
    if (String(url).includes('/events')) return j(${JSON.stringify(events)});
    if (String(url).includes('/pulls?')) return j([]);
    if (o.method === 'POST') return { ok: false, status: 403, text: async () => '{"message":"Resource not accessible by integration"}', json: async () => ({}) };
    return j(${JSON.stringify(pending)}); };`);
  return spawnSync(process.execPath, ['--import', shim, SCRIPT], { encoding: 'utf8', env: { PATH: process.env.PATH, GITHUB_REPOSITORY: 'o/r', GH_TOKEN: 't', GITHUB_EVENT_NAME: 'schedule' } });
}

test('CLI: when the label POST is 403 the real script STILL exits 1 and prints BOTH ::error::OVERDUE and the failed label', () => {
  const r = cliWith403(90);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stderr, /::error::OVERDUE: #227 \(9\d min\)/);
  assert.match(r.stderr, /::error::could not label #227: POST .*403/);
});

test('CLI: a 403 on a PR that is NOT overdue is irrelevant and the run stays GREEN (nothing is posted, so nothing can 403)', () => {
  assert.equal(cliWith403(10).status, 0);
});

test('WORKFLOW PERMISSIONS: pull-requests is WRITE (a PR label needs it), issues write is kept, and the token can NOT write contents', () => {
  const yml = readFileSync(new URL('../.github/workflows/deploy-authorization-watch.yml', import.meta.url), 'utf8');
  const perms = /^permissions:\n((?:  \S.*\n)+)/m.exec(yml)[1];
  assert.match(perms, /^  pull-requests: write$/m);
  assert.match(perms, /^  issues: write$/m);
  assert.doesNotMatch(perms, /pull-requests: read/);
  assert.doesNotMatch(perms, /contents:\s*write/, 'this token labels and comments; it must not be able to merge or push');
});
