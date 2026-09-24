// gy-uu7mt: controls for the INVERTED log-verb gate. Two families:
//  (1) a log verb nobody listed goes RED on every surface kind with no list change;
//  (2) the REGISTRY cannot launder: a junk entry, a wrong class, a sentence content never
//      ruled, a ruling from the wrong comment / author / class, a hand-edited rulings file,
//      an edited sentence and a deleted entry all turn it RED.
// tester found (PR 222) that the first version accepted a 12-character junk ruling for four
// of five classes and believed an entry that declared a tool sentence to be advice; pm then
// found that a real comment merely LISTING the classes tied any sentence. The rulings are now
// content's own sentence-level file, so the tie is exact by construction.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REASONS, PREDICATES, hasLogVerb, normalise, validateRegistry, loadRulings } from "../scripts/check-log-verb.mjs";

const SCRIPT = new URL("../scripts/check-log-verb.mjs", import.meta.url).pathname;
const ROOT = new URL("..", import.meta.url).pathname;
const REAL_REGISTRY = ROOT + "canonical-log-verb-registry.json";
const scratch = mkdtempSync(join(tmpdir(), "gymbo-log-verb-"));
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));
let serial = 0;
const sha = (b) => createHash("sha256").update(b).digest("hex");

const page = ({ body = "<p>Punch a class in one tap.</p>", head = "", ld = "" } = {}) =>
  `<!doctype html><html><head><title>Gymbo</title>${head}${ld}</head><body>${body}</body></html>`;

function site(files = {}, { home = page(), llms = "Punch a class in one tap.\n" } = {}) {
  const root = join(scratch, `site-${++serial}`);
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "index.html"), home);
  writeFileSync(join(root, "llms.txt"), llms);
  for (const [name, body] of Object.entries(files)) {
    mkdirSync(join(root, name, ".."), { recursive: true });
    writeFileSync(join(root, name), body);
  }
  return root;
}
const guide = (sentence) => site({ "guide/x/index.html": page({ body: `<p>${sentence}</p>` }) });

// ---- the vendored rulings file (content's) and its provenance record ----
const S = "Log the session as it ends.";
const ruled = (over = {}) => ({
  sentence: S, class: "advice-to-reader", ruling: "RULED", bead: "gy-uu7mt", commentId: "c-content",
  commentAuthor: "gymbo/gymbo-crew.content", commentCreatedAt: "2026-09-24T22:42:09Z", commentSha256: "x", ...over,
});
// Writes a rulings file + a record whose sha256 MATCHES it, so only the thing under test is wrong.
function rulingsFor(entries, { version = 1, tamper = false } = {}) {
  const dir = join(scratch, `rul-${++serial}`);
  mkdirSync(dir, { recursive: true });
  const bytes = Buffer.from(JSON.stringify({ version, entries }, null, 1));
  writeFileSync(join(dir, "rulings.json"), bytes);
  writeFileSync(join(dir, "source.json"), JSON.stringify({ sha256: tamper ? sha("what content really vendored") : sha(bytes), commit: "abcdef0123", mergedToMain: false }));
  return [join(dir, "rulings.json"), join(dir, "source.json")];
}
const entry = (over = {}) => ({
  route: "/guide/x/", kinds: ["visible"], sentence: S, reason: "advice-to-reader", ruling: { bead: "gy-uu7mt", comment: "c-content" }, ...over,
});
function write(obj) { const p = join(scratch, `reg-${++serial}.json`); writeFileSync(p, JSON.stringify(obj)); return p; }
const registry = (entries) => write({ version: 1, entries });
const run = (root, reg, extra = [], rul = rulingsFor([ruled()])) =>
  spawnSync(process.execPath, [SCRIPT, "--root", root, "--registry", reg, "--rulings", rul[0], "--rulings-source", rul[1], ...extra], { encoding: "utf8" });
const empty = () => registry([]);

