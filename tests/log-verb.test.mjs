// gy-uu7mt: controls for the INVERTED log-verb gate. Two families:
//  (1) a log verb nobody listed goes RED on every surface kind with no list change;
//  (2) the REGISTRY cannot launder: a junk entry, a wrong class, an unresolvable ruling, a
//      ruling by the wrong author, an edited sentence, a deleted entry all turn it RED.
// tester found (PR 222) that the first version accepted a 12-character junk ruling for four
// of five classes and believed an entry that declared a tool sentence to be advice; the
// tests below are the ones that would have caught it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REASONS, PREDICATES, hasLogVerb, normalise, validateRegistry } from "../scripts/check-log-verb.mjs";

const SCRIPT = new URL("../scripts/check-log-verb.mjs", import.meta.url).pathname;
const ROOT = new URL("..", import.meta.url).pathname;
const REAL_REGISTRY = ROOT + "canonical-log-verb-registry.json";
const REAL_RULINGS = ROOT + "canonical-log-verb-rulings.json";
const scratch = mkdtempSync(join(tmpdir(), "gymbo-log-verb-"));
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));
let serial = 0;

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

// A snapshot with a real-looking content ruling, a pm ruling, and one by LANDING (which must not count).
const QUOTE = "RULED advice-to-reader: Log the session as it ends.";
const TAXONOMY = "RULED classes: advice-to-reader / attributed-quote / competitor-description / unrelated-log / legal-text";
const EXAMPLE = "a sentence quoted as a defect example: Log the session as it ends. passes the gate";
const WRONGCLASS = "RULED legal-text: Log the session as it ends.";
const PIECE = "RULED advice: log the session as it ends, then review";
const RULINGS = {
  version: 1,
  rulings: {
    "c-content": { bead: "gy-uu7mt", author: "gymbo/gymbo-crew.content", created_at: "2026-09-24T21:41:59Z", sha256: "x", quotes: [QUOTE, TAXONOMY, EXAMPLE, WRONGCLASS, PIECE, "RULED advice: keep one ledger current in the moment", "RULED advice: log it in the moment", "RULED advice-to-reader: A payment logged only in your UPI app is money you'll have to reconstruct later."] },
    "c-pm": { bead: "gy-uu7mt", author: "gymbo/gymbo-crew.pm", created_at: "2026-09-24T21:44:26Z", sha256: "y", quotes: [QUOTE] },
    "c-landing": { bead: "gy-uu7mt", author: "gymbo/gymbo-crew.landing", created_at: "2026-09-24T21:40:00Z", sha256: "z", quotes: [QUOTE] },
    "c-other-bead": { bead: "gy-zzzzz", author: "gymbo/gymbo-crew.content", created_at: "2026-09-24T21:40:00Z", sha256: "w", quotes: [QUOTE] },
  },
};
const files = { rulings: null };
function write(name, obj) { const p = join(scratch, `${name}-${++serial}.json`); writeFileSync(p, JSON.stringify(obj)); return p; }

const ok = { bead: "gy-uu7mt", comment: "c-content", quote: QUOTE };
const entry = (over = {}) => ({
  route: "/guide/x/", kinds: ["visible"], sentence: "Log the session as it ends.",
  reason: "advice-to-reader", ruling: ok, ...over,
});
const registry = (entries) => write("reg", { version: 1, entries });
const rulings = (r = RULINGS) => write("rul", r);
const run = (root, reg, extra = [], rul = rulings()) =>
  spawnSync(process.execPath, [SCRIPT, "--root", root, "--registry", reg, "--rulings", rul, ...extra], { encoding: "utf8" });
const guide = (sentence) => site({}, {}) && site({ "guide/x/index.html": page({ body: `<p>${sentence}</p>` }) });
const empty = () => registry([]);

