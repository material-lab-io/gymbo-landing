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
