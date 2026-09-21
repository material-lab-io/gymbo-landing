// Master asset-drift check (gy-iit8q; wiring is gy-1je63).
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  STATUS: 🔴 UNWIRED. NOTHING RUNS THIS SCRIPT AGAINST THE REAL APP REPO. ║
// ║  Its logic is unit-tested in CI (tests/master-asset-drift.test.mjs), but  ║
// ║  no workflow checks out Gymbo-v1 and invokes it, so on the day this      ║
// ║  merged it protects NOTHING. Do not read its presence as protection.     ║
// ║  Wiring is its own bead: gy-1je63.                                       ║
// ╚══════════════════════════════════════════════════════════════════════════╝
//
// THE QUESTION IT ANSWERS. A code diff answers "did the code change". It cannot
// answer "did the SCREEN change", because a screen is also made of images,
// colours and fonts that live in the app's resources tree, not in Swift. On
// 2026-09-21 an audit that read every Swift value change returned "no change"
// for the dashboard and AI landing masters. Both had visibly changed: PR #568
// (gy-a0f0l, 2026-08-28) swapped the bottom-bar avatar from a tiger cub to a
// tiger in a cap by ADDING an image asset, and no .swift line said so.
//
// WHAT IT DOES. For each master the site actually serves (SCREENS in
// scripts/screens-map.mjs, the same single source the freshness gate uses) it
// diffs the app's resources tree (ios/Gymbo/Resources) from the build the master
// was captured from to the app's main, and reports what changed.
//
// WHAT IT DOES NOT DO — read this before trusting a verdict:
//   • It says which RESOURCES changed since capture. It does NOT say which
//     master depicts them, or whether the change is visible in the depicted
//     crop. The "referenced by" list is a string search for the quoted asset
//     name; an asset addressed by generated symbol (Image(.name)) is missed, so
//     an empty list is NOT evidence the asset is not on screen.
//   • It does not see SwiftUI-drawn changes: that is what a code diff is for.
//     The two are complements. Neither replaces recapturing on a device.
//   • It is not a pixel comparison. Only a rendered comparison is one.
//
// THREE OUTCOMES, never collapsed (rule: FOUND / NONE / COULD-NOT-LOOK):
//   exit 0  NONE   no visual resource changed since any master's capture
//   exit 3  FOUND  at least one visual resource changed (ADVISORY, see below)
//   exit 2  COULD-NOT-LOOK  the instrument was blind somewhere. This takes
//           precedence over 3 so blindness is never hidden behind a finding,
//           and a NONE is only ever printed when the controls below passed.
//   (exit 1 is reserved for a crash. It is never a verdict.)
//
// CONTROLS BEHIND "NONE". A "nothing changed" result is worthless from an
// instrument that could not see. Before it will say NONE it proves it can see:
// the repo is not shallow, the ref resolves, the resources tree exists at that
// ref and has history. A tree that never existed at the ref is COULD-NOT-LOOK,
// not NONE.
//
// ANCHOR. Each master's manifest entry carries gymboCommitSha. It is used only
// when it is an ANCESTOR of the app ref. Otherwise the anchor falls back to the
// last app commit at or before capturedAt, and that is printed as APPROXIMATE
// with the reason, per master. It is never silent. TODAY EVERY MASTER IS ON THE
// FALLBACK: the manifest's 86f34ef2 was the capture branch
// gy-5xmxm-landing-recapture, which is not on Gymbo-v1's main, so the recorded
// provenance points at a commit nobody can open. A recapture that records a
// reachable sha makes the anchor exact.
//
// 🔴 ADVISORY BY DESIGN, and it must stay out of the required `deploy` job. This
// signal is MONOTONIC: once a resource changes after a capture it stays FOUND
// until someone recaptures on a Mac, so no re-run ever turns it green. A
// monotonic input inside the sole required check is a scheduled outage generator
// (gy-7anl3, gy-fs7pe: that pinned getgymbo.com to a stale build on 2026-09-06).
// Non-visual resources (privacy manifest, Firebase plist, StoreKit config) are
// reported separately and never count as drift; that named list is the only
// exemption, so any NEW resource type defaults to "visual".
//
// Usage:
//   node scripts/check-master-asset-drift.mjs --app-repo <Gymbo-v1 checkout>
//        [--app-ref origin/main] [--manifest public/screens/manifest.json] [--json]
// The checkout must be a FULL clone (not shallow); the script refuses a shallow one.

import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { SCREENS } from "./screens-map.mjs";

const RESOURCES = "ios/Gymbo/Resources";
const SOURCES = "ios/Gymbo";
// The ONLY exemption. Anything not matched here is treated as visual.
const NON_VISUAL = [/\/PrivacyInfo\.xcprivacy$/, /\/GoogleService-Info\.plist$/, /\.storekit$/];
const ASSET_UNIT = /Assets\.xcassets\/([^/]+\.(?:imageset|colorset|appiconset|symbolset|dataset|launchimage|brandassets))\//;

