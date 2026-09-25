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