test("NEGATIVE CONTROL: a site with no log verb passes, is read, and prints its entry count", () => {
  const r = run(site(), empty());
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.match(r.stdout, /log-verb registry: 0 entries/);
  assert.match(r.stdout, /0 log-verb sentence\(s\) shipped/);
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
test("REGISTRY: a valid entry passes, the count prints with its reason, and the ruling resolved", () => {
  const r = run(guide("Log the session as it ends."), registry([entry()]));
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.match(r.stdout, /1 entry \(advice-to-reader 1\)/);
});

test("ACCEPTANCE (AC5): DELETING the entry turns the SAME site RED", () => {
  const root = guide("Log the session as it ends.");
  assert.equal(run(root, registry([entry()])).status, 0);
  assert.equal(run(root, empty()).status, 1);
});

test("REQUIREMENT 6: a deliberately JUNK entry turns the gate RED, for EVERY reason class", () => {
  // The exact attack from tester: a product-voice sentence, a junk 12-char ruling, each class.
  const product = "Gymbo lets you log attendance in one tap.";
  const routes = { "advice-to-reader": "/guide/x/", "attributed-quote": "/", "competitor-description": "/alternatives/x/", "unrelated-log": "/privacy/", "legal-text": "/terms/" };
  for (const reason of REASONS) {
    const r0 = routes[reason];
    const root = site({ [`${r0.slice(1)}index.html`]: page({ body: `<p>${product}</p>` }) }, r0 === "/" ? { home: page({ body: `<p>${product}</p>` }) } : {});
    for (const ruling of ["xxxxxxxxxxxx", { bead: "gy-uu7mt", comment: "made-up", quote: "xxxxxxxxxxxxxxxxxxxxxxxx" }, ok]) {
      const res = run(root, registry([entry({ route: r0, sentence: product, reason, ruling })]));
      assert.equal(res.status, 1, `${reason} / ${JSON.stringify(ruling).slice(0, 40)}`);
      assert.match(res.stderr, /invalid-entry/);
      assert.match(res.stderr, /unjustified-log-verb/, "an invalid entry must not still justify the sentence");
    }
  }
});

test("REQUIREMENT 1: content's ruled TOOL sentences cannot be classed as advice, whatever the entry claims", () => {
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
    const root = guide(sentence);
    const r = run(root, registry([entry({ sentence })]));
    assert.equal(r.status, 1, sentence);
    assert.match(r.stderr, /not advice-to-reader/, sentence);
  }
});

test("REQUIREMENT 1: advice that is NOT about a tool still passes (a UPI app is the place, not the subject)", () => {
  const s = "A payment logged only in your UPI app is money you'll have to reconstruct later.";
  const r = run(guide(s), registry([entry({ sentence: s, ruling: { bead: "gy-uu7mt", comment: "c-content", quote: `RULED advice-to-reader: ${s}` } })]));
  assert.equal(r.status, 0, r.stderr || r.stdout);
});

test("REQUIREMENT 1: each class is tied to where it can live (advice off an editorial route, legal off /terms/, ...)", () => {
  assert.match(PREDICATES["advice-to-reader"]("Log the session as it ends.", "/"), /only for/);
  assert.match(PREDICATES["legal-text"]("You log it.", "/guide/x/"), /lives on \/terms\//);
  assert.match(PREDICATES["competitor-description"]("Logs workouts.", "/guide/x/"), /live on \/alternatives\//);
  assert.match(PREDICATES["unrelated-log"]("Standard logs are kept.", "/guide/x/"), /lives in \/privacy\//);
  assert.match(PREDICATES["unrelated-log"]("We keep server logs the session data.", "/privacy/"), /attendance verb|not a server/);
  assert.match(PREDICATES["attributed-quote"]("Gymbo logs classes.", "/"), /first person/);
  assert.equal(PREDICATES["unrelated-log"]("Standard logs (such as IP address) are kept.", "/privacy/"), null);
});

test("REQUIREMENT 2: a ruling that does not RESOLVE is refused (unknown comment, wrong bead, wrong author, unverified quote)", () => {
  const root = guide("Log the session as it ends.");
  const cases = {
    "unknown comment": { ...ok, comment: "does-not-exist" },
    "comment on another bead": { bead: "gy-uu7mt", comment: "c-other-bead", quote: QUOTE },
    "written by landing, who cannot rule": { ...ok, comment: "c-landing", quote: QUOTE },
    "quote not in that comment": { ...ok, quote: "Log the session as it ends. invented ruling text" },
    "quote unrelated and not in that comment": { ...ok, quote: "a quote that appears nowhere in the ruling comment" },
    "quote too short": { ...ok, quote: "RULED advice-to-reader" },
    "free text": "content 2026-09-24 21:51Z gy-uu7mt confirmed",
    "missing": undefined,
  };
  for (const [name, ruling] of Object.entries(cases)) {
    const r = run(root, registry([entry({ ruling })]));
    assert.equal(r.status, 1, name);
    assert.match(r.stderr, /invalid-entry/, name);
  }
});

test("REQUIREMENT 2: a pm comment resolves", () => {
  const r = run(guide("Log the session as it ends."), registry([entry({ ruling: { bead: "gy-uu7mt", comment: "c-pm", quote: QUOTE } })]));
  assert.equal(r.status, 0, r.stderr || r.stdout);
});

// pm 22:37Z: "a document that MENTIONS a class is not a ruling that ASSIGNS that class to a sentence".
test("THE TIE IS SENTENCE-SPECIFIC: a real comment that only lists the classes rules NOTHING, for any sentence and any class", () => {
  const cases = [
    ["/guide/x/", "advice-to-reader", "You log it."], ["/guide/x/", "advice-to-reader", "Log a class and the package balance drops by one."],
    ["/guide/x/", "advice-to-reader", "Log every class in the app."], ["/", "attributed-quote", "\u201CI log it,\u201D said Sam."],
    ["/alternatives/x/", "competitor-description", "Logs workouts."], ["/privacy/", "unrelated-log", "We keep server logs."], ["/terms/", "legal-text", "You log payments here."],
  ];
  for (const [r0, reason, sentence] of cases) {
    const root = site({ [`${r0.slice(1)}index.html`]: page({ body: `<p>${sentence}</p>` }) }, r0 === "/" ? { home: page({ body: `<p>${sentence}</p>` }) } : {});
    const res = run(root, registry([entry({ route: r0, reason, sentence, ruling: { bead: "gy-uu7mt", comment: "c-content", quote: TAXONOMY } })]));
    assert.equal(res.status, 1, `${reason}: ${sentence}`);
    assert.match(res.stderr, /does not rule THIS sentence/, sentence);
  }
});

test("THE TIE: a sentence merely QUOTED in a comment (no ruling word) is not a ruling", () => {
  const r = run(guide("Log the session as it ends."), registry([entry({ ruling: { bead: "gy-uu7mt", comment: "c-content", quote: EXAMPLE } })]));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no ruling word/);
});

test("THE TIE: a ruling that assigns a DIFFERENT class to that sentence does not rule this entry", () => {
  const r = run(guide("Log the session as it ends."), registry([entry({ ruling: { bead: "gy-uu7mt", comment: "c-content", quote: WRONGCLASS } })]));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /does not assign the class 'advice-to-reader'/);
});

test("THE TIE: a partial quote must be 25+ chars, hold the verb, and identify ONE registry sentence", () => {
  const long = "Log the session as it ends, then review the whole roster once a week.";
  const root = guide(long);
  const partial = { bead: "gy-uu7mt", comment: "c-content", quote: PIECE };
  assert.equal(run(root, registry([entry({ sentence: long, ruling: partial })])).status, 0);
  // the same piece also sits in a second registry sentence: it no longer identifies either
  const other = "Log the session as it ends, then review the diary.";
  const rootTwo = site({ "guide/x/index.html": page({ body: `<p>${long}</p>` }), "guide/y/index.html": page({ body: `<p>${other}</p>` }) });
  const two = run(rootTwo, registry([entry({ sentence: long, ruling: partial }), entry({ route: "/guide/y/", sentence: other, ruling: partial })]));
  assert.equal(two.status, 1);
  assert.match(two.stderr, /does not identify this one/);
  // too short a piece
  const short = run(guide("Log it in the moment."), registry([entry({ sentence: "Log it in the moment.", ruling: { bead: "gy-uu7mt", comment: "c-content", quote: "RULED advice: log it in the moment" } })]));
  assert.equal(short.status, 0, "the whole sentence is inside the quote, so length is not the test");
  const tooShort = run(guide("Please log it now and then."), registry([entry({ sentence: "Please log it now and then.", ruling: { bead: "gy-uu7mt", comment: "c-content", quote: "RULED advice: log it in the moment" } })]));
  assert.equal(tooShort.status, 1);
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
  assert.equal(run(guide("Log the session as it ends."), registry([entry({ route: "/guide/y/" })])).status, 1);
});

test("STALE: an entry that matches nothing shipped fails, so the printed count stays true", () => {
  const r = run(site(), registry([entry()]));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /stale-entry/);
});

test("REGISTRY validation refuses a bad reason, a bad kind, a sentence with no log verb, a bad route and a duplicate", () => {
  const root = guide("Log the session as it ends.");
  for (const bad of [entry({ reason: "because" }), entry({ kinds: ["footer"] }), entry({ kinds: [] }), entry({ sentence: "Punch the class as it ends." }), entry({ route: "guide/" })]) {
    const r = run(root, registry([bad]));
    assert.equal(r.status, 1, JSON.stringify(bad));
    assert.match(r.stderr, /invalid-entry/);
  }
  const dup = run(root, registry([entry(), entry()]));
  assert.equal(dup.status, 1);
  assert.match(dup.stderr, /duplicate/);
});

test("FAIL CLOSED: a missing registry or rulings snapshot is COULD NOT EVALUATE (exit 2); an empty build is refused", () => {
  assert.equal(run(site(), join(scratch, "nope.json")).status, 2);
  assert.equal(run(site(), empty(), [], join(scratch, "nope2.json")).status, 2);
  const root = join(scratch, `empty-${++serial}`);
  mkdirSync(root, { recursive: true });
  assert.equal(run(root, empty()).status, 2);
  assert.equal(run(site(), empty(), [], write("badrul", { version: 2 })).status, 1);
});

test("--propose lists the unjustified sentences as skeletons and never writes the registry", () => {
  const r = run(site({}, { home: page({ body: `<p>${UNSEEN}</p>` }) }), empty(), ["--propose"]);
  assert.equal(r.status, 0);
  const rows = JSON.parse(r.stdout);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sentence, "You log it.");
  assert.equal(rows[0].reason, "");
});

