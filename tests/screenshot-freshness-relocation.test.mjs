// gy-dwxbm: the screenshot freshness gate treats a touched manifest as "an edit that re-publishes
// every entry" (deliberate: it blocks stale art). Moving the manifest out of public/ is a touch that
// changes no byte. These tests pin the ONLY safe distinction: content, not path. Everything git
// cannot answer stays fail-closed, and a move PLUS any edit still blocks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SCREENS } from "../scripts/screens-map.mjs";
import { manifestEdited } from "../scripts/check-screenshot-freshness.mjs";

const scratch = mkdtempSync(join(tmpdir(), "gymbo-fresh-"));
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));
let n = 0;
const files = Object.values(SCREENS);
const manifest = (days) => JSON.stringify({ maxAgeDays: 21, entries: Object.fromEntries(files.map((f) => [f, { capturedAt: new Date(Date.now() - days * 86400e3).toISOString(), verified: true }])) }, null, 2);
const git = (dir, ...a) => execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...a], { cwd: dir, stdio: "pipe" });

// A repo whose BASE commit has the STALE manifest at the LEGACY public path.
function repo() {
  const dir = join(scratch, `r${++n}`);
  mkdirSync(join(dir, "scripts"), { recursive: true }); mkdirSync(join(dir, "public", "screens"), { recursive: true }); mkdirSync(join(dir, "ops", "screens"), { recursive: true });
  for (const f of ["check-screenshot-freshness.mjs", "screens-map.mjs"]) cpSync(new URL(`../scripts/${f}`, import.meta.url).pathname, join(dir, "scripts", f));
  writeFileSync(join(dir, "public", "screens", "manifest.json"), manifest(400));
  git(dir, "init", "-q"); git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "base");
  return dir;
}
const gate = (dir, changed, ...extra) => { const f = join(dir, "changed.txt"); writeFileSync(f, changed.join("\n") + "\n"); return spawnSync(process.execPath, ["scripts/check-screenshot-freshness.mjs", "--changed", f, ...extra], { cwd: dir, encoding: "utf8" }); };
const relocate = (dir) => { git(dir, "mv", "public/screens/manifest.json", "ops/screens/manifest.json"); };

test("POSITIVE CONTROL: a manifest EDIT with stale entries still blocks (path only, no --base, fail-closed)", () => {
  const d = repo(); relocate(d);
  const r = gate(d, ["ops/screens/manifest.json"]); assert.equal(r.status, 1, r.stdout + r.stderr); assert.match(r.stdout + r.stderr, /this change publishes it/);
});

