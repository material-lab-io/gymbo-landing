// gy-iit8q — tests for scripts/check-master-asset-drift.mjs.
//
// 🔴 WHAT THIS FILE IS AND IS NOT. It proves the checker's LOGIC on synthetic git
// repos with fixed commit dates (no wall clock, no network, no Gymbo-v1). It does
// NOT prove anything about the real app repo: nothing in CI runs the checker
// against Gymbo-v1 (gy-1je63). A green run here means the instrument works, not
// that any landing master is fresh.
//
// The cases are the ones that make a "nothing changed" answer worth believing:
//   FOUND       the known truth (an asset ADDED after capture, PR #568's shape)
//               and the replace-in-place shape (same filename, new bytes)
//   NONE        only when the controls passed AND nothing visual changed
//   COULD-NOT-LOOK  every way the instrument can be blind must NOT read as NONE
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { SCREENS } from "../scripts/screens-map.mjs";

const SCRIPT = new URL("../scripts/check-master-asset-drift.mjs", import.meta.url).pathname;
const RES = "ios/Gymbo/Resources";
const ASSETS = `${RES}/Assets.xcassets`;
const MASTERS = Object.values(SCREENS);
const CAPTURED_AT = "2026-08-12T10:32:00+05:30"; // = 05:02Z, the real capture time

const scratch = mkdtempSync(join(tmpdir(), "asset-drift-"));
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));
let n = 0;
const fresh = (label) => join(scratch, `${label}-${++n}`);