const argv = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = argv.indexOf(name);
  return i === -1 ? dflt : argv[i + 1];
};
const APP_REPO = opt("--app-repo", null);
const APP_REF = opt("--app-ref", "origin/main");
const MANIFEST_PATH = opt("--manifest", "public/screens/manifest.json");
const AS_JSON = argv.includes("--json");

function git(args) {
  try {
    const out = execFileSync("git", ["-C", APP_REPO, ...args], {
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    return { ok: true, out: out.trim() };
  } catch (err) {
    return { ok: false, out: "", err: String(err.stderr || err.message || "").trim(), status: err.status };
  }
}

const result = { appRepo: APP_REPO, appRef: APP_REF, blind: [], masters: {}, anchors: {} };
const finish = () => {
  const anyBlind = result.blind.length > 0 || Object.values(result.masters).some((m) => m.verdict === "COULD-NOT-LOOK");
  const anyFound = Object.values(result.masters).some((m) => m.verdict === "FOUND");
  result.exit = anyBlind ? 2 : anyFound ? 3 : 0;
  if (AS_JSON) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } else {
    report();
  }
  process.exit(result.exit);
};

function report() {
  const L = (s = "") => console.log(s);
  L("Master asset-drift check (gy-iit8q)  —  🔴 UNWIRED: nothing runs this in CI against the real app repo (gy-1je63)");
  L(`app repo: ${APP_REPO}   ref: ${APP_REF}${result.appHead ? " @ " + result.appHead.slice(0, 9) : ""}`);
  if (result.blind.length) {
    L("");
    L("COULD-NOT-LOOK — the instrument was blind, so NO verdict below is a 'nothing changed':");
    for (const b of result.blind) L(`  • ${b}`);
  }
  const anchors = Object.entries(result.anchors);
  if (anchors.length) {
    L("");
    L("ANCHORS (the app build each master is compared from):");
    for (const [key, a] of anchors) {
      const tag = a.method === "sha" ? "exact" : "APPROXIMATE";
      L(`  ${a.commit.slice(0, 9)}  [${tag}, via ${a.method}]  ${a.masters.length} master(s)`);
      if (a.reason) L(`      why not exact: ${a.reason}`);
    }
  }
  L("");
  L("PER MASTER:");
  for (const [file, m] of Object.entries(result.masters)) {
    // FOUND means "resources changed since this master's capture", NOT "this master
    // shows them". Saying so on every line stops a skim reading 8 FOUNDs as 8 stale.
    const note = m.reason ? m.reason : m.verdict === "FOUND" ? "resources changed since capture; whether THIS master depicts them is not determined" : "";
    L(`  ${m.verdict.padEnd(15)} ${file}${note ? "   — " + note : ""}`);
  }
  const found = Object.entries(result.units || {});
  if (found.length) {
    L("");
    L("VISUAL RESOURCES CHANGED since capture (shared by every FOUND master above):");
    for (const [unit, u] of found) {
      L(`  ${u.status.padEnd(2)} ${unit}`);
      L(`      referenced by (quoted-name search, can miss symbol-addressed uses): ${u.referencedBy.length ? u.referencedBy.join(", ") : "(none found; NOT evidence it is not on screen)"}`);
    }
  }
  if (result.nonVisual && result.nonVisual.length) {
    L("");
    L("non-visual resources changed (informational, never counted as drift):");
    for (const p of result.nonVisual) L(`  ${p}`);
  }
  L("");
  L("Says which resources changed, NOT which master depicts them nor whether the change shows in the crop. Not a pixel comparison.");
  L(`exit ${result.exit}: ${{ 0: "NONE", 2: "COULD-NOT-LOOK", 3: "FOUND (advisory)" }[result.exit]}`);
}

// ── preconditions: prove the instrument can see before it may say "nothing" ──
if (!APP_REPO) {
  console.error("usage: check-master-asset-drift.mjs --app-repo <Gymbo-v1 checkout> [--app-ref origin/main] [--manifest file] [--json]");
  process.exit(2);
}
if (!git(["rev-parse", "--git-dir"]).ok) {
  result.blind.push(`${APP_REPO} is not a git repository`);
  finish();
}
if (git(["rev-parse", "--is-shallow-repository"]).out === "true") {
  result.blind.push("the app checkout is SHALLOW: anchor commits and the resources history may be missing, so 'unchanged' cannot be trusted. Use a full clone (fetch-depth: 0).");
  finish();
}
const head = git(["rev-parse", "--verify", "--quiet", `${APP_REF}^{commit}`]);
if (!head.ok || !head.out) {
  result.blind.push(`app ref '${APP_REF}' does not resolve to a commit`);
  finish();
}
result.appHead = head.out;
const tree = git(["ls-tree", "-r", "--name-only", head.out, "--", RESOURCES]);
if (!tree.ok || !tree.out) {
  result.blind.push(`no ${RESOURCES} tree at ${APP_REF}: an instrument that cannot see the resources tree must not report 'unchanged'`);
  finish();
}
const hist = git(["log", "-1", "--format=%H", head.out, "--", RESOURCES]);
if (!hist.ok || !hist.out) {
  result.blind.push(`${RESOURCES} has no history at ${APP_REF}: cannot tell 'unchanged' from 'history not available'`);
  finish();
}

// ── manifest ────────────────────────────────────────────────────────────────
let manifest;
try {
  manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
} catch (err) {
  result.blind.push(`manifest ${MANIFEST_PATH} unreadable (${err.code || err.message})`);
  finish();
}

const diffCache = new Map();
function changesSince(anchor) {
  if (diffCache.has(anchor)) return diffCache.get(anchor);
  const d = git(["diff", "--name-status", "-M", anchor, head.out, "--", RESOURCES]);
  const rows = [];
  if (d.ok && d.out) {
    for (const line of d.out.split("\n")) {
      const parts = line.split("\t");
      const status = parts[0].charAt(0);
      rows.push({ status, path: parts[parts.length - 1], oldPath: parts.length === 3 ? parts[1] : undefined });
    }
  }
  const entry = d.ok ? { rows } : { error: d.err || "git diff failed" };
  diffCache.set(anchor, entry);
  return entry;
}

const unitsAll = {}; // unit -> {status, referencedBy}
const nonVisualAll = new Set();

for (const file of Object.values(SCREENS)) {
  const entry = manifest.entries?.[file];
  if (!entry) {
    result.masters[file] = { verdict: "COULD-NOT-LOOK", reason: "no manifest entry for this served master" };
    continue;
  }
  const capMs = Date.parse(entry.capturedAt);
  if (Number.isNaN(capMs)) {
    result.masters[file] = { verdict: "COULD-NOT-LOOK", reason: `capturedAt is not a date: ${entry.capturedAt}` };
    continue;
  }

  // anchor: the recorded sha ONLY if it is an ancestor of the app ref
  let anchor = null;
  let method = "date";
  let reason = null;
  const sha = entry.gymboCommitSha;
  if (!sha) {
    reason = "manifest entry has no gymboCommitSha";
  } else {
    const full = git(["rev-parse", "--verify", "--quiet", `${sha}^{commit}`]);
    if (!full.ok || !full.out) {
      reason = `recorded sha ${sha} is not in the app repo (unpushed or deleted branch)`;
    } else if (git(["merge-base", "--is-ancestor", full.out, head.out]).ok) {
      anchor = full.out;
      method = "sha";
    } else {
      reason = `recorded sha ${sha} exists but is NOT an ancestor of ${APP_REF} (a branch that never merged)`;
    }
  }
  if (!anchor) {
    const r = git(["rev-list", "-1", `--before=${Math.floor(capMs / 1000)} +0000`, head.out]);
    if (!r.ok || !r.out) {
      result.masters[file] = { verdict: "COULD-NOT-LOOK", reason: `no app commit at or before capturedAt ${entry.capturedAt}` };
      continue;
    }
    anchor = r.out;
  }
  const key = `${anchor}|${method}`;
  (result.anchors[key] ||= { commit: anchor, method, reason, masters: [] }).masters.push(file);

  const ch = changesSince(anchor);
  if (ch.error) {
    result.masters[file] = { verdict: "COULD-NOT-LOOK", reason: `git diff failed: ${ch.error}` };
    continue;
  }
  const visual = [];
  for (const row of ch.rows) {
    if (NON_VISUAL.some((re) => re.test(row.path))) {
      nonVisualAll.add(`${row.status} ${row.path}`);
      continue;
    }
    const m = ASSET_UNIT.exec(row.path);
    visual.push({ unit: m ? m[1] : row.path, status: row.status });
  }
  if (visual.length) {
    for (const v of visual) {
      // one status per unit: an added imageset shows A on every file; keep the first seen
      unitsAll[v.unit] ||= { status: v.status, referencedBy: [] };
    }
    result.masters[file] = { verdict: "FOUND", anchor, anchorMethod: method, units: [...new Set(visual.map((v) => v.unit))] };
  } else {
    result.masters[file] = { verdict: "NONE", anchor, anchorMethod: method };
  }
}

// referencing files: quoted-name string search, once per changed unit
for (const unit of Object.keys(unitsAll)) {
  const name = unit.replace(/\.[^.]+$/, "");
  if (!/^[A-Za-z0-9_\-]+$/.test(unit.replace(/\.[^.]+$/, ""))) continue; // a raw file path, not an asset unit
  const g = git(["grep", "-l", "-F", "-e", `"${name}"`, head.out, "--", SOURCES]);
  if (g.ok && g.out) {
    unitsAll[unit].referencedBy = g.out.split("\n").map((l) => l.replace(`${head.out}:`, "")).filter(Boolean).slice(0, 12);
  }
}
result.units = unitsAll;
result.nonVisual = [...nonVisualAll];
finish();
