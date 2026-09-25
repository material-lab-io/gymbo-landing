#!/usr/bin/env node

// gy-e9wa6 — surface a green public-site PR that is awaiting PM authorisation.
//
// A merge to main publishes getgymbo.com. An implementer must therefore leave
// the merge to the authoriser, but a PR with no visible pending state looks the
// same as an abandoned one. This watcher turns that waiting state into a
// durable label and, once a PR has waited past the threshold, into a RED RUN.
//
// WHY RED (pm 2026-09-25): the first version only added a label and posted a PR
// comment. No agent reads GitHub notifications, and the named authoriser does
// not, so an overdue request reached nobody (AC3 NEG: "reports on PRs only when
// someone opens the repo"). A red conclusion IS read: this workflow is on the
// async-watchdog allowlists (wf 364035591), which mails the watchdog seat on a
// red SCHEDULED run within one tick. The label and the comment stay as the
// human-facing record; they are no longer the only signal.
//
// WHAT A GREEN RUN MEANS, stated so it cannot be over-read: an EMPTY pending set
// proves the scheduler works, not that authorisation requests are being made.
// Measured 2026-09-25: 0 PRs ever carried the pending label except this
// watcher's own PR (#199). This script therefore prints, every run, how many
// open non-draft PRs are NOT on the label and are therefore invisible to it.

export const PENDING_LABEL = 'deploy-authorization-pending';
export const OVERDUE_LABEL = 'deploy-authorization-overdue';
// A control PR carries this label so that its (deliberate) overdue state still turns the run
// red, but does not @-mention the founder with a test comment. It suppresses ONLY the comment.
export const TEST_LABEL = 'deploy-authorization-test';
export const DEFAULT_THRESHOLD_MS = 60 * 60 * 1000;
export const THRESHOLD_MS = DEFAULT_THRESHOLD_MS;

// The threshold may be shortened ONLY on a manual dispatch, so a control can be run in
// minutes. A scheduled run always uses the real hour: the production watcher's clock is never
// faked, and an override set on a schedule is ignored AND said out loud.
export function resolveThreshold(env = {}) {
  const raw = env.DEPLOY_AUTH_THRESHOLD_MINUTES;
  if (raw === undefined || String(raw).trim() === '') return { thresholdMs: DEFAULT_THRESHOLD_MS, note: null };
  if (env.GITHUB_EVENT_NAME !== 'workflow_dispatch') {
    return { thresholdMs: DEFAULT_THRESHOLD_MS, note: `threshold override ${raw} IGNORED: it is honoured only on workflow_dispatch (event is ${env.GITHUB_EVENT_NAME || 'unknown'}); using the real ${DEFAULT_THRESHOLD_MS / 60000} min` };
  }
  const minutes = Number(raw);
  if (!Number.isFinite(minutes) || minutes <= 0) throw new Error(`DEPLOY_AUTH_THRESHOLD_MINUTES must be a positive number, got ${JSON.stringify(raw)}; refusing to fall back silently`);
  return { thresholdMs: minutes * 60000, note: `TEST-ONLY threshold ${minutes} min in force (workflow_dispatch); a scheduled run would use ${DEFAULT_THRESHOLD_MS / 60000} min` };
}

export function pendingSince(events) {
  const labels = events
    .filter((event) => event.event === 'labeled' && event.label?.name === PENDING_LABEL)
    .map((event) => Date.parse(event.created_at))
    .filter(Number.isFinite);
  return labels.length ? Math.max(...labels) : null;
}

export function classifyPending(issue, events, now = Date.now(), thresholdMs = DEFAULT_THRESHOLD_MS) {
  const since = pendingSince(events);
  if (since === null) return { issue, state: 'could-not-look', since: null, ageMs: null };
  const ageMs = now - since;
  return { issue, state: ageMs >= thresholdMs ? 'overdue' : 'waiting', since, ageMs };
}

const minutes = (ms) => Math.floor(ms / 60000);

