// gy-y2ci1: Prod Watch's "live site matches main HEAD" guard must not go red while the deploy for that HEAD is
// still running, and must STAY red when the deploy really failed or never ran.
//
// AC1  a harness reproduces the recorded case and asserts PENDING (the old inline logic, reproduced below as
//      `oldGuard`, says FAIL for every one of them).
// AC2  the must-stay-red cases (gy-7d6v5 failed deploy, gy-sa0fm never ran, stuck, stale-after-success).
// AC3  the three recorded historical red instances replayed by run id from REAL GitHub data
//      (tests/fixtures/prod-watch-inflight-runs.json): PENDING at the guard's time, then clear.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { evaluate, LIMITS } from "../scripts/check-deploy-matches-head.mjs";

const SCRIPT = resolve(import.meta.dirname, "..", "scripts", "check-deploy-matches-head.mjs");
const FIXTURE = JSON.parse(readFileSync(resolve(import.meta.dirname, "fixtures", "prod-watch-inflight-runs.json"), "utf8"));
const MIN = 60000;
const STALE = "e".repeat(40);

// The logic this replaces: any difference fails.
const oldGuard = ({ headSha, liveSha }) => (!liveSha || liveSha !== headSha ? "FAIL" : "OK");

// A fixture deploy run holds its FINAL state; derive what it looked like at `nowMs`.
function asOf(run, nowMs) {
  const created = Date.parse(run.createdAt), done = Date.parse(run.updatedAt);
  if (nowMs < created) return null;
  return nowMs < done
    ? { ...run, status: "in_progress", conclusion: null }
    : { ...run, status: run.finalStatus, conclusion: run.finalConclusion };
}
const runsAt = (c, nowMs) => c.deployRuns.map((r) => asOf(r, nowMs)).filter(Boolean);
const facts = (c, nowMs, liveSha = STALE) => ({ headSha: c.headSha, liveSha, headCommittedAt: c.headCommittedAt, runs: runsAt(c, nowMs), now: nowMs });

for (const c of FIXTURE.cases) {
  test(`AC3 REPLAY watch run ${c.watchRunId}: at the guard's time (${c.guardEvaluatedAt}) the deploy for HEAD ${c.headSha.slice(0, 8)} is in flight -> PENDING (the old guard said FAIL)`, () => {
    const now = Date.parse(c.guardEvaluatedAt);
    const f = facts(c, now);
    assert.equal(oldGuard(f), "FAIL", "AC1: the old logic reproduces the false red");
    assert.equal(f.runs.length, 1);
    assert.equal(f.runs[0].status, "in_progress", "the recorded deploy run was still running when the guard looked");
    const r = evaluate(f);
    assert.equal(r.verdict, "PENDING");
    assert.equal(r.code, "deploy-in-flight");
    assert.match(r.message, new RegExp(String(f.runs[0].id)));
  });

  test(`AC3 REPLAY watch run ${c.watchRunId}: ...then clear once the deploy lands and the site serves HEAD`, () => {
    const done = Date.parse(c.deployRuns[0].updatedAt);
    // the next hourly run: well after the deploy, live now equals HEAD
    const r = evaluate(facts(c, done + 50 * MIN, c.headSha));
    assert.equal(r.verdict, "OK");
    assert.equal(r.code, "match");
  });
}

test("AC2 MUST STAY RED (gy-7d6v5): the deploy for HEAD concluded FAILURE -> FAIL, whatever the age", () => {
  const c = FIXTURE.cases[0], now = Date.parse(c.headCommittedAt) + 3 * MIN;
  for (const conclusion of ["failure", "cancelled", "timed_out"]) {
    const r = evaluate({ ...facts(c, now), runs: [{ id: 1, event: "push", branch: "main", status: "completed", conclusion, createdAt: c.headCommittedAt, updatedAt: new Date(now - MIN).toISOString() }] });
    assert.equal(r.verdict, "FAIL", conclusion);
    assert.equal(r.code, "deploy-failed");
  }
});