test("NEGATIVE CONTROL: a site with no log verb passes, is read, and prints its entry count and the rulings provenance", () => {
  const r = run(site(), empty());
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.match(r.stdout, /log-verb registry: 0 entries/);
  assert.match(r.stdout, /0 log-verb sentence\(s\) shipped/);
  assert.match(r.stdout, /an OPEN Gymbo-v1 PR \(not on main yet\)/);
  assert.match(r.stdout, /drift order: NOT YET CREATED/, "the gate must print, every run, the control it depends on that does not exist yet");
});

// ---------- (1) an unlisted verb, on every surface kind ----------
const UNSEEN = "Your clients just train. You log it.";
const SURFACES = {
  "visible text": (s) => site({}, { home: page({ body: `<p>${s}</p>` }) }),
  "meta description": (s) => site({}, { home: page({ head: `<meta name="description" content="${s}">` }) }),
  "og:description": (s) => site({}, { home: page({ head: `<meta property="og:description" content="${s}">` }) }),
  "JSON-LD": (s) => site({}, { home: page({ ld: `<script type="application/ld+json">${JSON.stringify({ "@type": "WebSite", description: s })}</script>` }) }),
  "alt text": (s) => site({}, { home: page({ body: `<img src="/x.png" alt="${s}">` }) }),
  "served llms.txt": (s) => site({}, { llms: `${s}\n` }),
  "noscript": (s) => site({}, { home: page({ body: `<noscript>${s}</noscript>` }) }),
  "input value": (s) => site({}, { home: page({ body: `<input value="${s}">` }) }),
  "placeholder": (s) => site({}, { home: page({ body: `<input placeholder="${s}">` }) }),
  "data attribute with a sentence": (s) => site({}, { home: page({ body: `<div data-hint="${s}"></div>` }) }),
};
for (const [name, make] of Object.entries(SURFACES)) {
  test(`SEEDED CONTROL: an unlisted log-verb paraphrase in ${name} goes RED with no list change`, () => {
    const r = run(make(UNSEEN), empty());
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stderr, /unjustified-log-verb/);
    assert.match(r.stderr, /You log it\./);
  });
}

test("SEEDED CONTROL: every verb form goes RED (log, logs, logged, logging, relog, logbook, loggers)", () => {
  for (const s of ["Trainers log it.", "The app logs it.", "Everything is logged.", "We are logging it.", "Please relog it.", "Keep a logbook.", "The loggers ran."]) {
    assert.equal(run(site({}, { home: page({ body: `<p>${s}</p>` }) }), empty()).status, 1, s);
  }
});

test("REQUIREMENT 4: 'log in/on/off/out' does NOT swallow a product claim", () => {
  for (const s of ["Gymbo lets you log in one tap.", "You log on your phone right after class.", "Log off each session the moment it ends.", "Log out the class when it finishes.", "Gymbo makes it easy to log in one tap.", "Gymbo lets you log in and track attendance."]) {
    assert.ok(hasLogVerb(s), s);
    assert.equal(run(site({}, { home: page({ body: `<p>${s}</p>` }) }), empty()).status, 1, s);
  }
});

test("OVER-BREADTH: the auth sense and non-verbs pass (log in to / with, log out., login, logo, blog, catalog)", () => {
  const body = "<p>Log in to your account. Then log out. Log in with Google. The login page. The logo. Read the blog. A catalog.</p>";
  const r = run(site({}, { home: page({ body }) }), empty());
  assert.equal(r.status, 0, r.stderr || r.stdout);
});

test("REQUIREMENT 5: an invisible character or look-alike INSIDE the verb is the verb", () => {
  for (const s of ["Trainers lo­g it.", "Trainers lo​g it.", "Trainers l‍og it.", "Trainers lo⁠g it.", "Trainers lоg it.", "Trainers ﻿log it."]) {
    assert.ok(hasLogVerb(s), JSON.stringify(s));
    assert.equal(run(site({}, { home: page({ body: `<p>${s}</p>` }) }), empty()).status, 1, JSON.stringify(s));
  }
  assert.equal(normalise("lo­g"), "log");
});

