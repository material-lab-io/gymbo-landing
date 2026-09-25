// gy-rh2rj (2): scripts/verify-waitlist-oracle.mjs was wired NOWHERE (0 references in 12 workflows), so the
// claim it guards, "a new signup and a duplicate are indistinguishable to a probing caller", could be broken by
// a later edit and nothing would notice. This runs the verifier against the REAL handler (must pass) and against
// COPIES with a planted defect (each must go RED, for the intended reason), so it is a control that can fail,
// not a green light. The copies are made in a temp dir; the real handler is never modified.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = new URL("..", import.meta.url).pathname;
const VERIFIER = join(ROOT, "scripts/verify-waitlist-oracle.mjs");
const REAL = join(ROOT, "functions/api/waitlist.js");
const scratch = mkdtempSync(join(tmpdir(), "gymbo-oracle-"));
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));
let n = 0;

const run = (handler) => spawnSync(process.execPath, [VERIFIER], { encoding: "utf8", cwd: ROOT, env: { ...process.env, ...(handler ? { WAITLIST_HANDLER: handler } : {}) } });

// A copy of the real handler with `mutate` applied. Its relative import is rewritten to an absolute file URL so it
// resolves from the temp dir. Every mutation asserts its anchor exists, so a refactor of the handler cannot
// silently turn a mutant into an unmodified copy (which would "pass" and hide that the control went blind).
function copyWith(mutate) {
  let src = readFileSync(REAL, "utf8");
  src = src.replace('"../../src/lib/sourceSlug.mjs"', JSON.stringify(pathToFileURL(join(ROOT, "src/lib/sourceSlug.mjs")).href));
  src = src.replace('"../../src/lib/emailShape.mjs"', JSON.stringify(pathToFileURL(join(ROOT, "src/lib/emailShape.mjs")).href));
  const out = mutate(src);
  const file = join(scratch, `handler-${++n}.mjs`);
  writeFileSync(file, out);
  return file;
}
const insertAfter = (src, anchor, text) => {
  assert.ok(src.includes(anchor), `mutation anchor not found in the handler: ${anchor}`);
  return src.replace(anchor, anchor + text);
};

test("THE REAL HANDLER passes, and the run names the handler it tested (the control is running, not skipped)", () => {
  const r = run();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /handler under test: file:\/\/.*functions\/api\/waitlist\.js/);
  assert.match(r.stdout, /ALL CHECKS PASSED/);
  assert.match(r.stdout, /POSITIVE CONTROL — pre-fix implementation is distinguishable/);
});

test("HARNESS CONTROL: an UNMODIFIED copy passes, so a red below is the planted defect and not the override or the copy step", () => {
  const r = run(copyWith((s) => s));
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

const MUTANTS = {
  "a duplicate (409) answers with the pre-fix shape {ok, already}": (s) => insertAfter(s, "if (res.status === 201) {", "").replace("if (res.status === 201) {", 'if (res.status === 409) return Response.json({ ok: true, already: true }, { status: 200 });\n    if (res.status === 201) {'),
  "a field is added to the NEW-INSERT branch only (the exact regression the verifier's header warns about)": (s) => s.replace("if (res.status === 201) {", 'if (res.status === 201) {\n      return Response.json({ ok: true, id: 1 }, { status: 200 });'),
  "a duplicate returns a different STATUS (202)": (s) => s.replace("if (res.status === 201) {", "if (res.status === 409) return Response.json({ ok: true }, { status: 202 });\n    if (res.status === 201) {"),
  "a duplicate carries an extra HEADER": (s) => s.replace("if (res.status === 201) {", 'if (res.status === 409) return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json", "x-existing": "1" } });\n    if (res.status === 201) {'),
};
for (const [name, mutate] of Object.entries(MUTANTS)) {
  test(`FORCED RED: ${name} -> the verifier exits 1 on a NEGATIVE CONTROL line`, () => {
    const file = copyWith((s) => {
      const out = mutate(s);
      assert.notEqual(out, s, "the mutation did not change the handler; the control would be blind");
      return out;
    });
    const r = run(file);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /FAIL\s+NEGATIVE CONTROL — (email-only|phone-only|both): known-absent and known-present are byte-identical/);
    assert.match(r.stdout, /CHECK\(S\) FAILED/);
  });
}

test("FORCED RED (gy-e60uc.2): a handler that only checks for an '@' accepts 'a@b' -> the verifier exits 1 on the malformed-email line", () => {
  const file = copyWith((s) => {
    const out = s.replace("if (email && !looksLikeEmail(email)) {", 'if (email && !email.includes("@")) {');
    assert.notEqual(out, s, "the mutation did not change the handler; the control would be blind");
    return out;
  });
  const r = run(file);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /FAIL\s+gy-e60uc\.2 — malformed email 'a@b' is REFUSED with 400/);
});

test("A handler that cannot be LOADED is exit 2, never a pass (I could not look != the oracle is closed)", () => {
  for (const bad of [join(scratch, "does-not-exist.mjs")]) {
    const r = run(bad);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /COULD NOT LOAD the handler under test/);
  }
  const noExport = join(scratch, "no-export.mjs");
  writeFileSync(noExport, "export const something = 1;\n");
  const r = run(noExport);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /no onRequestPost export/);
});

test("WIRED: deploy.yml runs the verifier and its forced-red test on gt2 (the finding was 0 references in 12 workflows)", () => {
  const yml = readFileSync(join(ROOT, ".github/workflows/deploy.yml"), "utf8");
  assert.match(yml, /node scripts\/verify-waitlist-oracle\.mjs/);
  assert.match(yml, /node --test tests\/waitlist-oracle-verifier\.test\.mjs/);
  assert.match(yml, /runs-on: \[self-hosted, gt2\]/);
});
