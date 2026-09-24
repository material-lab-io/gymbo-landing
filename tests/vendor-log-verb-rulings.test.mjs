// gy-uu7mt: the ruling VERIFIER must actually run and must discriminate (pm 22:37Z: a
// verifier with no caller is decorative, gy-ab757's founding finding). CI runners have no bd
// and no path to the beads database, so these tests put a STUB `bd` on PATH that serves a
// canned bead. That proves, on every deploy, that `verify:log-verb-rulings` goes RED on a
// forged snapshot record, a vanished comment, a quote that is not in the comment, a comment
// by an author who cannot rule, a hand-edited hash, and a missing bd, and GREEN on a genuine
// one. What it cannot prove is that the committed snapshot matches the LIVE beads; that
// needs bd and is run by an operator (see the PR notes).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

const VENDOR = new URL("../scripts/vendor-log-verb-rulings.mjs", import.meta.url).pathname;
const scratch = mkdtempSync(join(tmpdir(), "gymbo-vendor-"));
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));
let n = 0;

const SENTENCE = "Log the session as it ends.";
const BODY = `Some preamble.\nRULED advice-to-reader: ${SENTENCE}\nMore text.`;
const QUOTE = `RULED advice-to-reader: ${SENTENCE}`;
const sha = (s) => createHash("sha256").update(s).digest("hex");

// Build a working dir: registry + (optional) snapshot + a stub bd serving `comments`.
function world({ live, snapshot, entries } = {}) {
  const dir = join(scratch, `w${++n}`);
  mkdirSync(join(dir, "bin"), { recursive: true });
  const comments = live ?? [{ id: "c1", issue_id: "gy-uu7mt", author: "gymbo/gymbo-crew.content", text: BODY, created_at: "2026-09-24T21:41:59Z" }];
  writeFileSync(join(dir, "comments.json"), JSON.stringify(comments));
  writeFileSync(join(dir, "bin", "bd"), `#!/bin/sh\ncat "${join(dir, "comments.json")}"\n`);
  chmodSync(join(dir, "bin", "bd"), 0o755);
  writeFileSync(join(dir, "canonical-log-verb-registry.json"), JSON.stringify({ version: 1, entries: entries ?? [{
    route: "/guide/x/", kinds: ["visible"], sentence: SENTENCE, reason: "advice-to-reader", ruling: { bead: "gy-uu7mt", comment: "c1", quote: QUOTE },
  }] }));
  if (snapshot) writeFileSync(join(dir, "canonical-log-verb-rulings.json"), JSON.stringify(snapshot));
  return dir;
}
const genuine = () => ({ version: 1, rulings: { c1: { bead: "gy-uu7mt", author: "gymbo/gymbo-crew.content", created_at: "2026-09-24T21:41:59Z", sha256: sha(BODY), quotes: [QUOTE] } } });
const run = (dir, args = [], path = `${dir}/bin:${process.env.PATH}`) =>
  spawnSync(process.execPath, [VENDOR, ...args], { cwd: dir, encoding: "utf8", env: { ...process.env, PATH: path } });

test("GENUINE: rebuilding the snapshot succeeds, and --verify against the same live bead is green", () => {
  const dir = world();
  const built = run(dir);
  assert.equal(built.status, 0, built.stderr);
  const snap = JSON.parse(readFileSync(join(dir, "canonical-log-verb-rulings.json"), "utf8"));
  assert.equal(snap.rulings.c1.author, "gymbo/gymbo-crew.content");
  assert.equal(snap.rulings.c1.sha256, sha(BODY));
  assert.equal(run(dir, ["--verify"]).status, 0);
});

test("FORGED RECORD: a snapshot that claims the ruling comment was written by content when live says landing goes RED", () => {
  const live = [{ id: "c1", issue_id: "gy-uu7mt", author: "gymbo/gymbo-crew.landing", text: BODY, created_at: "2026-09-24T21:41:59Z" }];
  const dir = world({ live, snapshot: genuine() });   // the snapshot lies: author content
  const r = run(dir, ["--verify"]);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stderr, /written by gymbo\/gymbo-crew\.landing/);
});

test("FORGED RECORD: a hand-edited sha256 (the body was changed after it was vendored) goes RED", () => {
  const snap = genuine(); snap.rulings.c1.sha256 = sha("something else");
  const r = run(world({ snapshot: snap }), ["--verify"]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /differs from live bd/);
});

test("FORGED RECORD: a snapshot entry for a comment that does not exist live goes RED (an extra forged record)", () => {
  const snap = genuine(); snap.rulings.forged = { ...snap.rulings.c1 };
  const r = run(world({ snapshot: snap }), ["--verify"]);
  assert.equal(r.status, 1);
});

test("FORGED RECORD: a snapshot whose verified quotes were widened goes RED", () => {
  const snap = genuine(); snap.rulings.c1.quotes.push("RULED advice-to-reader: You log it.");
  assert.equal(run(world({ snapshot: snap }), ["--verify"]).status, 1);
});

test("A VANISHED comment (deleted or on another bead) goes RED", () => {
  const r = run(world({ live: [], snapshot: genuine() }), ["--verify"]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no such comment/);
});

test("A quote that is NOT in the live comment goes RED", () => {
  const live = [{ id: "c1", issue_id: "gy-uu7mt", author: "gymbo/gymbo-crew.content", text: "The ruling was edited away.", created_at: "2026-09-24T21:41:59Z" }];
  const r = run(world({ live, snapshot: genuine() }), ["--verify"]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /quote not found/);
});

test("An author who cannot rule (tester, landing) is refused even when the quote is real", () => {
  for (const author of ["gymbo/gymbo-crew.tester", "gymbo/gymbo-crew.landing", "somebody"]) {
    const live = [{ id: "c1", issue_id: "gy-uu7mt", author, text: BODY, created_at: "2026-09-24T21:41:59Z" }];
    assert.equal(run(world({ live }), []).status, 1, author);
  }
  const pm = [{ id: "c1", issue_id: "gy-uu7mt", author: "gymbo/gymbo-crew.pm", text: BODY, created_at: "2026-09-24T21:41:59Z" }];
  assert.equal(run(world({ live: pm }), []).status, 0);
});

test("FAIL CLOSED: with no bd on PATH the verifier is COULD NOT VERIFY (exit 2), never a pass", () => {
  const dir = world({ snapshot: genuine() });
  const r = run(dir, ["--verify"], "/nonexistent");
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stderr, /COULD NOT VERIFY/);
});

test("An entry with no {bead, comment, quote} ruling stops the vendor script; a PENDING one is skipped and reported, never vendored", () => {
  const bare = world({ entries: [{ route: "/guide/x/", kinds: ["visible"], sentence: SENTENCE, reason: "advice-to-reader", ruling: "free text" }] });
  assert.equal(run(bare).status, 2);
  const pending = world({ entries: [{ route: "/guide/x/", kinds: ["visible"], sentence: SENTENCE, reason: "advice-to-reader", ruling: { bead: "gy-uu7mt", comment: "PENDING-CONTENT-RULING", quote: "" } }] });
  const r = run(pending);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /1 entry is PENDING/);
  assert.deepEqual(JSON.parse(readFileSync(join(pending, "canonical-log-verb-rulings.json"), "utf8")).rulings, {});
});
