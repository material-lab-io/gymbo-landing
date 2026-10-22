// gy-xmzqr.7: fail when the BUILT public site promises the 7-day trial unconditionally.
// Apple decides introductory-offer eligibility per person per subscription group and the
// website cannot see a visitor's account, so every sentence that ties the 7 days to
// "free" or "trial" must qualify it ("eligible"). Head metadata and JSON-LD are
// hand-written per route, and llms.txt / pricing.md are served as-is, so scan built output.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverBuiltPages, pageSurfaces } from "./check-no-em-dash.mjs";
import { matchable } from "./text-normalise.mjs";

const TEXT_ENDPOINTS = ["llms.txt", "pricing.md"];
// gy-r0h3d: any dash (\p{Pd}: hyphen, en, em, figure, non-breaking...) or the minus sign, with optional
// whitespace around it, so a word processor's autocorrected "7\u2013day" is caught like "7-day".
const DASH = String.raw`[\p{Pd}\u2212]`;
// gy-id5zl (tester's attack on gy-r0h3d, 33/182 realistic cases passed): up to two filler words may sit
// between the number and the unit ("7 free days", "seven full days free", "7 consecutive days"), and the
// week forms include "a full week free" / "the first week free".
const FILL = String.raw`(?:(?:free|trial|full|whole|first|calendar|consecutive|complete|entire|straight|total|paid|risk-free)\s+){0,2}`;
const TRIGGER_DAYS = new RegExp(String.raw`\b(?:7|seven)\s*(?:${DASH}\s*)?${FILL}days?\b`, "iu");
// "a week" is ordinary English ("hours a week", "once a week"), so a week form only counts when the free/trial
// word is in the SAME sentence; the number-of-days form may reach into the neighbouring sentences.
const TRIGGER_WEEK = new RegExp(
  String.raw`\b(?:(?:a|one|1)\s*(?:${DASH}\s*)?${FILL}|(?:the\s+)?first\s+${FILL})weeks?\b`,
  "iu",
);
const TRIGGER_FREE = /\b(?:free|trial)\b/i;
// "eligible" as a WHOLE word. /eligib/ matched "ineligible" and "eligibility" in any sentence, so a
// sentence about who is NOT eligible qualified a promise it contradicts.
const QUALIFIED = /\beligible\b/i;

function normalise(value) {
  return matchable(value).replace(/[*_`]/g, "");
}

// A sentence is a finding when it carries the days/week trigger AND the free/trial word sits in it or in
// the sentence either side (a claim split as "Free trial. Seven days." or "Free | 7-day access"), unless
// "eligible" appears in that same window. Splits on sentence ends, " | " / " · " separators and newlines.
export function scanText(value, route, surface) {
  const findings = [];
  const sentences = normalise(value).split(/(?<=[.!?])\s+|\s[·|]\s|\n/).map((x) => x.trim()).filter(Boolean);
  sentences.forEach((sentence, i) => {
    const window = [sentences[i - 1], sentence, sentences[i + 1]].filter(Boolean).join(" ");
    const hit =
      (TRIGGER_DAYS.test(sentence) && TRIGGER_FREE.test(window) && !QUALIFIED.test(window)) ||
      (TRIGGER_WEEK.test(sentence) && TRIGGER_FREE.test(sentence) && !QUALIFIED.test(window));
    if (hit) findings.push({ route, surface, snippet: sentence.slice(0, 200) });
  });
  return findings;
}

export function scanHtmlTrial(html, route = "unknown") {
  return pageSurfaces(html, route).flatMap(({ surface, value }) => scanText(value, route, surface));
}

export function scanBuiltTrial(root = "dist") {
  const { pages, sitemapRoutes } = discoverBuiltPages(root);
  const findings = pages.flatMap(({ route, file }) => scanHtmlTrial(readFileSync(file, "utf8"), route));
  for (const name of TEXT_ENDPOINTS) {
    const file = resolve(root, name);
    if (!existsSync(file)) throw new Error(`${file} is missing; refusing a vacuous pass`);
    findings.push(...scanText(readFileSync(file, "utf8"), `/${name}`, "served text"));
  }
  return { findings, pages, sitemapRoutes };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const root = args.length === 2 && args[0] === "--root" ? args[1] : args.length ? null : "dist";
    if (root === null) throw new Error("usage: node scripts/check-trial-eligibility.mjs [--root <built-site-dir>]");
    const result = scanBuiltTrial(root);
    if (result.findings.length) {
      console.error(`FAIL: ${result.findings.length} unqualified 7-day trial promise(s) in built output:`);
      for (const f of result.findings) console.error(`  ${f.route} [${f.surface}]: ${f.snippet}`);
      process.exitCode = 1;
    } else {
      console.log(`OK: every 7-day trial mention is eligibility-qualified across ${result.pages.length} built page(s) plus ${TEXT_ENDPOINTS.join(" and ")}.`);
    }
  } catch (error) {
    console.error(`COULD NOT EVALUATE trial eligibility: ${error.message}`);
    process.exitCode = 2;
  }
}
