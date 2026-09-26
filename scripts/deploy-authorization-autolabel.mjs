#!/usr/bin/env node

// gy-e9wa6.1 — put a green, non-draft PR to main into the deploy-authorisation queue WITHOUT anyone remembering to.
//
// WHY: deploy-authorization-watch.mjs only sees PRs that carry the pending label, and the label was applied by
// hand. Measured 2026-09-25: exactly 2 of 30 PRs ever carried a deploy-authorization-* label, so the watcher
// observed an EMPTY set on every run while 3 green non-draft PRs sat up to 9 days. Detection that depends on the
// thing being detected volunteering itself is the defect. This closes that hole (pm ruled option (b), 2026-09-25).
//
// WHAT IT WRITES: one label, on one kind of PR. It never merges, approves, deploys, comments or removes a label.
//
// WHAT "GREEN" MEANS: every name in REQUIRED_CHECKS has a check run on the PR's CURRENT head sha whose conclusion
// is 'success'. The names are exact (never a substring, never "all checks"): an ABSENT check must not read as green,
// and a cancelled/skipped/in-progress one is not green either. Keep REQUIRED_CHECKS equal to branch protection on
// main; the test file asserts the list is non-empty and exact, and a mismatch shows up as a PR that is never labelled
// (fail-quiet toward "not labelled"), which the watcher's unlabelled count still prints every hour.

export const PENDING_LABEL = 'deploy-authorization-pending';
export const REQUIRED_CHECKS = ['deploy', 'Runner policy (self-hosted only)'];

// Pure. Returns { green, reasons[] }; a reason is given for every way a PR can fail to qualify.
export function judge(pr, checkRuns, required = REQUIRED_CHECKS) {
  const reasons = [];
  if (pr.draft) reasons.push('draft');
  if (pr.base?.ref !== 'main') reasons.push(`base is ${pr.base?.ref}, not main`);
  if ((pr.labels ?? []).some((label) => label.name === PENDING_LABEL)) reasons.push('already labelled');
  for (const name of required) {
    const runs = checkRuns.filter((run) => run.name === name);
    if (!runs.length) { reasons.push(`required check "${name}" is absent`); continue; }
    // a rerun leaves several runs of one name on one sha; the newest is the truth
    const latest = runs.reduce((a, b) => (Date.parse(b.started_at ?? 0) > Date.parse(a.started_at ?? 0) ? b : a));
    if (latest.conclusion !== 'success') reasons.push(`required check "${name}" is ${latest.conclusion ?? latest.status}`);
  }
  return { green: reasons.length === 0, reasons };
}

// `request(url, options)` is injected so a whole run can be exercised without GitHub.
export async function run({ request, env }) {
  const repo = env.GITHUB_REPOSITORY;
  if (!repo) throw new Error('GITHUB_REPOSITORY is required.');
  const api = `https://api.github.com/repos/${repo}`;
  const prs = await request(`${api}/pulls?state=open&base=main&per_page=100`);
  const labelled = [];
  const skipped = [];
  const errors = [];
  for (const pr of prs) {
    if (pr.draft) { skipped.push({ number: pr.number, reasons: ['draft'] }); continue; }
    let checkRuns;
    try {
      const page = await request(`${api}/commits/${pr.head.sha}/check-runs?filter=latest&per_page=100`);
      checkRuns = page.check_runs;
    } catch (error) { errors.push(`could not read checks of #${pr.number}: ${error.message}`); continue; }
    const verdict = judge(pr, checkRuns);
    if (!verdict.green) { skipped.push({ number: pr.number, reasons: verdict.reasons }); continue; }
    try {
      await request(`${api}/issues/${pr.number}/labels`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ labels: [PENDING_LABEL] }),
      });
      labelled.push(pr.number);
    } catch (error) { errors.push(`could not label #${pr.number}: ${error.message}`); }
  }
  return { labelled, skipped, errors };
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
  if (!process.env.GH_TOKEN) throw new Error('GH_TOKEN is required.');
  const { labelled, skipped, errors } = await run({ request, env: process.env });
  for (const s of skipped) console.log(`NOT labelled #${s.number}: ${s.reasons.join('; ')}`);
  for (const n of labelled) console.log(`LABELLED #${n} ${PENDING_LABEL}`);
  console.log(`OK: labelled ${labelled.length}, left ${skipped.length} alone.`);
  for (const e of errors) console.error(`::error::${e}`);
  process.exitCode = errors.length ? 1 : 0;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => { console.error(`::error::${error.message}`); process.exit(1); });
}
