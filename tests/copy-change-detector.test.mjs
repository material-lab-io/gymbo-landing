// gy-uu7mt: the COPY CHANGE-DETECTOR (not a positive pin: see its header for what it does not cover). Every case plants ONE defect in a fixture build
// and proves the gate fails on it BY NAME; the coverage cases prove the coverage check is
// itself capable of failing (a check that has only been seen passing has not been tested).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { maskEmails, diffAgainstLock, toLock, provenanceOf, collectBlocks, HTML, TEXT, BINARY, CODE } from "../scripts/copy-change-detector.mjs";

const SCRIPT = new URL("../scripts/copy-change-detector.mjs", import.meta.url).pathname;
const scratch = mkdtempSync(join(tmpdir(), "gymbo-copy-change-detector-"));
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));
let serial = 0;

const page = (title, body, head = "") => `<!doctype html><html><head><title>${title}</title>${head}</head><body><main>${body}</main></body></html>`;
const HOME = page("Gymbo", "<h1>Punch a class in one tap</h1><p>Ask Gymbo answers questions about your business.</p>", '<meta name="description" content="Built for independent personal trainers.">');
const RULED = { source: "test", ruled: [
  { id: "home-meta", route: "/", surface: "metadata description", equals: "Built for independent personal trainers.", ref: "test ruling" },
  { id: "punch", contains: "Punch a class in one tap", ref: "test ruling" },
] };

function fixture(files = {}) {
  const dir = join(scratch, `case-${++serial}`);
  mkdirSync(join(dir, "dist", "terms"), { recursive: true });
  writeFileSync(join(dir, "dist", "index.html"), HOME);
  writeFileSync(join(dir, "dist", "terms", "index.html"), page("Terms", "<p>Terms of service.</p>"));
  writeFileSync(join(dir, "dist", "llms.txt"), "# Gymbo\n\nGymbo is for the trainer.\n");
  for (const [path, body] of Object.entries(files)) { mkdirSync(join(dir, "dist", path.split("/").slice(0, -1).join("/")), { recursive: true }); writeFileSync(join(dir, "dist", path), body); }
  writeFileSync(join(dir, "ruled.json"), JSON.stringify(RULED));
  return dir;
}
const cli = (dir, ...a) => spawnSync(process.execPath, [SCRIPT, "--root", join(dir, "dist"), "--baseline", join(dir, "lock.json"), "--ruled", join(dir, "ruled.json"), "--canon", "none", ...a], { encoding: "utf8" });
const locked = () => { const d = fixture(); assert.equal(cli(d, "--write").status, 0); return d; };
const edit = (d, file, from, to) => { const p = join(d, "dist", file); const s = readFileSync(p, "utf8"); assert.ok(s.includes(from), `${from} not in ${file}`); writeFileSync(p, s.replace(from, to)); };

test("NEGATIVE CONTROL: a build that matches its lock passes, and says what it read", () => {
  const d = locked(); const r = cli(d);
  assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /3 route\/file\(s\)/);
});

test("POSITIVE CONTROL: a paraphrase on a pinned META surface fails, though it is on no denylist", () => {
  const d = locked(); edit(d, "index.html", "Built for independent personal trainers.", "Your AI sidekick for trainers.");
  const r = cli(d); assert.equal(r.status, 1);
  assert.match(r.stderr, /unapproved-copy \/ \[metadata description\]: Your AI sidekick/);
  assert.match(r.stderr, /removed-copy/); assert.match(r.stderr, /ruled-string-missing/);
});

test("POSITIVE CONTROL: a paraphrase in VISIBLE prose, a served text file and a JSON-LD string each fail", () => {
  for (const [file, from, to, surface] of [
    ["index.html", "Ask Gymbo answers questions about your business.", "A smart assistant answers questions.", "visible block"],
    ["llms.txt", "Gymbo is for the trainer.", "Gymbo is your AI coach.", "served line"],
  ]) { const d = locked(); edit(d, file, from, to); const r = cli(d); assert.equal(r.status, 1, file); assert.match(r.stderr, new RegExp(`unapproved-copy .*\\[${surface}\\]`), file); }
  const d = fixture({ "ld/index.html": page("LD", "<p>x</p>", '<script type="application/ld+json">{"description":"Log sessions easily"}</script>') });
  assert.equal(cli(d, "--write").status, 0);
  edit(d, "ld/index.html", "Log sessions easily", "Track sessions easily");
  assert.match(cli(d).stderr, /unapproved-copy \/ld\/ \[JSON-LD \$\.description\]/);
});

