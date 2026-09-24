// gy-uu7mt: controls for the INVERTED log-verb gate. The point of the gate is that a log
// verb nobody listed FAILS, and that its registry cannot quietly turn permissive, so every
// test here is either a paraphrase that was never on any list going RED on each surface
// kind, or an attack on the registry itself (delete, edit, drop the ruling, go stale).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REASONS, validateRegistry } from "../scripts/check-log-verb.mjs";

const SCRIPT = new URL("../scripts/check-log-verb.mjs", import.meta.url).pathname;
const REAL_REGISTRY = new URL("../canonical-log-verb-registry.json", import.meta.url).pathname;
const scratch = mkdtempSync(join(tmpdir(), "gymbo-log-verb-"));
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));
let serial = 0;

const page = ({ body = "<p>Punch a class in one tap.</p>", head = "", ld = "" } = {}) =>
  `<!doctype html><html><head><title>Gymbo</title>${head}${ld}</head><body>${body}</body></html>`;

function site({ home = page(), llms = "Punch a class in one tap.\n" } = {}) {
  const root = join(scratch, `site-${++serial}`);
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "index.html"), home);
  writeFileSync(join(root, "llms.txt"), llms);
  return root;
}

function registry(entries) {
  const path = join(scratch, `reg-${++serial}.json`);
  writeFileSync(path, JSON.stringify({ version: 1, entries }));
  return path;
}

const entry = (over = {}) => ({
  route: "/", kinds: ["visible"], sentence: "Log the session as it ends.",
  reason: "advice-to-reader", ruling: "content 2026-09-24 test ruling reference", ...over,
});

const run = (root, reg, extra = []) =>
  spawnSync(process.execPath, [SCRIPT, "--root", root, "--registry", reg, ...extra], { encoding: "utf8" });

const empty = () => registry([]);

test("NEGATIVE CONTROL: a site with no log verb passes, is actually read, and prints its entry count", () => {
  const r = run(site(), empty());
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.match(r.stdout, /log-verb registry: 0 entries/);
  assert.match(r.stdout, /0 log-verb sentence\(s\) shipped/);
});

// The paraphrase below is on NO list anywhere: it has no class/session noun, which is
// exactly what the family gate needed and this one does not.
const UNSEEN = "Your clients just train. You log it.";
const SURFACES = {
  "visible text": (s) => site({ home: page({ body: `<p>${s}</p>` }) }),
  "meta description": (s) => site({ home: page({ head: `<meta name="description" content="${s}">` }) }),
  "og:description": (s) => site({ home: page({ head: `<meta property="og:description" content="${s}">` }) }),
  "JSON-LD": (s) => site({ home: page({ ld: `<script type="application/ld+json">${JSON.stringify({ "@type": "WebSite", description: s })}</script>` }) }),
  "alt text": (s) => site({ home: page({ body: `<img src="/x.png" alt="${s}">` }) }),
  "served llms.txt": (s) => site({ llms: `${s}\n` }),
};
for (const [name, make] of Object.entries(SURFACES)) {
  test(`SEEDED CONTROL: an unlisted log-verb paraphrase in ${name} goes RED with no list change`, () => {
    const r = run(make(UNSEEN), empty());
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stderr, /unjustified-log-verb/);
    assert.match(r.stderr, /You log it\./);
  });
}

test("SEEDED CONTROL: every verb form goes RED (log, logs, logged, logging)", () => {
  for (const s of ["Trainers log it.", "The app logs it.", "Everything is logged.", "We are logging it."]) {
    const r = run(site({ home: page({ body: `<p>${s}</p>` }) }), empty());
    assert.equal(r.status, 1, s);
  }
});

test("OVER-BREADTH: log in / log out / login / logo / catalog are not the attendance verb", () => {
  const body = "<p>Log in to your account. Then log out. The login page. The logo. A catalog.</p>";
  const r = run(site({ home: page({ body }) }), empty());
  assert.equal(r.status, 0, r.stderr || r.stdout);
});

test("REGISTRY: a justified sentence passes, and the count is printed with its reason", () => {
  const root = site({ home: page({ body: "<p>Log the session as it ends.</p>" }) });
  const r = run(root, registry([entry()]));
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.match(r.stdout, /1 entry \(advice-to-reader 1\)/);
  assert.match(r.stdout, /1 log-verb sentence\(s\) shipped/);
});

test("ACCEPTANCE (AC5): DELETING the entry's justification turns the SAME site RED", () => {
  const root = site({ home: page({ body: "<p>Log the session as it ends.</p>" }) });
  assert.equal(run(root, registry([entry()])).status, 0);
  const r = run(root, empty());
  assert.equal(r.status, 1);
  assert.match(r.stderr, /unjustified-log-verb/);
});

