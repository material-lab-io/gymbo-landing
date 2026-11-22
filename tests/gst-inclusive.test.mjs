// gy-aqayff / gy-s1l31k: Kaushik 22 Nov 10:57Z, prices are GST-inclusive (Rs 399/mo, Rs 2,999/yr are what the trainer pays; gy-2ymb5y). Compliance's lines: Terms T3 P2 "both including GST",
// the pricing section, public/pricing.md and public/llms.txt say so, and the JSON-LD offer carries a priceSpecification with valueAddedTaxIncluded true. Source-level, so it runs before a build.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (p) => readFileSync(resolve(root, p), "utf8");
const SAYS_GST = /\b(?:incl\.|including|include|includes|inclusive of)\s+GST\b/i;
const statesGst = (text) => SAYS_GST.test(text);

function offerSpec(html) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const app = blocks.map((b) => (Array.isArray(b["@graph"]) ? b["@graph"] : [b])).flat().find((n) => n.offers);
  return app?.offers?.priceSpecification ?? null;
}

test("every price surface in the landing source says it includes GST", () => {
  assert.ok(statesGst(read("src/pages/Terms.tsx").match(/Gymbo Pro costs[^<]*/)?.[0] ?? ""), "Terms T3 P2");
  assert.ok(statesGst(read("src/lib/trialAccess.ts").match(/PRICING_PRO_ANNUAL_LINE = [^\n]*/)?.[0] ?? ""), "the pricing section note");
  const md = read("public/pricing.md");
  const mdLines = md.split("\n").filter((l) => /^- \*\*Pro, (monthly|annual)/.test(l));
  assert.equal(mdLines.length, 2, "pricing.md has both Pro lines (the check saw its corpus)");
  for (const line of mdLines) assert.ok(statesGst(line), line);
  const llmsLines = read("public/llms.txt").split("\n").filter((l) => /^- Pro, (monthly|annual)/.test(l));
  assert.equal(llmsLines.length, 2, "llms.txt has both Pro lines (the check saw its corpus)");
  for (const line of llmsLines) assert.ok(statesGst(line), line);
});

test("the JSON-LD offer carries priceSpecification.valueAddedTaxIncluded true, with the same price", () => {
  const spec = offerSpec(read("index.html"));
  assert.ok(spec, "the SoftwareApplication offer has a priceSpecification");
  assert.equal(spec.valueAddedTaxIncluded, true);
  assert.equal(spec.price, "399");
  assert.equal(spec.priceCurrency, "INR");
});

test("planted control: a price line with no GST words, or an offer with VAT false or absent, is caught", () => {
  assert.equal(statesGst("- Pro, monthly: ₹399/month"), false);
  assert.equal(statesGst("Gymbo Pro costs ₹399 per month or ₹2,999 per year (₹250 per month effective)."), false);
  assert.equal(statesGst("- Pro, monthly: ₹399/month, including GST"), true);
  assert.equal(statesGst("both including GST."), true);
  const html = (spec) => `<script type="application/ld+json">${JSON.stringify({ "@type": "SoftwareApplication", offers: { "@type": "Offer", price: "399", ...(spec ? { priceSpecification: spec } : {}) } })}</script>`;
  assert.equal(offerSpec(html(null)), null);
  assert.equal(offerSpec(html({ valueAddedTaxIncluded: false }))?.valueAddedTaxIncluded, false);
  assert.equal(offerSpec(html({ valueAddedTaxIncluded: true }))?.valueAddedTaxIncluded, true);
});

// ---- the build-output lint (scripts/check-gst-inclusive.mjs): red by name on a bare Gymbo price, with controls ----
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { barePrices } from "../scripts/check-gst-inclusive.mjs";

const SCRIPT = resolve(root, "scripts", "check-gst-inclusive.mjs");
function dist(pages) {
  const d = mkdtempSync(join(tmpdir(), "gst-incl-"));
  for (const [rel, body] of Object.entries(pages)) { const p = join(d, rel); mkdirSync(join(p, ".."), { recursive: true }); writeFileSync(p, `<!doctype html><html lang="en"><head><title>t</title></head><body><main>${body}</main></body></html>`); }
  return d;
}
const run = (d) => spawnSync(process.execPath, [SCRIPT, "--root", d], { encoding: "utf8" });
const GOOD = "<p>Pro is ₹399/mo, incl. GST.</p>";