function sh(cwd, args, env = {}) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, ...env } });
  assert.equal(r.status, 0, `git ${args.join(" ")} failed: ${r.stderr}`);
  return r.stdout.trim();
}
function repo(label) {
  const dir = fresh(label);
  mkdirSync(dir, { recursive: true });
  sh(dir, ["init", "-q", "-b", "main"]);
  return dir;
}
function commit(dir, iso, msg, files) {
  for (const [p, content] of Object.entries(files)) {
    const abs = join(dir, p);
    mkdirSync(dirname(abs), { recursive: true });
    if (content === null) rmSync(abs, { force: true });
    else writeFileSync(abs, content);
  }
  sh(dir, ["add", "-A"]);
  const env = { GIT_AUTHOR_DATE: iso, GIT_COMMITTER_DATE: iso };
  sh(dir, ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", "commit", "-q", "--allow-empty", "-m", msg], env);
  return sh(dir, ["rev-parse", "HEAD"]);
}
function manifestFile(label, { sha, omit } = {}) {
  const entries = {};
  for (const f of MASTERS) {
    if (f === omit) continue;
    entries[f] = { capturedAt: CAPTURED_AT, ...(sha ? { gymboCommitSha: sha } : {}) };
  }
  const p = join(scratch, `${label}-${++n}.json`);
  writeFileSync(p, JSON.stringify({ entries }));
  return p;
}
function run(dir, manifest, extra = []) {
  const r = spawnSync("node", [SCRIPT, "--app-repo", dir, "--app-ref", "main", "--manifest", manifest, "--json", ...extra], { encoding: "utf8" });
  let json = null;
  try {
    json = JSON.parse(r.stdout);
  } catch {
    /* leave null: the assertions below will name it */
  }
  return { status: r.status, json, stderr: r.stderr, raw: r.stdout };
}

// The baseline history every scenario builds on.
//   c1 07-01  the resources tree exists (GymboMark), before capture
//   c2 08-11  last commit before the 08-12 05:02Z capture
//   (capture happens here)
function base(label) {
  const dir = repo(label);
  const c1 = commit(dir, "2026-07-01T10:00:00Z", "resources exist", {
    [`${ASSETS}/GymboMark.imageset/Contents.json`]: "{}",
    [`${ASSETS}/GymboMark.imageset/GymboMark@3x.png`]: "v1-bytes",
    "ios/Gymbo/Views/Main/MainTabView.swift": "// tabs\n",
  });
  const c2 = commit(dir, "2026-08-11T22:00:00Z", "last commit before capture", { "ios/Gymbo/Views/Main/Other.swift": "// x\n" });
  return { dir, c1, c2 };
}
const allMasters = (json, verdict) => MASTERS.every((f) => json.masters[f]?.verdict === verdict);

test("FOUND — the known truth: an asset ADDED after capture (PR #568's shape), traced to its referrer", () => {
  const { dir } = base("found-add");
  commit(dir, "2026-08-28T09:00:00Z", "add the AI mascot", {
    [`${ASSETS}/AIAssistantMark.imageset/Contents.json`]: "{}",
    [`${ASSETS}/AIAssistantMark.imageset/AIAssistantMark@3x.png`]: "tiger-in-cap",
    "ios/Gymbo/Views/Main/MainTabView.swift": '// tabs\nlet i = UIImage(named: "AIAssistantMark")\n',
  });
  const r = run(dir, manifestFile("m"));
  assert.equal(r.status, 3, r.stderr || r.raw);
  assert.ok(allMasters(r.json, "FOUND"));
  assert.equal(r.json.units["AIAssistantMark.imageset"]?.status, "A");
  assert.ok(r.json.units["AIAssistantMark.imageset"].referencedBy.includes("ios/Gymbo/Views/Main/MainTabView.swift"));
  // the pre-capture asset must NOT be reported: only what changed AFTER capture
  assert.equal(r.json.units["GymboMark.imageset"], undefined);
});

test("FOUND — an asset REPLACED IN PLACE (same filename, new bytes) is not invisible to a name-based check", () => {
  const { dir } = base("found-replace");
  commit(dir, "2026-08-20T09:00:00Z", "swap the mark artwork", { [`${ASSETS}/GymboMark.imageset/GymboMark@3x.png`]: "v2-bytes" });
  const r = run(dir, manifestFile("m"));
  assert.equal(r.status, 3, r.stderr || r.raw);
  assert.equal(r.json.units["GymboMark.imageset"]?.status, "M");
});

test("NONE — only when the controls passed and nothing visual changed after capture (Swift-only change)", () => {
  const { dir } = base("none");
  commit(dir, "2026-08-25T09:00:00Z", "swift only", { "ios/Gymbo/Views/Main/Other.swift": "// changed\n" });
  const r = run(dir, manifestFile("m"));
  assert.equal(r.status, 0, r.stderr || r.raw);
  assert.ok(allMasters(r.json, "NONE"));
});

test("NON-VISUAL resources are reported separately and do NOT count as drift", () => {
  const { dir } = base("nonvisual");
  commit(dir, "2026-08-25T09:00:00Z", "privacy manifest", { [`${RES}/PrivacyInfo.xcprivacy`]: "<plist/>" });
  const r = run(dir, manifestFile("m"));
  assert.equal(r.status, 0, r.stderr || r.raw);
  assert.ok(allMasters(r.json, "NONE"));
  assert.ok(r.json.nonVisual.some((p) => p.endsWith("PrivacyInfo.xcprivacy")));
});

test("ANCHOR — a recorded sha that IS an ancestor is honoured over the date (exact)", () => {
  const { dir, c2 } = base("sha-exact");
  const c3 = commit(dir, "2026-08-28T09:00:00Z", "add mascot", { [`${ASSETS}/AIAssistantMark.imageset/Contents.json`]: "{}" });
  // anchored at c2 the mascot is AFTER it: FOUND, via sha
  let r = run(dir, manifestFile("m", { sha: c2 }));
  assert.equal(r.status, 3, r.stderr || r.raw);
  assert.equal(Object.values(r.json.anchors)[0].method, "sha");
  // anchored at c3 (the head) nothing is after it: NONE. The date anchor would have said FOUND,
  // so this proves the sha, not the date, decided.
  r = run(dir, manifestFile("m2", { sha: c3 }));
  assert.equal(r.status, 0, r.stderr || r.raw);
  assert.equal(Object.values(r.json.anchors)[0].method, "sha");
});

test("ANCHOR — a sha on a branch that never merged is NOT trusted: falls back to date and says why", () => {
  const { dir, c1 } = base("sha-side");
  sh(dir, ["checkout", "-q", "-b", "lane", c1]);
  const side = commit(dir, "2026-08-10T10:00:00Z", "unmerged capture lane", { "ios/Gymbo/Views/Main/Lane.swift": "// lane\n" });
  sh(dir, ["checkout", "-q", "main"]);
  commit(dir, "2026-08-28T09:00:00Z", "add mascot", { [`${ASSETS}/AIAssistantMark.imageset/Contents.json`]: "{}" });
  const r = run(dir, manifestFile("m", { sha: side }));
  assert.equal(r.status, 3, r.stderr || r.raw);
  const a = Object.values(r.json.anchors)[0];
  assert.equal(a.method, "date");
  assert.match(a.reason, /NOT an ancestor/);
});

test("ANCHOR — a recorded sha that does not exist at all falls back to date and says so (today's real case)", () => {
  const { dir } = base("sha-missing");
  commit(dir, "2026-08-28T09:00:00Z", "add mascot", { [`${ASSETS}/AIAssistantMark.imageset/Contents.json`]: "{}" });
  const r = run(dir, manifestFile("m", { sha: "86f34ef2" }));
  assert.equal(r.status, 3, r.stderr || r.raw);
  const a = Object.values(r.json.anchors)[0];
  assert.equal(a.method, "date");
  assert.match(a.reason, /not in the app repo/);
});

// ── COULD-NOT-LOOK: every way the instrument is blind must NOT read as NONE ──
test("COULD-NOT-LOOK — the resources tree never existed at the ref (must not be NONE)", () => {
  const dir = repo("no-resources");
  commit(dir, "2026-07-01T10:00:00Z", "no resources here", { "README.md": "x" });
  commit(dir, "2026-08-11T22:00:00Z", "still none", { "README.md": "y" });
  const r = run(dir, manifestFile("m"));
  assert.equal(r.status, 2, r.stderr || r.raw);
  assert.match(r.json.blind.join(" "), /resources tree/);
  assert.equal(Object.keys(r.json.masters).length, 0, "no per-master NONE may be printed when the instrument was blind");
});

test("COULD-NOT-LOOK — a SHALLOW checkout is refused, not trusted", () => {
  const { dir } = base("shallow-src");
  commit(dir, "2026-08-28T09:00:00Z", "add mascot", { [`${ASSETS}/AIAssistantMark.imageset/Contents.json`]: "{}" });
  const shallow = fresh("shallow");
  sh(scratch, ["clone", "-q", "--depth", "1", `file://${dir}`, shallow]);
  const r = spawnSync("node", [SCRIPT, "--app-repo", shallow, "--app-ref", "origin/main", "--manifest", manifestFile("m"), "--json"], { encoding: "utf8" });
  const json = JSON.parse(r.stdout);
  assert.equal(r.status, 2);
  assert.match(json.blind.join(" "), /SHALLOW/);
});

test("COULD-NOT-LOOK — an app ref that does not resolve", () => {
  const { dir } = base("bad-ref");
  const r = spawnSync("node", [SCRIPT, "--app-repo", dir, "--app-ref", "no-such-branch", "--manifest", manifestFile("m"), "--json"], { encoding: "utf8" });
  assert.equal(r.status, 2);
  assert.match(JSON.parse(r.stdout).blind.join(" "), /does not resolve/);
});

test("COULD-NOT-LOOK — not a git repository at all", () => {
  const dir = fresh("not-git");
  mkdirSync(dir, { recursive: true });
  const r = run(dir, manifestFile("m"));
  assert.equal(r.status, 2);
  assert.match(r.json.blind.join(" "), /not a git repository/);
});

test("COULD-NOT-LOOK — a served master with no manifest entry is blind for THAT master, others still evaluated", () => {
  const { dir } = base("missing-entry");
  const omitted = MASTERS[0];
  const r = run(dir, manifestFile("m", { omit: omitted }));
  assert.equal(r.status, 2, r.stderr || r.raw);
  assert.equal(r.json.masters[omitted].verdict, "COULD-NOT-LOOK");
  assert.equal(r.json.masters[MASTERS[1]].verdict, "NONE");
});

test("COULD-NOT-LOOK — capture predates every commit in the repo (no anchor exists)", () => {
  const { dir } = base("too-early");
  const p = join(scratch, `early-${++n}.json`);
  const entries = Object.fromEntries(MASTERS.map((f) => [f, { capturedAt: "2020-01-01T00:00:00Z" }]));
  writeFileSync(p, JSON.stringify({ entries }));
  const r = run(dir, p);
  assert.equal(r.status, 2, r.stderr || r.raw);
  assert.ok(allMasters(r.json, "COULD-NOT-LOOK"));
});

test("COULD-NOT-LOOK outranks FOUND: blindness is never hidden behind a finding", () => {
  const { dir } = base("blind-and-found");
  commit(dir, "2026-08-28T09:00:00Z", "add mascot", { [`${ASSETS}/AIAssistantMark.imageset/Contents.json`]: "{}" });
  const r = run(dir, manifestFile("m", { omit: MASTERS[0] }));
  assert.equal(r.status, 2, "exit 2 must win over exit 3");
  assert.equal(r.json.masters[MASTERS[1]].verdict, "FOUND", "the finding is still reported");
});
