// gy-uu7mt: content's vendored canonical strings. Each case plants ONE defect and proves
// the check fails on it by name; the waiver cases prove a known divergence is reported
// every run, cannot drift, and cannot outlive its expiry or its cause.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkCanonical, checkFacts, canonicalRuled, loadCanonical, loadFactsMap, readConstants, findBuiltPrices, loadPriceSurfaces, checkBuiltPricePin, checkPriceLedger, checkLedgerAppendOnly, ledgerBaseFromEnv, readBaseLedger, NAMED_LIMITS, SAVING_WORDS, SAVING_FILLERS, SAVING_AFTER, priceDrill, priceOccurrences, priceText, builtName, rupees, sha256 } from "../scripts/canonical-strings.mjs";
// The CLI tests spawn the real gate. On a CI runner the gate reads GITHUB_* to find its base commit (gy-53qq5.1 R3), so
// an inherited runner environment would make these tests depend on WHERE they run: scrub it. Tests that mean CI say so.
for (const k of ["GITHUB_ACTIONS", "GITHUB_EVENT_NAME", "GITHUB_EVENT_PATH", "GITHUB_BASE_REF"]) delete process.env[k];

const SCRIPT = new URL("../scripts/check-canonical-strings.mjs", import.meta.url).pathname;
const REAL = new URL("../src/canonical", import.meta.url).pathname;
const scratch = mkdtempSync(join(tmpdir(), "gymbo-canon-"));
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));

const DOC = { strings: [
  { id: "site.meta.twitter", text: "Built for independent personal trainers." },
  { id: "trial.line", text: "Eligible subscribers can try Gymbo free for 7 days." },
  { id: "trial.comparisonRow", text: "7 days for eligible subscribers, Apple payment method required" },
  { id: "app.pickClient", text: "Pick a client" },
] };
const SRC = { sha256: "x", commit: "91c956c84c46f82433ffe31c9a2c4dce0ce92fd0", guideVersion: "v15", webSurfaceIdPrefixes: ["site.", "trial."] };
const MAP = {
  "site.meta.twitter": { targets: [{ route: "/", surface: "metadata twitter:description", mode: "equals" }] },
  "trial.line": { targets: [{ route: "/", surface: "visible block", mode: "contains" }] },
  "trial.comparisonRow": { targets: [
    { route: "/alt/", surface: "visible block", mode: "equals" },
    { route: "/cmp/", surface: "visible block", mode: "equals", waiver: { ref: "test", expires: "2026-10-08", observed: "7 days for eligible subscribers", why: "test" } },
  ] },
};
const canon = (over = {}) => ({ doc: DOC, source: { ...SRC, sha256: "abc" }, map: MAP, sha: "abc", ...over });
const site = (over = {}) => new Map(Object.entries({
  "/": [{ surface: "metadata twitter:description", text: "Built for independent personal trainers." }, { surface: "visible block", text: "Hero. Eligible subscribers can try Gymbo free for 7 days. Billed via the App Store." }],
  "/alt/": [{ surface: "visible block", text: "7 days for eligible subscribers, Apple payment method required" }],
  "/cmp/": [{ surface: "visible block", text: "7 days for eligible subscribers" }],
  ...over,
}));
const kinds = (r) => r.findings.map((f) => f.kind);
const T = "2026-09-24";

