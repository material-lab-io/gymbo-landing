// gy-uu7mt: content's vendored canonical strings. Each case plants ONE defect and proves
// the check fails on it by name; the waiver cases prove a known divergence is reported
// every run, cannot drift, and cannot outlive its expiry or its cause.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkCanonical, checkFacts, canonicalRuled, loadCanonical, loadFactsMap, readConstants, findHandTypedPrices, sha256 } from "../scripts/canonical-strings.mjs";

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
  assert.equal(c.sha, "493c7354cc79f41c715268eb692cf158dc6ce15b79356e59cc9aa59b79e3bfd9");
  assert.equal(c.doc.strings.filter((s) => c.source.webSurfaceIdPrefixes.some((p) => s.id.startsWith(p))).length, 7);
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

test("SCOPE DISCLOSURE: hand-typed rupee amounts outside the constants file are FOUND and named, so the green cannot be read as 'every price is pinned'", () => {
  const root = mkdtempSync(join(scratch, "src-")); mkdirSync(join(root, "src/lib"), { recursive: true }); mkdirSync(join(root, "src/pages"), { recursive: true });
  writeFileSync(join(root, "src/lib/trialAccess.ts"), "export const PRICE_MONTHLY_INR = 399; // \u20b9399 here is the constants file, excluded\n");
  writeFileSync(join(root, "src/pages/Clean.tsx"), "const p = `\u20b9${PRICE_MONTHLY_INR}/month`; // template, no literal\n");
  assert.deepEqual(findHandTypedPrices(root), [], "constants file and template-only usage are not reported");
  writeFileSync(join(root, "src/pages/Terms.tsx"), "<p>Monthly at \u20b9399/month and annual at \u20b92,999 per year</p>");
  writeFileSync(join(root, "index.html"), "<meta content=\"from \u20b9250/month\">");
  assert.deepEqual(findHandTypedPrices(root), [{ file: "index.html", count: 1 }, { file: "src/pages/Terms.tsx", count: 2 }]);
  assert.ok(findHandTypedPrices(new URL("..", import.meta.url).pathname).some((f) => f.file === "src/pages/Terms.tsx"), "the REAL tree's Terms.tsx literals are found");
});

test("CLI end to end: the green output NAMES the files it does not read", () => {
  const dist = fixtureDist(loadCanonical(REAL));
  const r = spawnSync(process.execPath, [SCRIPT, "--root", dist, "--today", "2026-09-24"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /NOT READ by the price check: \d+ file\(s\).*src\/pages\/Terms\.tsx x\d/);
  assert.match(r.stdout, /that file ONLY/);
});

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
    else if (t.surface.startsWith("JSON-LD ")) page.head.push(`<script type="application/ld+json">${JSON.stringify({ description: text })}</script>`);
    else if (t.surface === "served line") page.lines.push(text);
    else page.body.push(`<p>${text}</p>`);
  }
  for (const [route, p] of pages) {
    if (route.endsWith("/")) { mkdirSync(join(dist, route), { recursive: true }); writeFileSync(join(dist, route, "index.html"), `<!doctype html><html><head><title>t</title>${p.head.join("")}</head><body><main>${p.body.join("")}</main></body></html>`); }
    else writeFileSync(join(dist, route), p.lines.join("\n") + "\n");
  }
  return dist;
}

test("CLI end to end: tampering with the vendored file, or deleting it, is caught; a real byte edit changes the hash", () => {
  const dir = join(scratch, "canon"); cpSync(REAL, dir, { recursive: true });
  const dist = fixtureDist(loadCanonical(REAL));
  const run = () => spawnSync(process.execPath, [SCRIPT, "--canon", dir, "--root", dist, "--today", "2026-09-24"], { encoding: "utf8" });
  const ok = run(); assert.equal(ok.status, 0, ok.stderr + ok.stdout); assert.match(ok.stdout, /2 waived divergence/);
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
