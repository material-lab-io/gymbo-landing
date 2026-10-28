// gy-y2ci1: Prod Watch's "does the live site serve main's HEAD" guard, split into WHAT HAPPENED and WHAT IT MEANS.
//
// The old inline step compared live build-sha.txt with `git rev-parse HEAD` and failed on any difference. That is
// a monitor race, not a production fault, whenever it ran while the deploy of the just-merged commit was still
// running: three recorded false reds (watch runs 36045942532, 36032131543, 36081532952), in each of which a
// deploy run for that exact HEAD existed and was in progress when the guard looked (deploys took 5 to 17.6 min;
// the cron is hourly, so the window is real). Each paged the async-watchdog for a healthy surface and muddied
// gy-95ctk's end-to-end alert-chain verification.
//
// The guard now classifies a MISMATCH by what the deploy run FOR THAT HEAD is doing:
//   live == HEAD                                  OK
//   a deploy run for HEAD is queued/in_progress   PENDING, until it has run too long (a stuck deploy goes red)
//   it succeeded very recently                    PENDING (edge/propagation), then FAIL: it published nothing
//   it concluded failure/cancelled/timed_out      FAIL (gy-7d6v5: a failed deploy that nothing retried)
//   no deploy run for HEAD at all                 PENDING for a short grace, then FAIL (gy-sa0fm: it never ran)
//   live build-sha could not be read              FAIL (unchanged: site down, or the stamp is not deployed)
//   the runs could not be read from the API       FAIL (fail closed: an unclassifiable mismatch is not a pass)
//
// PENDING is not a pass in disguise: it exits 0 with a ::notice::, but every PENDING branch is BOUNDED by a time
// measured from the HEAD commit or the deploy's completion, so a deploy that never lands turns red on a later hourly
// run instead of staying quiet.
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const LIMITS = {
  // A deploy for HEAD may legitimately run this long (observed 5 to 17.6 min; gt3 queueing can add more).
  inFlightMaxMin: 60,
  // After a SUCCESSFUL deploy, how long the live site may still serve the old stamp (Pages edge propagation).
  settleMin: 10,
  // After the commit lands, how long deploy.yml may take to even create its run.
  noRunGraceMin: 10,
};

const IN_FLIGHT = new Set(["queued", "in_progress", "waiting", "requested", "pending"]);
const mins = (a, b) => (a - b) / 60000;