test("AC2 MUST STAY RED (gy-sa0fm): no deploy run for HEAD exists past the grace window -> FAIL; inside it -> PENDING", () => {
  const c = FIXTURE.cases[0], t0 = Date.parse(c.headCommittedAt);
  const inside = evaluate({ ...facts(c, t0 + 4 * MIN), runs: [] });
  assert.equal(inside.verdict, "PENDING"); assert.equal(inside.code, "no-run-yet");
  const past = evaluate({ ...facts(c, t0 + (LIMITS.noRunGraceMin + 1) * MIN), runs: [] });
  assert.equal(past.verdict, "FAIL"); assert.equal(past.code, "no-run");
});

test("AC2 MUST STAY RED: a deploy that has been in flight past the limit is STUCK -> FAIL (PENDING is bounded)", () => {
  const c = FIXTURE.cases[0], t0 = Date.parse(c.headCommittedAt);
  const run = { id: 7, event: "push", branch: "main", status: "queued", conclusion: null, createdAt: c.headCommittedAt, updatedAt: c.headCommittedAt };
  assert.equal(evaluate({ ...facts(c, t0 + 30 * MIN), runs: [run] }).verdict, "PENDING", "queued behind a busy runner pool is legitimate for a while");
  const r = evaluate({ ...facts(c, t0 + (LIMITS.inFlightMaxMin + 1) * MIN), runs: [run] });
  assert.equal(r.verdict, "FAIL"); assert.equal(r.code, "deploy-stuck");
});

test("AC2 MUST STAY RED: the deploy SUCCEEDED but the live site still serves the old stamp past the settle window -> FAIL", () => {
  const c = FIXTURE.cases[0], done = Date.parse(c.deployRuns[0].updatedAt);
  assert.equal(evaluate(facts(c, done + 3 * MIN)).verdict, "PENDING", "settling");
  assert.equal(evaluate(facts(c, done + 3 * MIN)).code, "settling");
  const r = evaluate(facts(c, done + (LIMITS.settleMin + 1) * MIN));
  assert.equal(r.verdict, "FAIL"); assert.equal(r.code, "success-but-stale");
});

test("only a PUSH to MAIN counts: an in-flight pull_request run with the same sha does not excuse a missing main deploy", () => {
  const c = FIXTURE.cases[0], t0 = Date.parse(c.headCommittedAt);
  const prRun = { id: 9, event: "pull_request", branch: "landing/x", status: "in_progress", conclusion: null, createdAt: c.headCommittedAt, updatedAt: c.headCommittedAt };
  const r = evaluate({ ...facts(c, t0 + 20 * MIN), runs: [prRun] });
  assert.equal(r.verdict, "FAIL"); assert.equal(r.code, "no-run");
});

test("UNCHANGED behaviour: live == HEAD is OK; an unreadable live stamp is FAIL; unreadable runs FAIL CLOSED", () => {
  const c = FIXTURE.cases[0], now = Date.parse(c.guardEvaluatedAt);
  assert.equal(evaluate(facts(c, now, c.headSha)).verdict, "OK");
  assert.equal(evaluate(facts(c, now, "")).code, "no-live-sha");
  const r = evaluate({ ...facts(c, now), runs: null });
  assert.equal(r.verdict, "FAIL"); assert.equal(r.code, "runs-unreadable");
});

test("the latest deploy run for HEAD decides (a retried deploy supersedes the failed first attempt)", () => {
  const c = FIXTURE.cases[0], t0 = Date.parse(c.headCommittedAt);
  const failed = { id: 1, event: "push", branch: "main", status: "completed", conclusion: "failure", createdAt: new Date(t0 + MIN).toISOString(), updatedAt: new Date(t0 + 4 * MIN).toISOString() };
  const retry = { id: 2, event: "push", branch: "main", status: "in_progress", conclusion: null, createdAt: new Date(t0 + 5 * MIN).toISOString(), updatedAt: new Date(t0 + 5 * MIN).toISOString() };
  const r = evaluate({ ...facts(c, t0 + 8 * MIN), runs: [failed, retry] });
  assert.equal(r.verdict, "PENDING"); assert.match(r.message, /run 2/);
});

