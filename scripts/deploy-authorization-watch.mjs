#!/usr/bin/env node

// gy-e9wa6 — surface a green public-site PR that is awaiting PM authorisation.
//
// A merge to main publishes getgymbo.com. An implementer must therefore leave
// the merge to the authoriser, but a PR with no visible pending state looks the
// same as an abandoned one. This watcher turns that waiting state into a
// durable label and, after one hour, one GitHub notification to the authoriser.

export const PENDING_LABEL = 'deploy-authorization-pending';
export const OVERDUE_LABEL = 'deploy-authorization-overdue';
export const THRESHOLD_MS = 60 * 60 * 1000;

export function pendingSince(events) {
  const labels = events
    .filter((event) => event.event === 'labeled' && event.label?.name === PENDING_LABEL)
    .map((event) => Date.parse(event.created_at))
    .filter(Number.isFinite);
  return labels.length ? Math.max(...labels) : null;
}

export function classifyPending(issue, events, now = Date.now()) {
  const since = pendingSince(events);
  if (since === null) return { issue, state: 'could-not-look', since: null, ageMs: null };
  const ageMs = now - since;
  return { issue, state: ageMs >= THRESHOLD_MS ? 'overdue' : 'waiting', since, ageMs };
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
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo || !process.env.GH_TOKEN) throw new Error('GITHUB_REPOSITORY and GH_TOKEN are required.');
  const api = `https://api.github.com/repos/${repo}`;
  const issues = await request(`${api}/issues?state=open&labels=${encodeURIComponent(PENDING_LABEL)}&per_page=100`);
  const prs = issues.filter((issue) => issue.pull_request);
  const rows = [];

  for (const issue of prs) {
    const events = await request(`${api}/issues/${issue.number}/events?per_page=100`);
    const row = classifyPending(issue, events);
    rows.push(row);
    if (row.state !== 'overdue' || issue.labels.some((label) => label.name === OVERDUE_LABEL)) continue;

    await request(`${api}/issues/${issue.number}/labels`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ labels: [OVERDUE_LABEL] }),
    });
    await request(`${api}/issues/${issue.number}/comments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: `@kaushikNaarayan this public-site PR has awaited deployment authorisation for over one hour. Please authorise and perform (or name the performer of) the merge. This is not a delegation of the merge.\n\nTracking: \`${PENDING_LABEL}\` → \`${OVERDUE_LABEL}\` (gy-e9wa6).` }),
    });
  }

  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) {
    const lines = ['## Deploy authorisation queue', '', '| PR | State | Waiting |', '| --- | --- | --- |'];
    for (const row of rows) {
      const waiting = row.ageMs === null ? 'unknown' : `${Math.floor(row.ageMs / 60000)} min`;
      lines.push(`| #${row.issue.number} | ${row.state} | ${waiting} |`);
    }
    if (!rows.length) lines.push('| — | empty | — |');
    await (await import('node:fs/promises')).appendFile(summary, `${lines.join('\n')}\n`);
  }

  const unknown = rows.filter((row) => row.state === 'could-not-look');
  if (unknown.length) throw new Error(`Could not determine when ${unknown.map((row) => `#${row.issue.number}`).join(', ')} entered the pending queue.`);
  console.log(`OK: checked ${rows.length} pending public-site PR(s).`);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => { console.error(`::error::${error.message}`); process.exit(1); });
}