test("lint: a bare ₹399, ₹2,999 or ₹250 on a page is red by name, and the same price with GST words passes", () => {
  for (const bare of ["<p>Pro is ₹399/mo.</p>", "<p>Pro is ₹2,999 a year.</p>", "<p>Effective ₹250 a month.</p>", "<p>Pro is Rs 399 a month.</p>", "<p>Pro is INR 2999 a year.</p>"]) {
    const r = run(dist({ "index.html": GOOD, "compare/x/index.html": bare }));
    assert.equal(r.status, 1, bare);
    assert.match(r.stderr, /gst-bare-price \/compare\/x\/ \[visible block\]/, bare);
  }
  const ok = run(dist({ "index.html": GOOD, "compare/x/index.html": "<p>Pro is ₹399/mo, including GST, with no caps.</p>" }));
  assert.equal(ok.status, 0, ok.stderr);
});

test("lint: the price figure in one block and the GST note in the next passes; a bare figure with no note after it does not", () => {
  assert.equal(run(dist({ "index.html": GOOD, "p/index.html": "<div>₹399</div><p>Both prices include GST.</p>" })).status, 0);
  assert.equal(run(dist({ "index.html": GOOD, "p/index.html": "<div>₹399</div><p>Cancel anytime.</p>" })).status, 1);
});

test("lint: JSON-LD and meta prices are checked too, blog posts are out, a competitor price is not Gymbo's", () => {
  const head = (extra) => `<!doctype html><html lang="en"><head><title>t</title>${extra}</head><body><main><p>x</p></main></body></html>`;
  const d = mkdtempSync(join(tmpdir(), "gst-incl-"));
  mkdirSync(join(d, "compare/x"), { recursive: true });
  writeFileSync(join(d, "index.html"), head("").replace("<p>x</p>", GOOD));
  writeFileSync(join(d, "compare/x/index.html"), head('<meta name="description" content="Gymbo from ₹250/mo." />'));
  const r = run(d);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /gst-bare-price \/compare\/x\/ \[metadata description\]/);
  const ld = mkdtempSync(join(tmpdir(), "gst-incl-"));
  mkdirSync(join(ld, "compare/x"), { recursive: true });
  writeFileSync(join(ld, "index.html"), head("").replace("<p>x</p>", GOOD));
  writeFileSync(join(ld, "compare/x/index.html"), head(`<script type="application/ld+json">${JSON.stringify({ "@type": "FAQPage", mainEntity: [{ "@type": "Question", name: "Cost?", acceptedAnswer: { "@type": "Answer", text: "Gymbo is ₹399/month." } }] })}</script>`));
  const r2 = run(ld);
  assert.equal(r2.status, 1);
  assert.match(r2.stderr, /gst-bare-price \/compare\/x\/ \[JSON-LD/);
  assert.equal(run(dist({ "index.html": GOOD, "blog/post/index.html": "<p>Gymbo is ₹399/mo.</p>" })).status, 0, "blog posts are out of scope (pm 22 Nov)");
  assert.equal(run(dist({ "index.html": GOOD, "compare/x/index.html": "<p>Trainerize is ₹2,200/mo and WellnessZ ₹499/mo.</p>" })).status, 0, "other amounts are not Gymbo's");
});

test("lint: an empty or priceless build is a blind scanner (exit 1), a missing root is could-not-look (exit 2), never a pass", () => {
  assert.equal(run(dist({ "index.html": "<p>No prices here.</p>" })).status, 1);
  assert.equal(spawnSync(process.execPath, [SCRIPT, "--root", join(tmpdir(), "gst-does-not-exist-xyz")], { encoding: "utf8" }).status, 2);
});

test("lint: the named home meta-description exemption is the only bare price allowed, and only on /", () => {
  const meta = (p) => `<!doctype html><html lang="en"><head><title>t</title><meta name="description" content="Free to start, Pro from ₹399/mo." /></head><body><main>${GOOD}</main></body></html>`;
  const d = mkdtempSync(join(tmpdir(), "gst-incl-")); mkdirSync(join(d, "compare/x"), { recursive: true });
  writeFileSync(join(d, "index.html"), meta());
  writeFileSync(join(d, "compare/x/index.html"), `<!doctype html><html lang="en"><head><title>t</title></head><body><main>${GOOD}</main></body></html>`);
  assert.equal(run(d).status, 0);
  writeFileSync(join(d, "compare/x/index.html"), meta());
  assert.equal(run(d).status, 1, "the same meta on another route is not exempt");
  assert.equal(barePrices("/blog/a/", [{ surface: "visible block", text: "₹399" }]).findings.length, 0);
});