test("REQUIREMENT 3: an UNCLASSIFIED file type FAILS, not silently ignored (.htm .xhtml .rss .atom .yaml, extensionless)", () => {
  for (const name of ["a.htm", "a.xhtml", "feed.rss", "feed.atom", "data.yaml", "extensionless"]) {
    const r = run(site({ [name]: "Trainers log it." }), empty());
    assert.equal(r.status, 1, name);
    assert.match(r.stderr, /unclassified-file/, name);
  }
});

test("A NEW served text/json/xml file with a log verb is read and goes RED", () => {
  for (const name of ["humans.txt", "extra.md", "x.json", "feed.xml"]) assert.equal(run(site({ [name]: "Trainers log it." }), empty()).status, 1, name);
});

// ---------- (2) the registry cannot launder ----------
test("REGISTRY: a valid entry passes, the count prints with its reason", () => {
  const r = run(guide(S), registry([entry()]));
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.match(r.stdout, /1 entry \(advice-to-reader 1\)/);
});

test("ACCEPTANCE (AC5): DELETING the entry turns the SAME site RED", () => {
  const root = guide(S);
  assert.equal(run(root, registry([entry()])).status, 0);
  assert.equal(run(root, empty()).status, 1);
});

test("REQUIREMENT 6: a deliberately JUNK entry turns the gate RED, for EVERY reason class", () => {
  // The exact attack from tester: a product-voice sentence and a junk ruling, under each class.
  const product = "Gymbo lets you log attendance in one tap.";
  const routes = { "advice-to-reader": "/guide/x/", "attributed-quote": "/", "competitor-description": "/alternatives/x/", "unrelated-log": "/privacy/", "legal-text": "/terms/" };
  for (const reason of REASONS) {
    const r0 = routes[reason];
    const root = site({ [`${r0.slice(1)}index.html`]: page({ body: `<p>${product}</p>` }) }, r0 === "/" ? { home: page({ body: `<p>${product}</p>` }) } : {});
    // even when content's file DOES contain the sentence in that class (the strongest attack), the predicate refuses it
    const rul = rulingsFor([ruled({ sentence: product, class: reason })]);
    for (const ruling of ["xxxxxxxxxxxx", { bead: "gy-uu7mt", comment: "made-up" }, { bead: "gy-uu7mt", comment: "c-content" }]) {
      const res = run(root, registry([entry({ route: r0, sentence: product, reason, ruling })]), [], rul);
      assert.equal(res.status, 1, `${reason} / ${JSON.stringify(ruling)}`);
      assert.match(res.stderr, /invalid-entry/);
      assert.match(res.stderr, /unjustified-log-verb/, "an invalid entry must not still justify the sentence");
    }
  }
});

test("REQUIREMENT 1: content's ruled TOOL sentences cannot be classed as advice, whatever the entry or the rulings file claim", () => {
  for (const sentence of [
    "An app that logs attendance for you keeps the pattern visible.",
    "Our app lets you log every class with a single tap.",
    "Gymbo lets you log the session as it ends.",
    "The software logs each class automatically.",
    "Log the session in one tap.",
    "We log every class for you.",
    "It helps you log every class.",
    "Trainers who use it can automatically log each class.",
  ]) {
    const r = run(guide(sentence), registry([entry({ sentence })]), [], rulingsFor([ruled({ sentence })]));
    assert.equal(r.status, 1, sentence);
    assert.match(r.stderr, /not advice-to-reader/, sentence);
  }
});

test("REQUIREMENT 1: advice that is NOT about a tool still passes (a UPI app is the place, not the subject)", () => {
  const s = "A payment logged only in your UPI app is money you'll have to reconstruct later.";
  const r = run(guide(s), registry([entry({ sentence: s })]), [], rulingsFor([ruled({ sentence: s })]));
  assert.equal(r.status, 0, r.stderr || r.stdout);
});