// What the run concludes. Pure, so the red/green rule is testable without GitHub.
//   overdue        -> RED (the signal an agent can read)
//   could-not-look -> RED (an absence we could not observe is not an absence)
//   waiting/empty  -> green, with the empty set called out for what it proves
export function evaluate(rows, { thresholdMs = DEFAULT_THRESHOLD_MS } = {}) {
  const errors = [];
  const notes = [];
  const overdue = rows.filter((row) => row.state === 'overdue');
  const unknown = rows.filter((row) => row.state === 'could-not-look');
  if (overdue.length) {
    errors.push(`OVERDUE: ${overdue.map((row) => `#${row.issue.number} (${minutes(row.ageMs)} min)`).join(', ')} awaited deployment authorisation past the ${minutes(thresholdMs)} min threshold. Authorise and merge, name the performer, or close the PR; the run stays red until then (gy-e9wa6).`);
  }
  if (unknown.length) {
    errors.push(`Could not determine when ${unknown.map((row) => `#${row.issue.number}`).join(', ')} entered the pending queue.`);
  }
  if (!rows.length) {
    notes.push(`EMPTY SET: 0 open PRs carry ${PENDING_LABEL}. This green proves the scheduler works, NOT that authorisation requests are being made (gy-e9wa6 AC1/AC5).`);
  }
  return { exitCode: errors.length ? 1 : 0, errors, notes };
}

// PRs this watcher CANNOT see: open, non-draft, and not on the pending label. It is informational
// (an open PR is often legitimately waiting on CI or review), but printing it every run keeps the
// label-gated (opt-in) nature of this watcher visible instead of silent.
export function describeUnlabelled(openPrs, now = Date.now()) {
  const unlabelled = openPrs.filter((pr) => !pr.draft && !(pr.labels ?? []).some((label) => label.name === PENDING_LABEL));
  if (!unlabelled.length) return null;
  const oldest = Math.max(...unlabelled.map((pr) => now - Date.parse(pr.created_at)));
  return `${unlabelled.length} open non-draft PR(s) are NOT on ${PENDING_LABEL} and are INVISIBLE to this watcher (opt-in by label): ${unlabelled.map((pr) => `#${pr.number}`).join(', ')}; oldest ${Math.floor(oldest / 86400000)} day(s). Whether each is waiting on CI, review or an authoriser is not something this run can tell.`;
}

export const shouldNotify = (issue, row) =>
  row.state === 'overdue' && !issue.labels.some((label) => label.name === OVERDUE_LABEL || label.name === TEST_LABEL);

// `request(url, options)` is injected so the whole run can be exercised without GitHub.
export async function run({ request, env, now = Date.now() }) {
  const repo = env.GITHUB_REPOSITORY;
  if (!repo) throw new Error('GITHUB_REPOSITORY is required.');
  const { thresholdMs, note } = resolveThreshold(env);
  const api = `https://api.github.com/repos/${repo}`;
  const issues = await request(`${api}/issues?state=open&labels=${encodeURIComponent(PENDING_LABEL)}&per_page=100`);
  const prs = issues.filter((issue) => issue.pull_request);
  const rows = [];
  const actions = [];

  for (const issue of prs) {
    const events = await request(`${api}/issues/${issue.number}/events?per_page=100`);
    const row = classifyPending(issue, events, now, thresholdMs);
    rows.push(row);
    if (row.state !== 'overdue') continue;
    if (!issue.labels.some((label) => label.name === OVERDUE_LABEL)) {
      await request(`${api}/issues/${issue.number}/labels`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ labels: [OVERDUE_LABEL] }),
      });
      actions.push(`label:${issue.number}`);
    }
    if (shouldNotify(issue, row)) {
      await request(`${api}/issues/${issue.number}/comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: `@kaushikNaarayan this public-site PR has awaited deployment authorisation for over one hour. Please authorise and perform (or name the performer of) the merge. This is not a delegation of the merge.\n\nTracking: \`${PENDING_LABEL}\` → \`${OVERDUE_LABEL}\` (gy-e9wa6). This run is also RED until it is resolved.` }),
      });
      actions.push(`comment:${issue.number}`);
    }
  }

  const evaluation = evaluate(rows, { thresholdMs });
  if (note) evaluation.notes.push(note);
  let unlabelledNote = null;
  try {
    const open = await request(`${api}/pulls?state=open&per_page=100`);
    unlabelledNote = describeUnlabelled(open, now);
  } catch (error) {
    // the informational count must never turn a healthy run red, but it must not vanish quietly either
    evaluation.notes.push(`could not list open PRs to count the unlabelled ones: ${error.message}`);
  }
  if (unlabelledNote) evaluation.notes.push(unlabelledNote);
  return { rows, evaluation, actions, thresholdMs };
}

const request = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${process.env.GH_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  });
  if (!response.ok) throw new Error(`${options.method ?? 'GET'} ${url}: ${response.status} ${await response.text()}`);
  return response.status === 204 ? null : response.json();
};

const main = async () => {
  if (!process.env.GH_TOKEN) throw new Error('GITHUB_REPOSITORY and GH_TOKEN are required.');
  const { rows, evaluation, thresholdMs } = await run({ request, env: process.env });

  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) {
    const lines = ['## Deploy authorisation queue', '', '| PR | State | Waiting |', '| --- | --- | --- |'];
    for (const row of rows) {
      const waiting = row.ageMs === null ? 'unknown' : `${minutes(row.ageMs)} min`;
      lines.push(`| #${row.issue.number} | ${row.state} | ${waiting} |`);
    }
    if (!rows.length) lines.push('| — | empty | — |');
    lines.push('', `Threshold: ${minutes(thresholdMs)} min.`, ...evaluation.notes.map((n) => `- ${n}`), ...evaluation.errors.map((e) => `- **RED:** ${e}`));
    await (await import('node:fs/promises')).appendFile(summary, `${lines.join('\n')}\n`);
  }
  for (const n of evaluation.notes) console.log(`NOTE: ${n}`);
  for (const e of evaluation.errors) console.error(`::error::${e}`);
  if (evaluation.exitCode === 0) console.log(`OK: checked ${rows.length} pending public-site PR(s).`);
  process.exitCode = evaluation.exitCode;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => { console.error(`::error::${error.message}`); process.exit(1); });
}