test("DEFAULT files: with no --registry/--rulings the gate reads the checked-in pair", () => {
  const n = JSON.parse(readFileSync(REAL_REGISTRY, "utf8")).entries.length;
  const r = spawnSync(process.execPath, [SCRIPT, "--root", site()], { encoding: "utf8", cwd: ROOT });
  assert.equal(r.status, 1);   // the fixture ships none of the sentences, so every entry is stale
  assert.match(r.stderr, new RegExp(`log-verb registry: ${n} entries`));
});

test("THE REAL REGISTRY is valid against the REAL rulings snapshot, and content's ruling (a) is honoured", () => {
  const reg = JSON.parse(readFileSync(REAL_REGISTRY, "utf8"));
  const rul = JSON.parse(readFileSync(REAL_RULINGS, "utf8"));
  assert.deepEqual(validateRegistry(reg, rul), []);
  assert.ok(reg.entries.length > 0);
  for (const c of Object.values(rul.rulings)) assert.ok(["gymbo/gymbo-crew.content", "gymbo/gymbo-crew.pm"].includes(c.author));
  const terms = reg.entries.find((e) => e.route === "/terms/");
  assert.equal(terms.reason, "legal-text");
  assert.match(terms.sentence, /^Gymbo records the payments you log between you and your clients\.$/);
});