test("COVERAGE CONTROL: a page that ships but is in NO sitemap and NO lock fails as an unpinned surface", () => {
  const d = locked(); writeFileSync(join(d, "dist", "promo.html"), page("Promo", "<p>Your AI sidekick logs every session.</p>"));
  const r = cli(d); assert.equal(r.status, 1); assert.match(r.stderr, /unbaselined-surface \/promo\.html/);
});

test("COVERAGE CONTROL: a new text endpoint and a new block on a pinned page both fail", () => {
  let d = locked(); writeFileSync(join(d, "dist", "extra.txt"), "Smart assistant copy\n");
  assert.match(cli(d).stderr, /unbaselined-surface \/extra\.txt/);
  d = locked(); edit(d, "terms/index.html", "</main>", "<p>Brand new unreviewed sentence.</p></main>");
  assert.match(cli(d).stderr, /unapproved-copy \/terms\/ \[visible block\]: Brand new unreviewed sentence/);
});

test("COVERAGE CONTROL: an UNKNOWN file type fails closed instead of being skipped", () => {
  const d = locked(); writeFileSync(join(d, "dist", "notes.yaml"), "a: b\n");
  const r = cli(d); assert.equal(r.status, 1); assert.match(r.stderr, /unclassified-file-type \/notes\.yaml/);
  for (const ext of [...HTML, ...TEXT, ...BINARY, ...CODE]) assert.ok(ext.startsWith("."), ext);
});

