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
const TRIGGER_DAYS = /\b(?:7|seven)[- ]?days?\b/i;
const TRIGGER_FREE = /\b(?:free|trial)\b/i;
const QUALIFIED = /eligib/i;

function normalise(value) {
  return matchable(value).replace(/[*_`]/g, "");
}

export function scanText(value, route, surface) {
  const findings = [];
  for (const raw of normalise(value).split(/(?<=[.!?])\s+|\s[·|]\s|\n/)) {
    const sentence = raw.trim();
    if (!sentence) continue;
    if (TRIGGER_DAYS.test(sentence) && TRIGGER_FREE.test(sentence) && !QUALIFIED.test(sentence)) {
      findings.push({ route, surface, snippet: sentence.slice(0, 200) });
    }
  }
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
