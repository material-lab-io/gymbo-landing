// gy-x0pdi / gy-o71gz: structured data must say what the page says.
//
// A checked-in route shell (guide/*, alternatives/*, blog/*, compare/*) is hand-written: its head and its
// JSON-LD ship verbatim, while the BODY is generated from src/content/*. So the same FAQ answer or HowTo step
// lives in two hand-kept places, and nothing tied them together. Measured on origin/main 4349e7c8: 42 of 49
// guide FAQ answers and 8 of 10 blog answers were not in their own page's visible text, and search engines
// quote the JSON-LD.
//
// DECISION (gy-x0pdi AC3): ASSERT, do not generate. Generating the JSON-LD would need a prerender step for
// every shell and a rewrite of how the heads are written; an assertion over the BUILT output covers every
// page that exists today and every page added later, with no per-file list to forget (the same reasoning as
// the price gate's default-fail). If generation is wanted later, this check is what proves it is faithful.
//
// WHAT IT CHECKS, on built dist only (a gate that reads source or the checked-in shell is wrong about what
// ships): for every page, each FAQPage question and answer must appear, after the shared matching
// normalisation, inside that same page's visible text. Zero drift in WORDS is the rule: a changed, added or
// dropped word, number or currency/percent symbol fails (measured: how-india's JSON-LD still said 'around 15
// clients' after the visible text dropped that unsourced threshold). DECISION on wording-only drift
// (gy-o71gz): PUNCTUATION-ONLY differences are accepted, because the strings are compared as word sequences
// ('Akton is gym-management software: built' vs ', built' reads the same to a person and a crawler); 7 of
// the 9 pairs measured on origin/main were exactly that, and failing CI on a colon would train people to
// route around the gate.
//
// NAMED LIMIT, MEASURED NOT HIDDEN: HowTo step names and texts are NOT enforced. Measured on the same build,
// the guide pages' HowTo JSON-LD (52 strings) has no counterpart in the visible page at all: the page shows
// headed prose sections, not those steps. That is not drift between two copies of one sentence; it is a
// content decision (show the steps, drop the HowTo markup, or accept it), so it is counted and printed on
// every run instead of being allowlisted or silently skipped.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { copyBlocks } from "./copy-blocks.mjs";
import { matchable } from "./text-normalise.mjs";

// The JSON-LD paths that duplicate visible copy. Anything else in JSON-LD (urls, dates, ids, prices as
// numbers) is not a duplicate of a sentence on the page and is out of scope here.
// Word sequence: matching-normalised, lower-cased, every run of non-letter/non-digit/non-currency/non-percent
// characters collapsed to one space, padded so a match cannot start or end mid-word.
export const words = (s) => " " + matchable(s).toLowerCase().replace(/[^\p{L}\p{N}₹$%]+/gu, " ").trim() + " ";
const FAQ = /\.mainEntity\[\]\.(?:name|acceptedAnswer\.text)$/;
const HOWTO = /\.step\[\]\.(?:name|text)$/;

function* htmlFiles(dir, root) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { yield* htmlFiles(p, root); continue; }
    if (/\.html?$/i.test(name)) yield p;
  }
}

export function routeOf(rel) {
  return "/" + rel.split(sep).join("/").replace(/index\.html$/, "");
}

// One page: returns the drifting strings. Pure, so tests can feed it fixtures.
export function pageDrift(html, route) {
  const rows = copyBlocks(html, route);
  const visible = words(rows.filter((r) => r.surface === "visible block").map((r) => r.text).join(" "));
  const out = [], howto = [];
  let checked = 0;
  for (const r of rows) {
    if (!r.surface.startsWith("JSON-LD ")) continue;
    const isFaq = FAQ.test(r.surface), isHowTo = HOWTO.test(r.surface);
    if (!isFaq && !isHowTo) continue;
    const m = words(r.text);
    if (isFaq) checked++;
    if (m.trim() && !visible.includes(m)) (isFaq ? out : howto).push({ route, surface: r.surface, text: r.text });
  }
  return { checked, drift: out, howto };
}

export function findJsonLdDrift(root) {
  if (!existsSync(root)) throw new Error(`${root} does not exist; cannot check structured data on a build that is not there`);
  const findings = [], howto = [];
  let checked = 0, pages = 0;
  for (const file of htmlFiles(root, root)) {
    const rel = relative(root, file);
    const html = readFileSync(file, "utf8");
    if (!/application\/ld\+json/i.test(html)) continue;
    pages++;
    const r = pageDrift(html, routeOf(rel));
    checked += r.checked;
    findings.push(...r.drift);
    howto.push(...r.howto);
  }
  return { pages, checked, findings, howto };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const root = resolve(args.includes("--root") ? args[args.indexOf("--root") + 1] : "dist");
  let res;
  try { res = findJsonLdDrift(root); } catch (e) { console.error(`check-jsonld-sync: ${e.message}`); process.exit(2); }
  // A gate that checked nothing must not report green: the build has FAQ JSON-LD, so zero checked strings
  // means the extractor stopped seeing it.
  if (res.checked === 0) { console.error(`check-jsonld-sync: checked 0 FAQ strings across ${res.pages} page(s); the extractor is blind, refusing a vacuous pass`); process.exit(1); }
  const limit = res.howto.length ? `NAMED LIMIT (not enforced, content decision, gy-x0pdi): ${res.howto.length} HowTo step name/text string(s) on ${new Set(res.howto.map((h) => h.route)).size} page(s) have no counterpart in the visible text.` : "";
  if (res.findings.length) {
    console.error(`FAIL: check-jsonld-sync: ${res.findings.length} structured-data string(s) are not in their page's visible text (gy-x0pdi):`);
    for (const f of res.findings) console.error(`  ${f.route} ${f.surface}: ${f.text.slice(0, 140)}${f.text.length > 140 ? "…" : ""}`);
    console.error("Search engines quote the JSON-LD, so it must match the page. Fix the checked-in shell (or the content) so they agree; this is not a thing to allowlist.");
    if (limit) console.error(limit);
    process.exit(1);
  }
  console.log(`OK: FAQ structured data matches visible text: ${res.checked} question/answer string(s) across ${res.pages} page(s) with JSON-LD, 0 drifting.`);
  if (limit) console.log(`  ${limit}`);
}