test("a pinned page that disappears fails; so does a ruled string that is paraphrased away", () => {
  let d = locked(); rmSync(join(d, "dist", "terms"), { recursive: true });
  assert.match(cli(d).stderr, /removed-surface \/terms\//);
  d = locked(); edit(d, "index.html", "Punch a class in one tap", "Tap once to mark attendance");
  assert.match(cli(d).stderr, /ruled-string-missing .*ruled punch/);
});

test("COULD-NOT-EVALUATE (exit 2), never a pass: missing lock, empty lock, no html, no ruled list", () => {
  let d = fixture(); assert.equal(cli(d).status, 2);
  d = locked(); writeFileSync(join(d, "lock.json"), '{"version":1,"routes":{}}'); assert.equal(cli(d).status, 2);
  d = locked(); rmSync(join(d, "dist"), { recursive: true }); mkdirSync(join(d, "dist")); writeFileSync(join(d, "dist", "a.txt"), "x"); assert.equal(cli(d).status, 2);
  d = locked(); writeFileSync(join(d, "ruled.json"), '{"ruled":[]}'); assert.equal(cli(d).status, 2);
});

test("--write reports what changed against the previous lock, and records provenance", () => {
  const d = locked(); edit(d, "terms/index.html", "Terms of service.", "Terms of service, updated.");
  const w = cli(d, "--write"); assert.equal(w.status, 0);
  assert.match(w.stdout, /changes vs the previous lock: 2/); assert.match(w.stdout, /unapproved-copy \/terms\/.*updated/);
  const lock = JSON.parse(readFileSync(join(d, "lock.json"), "utf8"));
  const prov = Object.fromEntries(lock.routes["/"].map(([s, t, p]) => [t, p]));
  assert.equal(prov["Built for independent personal trainers."], "ruled:home-meta");
  assert.equal(prov["Punch a class in one tap"], "ruled:punch", "a contains rule on a block that IS the string is a whole-block match");
  assert.equal(prov["Ask Gymbo answers questions about your business."], "observed");
});

test("live parity: Cloudflare's '[email protected]' rewrite must not read as a copy change, a real address change must", () => {
  const blocks = (t) => new Map([["/privacy/", [{ surface: "visible block", text: t }]]]);
  const lock = toLock(blocks("Write to hello@getgymbo.com"));
  assert.equal(diffAgainstLock(blocks("Write to [email protected]"), lock, { mask: maskEmails }).length, 0);
  assert.equal(diffAgainstLock(blocks("Write to hello@getgymbo.com"), lock, { mask: maskEmails }).length, 0);
  assert.equal(diffAgainstLock(blocks("Write to whoever"), lock, { mask: maskEmails }).length, 2);
  assert.equal(diffAgainstLock(blocks("Write to [email protected]"), lock).length, 2, "unmasked, the rewrite IS a diff (which is why the mask exists)");
});

test("provenanceOf: a string matching several rulings lists them all; a string matching none is observed, not silently ruled", () => {
  assert.equal(provenanceOf("/", "visible block", "Punch a class in one tap", RULED.ruled), "ruled:punch");
  assert.equal(provenanceOf("/x/", "visible block", "Something nobody ruled", RULED.ruled), "observed");
  assert.equal(provenanceOf("/", "visible block", "Built for independent personal trainers.", RULED.ruled), "observed", "a ruled string on the WRONG SURFACE is not vouched for");
});

// ---- pm ruling 2026-09-24T15:4xZ: provenance must not launder, and tester's surviving mutants ----
test("PROVENANCE: a contains-match is a MENTION, never `ruled:`; appended unruled text cannot ride a reviewed label", () => {
  const rules = [{ id: "trial", contains: "Eligible subscribers can try Gymbo free for 7 days.", ref: "t" }];
  const whole = "Eligible subscribers can try Gymbo free for 7 days.";
  const appended = `${whole} 30-day refunds on every plan.`;
  assert.equal(provenanceOf("/", "visible block", whole, rules), "ruled:trial");
  assert.equal(provenanceOf("/", "visible block", appended, rules), "observed+mentions:trial");
  assert.ok(!provenanceOf("/", "visible block", appended, rules).startsWith("ruled"));
  assert.equal(provenanceOf("/", "visible block", "Something else", rules), "observed");
});

test("PROVENANCE, END TO END: an unruled sentence appended AFTER the baseline was written is not stamped ruled by --write", () => {
  const d = locked();
  edit(d, "index.html", "Punch a class in one tap</h1>", "Punch a class in one tap. 30-day refunds on every plan.</h1>");
  const w = cli(d, "--write"); assert.equal(w.status, 0, w.stderr);
  const lock = JSON.parse(readFileSync(join(d, "lock.json"), "utf8"));
  const row = lock.routes["/"].find(([, t]) => t.includes("30-day refunds"));
  assert.ok(row, "the appended claim is in the baseline");
  assert.doesNotMatch(row[2], /^ruled/, `laundered through a reviewed label: ${row[2]}`);
  assert.match(row[2], /^observed\+mentions:punch$/);
});

test("EQUALS MEANS EQUALS in the ruled-presence check: the string buried in a longer block does not satisfy `equals`", () => {
  const d = locked();
  edit(d, "index.html", 'content="Built for independent personal trainers."', 'content="Built for independent personal trainers. Plus a smart assistant."');
  const r = cli(d); assert.equal(r.status, 1);
  assert.match(r.stderr, /ruled-string-missing .*ruled home-meta/);
});

test("LOCAL CHECK DOES NOT MASK E-MAIL: a changed address fails (tester's e-mail-mask-in-local mutant)", () => {
  const d = fixture({ "privacy/index.html": page("Privacy", "<p>Write to grievance@getgymbo.com</p>") });
  assert.equal(cli(d, "--write").status, 0);
  edit(d, "privacy/index.html", "grievance@getgymbo.com", "elsewhere@example.com");
  const r = cli(d); assert.equal(r.status, 1);
  assert.match(r.stderr, /unapproved-copy \/privacy\/ \[visible block\]: Write to elsewhere@example\.com/);
  assert.match(r.stderr, /removed-copy \/privacy\/ \[visible block\]: Write to grievance@getgymbo\.com/);
});

test("PROVENANCE: an `equals` rule stamps ruled: only on a byte-equal block, never on a longer one that contains it", () => {
  const rules = [{ id: "eq", route: "/", surface: "metadata description", equals: "Built for independent personal trainers.", ref: "t" }];
  assert.equal(provenanceOf("/", "metadata description", "Built for independent personal trainers.", rules), "ruled:eq");
  assert.equal(provenanceOf("/", "metadata description", "Built for independent personal trainers. Plus a smart assistant.", rules), "observed");
  assert.equal(provenanceOf("/", "visible block", "Built for independent personal trainers.", rules), "observed", "wrong surface");
});