test("NEGATIVE CONTROL: a site that carries every canonical string passes, and the waived divergence is still LISTED", () => {
  const r = checkCanonical(canon(), site(), T);
  assert.deepEqual(r.findings, []); assert.equal(r.notes.length, 1); assert.match(r.notes[0], /WAIVED trial\.comparisonRow on \/cmp\//);
});

test("POSITIVE CONTROL: a paraphrase of a pinned string fails on every mode (equals and contains)", () => {
  assert.deepEqual(kinds(checkCanonical(canon(), site({ "/": [{ surface: "metadata twitter:description", text: "An AI app for trainers." }, { surface: "visible block", text: "Eligible subscribers can try Gymbo free for 7 days." }] }), T)), ["canonical-string-missing"]);
  assert.deepEqual(kinds(checkCanonical(canon(), site({ "/": [{ surface: "metadata twitter:description", text: "Built for independent personal trainers." }, { surface: "visible block", text: "Eligible people get a week free." }] }), T)), ["canonical-string-missing"]);
});

test("the right string on the WRONG surface or route does not count", () => {
  assert.deepEqual(kinds(checkCanonical(canon(), site({ "/": [{ surface: "visible block", text: "Built for independent personal trainers." }, { surface: "visible block", text: "Eligible subscribers can try Gymbo free for 7 days." }] }), T)), ["canonical-string-missing"]);
  assert.deepEqual(kinds(checkCanonical(canon(), site({ "/alt/": [] }), T)), ["canonical-string-missing"]);
});

test("EQUALS means equals: the pinned string buried inside a longer block does NOT satisfy an equals target", () => {
  const padded = site({ "/": [{ surface: "metadata twitter:description", text: "Built for independent personal trainers. Plus an AI sidekick." }, { surface: "visible block", text: "Eligible subscribers can try Gymbo free for 7 days." }] });
  assert.deepEqual(kinds(checkCanonical(canon(), padded, T)), ["canonical-string-missing"]);
});

test("MATCH CONTROL: content's own `match` field must agree with landing's mapped mode", () => {
  const doc = { strings: [...DOC.strings.filter((x) => x.id !== "site.meta.twitter"), { id: "site.meta.twitter", text: "Built for independent personal trainers.", match: "contains" }] };
  assert.deepEqual(kinds(checkCanonical(canon({ doc }), site(), T)), ["match-mode-disagrees"]);
  const ok = { strings: [...DOC.strings.filter((x) => x.id !== "trial.line"), { id: "trial.line", text: "Eligible subscribers can try Gymbo free for 7 days.", match: "contains" }] };
  assert.deepEqual(kinds(checkCanonical(canon({ doc: ok }), site(), T)), []);
});

test("HASH CONTROL: a hand-edited vendored file (or a re-vendor without SOURCE.json) fails", () => {
  assert.deepEqual(kinds(checkCanonical(canon({ sha: "tampered" }), site(), T)), ["canonical-hash-mismatch"]);
});

test("COVERAGE CONTROL: a NEW web-surface id from content with no mapping fails; an app-side id does not", () => {
  const doc = { strings: [...DOC.strings, { id: "site.hero.note", text: "New" }] };
  assert.deepEqual(kinds(checkCanonical(canon({ doc }), site(), T)), ["unmapped-web-string"]);
  assert.deepEqual(kinds(checkCanonical(canon(), site(), T)), [], "app.pickClient is unmapped and must be ignored");
  assert.deepEqual(kinds(checkCanonical(canon({ map: { ...MAP, "site.gone": { targets: [] } } }), site(), T)), ["unknown-mapping"]);
});

test("WAIVER CONTROLS: it goes stale when the canonical string appears, expires on its date, and cannot drift", () => {
  assert.deepEqual(kinds(checkCanonical(canon(), site({ "/cmp/": [{ surface: "visible block", text: "7 days for eligible subscribers, Apple payment method required" }] }), T)), ["stale-waiver"]);
  assert.deepEqual(kinds(checkCanonical(canon(), site(), "2026-10-09")), ["waiver-expired"]);
  assert.deepEqual(kinds(checkCanonical(canon(), site(), "2026-10-08")), [], "on the expiry date itself it still holds");
  assert.deepEqual(kinds(checkCanonical(canon(), site({ "/cmp/": [{ surface: "visible block", text: "A week free for anyone" }] }), T)), ["waiver-observed-missing"]);
});

test("canonicalRuled derives ruled entries from content's file and never from a waived target", () => {
  const r = canonicalRuled(canon());
  assert.ok(r.some((e) => e.id === "canonical.site.meta.twitter" && e.equals === "Built for independent personal trainers." && e.route === "/"));
  assert.ok(r.some((e) => e.id === "canonical.trial.line" && e.contains));
  assert.equal(r.filter((e) => e.id === "canonical.trial.comparisonRow").length, 1, "the waived /cmp/ target is not ruled");
  assert.ok(!r.some((e) => e.id.includes("pickClient")));
});

test("REAL FILES: the vendored file's sha256 equals SOURCE.json, and content's stated hash", () => {
  const c = loadCanonical(REAL);
  assert.equal(c.sha, c.source.sha256);
  assert.equal(c.sha, "f74dd05a322d6ad3790f8bd5cf5d73714fc1f9e9c60e75a5e66022d0d573c768");
  assert.equal(c.doc.strings.filter((s) => c.source.webSurfaceIdPrefixes.some((p) => s.id.startsWith(p))).length, 10);
  for (const id of c.doc.strings.map((s) => s.id).filter((i) => /^(site|trial)\./.test(i))) assert.ok(c.map[id], `${id} unmapped`);
});

// v3 FACTS: content rules the numbers, the constants must EQUAL them. Each case plants ONE defect.
const FMAP = { file: "src/lib/trialAccess.ts", map: { trialDays: "TRIAL_DAYS", monthlyINR: "PRICE_MONTHLY_INR", annualSavingsPercent: "ANNUAL_SAVINGS_PERCENT" } };
const FDOC = { facts: { _comment: "ignored", trialDays: 7, monthlyINR: 399, annualSavingsPercent: 37 } };
const TS = (o = {}) => { const v = { TRIAL_DAYS: "7", PRICE_MONTHLY_INR: "399", ANNUAL_SAVINGS_PERCENT: "37", ...o }; return Object.entries(v).map(([k, x]) => `export const ${k} = ${x};`).join("\n"); };
const fkinds = (doc, map, ts) => checkFacts(doc, map, ts).map((f) => f.kind);

test("FACTS CONTROL: constants equal to content's ruled numbers pass, and a `_comment` key is not a fact", () => {
  assert.deepEqual(checkFacts(FDOC, FMAP, TS()), []);
});

test("FACTS CONTROL: each constant that drifts from the ruled number fails alone, by name", () => {
  assert.deepEqual(fkinds(FDOC, FMAP, TS({ PRICE_MONTHLY_INR: "449" })), ["fact-mismatch"]);
  assert.deepEqual(fkinds(FDOC, FMAP, TS({ TRIAL_DAYS: "14" })), ["fact-mismatch"]);
  assert.deepEqual(fkinds(FDOC, FMAP, TS({ ANNUAL_SAVINGS_PERCENT: "40" })), ["fact-mismatch"]);
  assert.match(checkFacts(FDOC, FMAP, TS({ PRICE_MONTHLY_INR: "449" }))[0].detail, /PRICE_MONTHLY_INR = 449.*ruled 399/);
});

test("FACTS CONTROL: a constant rewritten as an expression, renamed, or removed FAILS CLOSED instead of being skipped", () => {
  assert.deepEqual(fkinds(FDOC, FMAP, TS({ PRICE_MONTHLY_INR: "399 + 0" })), ["cannot-read-constant"]);
  assert.deepEqual(fkinds(FDOC, FMAP, TS({ TRIAL_DAYS: "Number('7')" })), ["cannot-read-constant"]);
  assert.deepEqual(fkinds(FDOC, FMAP, TS().replace("PRICE_MONTHLY_INR", "PRICE_MONTHLY_RUPEES")), ["cannot-read-constant"]);
  assert.deepEqual(fkinds(FDOC, FMAP, ""), ["cannot-read-constant", "cannot-read-constant", "cannot-read-constant"]);
});

test("FACTS COVERAGE: a NEW fact from content with no mapping fails; a mapping for a missing fact fails", () => {
  assert.deepEqual(fkinds({ facts: { ...FDOC.facts, annualINR: 2999 } }, FMAP, TS()), ["unmapped-fact"]);
  assert.deepEqual(fkinds({ facts: { trialDays: 7, monthlyINR: 399 } }, FMAP, TS()), ["unknown-fact-mapping"]);
});

test("FACTS VACUITY: a vendored file with no facts block, or an empty one, fails rather than passing", () => {
  assert.deepEqual(fkinds({ strings: [] }, FMAP, TS()), ["facts-missing"]);
  assert.deepEqual(fkinds({ facts: { _comment: "only a comment" } }, FMAP, TS()), ["facts-missing"]);
});

test("REAL FILES: the vendored facts equal the site's REAL constants, and every fact is mapped", () => {
  const c = loadCanonical(REAL); const fm = loadFactsMap(REAL);
  const ts = readFileSync(new URL("../" + fm.file, import.meta.url), "utf8");
  assert.deepEqual(checkFacts(c.doc, fm, ts), []);
  assert.deepEqual(c.doc.facts && Object.keys(c.doc.facts).filter((k) => !k.startsWith("_")).sort(), Object.keys(fm.map).sort());
  const got = readConstants(ts, Object.values(fm.map));
  assert.deepEqual(got, { TRIAL_DAYS: 7, PRICE_MONTHLY_INR: 399, PRICE_ANNUAL_INR: 2999, PRICE_ANNUAL_MONTHLY_EQUIVALENT_INR: 250, ANNUAL_SAVINGS_PERCENT: 37 });
  // THE DISCRIMINATING CONTROL: the real gate against the real file with ONE real constant nudged.
  for (const [name, v] of Object.entries(got)) {
    const mutated = ts.replace(new RegExp(`(export const ${name}\\s*=\\s*)${v}`), `$1${v + 1}`);
    assert.notEqual(mutated, ts, `${name} mutation applied`);
    assert.deepEqual(checkFacts(c.doc, fm, mutated).map((f) => f.kind), ["fact-mismatch"], `${name} drift must fail`);
  }
});

test("F2 DECOY: a comment that QUOTES the old declaration is not read as the constant; a duplicate declaration fails closed", () => {
  // tester's F2 form: the old declaration on its OWN LINE inside a block comment, ahead of the real one.
  const decoy = `/*\nexport const PRICE_MONTHLY_INR = 399;\n*/\n${TS({ PRICE_MONTHLY_INR: "449" })}`;
  assert.deepEqual(fkinds(FDOC, FMAP, decoy), ["fact-mismatch"], "the real 449 is read, not the quoted 399");
  assert.deepEqual(fkinds(FDOC, FMAP, `/** doc\n * old:\nexport const PRICE_MONTHLY_INR = 399;\n */\n${TS({ PRICE_MONTHLY_INR: "449" })}`), ["fact-mismatch"]);
  assert.deepEqual(fkinds(FDOC, FMAP, `/*\nexport const PRICE_MONTHLY_INR = 449;\n*/\n${TS()}`), [], "a commented-out WRONG value must not fail a correct file");
  assert.deepEqual(fkinds(FDOC, FMAP, `${TS()}\nexport const PRICE_MONTHLY_INR = 449;`), ["cannot-read-constant"], "declared twice: fail closed");
  assert.deepEqual(fkinds(FDOC, FMAP, TS()), [], "control: the clean file still passes");
});

test("SCOPE DISCLOSURE: built files that state a rupee amount are FOUND and named, including public/ text files no source scan can see", () => {
  const root = mkdtempSync(join(scratch, "built-")); mkdirSync(join(root, "alternatives/akton"), { recursive: true });
  writeFileSync(join(root, "index.html"), "<p>no price here</p>");
  assert.deepEqual(findBuiltPrices(root), [], "a dist with no rupee amount reports none");
  writeFileSync(join(root, "alternatives/akton/index.html"), "<p>\u20b9399/month</p><script type=\"application/ld+json\">{\"price\":\"\u20b92,999\"}</script>");
  writeFileSync(join(root, "pricing.md"), "| Monthly | \u20b9399 / month |\n- Annual \u20b92,999\n");
  writeFileSync(join(root, "llms.txt"), "Monthly: \u20b9399/month\n");
  writeFileSync(join(root, "app.js"), "const x = '\u20b9399'"); // gy-53qq5.1 M4: scripts are read now, not a named gap
  assert.deepEqual(findBuiltPrices(root), [{ file: "alternatives/akton/", count: 2 }, { file: "app.js", count: 1 }, { file: "llms.txt", count: 1 }, { file: "pricing.md", count: 2 }]);
  assert.throws(() => findBuiltPrices(join(root, "nope")), /does not exist/, "a missing dist is an error, not an empty list");
});

test("PRICE PIN gy-53qq5: the 399 -> 449 drill. A bumped price goes RED on every listed built file (llms.txt and pricing.md included); the unbumped build is GREEN", () => {
  const canon = loadCanonical(REAL), reg = loadPriceSurfaces(REAL);
  const dist = fixtureDist(canon);
  assert.deepEqual(checkBuiltPricePin(canon.doc.facts, reg, dist), [], "control: the fixture build states every pinned price, so it is green");
  const drifted = { ...canon.doc.facts, monthlyINR: 449 };
  const red = checkBuiltPricePin(drifted, reg, dist).filter((f) => f.id === "monthlyINR").map((f) => f.file).sort();
  assert.deepEqual(red, Object.entries(reg.surfaces).filter(([, k]) => k.includes("monthlyINR")).map(([f]) => f).sort(), "every surface pinned to monthlyINR is red, not just the ones the author remembered");
  assert.ok(red.includes("llms.txt") && red.includes("pricing.md"), "the machine-read surfaces are inside the pin");
  assert.deepEqual(priceDrill(canon.doc.facts, reg, dist).missed, [], "the standing drill goes red for every (file, key)");
});

test("PRICE PIN: a page that quotes a current Gymbo price but is not listed FAILS (a new page cannot state the price unwatched); a declared third-party amount is exempt", () => {
  const canon = loadCanonical(REAL), reg = loadPriceSurfaces(REAL);
  const dist = fixtureDist(canon);
  mkdirSync(join(dist, "newpage"), { recursive: true }); writeFileSync(join(dist, "newpage/index.html"), `<p>Only ${rupees(canon.doc.facts.monthlyINR)}/month</p>`);
  const f = checkBuiltPricePin(canon.doc.facts, reg, dist);
  assert.deepEqual(f.map((x) => `${x.kind} ${x.file} ${x.id}`), ["price-unregistered newpage/index.html monthlyINR"]);
  const declared = { ...reg, thirdPartyAmounts: { entries: [{ file: "newpage/index.html", amount: canon.doc.facts.monthlyINR, reason: "competitor at the same figure" }] } };
  assert.deepEqual(checkBuiltPricePin(canon.doc.facts, declared, dist), []);
});

test("PRICE PIN: one stale surface, a wrong Save N%, a missing listed file, a substring amount and a non-integer fact each fail by name", () => {
  const canon = loadCanonical(REAL), reg = loadPriceSurfaces(REAL), F = canon.doc.facts;
  const dist = fixtureDist(canon);
  writeFileSync(join(dist, "pricing.md"), readFileSync(join(dist, "pricing.md"), "utf8").replace(rupees(F.annualINR), rupees(F.annualINR + 500)));
  assert.deepEqual(checkBuiltPricePin(F, reg, dist).map((x) => `${x.kind} ${x.file} ${x.id ?? x.value}`), ["price-stale pricing.md annualINR", `price-unclassified pricing.md ${F.annualINR + 500}`], "the missing price AND the stray new figure are both named");
  const d2 = fixtureDist(canon); writeFileSync(join(d2, "llms.txt"), readFileSync(join(d2, "llms.txt"), "utf8").replace(`Save ${F.annualSavingsPercent}%`, "Save 40%"));
  assert.ok(checkBuiltPricePin(F, reg, d2).some((x) => x.file === "llms.txt" && x.id === "annualSavingsPercent"));
  const d3 = fixtureDist(canon); rmSync(join(d3, "terms/index.html"));
  assert.ok(checkBuiltPricePin(F, reg, d3).some((x) => x.kind === "price-surface-missing" && x.file === "terms/index.html"));
  // a longer amount must not satisfy the pin: \u20b93990 is not \u20b9399, \u20b929990 is not \u20b92,999 (the trailing-digit guard)
  const d4 = fixtureDist(canon); const p4 = join(d4, "llms.txt");
  writeFileSync(p4, readFileSync(p4, "utf8").split(rupees(F.annualINR)).join(`\u20b9${F.annualINR}0`).split(rupees(F.monthlyINR)).join(`\u20b9${F.monthlyINR}0`));
  const k = checkBuiltPricePin(F, reg, d4).filter((x) => x.file === "llms.txt" && x.kind === "price-stale").map((x) => x.id).sort();
  assert.deepEqual(k, ["annualINR", "monthlyINR"], "amounts that merely START WITH the ruled digits do not count");
  assert.throws(() => checkBuiltPricePin(F, reg, join(dist, "nope")), /does not exist/);
  assert.equal(checkBuiltPricePin({ ...F, monthlyINR: "399" }, reg, dist)[0].kind, "price-fact-missing", "a non-integer fact fails closed");
});

test("PRICE PIN M1/M2 (tester 09-26): the split-tag and alternate-spelling forms are READ, so an unlisted page cannot state the price in them unwatched", () => {
  const canon = loadCanonical(REAL), reg = loadPriceSurfaces(REAL), F = canon.doc.facts;
  const M = F.monthlyINR, A = F.annualINR, g = (n) => Number(n).toLocaleString("en-IN");
  const forms = {
    "react split tag": `<span>\u20b9<!-- -->${M}</span>`,
    "comment holding a >": `<span>\u20b9<!-- a > b -->${M}</span>`,
    "tag between sign and digits": `<b>\u20b9</b><b>${M}</b>`,
    "Rs.": `<meta content="flat Rs.${M}/mo">`, "Rs space": `<p>Rs ${M}</p>`, "INR": `<p>INR ${M}</p>`,
    "rupees after": `<p>${M} rupees a month</p>`, "sign then space": `<p>\u20b9 ${M}</p>`,
    "entity sign": `<p>&#8377;${M}</p>`, "nbsp": `<p>\u20b9&nbsp;${M}</p>`,
    "annual no comma": `<p>\u20b9${A}</p>`, "annual Rs": `<p>Rs.${g(A)}</p>`,
  };
  for (const [name, html] of Object.entries(forms)) {
    const dist = fixtureDist(canon); mkdirSync(join(dist, "newpage"), { recursive: true }); writeFileSync(join(dist, "newpage/index.html"), html);
    const f = checkBuiltPricePin(F, reg, dist).filter((x) => x.file === "newpage/index.html");
    assert.equal(f.length >= 1 && f.every((x) => x.kind === "price-unregistered"), true, `${name}: an unlisted page stating the price in this form must FAIL, got ${JSON.stringify(f)}`);
  }
  // NEGATIVES: near-misses that are not the price must stay quiet (no false alarm from the wider reader).
  const quiet = [`<p>\u20b9${M}0</p>`, `<p>\u20b91,${M}</p>`, `<p>Rs.1${M}</p>`, `<p>${M}0 rupees</p>`, `<p>cars ${M}</p>`, `<p>version ${M} of the guide</p>`, `<p>\u20b9${M}.50</p>`];
  for (const html of quiet) {
    const dist = fixtureDist(canon); mkdirSync(join(dist, "newpage"), { recursive: true }); writeFileSync(join(dist, "newpage/index.html"), html);
    assert.deepEqual(checkBuiltPricePin(F, reg, dist).filter((x) => x.file === "newpage/index.html"), [], `${html} is not the ruled price`);
  }
  // a LISTED file whose only monthly mention is the split-tag form still satisfies the pin, and goes red when the price is bumped.
  const dist = fixtureDist(canon), p = join(dist, "compare/gymbo-vs-wellnessz/index.html");
  writeFileSync(p, readFileSync(p, "utf8").split(rupees(M)).join(`\u20b9<!-- -->${M}`).split(rupees(F.annualMonthlyEquivalentINR)).join(`\u20b9<span>${F.annualMonthlyEquivalentINR}</span>`));
  assert.deepEqual(checkBuiltPricePin(F, reg, dist), [], "control: split-tag amounts on a listed page are read, not reported stale");
  assert.ok(checkBuiltPricePin({ ...F, monthlyINR: M + 50 }, reg, dist).some((x) => x.file === "compare/gymbo-vs-wellnessz/index.html" && x.id === "monthlyINR"), "and a bumped price is still red on that page");
  assert.deepEqual(priceDrill(F, reg, dist).missed, [], "the standing drill still goes red for every (file, key) with split tags in the build");
});

test("PRICE PIN control: a listed page that already states the DRIFTED amount blinds the pin, and the standing drill says so instead of a green", () => {
  const canon = loadCanonical(REAL), reg = loadPriceSurfaces(REAL), F = canon.doc.facts;
  const dist = fixtureDist(canon);
  assert.deepEqual(priceDrill(F, reg, dist).missed, [], "control: clean fixture, no blind spot");
  const p = join(dist, "llms.txt"); writeFileSync(p, readFileSync(p, "utf8") + `\ncompetitor: ${rupees(F.monthlyINR + 37)}\n`);
  assert.deepEqual(priceDrill(F, reg, dist).missed, ["llms.txt|monthlyINR"]);
  const r = spawnSync(process.execPath, [SCRIPT, "--root", dist, "--today", "2026-09-24"], { encoding: "utf8" });
  assert.equal(r.status, 1); assert.match(r.stderr, /price-pin-blind.*did NOT go red for 1 listed \(file,key\) or occurrence\(s\).*llms\.txt\|monthlyINR/);
  assert.match(r.stderr, /price-unclassified.*llms\.txt states "\u20b9436"/, "the undeclared figure is also named on its own");
});

test("CLI end to end: the real gate goes RED on a stale price and prints the drill result on green", () => {
  const dist = fixtureDist(loadCanonical(REAL));
  const ok = spawnSync(process.execPath, [SCRIPT, "--root", dist, "--today", "2026-09-24"], { encoding: "utf8" });
  assert.equal(ok.status, 0, ok.stderr + ok.stdout);
  assert.match(ok.stdout, /PRICE PIN \(gy-53qq5\): \d+ built file\(s\) pinned.*went RED on (\d+) of \1 listed/);
  assert.match(ok.stdout, /DECLARED UNREAD/);
  writeFileSync(join(dist, "llms.txt"), readFileSync(join(dist, "llms.txt"), "utf8").replace("\u20b9399", "\u20b9449"));
  const bad = spawnSync(process.execPath, [SCRIPT, "--root", dist, "--today", "2026-09-24"], { encoding: "utf8" });
  assert.equal(bad.status, 1); assert.match(bad.stderr, /price-stale monthlyINR.*llms\.txt does not state \u20b9399/);
});

// ---- gy-53qq5 M1 + M2 (tester's attack2): every spelling of an amount is one amount ----
const FORMS = (n) => { const g = Number(n).toLocaleString("en-IN"); return [`\u20b9${g}`, `\u20b9<!-- -->${g}`, `\u20b9<!-- --> ${g}`, `\u20b9 ${g}`, `\u20b9\u00a0${g}`, `&#8377;${g}`, `\u20b9<span>${g}</span>`, `Rs.${g}`, `Rs ${g}`, `Rs. ${g}`, `INR ${g}`, `INR${g}`, `${g} rupees`, `\u20b9${n}`, `Rs.${n}`]; };
const occ = (t) => priceOccurrences(priceText(t, "x.html")); // the gate normalises (comments, tags, entities) BEFORE it reads amounts
test("M1/M2 NORMALISER: every spelling reads as the same amount; a non-amount does not", () => {
  for (const f of FORMS(399)) assert.deepEqual(occ(f).map((o) => o.value), [399], f);
  for (const f of FORMS(2999)) assert.deepEqual(occ(f).map((o) => o.value), [2999], f);
  assert.deepEqual(occ("\u20b9<!-- a > b -->399").map((o) => o.value), [399], "a comment that itself contains '>' is skipped as a comment, not cut as a tag");
  assert.deepEqual(occ("\u20b9<!-- x -->\u00a0&nbsp;&#160;399").map((o) => o.value), [399], "any mix of whitespace-like padding");
  assert.deepEqual(occ("\u20b9399, or \u20b92,999/year; Rs.250/mo").map((o) => o.value), [399, 2999, 250]);
  assert.deepEqual(occ('"priceCurrency":"INR","price":"399"').map((o) => o.value), [], "a bare JSON-LD price has no marker in front of it (copy-facts.spec.ts guards that one)");
  assert.deepEqual(occ("SINR 399 and RsX 399 and words 399"), [], "the marker must be a whole token");
});

test("M1/M2 UNLISTED PAGE: every spelling of a current Gymbo price is price-unregistered (was GREEN for all of them)", () => {
  const canon = loadCanonical(REAL), reg = loadPriceSurfaces(REAL), F = canon.doc.facts;
  for (const [key, val] of [["monthlyINR", F.monthlyINR], ["annualINR", F.annualINR], ["annualMonthlyEquivalentINR", F.annualMonthlyEquivalentINR]]) for (const form of FORMS(val)) {
    const dist = fixtureDist(canon); mkdirSync(join(dist, "newpage"), { recursive: true }); writeFileSync(join(dist, "newpage/index.html"), `<p>Only ${form}</p>`);
    assert.deepEqual(checkBuiltPricePin(F, reg, dist).map((x) => `${x.kind} ${x.file} ${x.id}`), [`price-unregistered newpage/index.html ${key}`], form);
  }
});

test("M1/M2 REGRESSION OF tester's attack2: a careful plain-text 399 -> 449 update that leaves the React-split and 'Rs.' forms goes RED naming each one", () => {
  const canon = loadCanonical(REAL), reg = loadPriceSurfaces(REAL), F = canon.doc.facts;
  const dist = fixtureDist(canon), cmp = join(dist, "compare/gymbo-vs-wellnessz/index.html");
  mkdirSync(join(dist, "compare/gymbo-vs-wellnessz"), { recursive: true });
  const body = `<meta name="description" content="flat Rs.399"><p>\u20b9<!-- -->399/mo (\u20b9<!-- -->250/mo annual)</p><p>\u20b9399 flat</p><p>Rs.399/mo</p>`;
  writeFileSync(cmp, body);
  assert.deepEqual(checkBuiltPricePin(F, reg, dist).filter((x) => x.file.startsWith("compare/")), [], "control: at the ruled 399 the page is green in every form");
  const prep = (t) => t.replace(/\u20b9399(?![\d,])/g, "\u20b9449");           // tester's PREP: plain text only
  writeFileSync(cmp, prep(readFileSync(cmp, "utf8")));
  const red = checkBuiltPricePin({ ...F, monthlyINR: 449 }, reg, dist).filter((x) => x.kind === "price-unclassified" && x.file.startsWith("compare/"));
  assert.deepEqual(red.map((x) => x.form).sort(), ["Rs.399", "Rs.399", "\u20b9399"].sort(), "the split form (shown as read, comment dropped) and both Rs. forms are named; the updated plain one is not");
  assert.equal(checkBuiltPricePin({ ...F, monthlyINR: 449 }, reg, dist).filter((x) => x.kind === "price-stale" && x.file.startsWith("compare/")).length, 0, "presence of the new amount alone was the old pass; it no longer decides");
});

test("M3 (gy-53qq5.1) PRESENCE IS VISIBLE: a listed page whose only statement of the ruled price sits in a tag attribute (meta, alt) or a script FAILS as price-stale; the same amount in the body passes", () => {
  const canon = loadCanonical(REAL), reg = loadPriceSurfaces(REAL), F = canon.doc.facts, key = "monthlyINR";
  const f = "blog/how-india-independent-trainers-run-their-business/index.html";   // pinned to monthlyINR only
  const page = (inner) => `<!doctype html><html><head><title>t</title></head><body>${inner}</body></html>`;
  const cases = {
    "meta attribute only": page(`<meta name="description" content="Only ${rupees(F.monthlyINR)}/month"><p>Pricing is on the pricing page.</p>`),
    "img alt only": page(`<img src="a.png" alt="Just ${rupees(F.monthlyINR)}/month"><p>Pricing is on the pricing page.</p>`),
    "script only": page(`<script type="application/ld+json">{"description":"${rupees(F.monthlyINR)}/month"}</script><p>Pricing is on the pricing page.</p>`),
    "comment holding a > before the price": page(`<!-- a > b ${rupees(F.monthlyINR)}/month --><p>Pricing is on the pricing page.</p>`),
    "html comment only": page(`<!-- ${rupees(F.monthlyINR)}/month --><p>Pricing is on the pricing page.</p>`),
  };
  for (const [name, html] of Object.entries(cases)) {
    const dist = fixtureDist(canon); mkdirSync(join(dist, "blog/how-india-independent-trainers-run-their-business"), { recursive: true }); writeFileSync(join(dist, f), html);
    const r = checkBuiltPricePin(F, reg, dist).filter((x) => x.file === f);
    assert.deepEqual(r.map((x) => `${x.kind} ${x.id}`), [`price-stale ${key}`], `${name}: the amount is not in visible text, so the pin must not count it`);
  }
  const dist = fixtureDist(canon); mkdirSync(join(dist, "blog/how-india-independent-trainers-run-their-business"), { recursive: true });
  writeFileSync(join(dist, f), page(`<meta name="description" content="Only ${rupees(F.monthlyINR)}/month"><p>Only ${rupees(F.monthlyINR)}/month</p>`));
  assert.deepEqual(checkBuiltPricePin(F, reg, dist).filter((x) => x.file === f), [], "control: the same amount in the body passes (and the attribute copy is still classified, not ignored)");
  writeFileSync(join(dist, f), page(`<p>Only ${rupees(F.monthlyINR)}/month</p><meta name="description" content="Only ${rupees(F.monthlyINR + 1)}/month">`));
  assert.ok(checkBuiltPricePin(F, reg, dist).some((x) => x.file === f && x.kind === "price-unclassified"), "an attribute still gets classified: a stale amount hidden in a meta is not exempt");
});

test("M3 (gy-53qq5.1) A DECLARATION AT A CURRENT PRICE HIDES IT: a third-party entry on a LISTED file whose amount equals a ruled Gymbo price FAILS; on an unlisted file it stays allowed", () => {
  const canon = loadCanonical(REAL), reg = loadPriceSurfaces(REAL), F = canon.doc.facts;
  const dist = fixtureDist(canon);
  const listed = Object.keys(reg.surfaces)[0];
  const collide = { ...reg, thirdPartyAmounts: { entries: [...reg.thirdPartyAmounts.entries, { file: listed, amount: F.monthlyINR, reason: "test: competitor at the same figure" }] } };
  const r = checkBuiltPricePin(F, collide, dist).filter((x) => x.kind === "price-declared-collides-current");
  assert.deepEqual(r.map((x) => `${x.file} ${x.value}`), [`${listed} ${F.monthlyINR}`], "the declaration is named");
  const unlisted = { ...reg, thirdPartyAmounts: { entries: [...reg.thirdPartyAmounts.entries, { file: "newpage/index.html", amount: F.monthlyINR, reason: "competitor at the same figure" }] } };
  assert.deepEqual(checkBuiltPricePin(F, unlisted, dist).filter((x) => x.kind === "price-declared-collides-current"), [], "an unlisted page may still declare a third-party amount at the same figure (nothing is pinned there to hide)");
  assert.deepEqual(checkBuiltPricePin(F, reg, dist).filter((x) => x.kind === "price-declared-collides-current"), [], "control: the real registry has no collision today");
});

test("M5 (gy-53qq5.1) SAVINGS PERCENT IN EVERY PHRASING: a wrong percent beside any saving word FAILS on a listed and an unlisted page; the ruled percent, and unrelated percentages, stay quiet", () => {
  const canon = loadCanonical(REAL), reg = loadPriceSurfaces(REAL), F = canon.doc.facts, P = F.annualSavingsPercent, W = P + 1;
  const phrasings = (n) => [`${n}% savings`, `Save up to ${n} percent`, `${n}% off the annual plan`, `${n}% cheaper`, `Saving ${n} %`, `save ${n}%`, `Save ${n}%`, `${n} per cent discount`, `SAVE ${n}%`];
  for (const form of phrasings(W)) for (const [where, file, wrap] of [["listed", "llms.txt", (t) => `\n${t}\n`], ["unlisted", "newpage/index.html", (t) => `<p>${t}</p>`]]) {
    const dist = fixtureDist(canon); const p = join(dist, file); mkdirSync(join(dist, "newpage"), { recursive: true });
    if (where === "listed") writeFileSync(p, readFileSync(p, "utf8") + wrap(form)); else writeFileSync(p, wrap(form));
    const r = checkBuiltPricePin(F, reg, dist).filter((x) => x.file === file && x.id === "annualSavingsPercent");
    assert.equal(r.length, 1, `${where} '${form}': a percent that is not the ruled ${P} must be flagged once, got ${JSON.stringify(r)}`);
  }
  for (const form of phrasings(P)) {
    const dist = fixtureDist(canon); const p = join(dist, "llms.txt"); writeFileSync(p, readFileSync(p, "utf8") + `\n${form}\n`);
    assert.deepEqual(checkBuiltPricePin(F, reg, dist), [], `control: '${form}' is the ruled percent and passes`);
  }
  for (const quiet of ["Verified 90-day client drop-off ~60% of clients", "clients drop off 60% of the time", "about 60% of clients drop off within 90 days", "28% self-employed", "a lower churn of 12%", "7% GST", "reduces admin time by 40%"]) {
    const dist = fixtureDist(canon); mkdirSync(join(dist, "newpage"), { recursive: true }); writeFileSync(join(dist, "newpage/index.html"), `<p>${quiet}</p>`);
    assert.deepEqual(checkBuiltPricePin(F, reg, dist).filter((x) => x.file === "newpage/index.html"), [], `'${quiet}' is not a savings claim`);
  }
  // presence: a pinned file may state the percent as '37% savings' alone (it used to require the literal 'Save 37%')
  const dist = fixtureDist(canon); const p = join(dist, "llms.txt"); writeFileSync(p, readFileSync(p, "utf8").replace(`Save ${P}%`, `${P}% savings`));
  assert.deepEqual(checkBuiltPricePin(F, reg, dist).filter((x) => x.file === "llms.txt"), [], "the ruled percent in another phrasing satisfies the pin");
  // a declared third-party percent is exempt for that page only
  const d2 = fixtureDist(canon); mkdirSync(join(d2, "newpage"), { recursive: true }); writeFileSync(join(d2, "newpage/index.html"), "<p>Rival: 20% off annual</p>");
  assert.equal(checkBuiltPricePin(F, reg, d2).filter((x) => x.file === "newpage/index.html").length, 1, "control: undeclared, flagged");
  const decl = { ...reg, thirdPartyAmounts: { entries: [...reg.thirdPartyAmounts.entries, { file: "newpage/index.html", amount: 20, unit: "percent", reason: "competitor's advertised discount" }] } };
  assert.deepEqual(checkBuiltPricePin(F, decl, d2).filter((x) => x.file === "newpage/index.html"), [], "declared with unit percent and a reason: exempt on that page");
});

test("M5 (gy-53qq5.1) two seams: a percent declaration never exempts a rupee amount; the savings claim must be VISIBLE on a page pinned to it", () => {
  const canon = loadCanonical(REAL), reg = loadPriceSurfaces(REAL), F = canon.doc.facts, P = F.annualSavingsPercent;
  const dist = fixtureDist(canon); mkdirSync(join(dist, "newpage"), { recursive: true }); writeFileSync(join(dist, "newpage/index.html"), `<p>Only ${rupees(F.monthlyINR)}/month</p>`);
  const leak = { ...reg, thirdPartyAmounts: { entries: [...reg.thirdPartyAmounts.entries, { file: "newpage/index.html", amount: F.monthlyINR, unit: "percent", reason: "test: a PERCENT declaration at the same digits" }] } };
  assert.deepEqual(checkBuiltPricePin(F, leak, dist).filter((x) => x.file === "newpage/index.html").map((x) => x.kind), ["price-unregistered"], "a percent entry does not exempt the rupee amount with the same digits");
  const idx = join(dist, "index.html"), price = (n) => `<p>${rupees(n)}</p>`;
  const body = `${price(F.monthlyINR)}${price(F.annualINR)}${price(F.annualMonthlyEquivalentINR)}`;
  writeFileSync(idx, `<html><head><meta name="description" content="Save ${P}%"></head><body>${body}</body></html>`);
  assert.deepEqual(checkBuiltPricePin(F, reg, dist).filter((x) => x.file === "index.html").map((x) => `${x.kind} ${x.id}`), ["price-stale annualSavingsPercent"], "index is pinned to the percent, and a claim only in a meta is not on the page");
  writeFileSync(idx, `<html><head><meta name="description" content="Save ${P}%"></head><body>${body}<p>Save ${P}%</p></body></html>`);
  assert.deepEqual(checkBuiltPricePin(F, reg, dist).filter((x) => x.file === "index.html"), [], "control: the same claim in the body passes");
});

test("M6 (gy-53qq5.1) A RETIRED PRICE ON AN UNLISTED PAGE: after a bump, a former Gymbo price on any page that is not pinned FAILS (was GREEN); a declared third-party figure and a listed page are not double-flagged", () => {
  const canon = loadCanonical(REAL), reg = loadPriceSurfaces(REAL), F = canon.doc.facts, OLD = F.monthlyINR, NEW = OLD + 50;
  const F2 = { ...F, monthlyINR: NEW };
  const ledger = (retired) => ({ ruled: { monthlyINR: NEW, annualINR: F.annualINR, annualMonthlyEquivalentINR: F.annualMonthlyEquivalentINR }, retired });
  const withLedger = (r) => ({ ...reg, priceLedger: ledger(r) });
  const forms = { "plain": `<p>Only ${rupees(OLD)}/month</p>`, "Rs.": `<p>Rs.${OLD}/mo</p>`, "react split": `<p>\u20b9<!-- -->${OLD}</p>`, "rupees after": `<p>${OLD} rupees</p>`, "meta attr": `<meta name="d" content="${rupees(OLD)}">` };
  for (const [name, html] of Object.entries(forms)) {
    const dist = fixtureDist(canon); mkdirSync(join(dist, "oldpage"), { recursive: true }); writeFileSync(join(dist, "oldpage/index.html"), html);
    const before = checkBuiltPricePin(F2, reg, dist).filter((x) => x.file === "oldpage/index.html");
    assert.deepEqual(before, [], `${name}: control, WITHOUT a retired ledger the old price on an unlisted page passes (the M6 miss, measured)`);
    const after = checkBuiltPricePin(F2, withLedger([{ amount: OLD, was: "monthlyINR", note: "test" }]), dist).filter((x) => x.file === "oldpage/index.html");
    assert.deepEqual(after.map((x) => `${x.kind} ${x.value}`), [`price-retired-amount ${OLD}`], `${name}: a retired amount on an unlisted page must FAIL once`);
  }
  const dist = fixtureDist(canon); mkdirSync(join(dist, "oldpage"), { recursive: true }); writeFileSync(join(dist, "oldpage/index.html"), forms.plain);
  const decl = { ...withLedger([{ amount: OLD, was: "monthlyINR" }]), thirdPartyAmounts: { entries: [...reg.thirdPartyAmounts.entries, { file: "oldpage/index.html", amount: OLD, reason: "a competitor at the same figure" }] } };
  assert.deepEqual(checkBuiltPricePin(F2, decl, dist).filter((x) => x.file === "oldpage/index.html"), [], "declared third-party at the retired figure: exempt on that page only");
  const doubled = checkBuiltPricePin(F2, withLedger([{ amount: OLD, was: "monthlyINR" }]), dist).filter((x) => reg.surfaces[x.file] && x.kind === "price-retired-amount");
  assert.deepEqual(doubled, [], "a LISTED page already fails as price-unclassified; it is not flagged twice");
  const cur = fixtureDist(canon); mkdirSync(join(cur, "newpage"), { recursive: true }); writeFileSync(join(cur, "newpage/index.html"), `<p>Only ${rupees(NEW)}/month</p>`);
  assert.deepEqual(checkBuiltPricePin(F2, withLedger([{ amount: NEW, was: "monthlyINR" }]), cur).filter((x) => x.file === "newpage/index.html").map((x) => x.kind), ["price-unregistered"], "an amount that is a CURRENT price again is treated as current (unregistered), never as retired");
  const twice = fixtureDist(canon); mkdirSync(join(twice, "oldpage"), { recursive: true }); writeFileSync(join(twice, "oldpage/index.html"), `<p>${rupees(OLD)} a month</p><p>Rs.${OLD} flat</p><p>${OLD} rupees</p>`);
  assert.equal(checkBuiltPricePin(F2, withLedger([{ amount: OLD, was: "monthlyINR" }]), twice).filter((x) => x.file === "oldpage/index.html" && x.kind === "price-retired-amount").length, 1, "the same retired amount stated three times on one page is ONE finding, not three");
  const md = fixtureDist(canon); writeFileSync(join(md, "old.md"), `Only ${rupees(OLD)}/month`);
  assert.equal(checkBuiltPricePin(F2, withLedger([{ amount: OLD, was: "monthlyINR" }]), md).filter((x) => x.file === "old.md" && x.kind === "price-retired-amount").length, 1, "a markdown/text surface (llms.txt-style) is read too");
});

test("M6 LEDGER: content's facts must equal the ledger the registry was reconciled to, so a bump cannot land without retiring the old price", () => {
  const canon = loadCanonical(REAL), reg = loadPriceSurfaces(REAL), F = canon.doc.facts;
  assert.deepEqual(checkPriceLedger(F, reg), [], "control: the real registry's ledger matches the real facts");
  const bumped = checkPriceLedger({ ...F, monthlyINR: F.monthlyINR + 50, annualINR: F.annualINR + 1 }, reg);
  assert.deepEqual(bumped.map((x) => `${x.kind} ${x.id}`).sort(), ["price-ledger-behind annualINR", "price-ledger-behind monthlyINR"], "every drifted price is named");
  assert.match(bumped[0].detail, /retired/i, "the finding says what to do");
  assert.deepEqual(checkPriceLedger(F, { ...reg, priceLedger: undefined }).map((x) => x.kind), ["price-ledger-missing"], "no ledger fails closed");
  assert.deepEqual(checkPriceLedger(F, { ...reg, priceLedger: { ruled: { monthlyINR: F.monthlyINR }, retired: [] } }).map((x) => `${x.kind} ${x.id}`).sort(), ["price-ledger-behind annualINR", "price-ledger-behind annualMonthlyEquivalentINR"], "a ruled key the ledger does not record is behind, not skipped");
  const live = checkPriceLedger(F, { ...reg, priceLedger: { ...reg.priceLedger, retired: [{ amount: F.monthlyINR, was: "monthlyINR" }] } });
  assert.deepEqual(live.map((x) => x.kind), ["price-ledger-retired-is-current"], "retiring a live price would hide it: refused");
  assert.deepEqual(checkPriceLedger(F, { ...reg, priceLedger: { ...reg.priceLedger, retired: [{ was: "monthlyINR" }] } }).map((x) => x.kind), ["price-ledger-bad-entry"], "a retired entry without an integer amount is refused");
});

test("M6 CLI end to end: a bumped fact with the ledger left behind fails the REAL gate and names the fix; the real ledger passes", () => {
  const dist = fixtureDist(loadCanonical(REAL));
  const canon = mkdtempSync(join(scratch, "canon-")); cpSync(REAL, canon, { recursive: true });
  const ok = spawnSync(process.execPath, [SCRIPT, "--canon", canon, "--root", dist, "--today", "2026-09-24"], { encoding: "utf8" });
  assert.equal(ok.status, 0, ok.stderr + ok.stdout);
  const f = join(canon, "price-surfaces.json"), j = JSON.parse(readFileSync(f, "utf8")); j.priceLedger.ruled.monthlyINR += 50; writeFileSync(f, JSON.stringify(j));
  const bad = spawnSync(process.execPath, [SCRIPT, "--canon", canon, "--root", dist, "--today", "2026-09-24"], { encoding: "utf8" });
  assert.equal(bad.status, 1); assert.match(bad.stderr, /price-ledger-behind monthlyINR.*retired/i);
});

test("M4 (gy-53qq5.1) EVERY SHIPPED TEXT FILE IS READ: the current price in an unlisted .js/.mjs/.css/.svg/.webmanifest FAILS, including an svg split across tspans", () => {
  const canon = loadCanonical(REAL), reg = loadPriceSurfaces(REAL), F = canon.doc.facts, M = F.monthlyINR;
  const forms = {
    "stale.js": `x="${rupees(M)}/month"`, "stale.mjs": `export const p = "Rs.${M}"`, "stale.css": `a::after{content:"${rupees(M)}"}`,
    "stale.svg": `<svg><text>\u20b9<tspan>${M}</tspan>/month</text></svg>`, "stale.webmanifest": `{"description":"Only ${rupees(M)}/month"}`,
    "assets/lazy-Ab3dEf9h.js": `const a="\\u20b9${M}"`,   // a JSON/JS-escaped rupee sign in a hashed chunk
  };
  for (const [file, body] of Object.entries(forms)) {
    const dist = fixtureDist(canon); mkdirSync(join(dist, "assets"), { recursive: true }); writeFileSync(join(dist, file), body);
    const r = checkBuiltPricePin(F, reg, dist).filter((x) => x.kind === "price-unregistered");
    assert.equal(r.length, 1, `${file}: an unlisted file stating the current price must FAIL, got ${JSON.stringify(r.map((x) => x.file))}`);
  }
  const dist = fixtureDist(canon); writeFileSync(join(dist, "stale.js"), "x=1;var y='no price here'");
  assert.deepEqual(checkBuiltPricePin(F, reg, dist), [], "control: a .js that states no price is green");
});

test("M4 HASHED CHUNKS: a registry key names a bundle WITHOUT its build hash, so the pin survives a rebuild; two files that reduce to one name fail closed", () => {
  const canon = loadCanonical(REAL), F = canon.doc.facts;
  const reg = { surfaces: { "assets/terms.js": ["monthlyINR", "annualINR"] }, thirdPartyAmounts: { entries: [] } };
  const mk = (hash) => { const d = mkdtempSync(join(scratch, "hash-")); mkdirSync(join(d, "assets"), { recursive: true }); writeFileSync(join(d, `assets/terms-${hash}.js`), `p="${rupees(F.monthlyINR)} ${rupees(F.annualINR)}"`); return d; };
  assert.deepEqual(checkBuiltPricePin(F, reg, mk("6GmOuVPd")), [], "the pin matches the chunk under one hash");
  assert.deepEqual(checkBuiltPricePin(F, reg, mk("Zz9-_aBc")), [], "and under another (the next build)");
  const red = checkBuiltPricePin({ ...F, monthlyINR: F.monthlyINR + 50 }, reg, mk("6GmOuVPd")).filter((x) => x.kind === "price-stale");
  assert.deepEqual(red.map((x) => `${x.file} ${x.id}`), ["assets/terms.js monthlyINR"], "a bumped price goes red on the chunk, named without the hash");
  const dup = mk("6GmOuVPd"); writeFileSync(join(dup, "assets/terms-Ab3dEf9h.js"), "x");
  assert.throws(() => checkBuiltPricePin(F, reg, dup), /both reduce to|same built name/i, "two chunks with one hash-stripped name are ambiguous: fail closed");
  const gone = mkdtempSync(join(scratch, "hash-")); mkdirSync(join(gone, "assets"), { recursive: true });
  assert.ok(checkBuiltPricePin(F, reg, gone).some((x) => x.kind === "price-surface-missing" && x.file === "assets/terms.js"), "a listed chunk that is not in the build is reported by its hash-free name");
});

test("M4 builtName: a build hash is stripped only from an assets/ file whose 8-character tail looks like a hash; nothing else is renamed", () => {
  const cases = {
    "assets/terms-6GmOuVPd.js": "assets/terms.js", "assets/alternatives-main-4sIo2GwD.js": "assets/alternatives-main.js",
    "assets/index-Zz9-_aBc.css": "assets/index.css", "assets/deep/x-Ab3dEf9h.mjs": "assets/deep/x.mjs",
    "assets/data-analysis.js": "assets/data-analysis.js",      // 8 lowercase letters: a word, not a hash
    "other/terms-6GmOuVPd.js": "other/terms-6GmOuVPd.js",      // outside assets/: left alone
    "assets/logo.svg": "assets/logo.svg", "index.html": "index.html", "assets/terms-6GmOuVP.js": "assets/terms-6GmOuVP.js", // 7 chars: not a hash
    "assets/terms-6GmOuVPdX.js": "assets/terms-6GmOuVPdX.js",  // 9 chars: not a hash
  };
  for (const [from, to] of Object.entries(cases)) assert.equal(builtName(from), to, from);
});

test("M4 REAL REGISTRY: the two bundles that state Gymbo's price on the real build are pinned", () => {
  const reg = loadPriceSurfaces(REAL);
  assert.deepEqual(Object.keys(reg.surfaces).filter((k) => k.startsWith("assets/")).sort(), ["assets/terms.js", "assets/trialAccess.js"], "terms-*.js and trialAccess-*.js state the price (measured on dist 09-26) and are pinned");
});

test("R1 (gy-53qq5.1) HIDDEN TEXT IS NOT PRESENCE: a pinned price kept only in a hidden element FAILS; a hidden STALE price is still classified; look-alikes that are visible pass", () => {
  const canon = loadCanonical(REAL), reg = loadPriceSurfaces(REAL), F = canon.doc.facts, key = "monthlyINR", P = rupees(F.monthlyINR);
  const f = "blog/how-india-independent-trainers-run-their-business/index.html";   // pinned to monthlyINR only
  const run = (inner) => { const dist = fixtureDist(canon); mkdirSync(join(dist, "blog/how-india-independent-trainers-run-their-business"), { recursive: true }); writeFileSync(join(dist, f), `<!doctype html><html><head><title>t</title></head><body>${inner}</body></html>`); return checkBuiltPricePin(F, reg, dist).filter((x) => x.file === f); };
  const visible = "<p>Pricing is on the pricing page.</p>";
  const hidden = {
    "hidden attribute": `<div hidden>${P}/month</div>`, "hidden=\"\"": `<div hidden="">${P}/month</div>`, "hidden=until-found": `<div hidden="until-found">${P}/month</div>`,
    "display:none": `<div style="display:none">${P}/month</div>`, "display: none;": `<span style='display: none;'>${P}/month</span>`, "display:none among others": `<p style="color:red;display:none;margin:0">${P}/month</p>`,
    "visibility:hidden": `<p style="visibility:hidden">${P}/month</p>`, "content-visibility": `<div style="content-visibility:hidden">${P}/month</div>`,
    "nested deep": `<div style="display:none"><ul><li><span>${P}</span></li></ul></div>`, "same-name nesting": `<div hidden><div>x</div>${P}</div>`, "case": `<DIV HIDDEN>${P}</DIV>`, "unquoted style value": `<p style=display:none>${P}</p>`, "mixed-case open and close": `<Div hidden>${P}</dIV>`,
  };
  for (const [name, html] of Object.entries(hidden)) assert.deepEqual(run(visible + html).map((x) => `${x.kind} ${x.id}`), [`price-stale ${key}`], `${name}: the price is not visible, so the pin must not count it`);
  assert.deepEqual(run(`<div hidden>${P}</div>${visible}`).map((x) => x.kind), ["price-stale"], "an unclosed-looking sibling order does not matter");
  const shown = {
    "aria-hidden=true is hidden from assistive tech, NOT from a sighted reader": `<p aria-hidden="true">${P}/month</p>`, "aria-hidden=false": `<p aria-hidden="false">${P}/month</p>`, "display:block": `<p style="display:block">${P}/month</p>`, "class name only": `<p class="hidden-xs">${P}/month</p>`,
    "data attribute": `<p data-hidden="x">${P}/month</p>`, "title says hidden": `<p title="hidden fee">${P}/month</p>`, "after a closed hidden block": `<div hidden>x</div><p>${P}/month</p>`, "mixed-case close tag still closes the hidden block": `<Div hidden>x</dIV><p>${P}/month</p>`, "non-void self-closing hidden element opens no skip": `<span hidden/><p>${P}/month</p>`, "self-closing with space": `<div hidden /><p>${P}/month</p>`, "opacity is not hiding": `<p style="opacity:1">${P}/month</p>`, "invalid display value is ignored by browsers": `<p style="display:none-x">${P}/month</p>`, "prefixed property is a different property": `<p style="x-display:none">${P}/month</p>`, "hidden is not a substring match": `<p data-x="a hidden b" class="hidden">${P}/month</p>`,
  };
  for (const [name, html] of Object.entries(shown)) assert.deepEqual(run(html), [], `${name}: still visible, the pin passes`);
  assert.ok(run(`<p>${P}/month</p><div hidden>${rupees(F.monthlyINR + 1)}/month</div>`).some((x) => x.kind === "price-unclassified"), "a stale amount hidden in a display:none block is still CLASSIFIED (exclusion is for presence only)");
  assert.deepEqual(run(`<input hidden name="p" value="x"><img hidden alt="x" src="a.png"><br hidden><hr hidden><p>${P}/month</p>`), [], "hidden VOID elements (input, img, br, hr) carry no text and must not swallow the rest of the page");
  assert.deepEqual(run(`<div style="display:none"><p>x</p></div><p>${P}/month</p>`), [], "a hidden block closes: text after it is visible again");
  // the HTML void elements, as an INDEPENDENT literal (the source list cannot vouch for itself): a hidden one opens no skip
  for (const v of ["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]) assert.deepEqual(run(`<${v} hidden><p>${P}/month</p>`), [], `<${v} hidden> is void: it must not swallow the rest of the page`);
});

test("R2 (gy-53qq5.1) PHRASING BREADTH: a saving verb with filler words before the number, a hyphenated 'N%-off', and 'pct' are read; sentence boundaries and non-savings percents stay quiet", () => {
  const canon = loadCanonical(REAL), reg = loadPriceSurfaces(REAL), F = canon.doc.facts, P = F.annualSavingsPercent, W = P + 1;
  const forms = (n) => [`annual billing saves you ${n}%`, `Save an extra ${n}%`, `Save a full ${n}%`, `Saves you up to ${n} percent`, `save as much as ${n}%`, `You save an additional ${n}%`, `saved ${n}%`, `cheaper by ${n}%`, `${n}%-off annual plan`, `save ${n} pct`, `${n} pct savings`, `Saving you a whopping ${n}%`];
  for (const form of forms(W)) {
    const dist = fixtureDist(canon); mkdirSync(join(dist, "newpage"), { recursive: true }); writeFileSync(join(dist, "newpage/index.html"), `<p>${form}</p>`);
    const r = checkBuiltPricePin(F, reg, dist).filter((x) => x.file === "newpage/index.html" && x.id === "annualSavingsPercent");
    assert.equal(r.length, 1, `'${form}': a percent that is not the ruled ${P} must be flagged once, got ${JSON.stringify(r)}`);
  }
  for (const form of forms(P)) {
    const dist = fixtureDist(canon); const p = join(dist, "llms.txt"); writeFileSync(p, readFileSync(p, "utf8") + `\n${form}\n`);
    assert.deepEqual(checkBuiltPricePin(F, reg, dist), [], `control: '${form}' is the ruled percent and passes`);
  }
  for (const quiet of ["Save. 60% of clients drop off within 90 days", "saves the day. 60% of trainers agree", "saves you 2 hours and 50% of admin", "save time on 60% of tasks", "a full 60% of clients", "an extra 12% of trainers replied", "you save your 5 minutes; 40% churn", "cheaper than Trainerize. 30% of trainers switch"]) {
    const dist = fixtureDist(canon); mkdirSync(join(dist, "newpage"), { recursive: true }); writeFileSync(join(dist, "newpage/index.html"), `<p>${quiet}</p>`);
    assert.deepEqual(checkBuiltPricePin(F, reg, dist).filter((x) => x.file === "newpage/index.html"), [], `'${quiet}' is not a savings claim`);
  }
});

test("R2 VOCABULARY: the declared lists are pinned to independent literals and every word is behaviourally live (a list derived from itself could not fail when an entry is dropped)", () => {
  const canon = loadCanonical(REAL), reg = loadPriceSurfaces(REAL), F = canon.doc.facts, W = F.annualSavingsPercent + 1;
  const WORDS = ["save", "saves", "saved", "saving", "savings", "discount", "cheaper"];
  const FILL = ["you", "your", "an", "a", "the", "up", "to", "upto", "of", "by", "about", "around", "over", "nearly", "almost", "extra", "full", "further", "additional", "another", "more", "as", "much", "whopping", "huge", "than", "at", "least", "roughly", "close", "upwards", "massive"];
  const AFTER = ["savings", "saving", "off", "cheaper", "discount"];
  assert.deepEqual([...SAVING_WORDS].sort(), [...WORDS].sort(), "saving words: change the list and this literal together, on purpose");
  assert.deepEqual([...SAVING_FILLERS].sort(), [...FILL].sort(), "filler words: change the list and this literal together, on purpose");
  assert.deepEqual([...SAVING_AFTER].sort(), [...AFTER].sort(), "after-number words: change the list and this literal together, on purpose");
  const flagged = (text) => { const dist = fixtureDist(canon); mkdirSync(join(dist, "newpage"), { recursive: true }); writeFileSync(join(dist, "newpage/index.html"), `<p>${text}</p>`); return checkBuiltPricePin(F, reg, dist).filter((x) => x.file === "newpage/index.html" && x.id === "annualSavingsPercent").length; };
  for (const w of WORDS) assert.equal(flagged(`${w} ${W}%`), 1, `saving word '${w}' opens a claim`);
  for (const f of FILL) assert.equal(flagged(`save ${f} ${W}%`), 1, `filler '${f}' may sit between the saving word and the number`);
  for (const a of AFTER) assert.equal(flagged(`${W}% ${a}`), 1, `'${a}' after the number closes a claim`);
  assert.equal(flagged(`save quickly ${W}%`), 0, "a word that is not a filler ends the search");
});

test("RESIDUALS (tester R2): 'more than', 'at least', 'roughly', 'close to', 'upwards of' and 'a massive' before the number are read", () => {
  const canon = loadCanonical(REAL), reg = loadPriceSurfaces(REAL), F = canon.doc.facts, P = F.annualSavingsPercent, W = P + 1;
  const forms = (n) => [`Save more than ${n}%`, `saves you at least ${n}%`, `Save roughly ${n}%`, `save close to ${n}%`, `save upwards of ${n}%`, `Save a massive ${n}%`, `You save more than ${n} percent`, `saving at least ${n} pct`];
  for (const form of forms(W)) {
    const dist = fixtureDist(canon); mkdirSync(join(dist, "newpage"), { recursive: true }); writeFileSync(join(dist, "newpage/index.html"), `<p>${form}</p>`);
    assert.equal(checkBuiltPricePin(F, reg, dist).filter((x) => x.file === "newpage/index.html" && x.id === "annualSavingsPercent").length, 1, `'${form}': a percent that is not the ruled ${P} must be flagged once`);
  }
  for (const form of forms(P)) { const dist = fixtureDist(canon); const p = join(dist, "llms.txt"); writeFileSync(p, readFileSync(p, "utf8") + `\n${form}\n`); assert.deepEqual(checkBuiltPricePin(F, reg, dist), [], `control: '${form}' is the ruled percent`); }
  for (const quiet of ["saves you at least 2 hours; 50% of trainers agree", "save more than one afternoon. 60% of clients", "roughly 60% of clients drop off", "more than 40% of trainers reply", "at least 30% of sessions run late", "close to 12% churn"]) {
    const dist = fixtureDist(canon); mkdirSync(join(dist, "newpage"), { recursive: true }); writeFileSync(join(dist, "newpage/index.html"), `<p>${quiet}</p>`);
    assert.deepEqual(checkBuiltPricePin(F, reg, dist).filter((x) => x.file === "newpage/index.html"), [], `'${quiet}' is not a savings claim (no saving word before the number)`);
  }
});

test("RESIDUALS: the stale-percent finding no longer says only 'competitor': a time-saved or other percentage that reads as a saving trips it too, and the text says so", () => {
  const canon = loadCanonical(REAL), reg = loadPriceSurfaces(REAL), F = canon.doc.facts;
  const dist = fixtureDist(canon); mkdirSync(join(dist, "newpage"), { recursive: true }); writeFileSync(join(dist, "newpage/index.html"), "<p>Save 40% of your admin time</p>");
  const r = checkBuiltPricePin(F, reg, dist).find((x) => x.file === "newpage/index.html" && x.id === "annualSavingsPercent");
  assert.ok(r, "a time-saved percentage beside a saving word is flagged (by design: strict until declared)");
  assert.match(r.detail, /time saved|not a price/i, "the text names that case, not only a competitor's discount");
  assert.match(r.detail, /declare/i); assert.match(r.detail, /unit/i);
});

test("NAMED LIMITS: what the price gate deliberately does NOT read is a declared list in the gate, printed on every green run, and each limit is real (measured, not hoped)", () => {
  const LIT = ["less/lower savings phrasings ('Pay 37% less', '37% lower than monthly')", "'You get 37% back' (no saving word)", "hiding by opacity:0, font-size:0, an off-screen or clipped box, or a CSS comment inside style", "a price kept only in the <title> element", "hiding by a class name (a stylesheet is not read)", "Devanagari digits and text inside images"];
  assert.deepEqual(NAMED_LIMITS, LIT, "the list is pinned to an independent literal: change both on purpose");
  const canon = loadCanonical(REAL), reg = loadPriceSurfaces(REAL), F = canon.doc.facts, W = F.annualSavingsPercent + 1;
  const flagged = (text) => { const dist = fixtureDist(canon); mkdirSync(join(dist, "newpage"), { recursive: true }); writeFileSync(join(dist, "newpage/index.html"), `<p>${text}</p>`); return checkBuiltPricePin(F, reg, dist).filter((x) => x.file === "newpage/index.html").length; };
  assert.equal(flagged(`Pay ${W}% less`), 0, "limit 1 is real: 'less' is not read");
  assert.equal(flagged(`${W}% lower than monthly`), 0, "limit 1 is real: 'lower' is not read");
  assert.equal(flagged(`You get ${W}% back`), 0, "limit 2 is real");
  const pinned = "blog/how-india-independent-trainers-run-their-business/index.html", key = "monthlyINR", P = rupees(F.monthlyINR);
  const presence = (inner) => { const dist = fixtureDist(canon); mkdirSync(join(dist, "blog/how-india-independent-trainers-run-their-business"), { recursive: true }); writeFileSync(join(dist, pinned), `<!doctype html><html><head><title>t</title></head><body>${inner}</body></html>`); return checkBuiltPricePin(F, reg, dist).filter((x) => x.file === pinned && x.id === key).length; };
  for (const [n, inner] of [["opacity:0", `<p style="opacity:0">${P}</p>`], ["font-size:0", `<p style="font-size:0">${P}</p>`], ["off-screen", `<p style="position:absolute;left:-9999px">${P}</p>`], ["clip", `<p style="clip:rect(0,0,0,0);position:absolute">${P}</p>`], ["css comment in style", `<p style="/* x */display:none">${P}</p>`], ["class name", `<p class="hidden">${P}</p>`]]) assert.equal(presence(inner), 0, `limit 3/5 is real: '${n}' still counts as PRESENT (a named limit, not a fix)`);
  const dist = fixtureDist(canon); mkdirSync(join(dist, "blog/how-india-independent-trainers-run-their-business"), { recursive: true }); writeFileSync(join(dist, pinned), `<!doctype html><html><head><title>${P}</title></head><body><p>x</p></body></html>`);
  assert.equal(checkBuiltPricePin(F, reg, dist).filter((x) => x.file === pinned && x.id === key).length, 0, "limit 4 is real: a price only in <title> counts as present");
  const out = spawnSync(process.execPath, [SCRIPT, "--root", fixtureDist(canon), "--today", "2026-09-24"], { encoding: "utf8" });
  assert.equal(out.status, 0, out.stderr + out.stdout); for (const l of LIT) assert.ok(out.stdout.includes(l), `a green run prints the named limit: ${l}`);
  assert.match(out.stdout, /NAMED LIMITS/);
});

test("R2 finding text tells the next editor what to do: a competitor percent is declared with unit percent; a listed chunk missing from a build says a rebuild may fix a hash that looks like a word", () => {
  const canon = loadCanonical(REAL), reg = loadPriceSurfaces(REAL), F = canon.doc.facts;
  const dist = fixtureDist(canon); mkdirSync(join(dist, "newpage"), { recursive: true }); writeFileSync(join(dist, "newpage/index.html"), "<p>Rival: 20% off annual</p>");
  const r = checkBuiltPricePin(F, reg, dist).find((x) => x.file === "newpage/index.html");
  assert.match(r.detail, /declare/i); assert.match(r.detail, /unit/i); assert.match(r.detail, /percent/i);
  const d2 = fixtureDist(canon); rmSync(join(d2, "terms/index.html"));
  const m = checkBuiltPricePin(F, reg, d2).find((x) => x.kind === "price-surface-missing");
  assert.match(m.detail, /rebuild/i, "a missing listed file says what to try first");
});

// ---- R3 (gy-53qq5.1): the ledger cannot be silenced ----
const LEDGER = (ruled, retired = []) => ({ ruled: { monthlyINR: 399, annualINR: 2999, annualMonthlyEquivalentINR: 250, ...ruled }, retired });
const ledgerKinds = (r) => r.map((x) => [x.kind, x.id, x.value].filter((v) => v !== undefined).join(" ")).sort();

test("R3 APPEND-ONLY: a changed ruled price REQUIRES its old value in retired, and nothing may leave retired (except a price that is live again)", () => {
  const base = LEDGER({});
  assert.deepEqual(checkLedgerAppendOnly(base, LEDGER({})), [], "control: no change");
  assert.deepEqual(checkLedgerAppendOnly(base, LEDGER({ monthlyINR: 449 }, [{ amount: 399, was: "monthlyINR" }])), [], "bump with the old price retired: fine");
  assert.deepEqual(ledgerKinds(checkLedgerAppendOnly(base, LEDGER({ monthlyINR: 449 }))), ["price-ledger-old-not-retired monthlyINR 399"], "tester's L6c: ruled overwritten, old price never retired = SILENCED");
  assert.deepEqual(ledgerKinds(checkLedgerAppendOnly(base, LEDGER({ annualINR: 3499, annualMonthlyEquivalentINR: 292 }, [{ amount: 2999, was: "annualINR" }]))), ["price-ledger-old-not-retired annualMonthlyEquivalentINR 250"], "tester's L7d: retire SOME old prices but not all");
  assert.deepEqual(ledgerKinds(checkLedgerAppendOnly(base, LEDGER({ monthlyINR: 449, annualINR: 3499 }))), ["price-ledger-old-not-retired annualINR 2999", "price-ledger-old-not-retired monthlyINR 399"], "every silenced key is named");
  const b2 = LEDGER({ monthlyINR: 449 }, [{ amount: 399, was: "monthlyINR", note: "old" }]);
  assert.deepEqual(ledgerKinds(checkLedgerAppendOnly(b2, LEDGER({ monthlyINR: 449 }))), ["price-ledger-retired-removed 399"], "an entry that was retired on the base cannot be deleted");
  assert.deepEqual(checkLedgerAppendOnly(b2, LEDGER({ monthlyINR: 449 }, [{ amount: 399, was: "monthlyINR", note: "reworded" }])), [], "editing a note is not removal");
  assert.deepEqual(checkLedgerAppendOnly(b2, LEDGER({ monthlyINR: 449 }, [{ amount: 399 }, { amount: 299, was: "x" }])), [], "appending more entries is fine");
  assert.deepEqual(checkLedgerAppendOnly(b2, LEDGER({ monthlyINR: 399 }, [{ amount: 449, was: "monthlyINR" }])), [], "REINSTATED: the price went back to 399, so 399 may leave retired (checkPriceLedger refuses a live price there) and the price it left, 449, is retired");
  assert.deepEqual(ledgerKinds(checkLedgerAppendOnly(b2, LEDGER({ monthlyINR: 399 }, []))), ["price-ledger-old-not-retired monthlyINR 449"], "...but reverting still requires retiring the price it moved away from");
  assert.deepEqual(checkLedgerAppendOnly(LEDGER({}), LEDGER({ monthlyINR: 250, annualMonthlyEquivalentINR: 399 })), [], "a value that moves BETWEEN keys is still live, so retiring it would deadlock against checkPriceLedger: not demanded");
  assert.deepEqual(ledgerKinds(checkLedgerAppendOnly(LEDGER({ monthlyINR: 449 }, [{ amount: 399 }, { amount: 299 }]), LEDGER({ monthlyINR: 449 }, [{ amount: 399 }]))), ["price-ledger-retired-removed 299"], "only the entry that left is named");
  assert.deepEqual(checkLedgerAppendOnly(undefined, LEDGER({ monthlyINR: 449 })), [], "a base with no ledger yet has nothing to protect");
  assert.deepEqual(checkLedgerAppendOnly(base, undefined).map((x) => x.kind), ["price-ledger-missing"], "a head that deleted the ledger is refused");
});

test("R3 BASE FROM CI: the PR base sha or the push 'before' sha, read from the event payload; anything unresolvable in CI fails closed", () => {
  const ev = (o) => () => JSON.stringify(o);
  assert.deepEqual(ledgerBaseFromEnv({ GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "pull_request", GITHUB_EVENT_PATH: "/e" }, ev({ pull_request: { base: { sha: "abc123" } } })), { ref: "abc123" });
  assert.deepEqual(ledgerBaseFromEnv({ GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "push", GITHUB_EVENT_PATH: "/e" }, ev({ before: "def456" })), { ref: "def456" });
  for (const [name, env, reader] of [
    ["all-zero before", { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "push", GITHUB_EVENT_PATH: "/e" }, ev({ before: "0".repeat(40) })],
    ["pull_request without a base sha", { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "pull_request", GITHUB_EVENT_PATH: "/e" }, ev({ pull_request: {} })],
    ["no event path", { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "push" }, ev({}), /GITHUB_EVENT_PATH/],
    ["unreadable payload", { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "push", GITHUB_EVENT_PATH: "/e" }, () => { throw new Error("ENOENT"); }],
    ["an event this gate does not know", { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "schedule", GITHUB_EVENT_PATH: "/e" }, ev({}), /not one this check knows/],
  ]) { const r = ledgerBaseFromEnv(env, reader); assert.ok(r.error && !r.ref, `${name}: in CI an unresolvable base is an ERROR, never a silent skip`); }
  for (const [name, env, reader, msg] of [["no event path", { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "push" }, ev({}), /GITHUB_EVENT_PATH/], ["unknown event", { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "schedule", GITHUB_EVENT_PATH: "/e" }, ev({}), /not one this check knows/], ["unreadable", { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "push", GITHUB_EVENT_PATH: "/e" }, () => { throw new Error("ENOENT"); }, /could not be read/]]) assert.match(ledgerBaseFromEnv(env, reader).error, msg, `${name}: the message names the cause`);
  assert.deepEqual(ledgerBaseFromEnv({}, () => { throw new Error("must not read"); }), { ref: null }, "off CI with nothing configured: no base, no error (the CLI decides)");
  assert.deepEqual(ledgerBaseFromEnv({ GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "workflow_dispatch" }, () => { throw new Error("a dispatch carries no base: must not read"); }), { ref: null, mergeBase: "origin/main" }, "a manual dispatch has no base commit: compare against where this ref left main");
});

test("R3 CLI end to end: --base-ledger, --base <git ref>, and CI with no resolvable base", () => {
  const dist = fixtureDist(loadCanonical(REAL));
  const run = (args, env = {}) => spawnSync(process.execPath, [SCRIPT, "--root", dist, "--today", "2026-09-24", ...args], { encoding: "utf8", env: { ...process.env, GITHUB_ACTIONS: "", GITHUB_EVENT_NAME: "", GITHUB_EVENT_PATH: "", GITHUB_BASE_REF: "", ...env } });
  const real = loadPriceSurfaces(REAL).priceLedger, tmp = mkdtempSync(join(scratch, "base-"));
  const same = join(tmp, "same.json"); writeFileSync(same, JSON.stringify(real));
  const ok = run(["--base-ledger", same]); assert.equal(ok.status, 0, ok.stderr + ok.stdout); assert.match(ok.stdout, /append-only/i, "a green run says the check ran");
  const older = join(tmp, "older.json"); writeFileSync(older, JSON.stringify({ ...real, ruled: { ...real.ruled, monthlyINR: real.ruled.monthlyINR - 50 } }));
  const bad = run(["--base-ledger", older]); assert.equal(bad.status, 1); assert.match(bad.stderr, /price-ledger-old-not-retired monthlyINR.*retire/i);
  const gone = join(tmp, "gone.json"); writeFileSync(gone, JSON.stringify({ ...real, retired: [{ amount: 299, was: "monthlyINR" }] }));
  const rm = run(["--base-ledger", gone]); assert.equal(rm.status, 1); assert.match(rm.stderr, /price-ledger-retired-removed \(299 was in priceLedger\.retired on the base and is gone/);
  const ci = run([], { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "push" }); assert.equal(ci.status, 1); assert.match(ci.stderr, /price-ledger-base-unknown/, "in CI with no resolvable base the gate FAILS, it does not skip");
  // a real git base: two commits of a canon dir, the second silently bumps ruled
  const repo = mkdtempSync(join(scratch, "repo-")), sh = (...a) => spawnSync("git", ["-C", repo, ...a], { encoding: "utf8" });
  sh("init", "-q"); sh("config", "user.email", "t@t"); sh("config", "user.name", "t");
  sh("commit", "-q", "--allow-empty", "-m", "before the registry existed"); const emptySha = sh("rev-parse", "HEAD").stdout.trim();
  const canon = join(repo, "canon"); cpSync(REAL, canon, { recursive: true }); sh("add", "-A"); sh("commit", "-qm", "base");
  const baseSha = sh("rev-parse", "HEAD").stdout.trim();
  const early = run(["--canon", canon, "--base", emptySha]); assert.equal(early.status, 0, early.stderr + early.stdout); assert.match(early.stdout, /base has no ledger yet/, "a base that predates the registry has nothing to protect: not an error");
  const badJson = join(canon, "price-surfaces.json"), keep = readFileSync(badJson, "utf8"); writeFileSync(badJson, "{ not json"); sh("commit", "-qam", "broken"); const brokenSha = sh("rev-parse", "HEAD").stdout.trim(); writeFileSync(badJson, keep);
  const bj = run(["--canon", canon, "--base", brokenSha]); assert.equal(bj.status, 1); assert.match(bj.stderr, /price-ledger-base-unknown.*not valid JSON/, "an unparseable base file is an error, not a pass");
  const f = join(canon, "price-surfaces.json"), j = JSON.parse(readFileSync(f, "utf8")); j.priceLedger.ruled.monthlyINR += 50; writeFileSync(f, JSON.stringify(j));
  const g = run(["--canon", canon, "--base", baseSha]); assert.equal(g.status, 1); assert.match(g.stderr, /price-ledger-old-not-retired monthlyINR/, "the git path reads the base's ledger from the ref");
  // a manual workflow_dispatch: the base is the merge-base with origin/main
  sh("update-ref", "refs/remotes/origin/main", baseSha);
  const disp = run(["--canon", canon], { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "workflow_dispatch" }); assert.equal(disp.status, 1); assert.match(disp.stderr, /price-ledger-old-not-retired monthlyINR/, "a dispatch compares against the merge-base with origin/main");
  sh("update-ref", "-d", "refs/remotes/origin/main");
  const nomain = run(["--canon", canon], { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "workflow_dispatch" }); assert.equal(nomain.status, 1); assert.match(nomain.stderr, /price-ledger-base-unknown.*origin\/main/, "no origin/main to compare with: fails closed");
  const g2 = run(["--canon", canon, "--base", "0000000000000000000000000000000000000000"]); assert.equal(g2.status, 1); assert.match(g2.stderr, /price-ledger-base-unknown/, "a ref git cannot resolve fails closed");
});

test("M5 STANDING DRILL: every savings claim in every phrasing goes red under drift, and the drill says so when one is masked", () => {
  const canon = loadCanonical(REAL), reg = loadPriceSurfaces(REAL), F = canon.doc.facts;
  const dist = fixtureDist(canon); const p = join(dist, "llms.txt");
  writeFileSync(p, readFileSync(p, "utf8") + `\n${F.annualSavingsPercent}% savings\nSave up to ${F.annualSavingsPercent} percent\n${F.annualSavingsPercent}% cheaper\n`);
  const d = priceDrill(F, reg, dist);
  assert.deepEqual(d.missed, [], "control: every claim, in every phrasing, goes red when the percent drifts");
  assert.ok(d.claims >= 3, "the drill counted the extra claims");
  const masked = { ...reg, thirdPartyAmounts: { entries: [...reg.thirdPartyAmounts.entries, { file: "llms.txt", amount: F.annualSavingsPercent, unit: "percent", reason: "test: declared at the figure the page states" }] } };
  assert.match(priceDrill(F, masked, dist).missed.join(";"), /llms\.txt\|\d+ of \d+ savings claim\(s\)/, "a declaration at the percent the page states would hide those claims under drift, and the drill reports it");
});

test("M1/M2 STANDING DRILL: covers every occurrence in every spelling, and says so when one is masked", () => {
  const canon = loadCanonical(REAL), reg = loadPriceSurfaces(REAL), F = canon.doc.facts;
  const dist = fixtureDist(canon); const p = join(dist, "llms.txt");
  writeFileSync(p, readFileSync(p, "utf8") + FORMS(F.monthlyINR).map((x) => `<p>${x}</p>`).join("\n"));
  const d = priceDrill(F, reg, dist);
  assert.deepEqual(d.missed, [], "control: every extra form is caught under drift");
  assert.ok(d.occurrences >= FORMS(1).length, "the drill counted the extra forms");
  const masked = { ...reg, thirdPartyAmounts: { entries: [{ file: "llms.txt", amount: F.monthlyINR, reason: "test: a declaration at the old figure" }] } };
  assert.match(priceDrill(F, masked, dist).missed.join(";"), /llms\.txt\|\d+ of \d+ occurrence\(s\) of 399/, "a third-party declaration at the same figure hides a stale price, and the drill reports it");
});

// Build the JSON object whose string sits at a surface path like "$.mainEntity[].acceptedAnswer.text".
function jsonAt(path, text) {
  const segs = path.replace(/^\$\.?/, "").split(".").filter(Boolean); let node = text;
  for (const s of segs.reverse()) { const arr = s.endsWith("[]"); const key = arr ? s.slice(0, -2) : s; node = { [key]: arr ? [node] : node }; }
  return node;
}

// A fixture dist built from the REAL vendored strings and the REAL map, so this test needs no
// build (test:copy-output runs before `npm run build` in deploy.yml).
function fixtureDist(canon) {
  const dist = mkdtempSync(join(scratch, "dist-"));
  const byId = new Map(canon.doc.strings.map((s) => [s.id, s.text]));
  const pages = new Map();
  for (const [id, m] of Object.entries(canon.map)) for (const t of m.targets) {
    const text = t.waiver ? t.waiver.observed : byId.get(id);
    const page = pages.get(t.route) || { head: [], body: [], lines: [] }; pages.set(t.route, page);
    if (t.surface.startsWith("metadata ")) { const n = t.surface.slice(9); page.head.push(`<meta ${n.includes(":") && n.startsWith("og") ? "property" : "name"}="${n}" content="${text}">`); }
    else if (t.surface.startsWith("JSON-LD ")) page.head.push(`<script type="application/ld+json">${JSON.stringify(jsonAt(t.surface.slice(8), text))}</script>`);
    else if (t.surface === "served line") page.lines.push(text);
    else page.body.push(`<p>${text}</p>`);
  }
  for (const [route, p] of pages) {
    if (route.endsWith("/")) { mkdirSync(join(dist, route), { recursive: true }); writeFileSync(join(dist, route, "index.html"), `<!doctype html><html><head><title>t</title>${p.head.join("")}</head><body><main>${p.body.join("")}</main></body></html>`); }
    else writeFileSync(join(dist, route), p.lines.join("\n") + "\n");
  }
  const reg = loadPriceSurfaces(REAL), f = canon.doc.facts;
  for (const [file, keys] of Object.entries(reg.surfaces)) {
    const line = keys.map((k) => (k === "annualSavingsPercent" ? `Save ${f[k]}%` : rupees(f[k]))).join(" ");
    mkdirSync(join(dist, file, ".."), { recursive: true });
    writeFileSync(join(dist, file), (existsSync(join(dist, file)) ? readFileSync(join(dist, file), "utf8") : "") + `<p>${line}</p>\n`);
  }
  return dist;
}

test("CLI end to end: tampering with the vendored file, or deleting it, is caught; a real byte edit changes the hash", () => {
  const dir = join(scratch, "canon"); cpSync(REAL, dir, { recursive: true });
  const dist = fixtureDist(loadCanonical(REAL));
  const run = () => spawnSync(process.execPath, [SCRIPT, "--canon", dir, "--root", dist, "--today", "2026-09-24"], { encoding: "utf8" });
  const ok = run(); assert.equal(ok.status, 0, ok.stderr + ok.stdout); assert.match(ok.stdout, /\d+ waived divergence/);
  const f = join(dir, "gymbo-canonical-strings.json"); const orig = readFileSync(f, "utf8");
  writeFileSync(f, orig.replace("Your week, tap to punch", "Your week, one tap to punch"));
  assert.notEqual(sha256(readFileSync(f)), sha256(orig));
  const r = run(); assert.equal(r.status, 1); assert.match(r.stderr, /canonical-hash-mismatch/); assert.match(r.stderr, /canonical-string-missing site\.gallery\.schedule\.caption/);
  rmSync(f); assert.equal(run().status, 2);
});

test("CLI end to end: a drifted price constant fails the real gate; the real constants pass", () => {
  const dist = fixtureDist(loadCanonical(REAL));
  const real = readFileSync(new URL("../src/lib/trialAccess.ts", import.meta.url), "utf8");
  const ts = join(scratch, "trialAccess.ts");
  const run = () => spawnSync(process.execPath, [SCRIPT, "--root", dist, "--constants", ts, "--today", "2026-09-24"], { encoding: "utf8" });
  writeFileSync(ts, real); const ok = run(); assert.equal(ok.status, 0, ok.stderr + ok.stdout); assert.match(ok.stdout, /5 ruled facts equal the constants/);
  writeFileSync(ts, real.replace("PRICE_MONTHLY_INR = 399", "PRICE_MONTHLY_INR = 449"));
  const bad = run(); assert.equal(bad.status, 1); assert.match(bad.stderr, /fact-mismatch monthlyINR/);
});