// Pure. `runs` = deploy.yml runs for headSha (any event/branch; filtered here), each
// { id, event, branch, status, conclusion, createdAt, updatedAt }. All times are ms epoch or ISO strings.
export function evaluate({ headSha, liveSha, headCommittedAt, runs, now, limits = LIMITS }) {
  const t = (x) => (typeof x === "number" ? x : Date.parse(x));
  const nowMs = t(now), headMs = t(headCommittedAt);
  const sinceCommit = mins(nowMs, headMs);
  if (!liveSha) return { verdict: "FAIL", code: "no-live-sha", message: "Could not fetch https://getgymbo.com/build-sha.txt at all: either the guard itself has not deployed yet, or the site is down (getgymbo-smoke.sh above should already have caught the latter)." };
  if (liveSha === headSha) return { verdict: "OK", code: "match", message: "live site matches main HEAD" };
  if (runs == null) return { verdict: "FAIL", code: "runs-unreadable", message: `Live site serves ${liveSha} but main's HEAD is ${headSha}, and the deploy runs for HEAD could not be read, so this mismatch cannot be classified. Failing closed.` };

  const mine = runs.filter((r) => r.event === "push" && r.branch === "main").sort((a, b) => t(b.createdAt) - t(a.createdAt));
  const run = mine[0];
  if (!run) {
    if (sinceCommit <= limits.noRunGraceMin) return { verdict: "PENDING", code: "no-run-yet", message: `HEAD ${headSha.slice(0, 8)} was committed ${sinceCommit.toFixed(1)} min ago and deploy.yml has not created a run for it yet (grace ${limits.noRunGraceMin} min). Live still serves ${liveSha.slice(0, 8)}.` };
    return { verdict: "FAIL", code: "no-run", message: `Live site is serving ${liveSha} but main's HEAD is ${headSha}, committed ${sinceCommit.toFixed(0)} min ago, and deploy.yml never ran for it (gy-sa0fm: suppressed by [skip ci], or wedged before a run was created). A merge to main has not reached production.` };
  }
  if (IN_FLIGHT.has(run.status)) {
    if (sinceCommit <= limits.inFlightMaxMin) return { verdict: "PENDING", code: "deploy-in-flight", message: `Deploy run ${run.id} for HEAD ${headSha.slice(0, 8)} is ${run.status}, ${sinceCommit.toFixed(1)} min after the commit (limit ${limits.inFlightMaxMin} min). Live still serves ${liveSha.slice(0, 8)}; not a production fault.` };
    return { verdict: "FAIL", code: "deploy-stuck", message: `Deploy run ${run.id} for HEAD ${headSha} has been ${run.status} for ${sinceCommit.toFixed(0)} min (limit ${limits.inFlightMaxMin}); live still serves ${liveSha}. The deploy is stuck.` };
  }
  if (run.conclusion === "success") {
    const since = mins(nowMs, t(run.updatedAt));
    if (since <= limits.settleMin) return { verdict: "PENDING", code: "settling", message: `Deploy run ${run.id} succeeded ${since.toFixed(1)} min ago; live still serves ${liveSha.slice(0, 8)} (settle window ${limits.settleMin} min).` };
    return { verdict: "FAIL", code: "success-but-stale", message: `Deploy run ${run.id} for HEAD ${headSha} succeeded ${since.toFixed(0)} min ago but the live site still serves ${liveSha}. The deploy step reported success and published nothing.` };
  }
  return { verdict: "FAIL", code: "deploy-failed", message: `Live site is serving ${liveSha} but main's HEAD is ${headSha}, and its deploy run ${run.id} concluded ${run.conclusion} (gy-7d6v5: a failed main deploy leaves the site behind until something retries it).` };
}

async function gather() {
  const headSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const headCommittedAt = execFileSync("git", ["show", "-s", "--format=%cI", "HEAD"], { encoding: "utf8" }).trim();
  let liveSha = "";
  try { const r = await fetch(process.env.BUILD_SHA_URL || "https://getgymbo.com/build-sha.txt", { signal: AbortSignal.timeout(10000) }); if (r.ok) liveSha = (await r.text()).trim(); } catch { /* reported as no-live-sha */ }
  let runs = null;
  if (liveSha && liveSha !== headSha) {
    const repo = process.env.GITHUB_REPOSITORY || "material-lab-io/gymbo-landing";
    const headers = { accept: "application/vnd.github+json", "user-agent": "gymbo-prod-watch" };
    if (process.env.GH_TOKEN) headers.authorization = `Bearer ${process.env.GH_TOKEN}`;
    try {
      const api = (process.env.GITHUB_API_URL || "https://api.github.com").replace(/\/$/, "");
      const r = await fetch(`${api}/repos/${repo}/actions/workflows/deploy.yml/runs?head_sha=${headSha}&per_page=20`, { headers, signal: AbortSignal.timeout(15000) });
      if (r.ok) runs = (await r.json()).workflow_runs.map((w) => ({ id: w.id, event: w.event, branch: w.head_branch, status: w.status, conclusion: w.conclusion, createdAt: w.created_at, updatedAt: w.updated_at }));
      else console.error(`check-deploy-matches-head: GitHub API answered HTTP ${r.status}`);
    } catch (e) { console.error(`check-deploy-matches-head: GitHub API unreachable: ${e.message}`); }
  }
  return { headSha, liveSha, headCommittedAt, runs, now: Date.now() };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const facts = await gather();
  console.log(`main HEAD:        ${facts.headSha}`);
  console.log(`live build-sha:   ${facts.liveSha}`);
  const r = evaluate(facts);
  if (r.verdict === "OK") { console.log(`OK   ${r.message}`); process.exit(0); }
  if (r.verdict === "PENDING") { console.log(`::notice::PENDING (${r.code}): ${r.message}`); console.log(`PENDING ${r.message}`); process.exit(0); }
  console.log(`::error::${r.message}`); console.log(`FAIL (${r.code})`);
  process.exit(1);
}