test("EDITING a justified sentence re-opens the question: the edit is unjustified AND the old entry is stale", () => {
  const root = site({ home: page({ body: "<p>Log the session as it ends now.</p>" }) });
  const r = run(root, registry([entry()]));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /unjustified-log-verb/);
  assert.match(r.stderr, /stale-entry/);
});

test("KIND is part of the key: a sentence justified as visible is NOT justified when it appears in meta", () => {
  const root = site({ home: page({ head: '<meta name="description" content="Log the session as it ends.">' }) });
  const r = run(root, registry([entry({ kinds: ["visible"] })]));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /unjustified-log-verb/);
});

test("ROUTE is part of the key: the same sentence on another page is not justified", () => {
  const root = site({ home: page({ body: "<p>Log the session as it ends.</p>" }) });
  const r = run(root, registry([entry({ route: "/guide/" })]));
  assert.equal(r.status, 1);
});

test("STALE: an entry that matches nothing shipped fails, so the printed count stays true", () => {
  const r = run(site(), registry([entry()]));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /stale-entry/);
});

test("ACCEPTANCE (AC6c): an entry with NO ruling reference is REFUSED and justifies nothing", () => {
  const root = site({ home: page({ body: "<p>Log the session as it ends.</p>" }) });
  for (const ruling of [undefined, "", "   ", "ok"]) {
    const r = run(root, registry([entry({ ruling })]));
    assert.equal(r.status, 1, JSON.stringify(ruling));
    assert.match(r.stderr, /invalid-entry/);
    assert.match(r.stderr, /unjustified-log-verb/, "an invalid entry must not still justify the sentence");
  }
});

test("REGISTRY validation refuses an unknown reason, a bad kind, a sentence with no log verb, and a duplicate", () => {
  const root = site({ home: page({ body: "<p>Log the session as it ends.</p>" }) });
  for (const bad of [
    entry({ reason: "because" }),
    entry({ kinds: ["footer"] }),
    entry({ kinds: [] }),
    entry({ sentence: "Punch the class as it ends." }),
    entry({ route: "guide/" }),
  ]) {
    const r = run(root, registry([bad]));
    assert.equal(r.status, 1, JSON.stringify(bad));
    assert.match(r.stderr, /invalid-entry/);
  }
  const dup = run(root, registry([entry(), entry()]));
  assert.equal(dup.status, 1);
  assert.match(dup.stderr, /duplicate/);
});

test("FAIL CLOSED: a missing registry is COULD NOT EVALUATE (exit 2), never a pass", () => {
  const r = run(site(), join(scratch, "does-not-exist.json"));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /COULD NOT EVALUATE/);
});

test("FAIL CLOSED: an empty build directory is refused, not a vacuous pass", () => {
  const root = join(scratch, `empty-${++serial}`);
  mkdirSync(root, { recursive: true });
  assert.equal(run(root, empty()).status, 2);
});

test("MECHANICAL ANSWER: --propose lists the unjustified sentences as skeletons and never writes the registry", () => {
  const r = run(site({ home: page({ body: `<p>${UNSEEN}</p>` }) }), empty(), ["--propose"]);
  assert.equal(r.status, 0);
  const rows = JSON.parse(r.stdout);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sentence, "You log it.", "the unit is one SENTENCE, not the whole block");
  assert.equal(rows[0].reason, "");
  assert.equal(rows[0].ruling, "");
});

test("THE REAL REGISTRY is valid: every entry has a class, a kind set and a ruling reference", () => {
  const reg = JSON.parse(readFileSync(REAL_REGISTRY, "utf8"));
  assert.deepEqual(validateRegistry(reg), []);
  assert.ok(reg.entries.length > 0, "an empty real registry would be a vacuous pass");
  for (const e of reg.entries) assert.ok(REASONS.includes(e.reason));
  // content's ruling (a): the Terms sentence is ALLOWED as legal text and nobody edits it.
  const terms = reg.entries.find((e) => e.route === "/terms/");
  assert.equal(terms.reason, "legal-text");
  assert.match(terms.sentence, /^Gymbo records the payments you log between you and your clients\.$/);
});

test("DEFAULT registry is the checked-in file: with no --registry the gate reads canonical-log-verb-registry.json", () => {
  const n = JSON.parse(readFileSync(REAL_REGISTRY, "utf8")).entries.length;
  const r = spawnSync(process.execPath, [SCRIPT, "--root", site()], { encoding: "utf8", cwd: new URL("..", import.meta.url).pathname });
  // The fixture ships none of the registry's sentences, so every entry is stale: RED,
  // and the printed count is the real file's, proving which file was read.
  assert.equal(r.status, 1);
  assert.match(r.stderr, new RegExp(`log-verb registry: ${n} entries`));
});