// ---- the real CLI, in a throwaway git repo (so HEAD's commit time is under test control), against local fakes ----
function repoWithHead(dateIso) {
  const dir = mkdtempSync(join(tmpdir(), "pw-inflight-"));
  const env = { ...process.env, GIT_AUTHOR_DATE: dateIso, GIT_COMMITTER_DATE: dateIso, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["commit", "-q", "--allow-empty", "-m", "x"], { cwd: dir, env });
  return { dir, sha: execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" }).trim() };
}
function fake({ liveSha, apiStatus = 200, runs = [] }) {
  return new Promise((ok) => {
    const s = http.createServer((req, res) => {
      if (req.url.startsWith("/build-sha.txt")) { res.writeHead(liveSha ? 200 : 404); return res.end(liveSha || "no"); }
      res.writeHead(apiStatus, { "content-type": "application/json" });
      res.end(JSON.stringify({ workflow_runs: runs.map((r) => ({ id: r.id, event: r.event, head_branch: r.branch, status: r.status, conclusion: r.conclusion, created_at: r.createdAt, updated_at: r.updatedAt })) }));
    });
    s.listen(0, "127.0.0.1", () => ok({ s, base: `http://127.0.0.1:${s.address().port}` }));
  });
}
const cli = (cwd, base) => new Promise((ok) => {
  const p = spawn(process.execPath, [SCRIPT], { cwd, env: { ...process.env, BUILD_SHA_URL: `${base}/build-sha.txt`, GITHUB_API_URL: base, GITHUB_REPOSITORY: "o/r" } });
  let out = ""; p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (out += d)); p.on("close", (code) => ok({ code, out }));
});
async function scenario({ liveIsHead, ageMin, apiStatus, mkRuns }) {
  const iso = new Date(Date.now() - ageMin * MIN).toISOString().replace(/\.\d+Z$/, "Z");
  const { dir, sha } = repoWithHead(iso);
  const { s, base } = await fake({ liveSha: liveIsHead ? sha : STALE, apiStatus, runs: mkRuns ? mkRuns(sha, iso) : [] });
  try { return await cli(dir, base); } finally { s.close(); rmSync(dir, { recursive: true, force: true }); }
}

test("CLI: live == HEAD exits 0 and says OK", async () => {
  const r = await scenario({ liveIsHead: true, ageMin: 5 });
  assert.equal(r.code, 0, r.out); assert.match(r.out, /OK\s+live site matches main HEAD/);
});
test("CLI: stale live + a deploy IN PROGRESS for HEAD exits 0 with a PENDING notice (the recorded false red)", async () => {
  const r = await scenario({ liveIsHead: false, ageMin: 2, mkRuns: (sha, iso) => [{ id: 4242, event: "push", branch: "main", status: "in_progress", conclusion: null, createdAt: iso, updatedAt: iso }] });
  assert.equal(r.code, 0, r.out); assert.match(r.out, /::notice::PENDING \(deploy-in-flight\)/); assert.match(r.out, /4242/);
});
test("CLI: stale live + the deploy FAILED exits 1 (stays red)", async () => {
  const r = await scenario({ liveIsHead: false, ageMin: 20, mkRuns: (sha, iso) => [{ id: 77, event: "push", branch: "main", status: "completed", conclusion: "failure", createdAt: iso, updatedAt: iso }] });
  assert.equal(r.code, 1, r.out); assert.match(r.out, /FAIL \(deploy-failed\)/);
});
test("CLI: stale live + NO deploy run for an old HEAD exits 1 (gy-sa0fm)", async () => {
  const r = await scenario({ liveIsHead: false, ageMin: 40, mkRuns: () => [] });
  assert.equal(r.code, 1, r.out); assert.match(r.out, /FAIL \(no-run\)/);
});
test("CLI: stale live + the GitHub API answering 500 exits 1 (fails closed)", async () => {
  const r = await scenario({ liveIsHead: false, ageMin: 2, apiStatus: 500 });
  assert.equal(r.code, 1, r.out); assert.match(r.out, /FAIL \(runs-unreadable\)/);
});