test("a PURE RELOCATION of a stale manifest is NOT an edit: it passes and says why", () => {
  const d = repo(); relocate(d);
  const r = gate(d, ["public/screens/manifest.json", "ops/screens/manifest.json"], "--base", "HEAD");
  assert.equal(r.status, 0, r.stdout + r.stderr); assert.match(r.stdout, /RELOCATED \(byte-identical to HEAD's copy\), not edited/);
});

test("a relocation PLUS one changed entry is an edit and blocks", () => {
  const d = repo(); relocate(d);
  const p = join(d, "ops", "screens", "manifest.json"); const m = JSON.parse(readFileSync(p, "utf8")); m.entries[files[0]].capturedAt = new Date().toISOString(); writeFileSync(p, JSON.stringify(m, null, 2));
  const r = gate(d, ["public/screens/manifest.json", "ops/screens/manifest.json"], "--base", "HEAD");
  assert.equal(r.status, 1, r.stdout + r.stderr);
});

test("fail-closed: an unresolvable --base, or no --base, is an edit", () => {
  const d = repo(); relocate(d);
  const touched = ["public/screens/manifest.json", "ops/screens/manifest.json"];
  assert.equal(gate(d, touched, "--base", "no-such-ref").status, 1);
  assert.equal(gate(d, touched).status, 1);
});

test("REGRESSION: a stale PNG this change touches still blocks; an unrelated change still only warns", () => {
  const d = repo(); relocate(d); git(d, "commit", "-q", "-m", "moved");
  assert.equal(gate(d, [`public/screens/${files[0]}`], "--base", "HEAD~1").status, 1);
  const r = gate(d, ["src/pages/privacy.tsx"], "--base", "HEAD~1"); assert.equal(r.status, 0, r.stdout + r.stderr);
});

test("manifestEdited (unit): only byte equality with the base's copy, at the current OR legacy path, is a relocation", () => {
  const show = (map) => (ref, path) => { if (!(path in map)) throw new Error("absent"); return map[path]; };
  assert.equal(manifestEdited(() => "A", show({ "old.json": "A" }), "HEAD", ["new.json", "old.json"]), false);
  assert.equal(manifestEdited(() => "A", show({ "old.json": "B" }), "HEAD", ["new.json", "old.json"]), true);
  assert.equal(manifestEdited(() => "A", show({}), "HEAD", ["new.json", "old.json"]), true, "not in the base at all = new content");
  assert.equal(manifestEdited(() => "A", show({ "old.json": "A" }), null, ["old.json"]), true, "no base = edit");
  assert.equal(manifestEdited(() => { throw new Error("unreadable"); }, show({ "old.json": "A" }), "HEAD", ["old.json"]), true, "unreadable current = edit");
});

// ── gy-sk86p2 (pm ruling 26 Nov): a manifest EDIT publishes the entries it adds or changes ──────────
// Before: any edit counted as publishing every entry, so adding two fresh card masters blocked on eight old
// masters that were already live and unchanged. Each control names exactly which rows FAIL: the others must
// stay warnings, so a gate that blocks everything fails these as surely as a gate that blocks nothing.
const OLD = {
  dashboard: "hero-01-dashboard-clean.png", balances: "hero-02-who-owes-balance.png", "log-payment": "hero-03-log-payment.png",
  schedule: "organized-01-schedule-day.png", payments: "revenue-01-ledger-history.png", export: "revenue-02-export-statement.png",
  workouts: "workouts-01-template-fullbody.png", ai: "extra-ai-assistant.png",
};
const NEW = { "card-week": "card-2-schedule-week-web-dark.png", "card-builder": "card-4-workout-builder-dark.png" };
const ALL = { ...OLD, ...NEW };
const NOW = Date.now();
const entry = (days, sha = "86f34ef2") => ({ appVersion: "1.0.0", buildNumber: "1", gymboCommitSha: sha, capturedAt: new Date(NOW - days * 86400e3).toISOString(), verified: true });
const oldEntries = () => Object.fromEntries(Object.values(OLD).map((f) => [f, entry(106)]));
const headEntries = () => ({ ...oldEntries(), [NEW["card-week"]]: entry(0, "806b39cf"), [NEW["card-builder"]]: entry(10, "912ff05d") });
const MANIFEST = "ops/screens/manifest.json";
const master = (f) => `public/screens/real/${f}`;
const derivatives = (slug) => [...[360, 540, 720, 1080].map((w) => `public/screens/gallery/${slug}-${w}.webp`), `public/screens/gallery/${slug}.png`];
// The change set of the change that was blocked (gymbo-landing #364), screens only.
const CHANGE_364 = [MANIFEST, "scripts/screens-map.mjs", ...Object.keys(NEW).flatMap(derivatives), ...Object.values(NEW).map(master)];

function publishRepo({ map = OLD, entries = oldEntries(), maxAgeDays = 21, withMap = true } = {}) {
  const dir = join(scratch, `p${++n}`);
  mkdirSync(join(dir, "scripts"), { recursive: true }); mkdirSync(join(dir, "ops", "screens"), { recursive: true });
  cpSync(new URL("../scripts/check-screenshot-freshness.mjs", import.meta.url).pathname, join(dir, "scripts", "check-screenshot-freshness.mjs"));
  const write = (m, e, age = 21) => {
    writeFileSync(join(dir, "scripts", "screens-map.mjs"), `export const SCREENS = ${JSON.stringify(m, null, 2)};\n`);
    writeFileSync(join(dir, MANIFEST), JSON.stringify({ maxAgeDays: age, entries: e }, null, 2));
  };
  write(map, entries, maxAgeDays);
  git(dir, "init", "-q"); git(dir, "add", MANIFEST, "scripts/check-screenshot-freshness.mjs", ...(withMap ? ["scripts/screens-map.mjs"] : [])); git(dir, "commit", "-q", "-m", "base");
  return { dir, head: write, run: (changed) => gate(dir, changed, "--base", "HEAD") };
}
const rows = (r, state) => [...r.stdout.matchAll(new RegExp(`^  ${state}\\s+(\\S+)\\s+(\\S+)`, "gm"))].map((m) => m[2]).sort();
const refused = (r, files, why = /and this change publishes it/) => {
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.deepEqual(rows(r, "FAIL"), [...files].sort(), r.stdout);
  assert.match(r.stdout, why);
};

test("GREEN CONTROL (#364's change): two new fresh masters pass; the eight unchanged old ones WARN, each by name", () => {
  const p = publishRepo(); p.head(ALL, headEntries());
  const r = p.run(CHANGE_364);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(rows(r, "WARN"), Object.values(OLD).sort());
  assert.deepEqual(rows(r, "OK"), Object.values(NEW).sort());
  for (const f of Object.values(OLD)) assert.ok(r.stdout.includes(`::warning file=public/screens/${f}::`), f);
});

test("RED (a): a NEW entry with a stale capture date is refused", () => {
  const p = publishRepo(); p.head(ALL, { ...headEntries(), [NEW["card-week"]]: entry(30) });
  refused(p.run(CHANGE_364), [NEW["card-week"]]);
  // the entry alone publishes it: no PNG or derivative of that master in the change set
  refused(p.run(CHANGE_364.filter((f) => f !== master(NEW["card-week"]) && !derivatives("card-week").includes(f))), [NEW["card-week"]]);
});

test("RED (b): an OLD entry restated with a new sha and its old capture date is refused", () => {
  const p = publishRepo(); p.head(ALL, { ...headEntries(), [OLD.schedule]: entry(106, "806b39cf") });
  refused(p.run(CHANGE_364), [OLD.schedule]);
});

test("RED (c): an OLD master PNG touched with no manifest change is refused (real/, where the masters live)", () => {
  const p = publishRepo();
  refused(p.run([master(OLD.payments)]), [OLD.payments]);
  refused(p.run([`public/screens/${OLD.payments}`]), [OLD.payments]);
});

test("RED (d): an old entry removed earlier and re-added is refused, whether the entry or only its place on the site was removed", () => {
  const without = (o, k) => Object.fromEntries(Object.entries(o).filter(([key]) => key !== k));
  const gone = publishRepo({ map: without(OLD, "export"), entries: without(oldEntries(), OLD.export) });
  gone.head(ALL, headEntries());
  refused(gone.run(CHANGE_364), [OLD.export]);
  const unlisted = publishRepo({ map: without(OLD, "export") }); // entry stayed in the manifest, byte for byte
  unlisted.head(ALL, headEntries());
  refused(unlisted.run(CHANGE_364), [OLD.export]);
});

test("a stale capture re-dated to today with no new PNG is refused; with a new PNG it passes", () => {
  const p = publishRepo(); p.head(ALL, { ...headEntries(), [OLD.ai]: entry(0) });
  refused(p.run(CHANGE_364), [OLD.ai], /a date without a new capture/);
  const r = p.run([...CHANGE_364, master(OLD.ai)]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test("an old gallery derivative changed beside a manifest edit is refused", () => {
  const p = publishRepo(); p.head(ALL, headEntries());
  refused(p.run([...CHANGE_364, "public/screens/gallery/dashboard-720.webp"]), [OLD.dashboard]);
});

test("reordering keys is not an edit of an entry", () => {
  const p = publishRepo();
  p.head(ALL, Object.fromEntries(Object.entries(headEntries()).reverse().map(([f, e]) => [f, Object.fromEntries(Object.entries(e).reverse())])));
  const r = p.run(CHANGE_364);
  assert.equal(r.status, 0, r.stdout + r.stderr); assert.deepEqual(rows(r, "WARN"), Object.values(OLD).sort());
});

test("fail-closed: a changed maxAgeDays, or a base that cannot be compared, publishes every entry", () => {
  const aged = publishRepo(); aged.head(ALL, headEntries(), 100);
  refused(aged.run(CHANGE_364), Object.values(OLD));
  const blind = publishRepo({ withMap: false }); blind.head(ALL, headEntries());
  const r = blind.run(CHANGE_364);
  refused(r, Object.values(OLD)); assert.match(r.stdout, /could not be compared/);
});