test("REQUIREMENT 1: each class is tied to where it can live", () => {
  assert.match(PREDICATES["advice-to-reader"]("Log the session as it ends.", "/"), /only for/);
  assert.match(PREDICATES["legal-text"]("You log it.", "/guide/x/"), /lives on \/terms\//);
  assert.match(PREDICATES["competitor-description"]("Logs workouts.", "/guide/x/"), /live on \/alternatives\//);
  assert.match(PREDICATES["unrelated-log"]("Standard logs are kept.", "/guide/x/"), /lives in \/privacy\//);
  assert.match(PREDICATES["unrelated-log"]("We keep server logs the session data.", "/privacy/"), /attendance verb|not a server/);
  assert.match(PREDICATES["attributed-quote"]("Gymbo logs classes.", "/"), /first person/);
  assert.equal(PREDICATES["unrelated-log"]("Standard logs (such as IP address) are kept.", "/privacy/"), null);
});

// pm 22:37Z: "a document that MENTIONS a class is not a ruling that ASSIGNS that class to a sentence."
// With content's own sentence-level file there is no fuzzy tie left to abuse; these prove it.
test("THE TIE IS EXACT: a sentence content never ruled is refused, even with a real comment id and the right class", () => {
  for (const sentence of ["You log it.", "Log a class and the package balance drops by one.", "Log every class in the app."]) {
    const r = run(guide(sentence), registry([entry({ sentence })]), [], rulingsFor([ruled()]));   // the file rules a DIFFERENT sentence, same comment id
    assert.equal(r.status, 1, sentence);
    assert.match(r.stderr, /content has not ruled this sentence/, sentence);
  }
});

test("THE TIE IS EXACT: content ruled the sentence as a DIFFERENT class -> refused", () => {
  const r = run(guide(S), registry([entry()]), [], rulingsFor([ruled({ class: "legal-text" })]));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /content ruled this sentence as legal-text, not advice-to-reader/);
});

test("THE TIE IS EXACT: the entry must cite the comment content's file names for THIS sentence", () => {
  const r = run(guide(S), registry([entry({ ruling: { bead: "gy-uu7mt", comment: "c-some-other-comment" } })]), [], rulingsFor([ruled()]));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /content's ruling for this sentence is comment c-content, not c-some-other-comment/);
});

test("THE TIE IS EXACT: a comment on another bead, a non-RULED verdict, or an author who cannot rule is refused", () => {
  const cases = { "another bead": ruled({ bead: "gy-zzzzz" }), "verdict not RULED": ruled({ ruling: "MENTIONED" }), "written by landing": ruled({ commentAuthor: "gymbo/gymbo-crew.landing" }), "written by tester": ruled({ commentAuthor: "gymbo/gymbo-crew.tester" }) };
  for (const [name, v] of Object.entries(cases)) {
    const r = run(guide(S), registry([entry()]), [], rulingsFor([v]));
    assert.equal(r.status, 1, name);
    assert.match(r.stderr, /invalid-entry/, name);
  }
  assert.equal(run(guide(S), registry([entry()]), [], rulingsFor([ruled({ commentAuthor: "gymbo/gymbo-crew.pm" })])).status, 0, "a pm ruling counts");
});

test("A registry entry with free-text ruling, no ruling or a bare comment id is refused", () => {
  for (const ruling of ["content 2026-09-24 21:51Z gy-uu7mt confirmed", undefined, { comment: "c-content" }, { bead: "gy-uu7mt" }]) {
    const r = run(guide(S), registry([entry({ ruling })]));
    assert.equal(r.status, 1, JSON.stringify(ruling));
    assert.match(r.stderr, /invalid-entry/);
  }
});

test("FORGED RULINGS FILE: any hand edit that is not re-vendored (sha256 differs from the record) turns the WHOLE gate RED", () => {
  const forged = rulingsFor([ruled()], { tamper: true });
  const r = run(guide(S), registry([entry()]), [], forged);
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stderr, /rulings-file-modified/);
  assert.match(r.stderr, /vendored VERBATIM from content and is never hand-edited/);
});

test("RULINGS FILE structure: an empty file, a wrong version and a missing file/record are refused (fail closed)", () => {
  const emptyFile = run(site(), empty(), [], rulingsFor([]));   // no entries needed anywhere: ONLY the empty file can fail this
  assert.equal(emptyFile.status, 1, emptyFile.stdout);
  assert.match(emptyFile.stderr, /an empty file proves nothing/);
  assert.equal(run(site(), empty(), [], rulingsFor([ruled()], { version: 2 })).status, 1);
  assert.equal(run(guide(S), registry([entry()]), [], rulingsFor([ruled()], { version: 2 })).status, 1);
  assert.equal(run(guide(S), registry([entry()]), [], [join(scratch, "nope.json"), join(scratch, "nope2.json")]).status, 2);
});

test("EDITING a justified sentence re-opens the question: unjustified AND the old entry is stale", () => {
  const r = run(guide("Log the session as it ends now."), registry([entry()]));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /unjustified-log-verb/);
  assert.match(r.stderr, /stale-entry/);
});

test("KIND and ROUTE are part of the key", () => {
  const meta = site({ "guide/x/index.html": page({ head: '<meta name="description" content="Log the session as it ends.">' }) });
  assert.equal(run(meta, registry([entry({ kinds: ["visible"] })])).status, 1);
  assert.equal(run(guide(S), registry([entry({ route: "/guide/y/" })])).status, 1);
});

test("STALE: an entry that matches nothing shipped fails, so the printed count stays true", () => {
  const r = run(site(), registry([entry()]));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /stale-entry/);
});

test("REGISTRY validation refuses a bad reason, a bad kind, a sentence with no log verb, a bad route and a duplicate", () => {
  const root = guide(S);
  for (const bad of [entry({ reason: "because" }), entry({ kinds: ["footer"] }), entry({ kinds: [] }), entry({ sentence: "Punch the class as it ends." }), entry({ route: "guide/" })]) {
    const r = run(root, registry([bad]));
    assert.equal(r.status, 1, JSON.stringify(bad));
    assert.match(r.stderr, /invalid-entry/);
  }
  const dup = run(root, registry([entry(), entry()]));
  assert.equal(dup.status, 1);
  assert.match(dup.stderr, /duplicate/);
});

test("FAIL CLOSED: a missing registry is COULD NOT EVALUATE (exit 2); an empty build is refused", () => {
  assert.equal(run(site(), join(scratch, "nope.json")).status, 2);
  const root = join(scratch, `empty-${++serial}`);
  mkdirSync(root, { recursive: true });
  assert.equal(run(root, empty()).status, 2);
});

test("--propose lists the unjustified sentences as skeletons and never writes the registry", () => {
  const r = run(site({}, { home: page({ body: `<p>${UNSEEN}</p>` }) }), empty(), ["--propose"]);
  assert.equal(r.status, 0);
  const rows = JSON.parse(r.stdout);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sentence, "You log it.");
  assert.equal(rows[0].reason, "");
});

test("DEFAULT files: with no flags the gate reads the checked-in registry and the vendored rulings", () => {
  const n = JSON.parse(readFileSync(REAL_REGISTRY, "utf8")).entries.length;
  const r = spawnSync(process.execPath, [SCRIPT, "--root", site()], { encoding: "utf8", cwd: ROOT });
  assert.equal(r.status, 1);   // the fixture ships none of the sentences, so every entry is stale
  assert.match(r.stderr, new RegExp(`log-verb registry: ${n} entries`));
  assert.match(r.stderr, /rulings 8e53ebc1dd52/);
});

test("THE REAL REGISTRY is valid against content's REAL vendored rulings, whose bytes match the recorded sha256", () => {
  const reg = JSON.parse(readFileSync(REAL_REGISTRY, "utf8"));
  const rul = loadRulings();
  assert.deepEqual(rul.problems, [], "the real rulings file must match its recorded sha256");
  assert.deepEqual(validateRegistry(reg, rul), []);
  assert.ok(reg.entries.length > 0);
  for (const e of reg.entries) assert.ok(REASONS.includes(e.reason));
  const terms = reg.entries.find((e) => e.route === "/terms/");
  assert.equal(terms.reason, "legal-text");
  assert.match(terms.sentence, /^Gymbo records the payments you log between you and your clients\.$/);
});

test("THE REAL RULINGS FILE: every entry is RULED by content or pm, on gy-uu7mt, with a comment id and a comment sha256", () => {
  const { entries } = loadRulings();
  assert.ok(entries.length >= 32);
  for (const v of entries) {
    assert.equal(v.ruling, "RULED");
    assert.ok(["gymbo/gymbo-crew.content", "gymbo/gymbo-crew.pm"].includes(v.commentAuthor));
    assert.match(v.commentId, /^[0-9a-f]{8}-/);
    assert.match(v.commentSha256, /^[0-9a-f]{64}$/);
    assert.ok(REASONS.includes(v.class));
  }
});

// ---- gy-illzd / PR 223: this gate uses the ONE shared normaliser ----
test("HIDDEN CHARACTERS through the whole gate: named and numeric entities hide nothing (&shy; &zwj; &zwnj; &ZeroWidthSpace; &NoBreak; &lrm; &rlm;)", () => {
  for (const hide of ["&shy;", "&#173;", "&zwj;", "&zwnj;", "&ZeroWidthSpace;", "&#8203;", "&NoBreak;", "&lrm;", "&rlm;"]) {
    const r = run(site({}, { home: page({ body: `<p>Trainers lo${hide}g it.</p>` }) }), empty());
    assert.equal(r.status, 1, hide);
    assert.match(r.stderr, /unjustified-log-verb/, hide);
  }
});

test("HIDDEN HYPHEN forms of a compound verb form are folded (non-breaking hyphen)", () => {
  assert.ok(hasLogVerb("Keep a re‑log of it."));
});

test("ONE NORMALISER: this gate imports the shared matchable() and defines no private fold list of its own", () => {
  const src = readFileSync(SCRIPT, "utf8");
  assert.match(src, /import \{ matchable \} from "\.\/text-normalise\.mjs"/);
  assert.doesNotMatch(src, /HOMOGLYPHS|INVISIBLES\s*=|\\u200B-\\u200D/, "a second normaliser is how the copy gates ended up disagreeing");
  assert.equal(normalise("lo&lrm;g"), "log");
});

test("ATTRIBUTED QUOTE is home-only: content's ruling names a sentence, not a route, so the same sentence on /guide/ is refused", () => {
  const q = "With Gymbo, I open the app, log the session, and move on.”";
  const rul = rulingsFor([ruled({ sentence: q, class: "attributed-quote" })]);
  const home = run(site({}, { home: page({ body: `<p>${q}</p>` }) }), registry([entry({ route: "/", sentence: q, reason: "attributed-quote" })]), [], rul);
  assert.equal(home.status, 0, home.stderr || home.stdout);
  const guideRoute = run(guide(q), registry([entry({ route: "/guide/x/", sentence: q, reason: "attributed-quote" })]), [], rul);
  assert.equal(guideRoute.status, 1);
  assert.match(guideRoute.stderr, /home page only/);
});

// ---- the provenance record must not overstate its own guarantees (pm 23:12Z, gy-ab757's defect) ----
test("THE PROVENANCE RECORD TELLS THE TRUTH: the drift order is NOT claimed to run, the closed PR is not called open, and the forgery gap is stated", () => {
  const src = JSON.parse(readFileSync(ROOT + "src/canonical/SENTENCE-RULINGS-SOURCE.json", "utf8"));
  assert.equal(src.driftOrder.exists, false);
  assert.equal(src.driftOrder.owner, "pm");
  assert.match(src._comment, /DOES NOT EXIST YET/);
  assert.match(src._comment, /edited together in ONE PR/);
  assert.doesNotMatch(src._comment + src.branch, /a scheduled order runs/i, "an artefact that says a control runs when it does not is the defect this bead exists to remove");
  assert.match(src.branch, /1457 first carried this file and is CLOSED/);
  assert.doesNotMatch(src.branch, /1457[^.]*\bOPEN\b(?! and NOT MERGED)/);
  assert.equal(src.mergedToMain, false);
  const gate = readFileSync(SCRIPT, "utf8");
  assert.match(gate, /THAT ORDER DOES NOT EXIST YET/);
  assert.doesNotMatch(gate, /a scheduled Gas City order\s*\n?\/\/\s*runs content/);
});
