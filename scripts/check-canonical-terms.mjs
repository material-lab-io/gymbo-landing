// gy-afarz.1: fail when the BUILT public site names a Gymbo product action with a
// retired term. Voice Guide v13: Gymbo punches classes, records payments, and its
// AI chat is "Ask Gymbo". Source grep is not enough: head metadata and JSON-LD are
// hand-written in per-route index.html, and llms.txt / pricing.md are served as-is.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverBuiltPages, pageSurfaces } from "./check-no-em-dash.mjs";
import { matchable } from "./text-normalise.mjs";

export const BANNED = [
  "AI assistant",
  "AI chat assistant",
  "session logging",
  "logged sessions",
  "sessions logged",
  "log a class",
  "log classes",
  "log a session",
  "one-tap session log",
  "one tap to log a session",
  "one-tap logging",
  "each session logs",
  "payments logged",
  "payment logging",
  "classes you log",
  "back office",
  "AI-powered",
  "chat assistant",
];

// gy-xmzqr.7 (content ruling 2026-09-24): "log sessions" is banned only where it
// describes Gymbo in SEARCH/SHARE metadata: <meta> tags on every page, and JSON-LD on
// the homepage. Body copy and guide-page JSON-LD also carry general editorial advice
// and competitor language ("log sessions as they happen"), so a wider ban would need
// exceptions for prose this gate must not touch.
export const META_ONLY_BANNED = ["log sessions"];
const isMetaSurface = (surface, route) => surface.startsWith("metadata ") || (route === "/" && surface.startsWith("JSON-LD "));

// Deliberately narrow: each entry keeps ONE sentence whose subject is not Gymbo's
// action. Nothing here may exempt a file or a route.
export const EXCEPTIONS = [
  {
    reason: "guide/get-organized: spreadsheet comparison, not Gymbo's action",
    context: /a spreadsheet can hold this, but it doesn't log a session with one tap between clients/i,
  },
  {
    reason: "home: attributed trainer quote, the trainer's own words (content addendum 2, 2026-09-22)",
    context: /I open the app, log the session, and move on/i,
  },
];

const TEXT_ENDPOINTS = ["llms.txt", "pricing.md"];

// gy-uu7mt: the exact-phrase list above is a CLOSED vocabulary policing an OPEN one, so
// it only ever confirms the paraphrases its author already thought of. These FAMILIES
// match the retired CONCEPT instead: the logging verb applied to a class or session, in
// either order, and the generic-AI labels (Voice Guide v14 lexicon: Ask Gymbo, never
// chatbot / virtual assistant / copilot; content ruling 2026-09-24 extends this to
// "AI-powered", "AI assistant", "chat assistant"). A family match is skipped where an
// exact-phrase finding already covers the same span, so nothing is reported twice.
// "AI chat" alone is NOT a family member: "Ask Gymbo (AI chat)" is the canonical
// processor heading on /privacy/.
const VERB = "(?:log|logs|logged|logging)";
const NOUN = "(?:class|classes|session|sessions)";
export const FAMILIES = [
  {
    name: "attendance-logging",
    // On editorial routes (guide/research) "log sessions as they happen" is general
    // advice to any trainer, so only text that also names Gymbo NEARBY counts there.
    gymboSentenceOnlyOnEditorialRoutes: true,
    patterns: [
      new RegExp(`\\b${VERB}\\b,?(?:\\s+[\\w'’-]+,?){0,3}?\\s+${NOUN}\\b`, "gi"),
      new RegExp(`\\b${NOUN}\\b,?(?:\\s+[\\w'’-]+,?){0,2}?\\s+${VERB}\\b`, "gi"),
      /\b(?:class|classes|session|sessions)[- ]log(?:s|ging)?\b/gi,
    ],
  },
  {
    name: "generic-ai-label",
    patterns: [
      /\bAI[- ](?:powered|driven|assistants?|helpers?|copilots?|companions?|agents?|bots?|chatbots?|chat (?:assistants?|helpers?|bots?))\b/gi,
      /\b(?:chat ?bots?|chat (?:assistants?|helpers?)|virtual assistants?|digital assistants?|copilots?)\b/gi,
    ],
  },
];

// An exception excuses only the span its own pattern matches, never its neighbours: a
// window test would let a quoted sentence excuse a real violation in the next sentence.
function excepted(text, start, end) {
  return EXCEPTIONS.some(({ context }) => {
    const flags = context.flags.includes("g") ? context.flags : `${context.flags}g`;
    for (const m of text.matchAll(new RegExp(context.source, flags))) {
      if (start >= m.index && end <= m.index + m[0].length) return true;
    }
    return false;
  });
}

// A sentence test missed the pronoun case ("Gymbo does X. It gives you ... logging
// sessions"), which is exactly how the shipped blog misdescription was shaped. 150 chars
// either side is a tuned number, not a principle: measured on the real built site, 150
// adds no false positive over sentence scope, 250 adds two guide sentences.
const GYMBO_CONTEXT_CHARS = 150;

// /blog/ is NOT here on purpose. Blog posts compare products section by section and refer
// back with a pronoun ("Be aware: It's iPhone-only ... it gives you ... a chat assistant"),
// with the product named only in a heading hundreds of characters earlier, so no proximity
// test can tell Gymbo's paragraph from a competitor's. It has zero family hits today; a
// future false positive gets a reasoned EXCEPTION rather than a blind spot.
const EDITORIAL_ROUTE = /^\/(?:guide|research)(?:\/|$)/;

function gymboNearby(text, index, length) {
  return /\bGymbo\b/.test(text.slice(Math.max(0, index - GYMBO_CONTEXT_CHARS), index + length + GYMBO_CONTEXT_CHARS));
}

function normalise(value) {
  return matchable(value);
}

export function scanText(value, route, surface) {
  const text = normalise(value);
  const findings = [];
  const spans = [];
  const terms = isMetaSurface(surface, route) ? [...BANNED, ...META_ONLY_BANNED] : BANNED;
  for (const term of terms) {
    const pattern = new RegExp(`(?<![A-Za-z])${term.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}(?![A-Za-z])`, "gi");
    for (const match of text.matchAll(pattern)) {
      const window = text.slice(Math.max(0, match.index - 90), match.index + match[0].length + 60);
      if (excepted(text, match.index, match.index + match[0].length)) continue;
      spans.push([match.index, match.index + match[0].length]);
      findings.push({ route, surface, term, snippet: window.trim() });
    }
  }
  for (const family of FAMILIES) {
    for (const pattern of family.patterns) {
      for (const match of text.matchAll(pattern)) {
        const end = match.index + match[0].length;
        if (spans.some(([a, b]) => match.index < b && end > a)) continue;
        if (family.gymboSentenceOnlyOnEditorialRoutes && EDITORIAL_ROUTE.test(route)
            && !gymboNearby(text, match.index, match[0].length)) continue;
        const window = text.slice(Math.max(0, match.index - 90), end + 60);
        if (excepted(text, match.index, end)) continue;
        spans.push([match.index, end]);
        findings.push({ route, surface, term: `${family.name}: ${match[0]}`, snippet: window.trim() });
      }
    }
  }
  return findings;
}

export function scanHtmlTerms(html, route = "unknown") {
  return pageSurfaces(html, route).flatMap(({ surface, value }) => scanText(value, route, surface));
}

export function scanBuiltTerms(root = "dist") {
  const { pages, sitemapRoutes } = discoverBuiltPages(root);
  const findings = pages.flatMap(({ route, file }) => scanHtmlTerms(readFileSync(file, "utf8"), route));
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
    if (root === null) throw new Error("usage: node scripts/check-canonical-terms.mjs [--root <built-site-dir>]");
    const result = scanBuiltTerms(root);
    if (result.findings.length) {
      console.error(`FAIL: ${result.findings.length} retired product term(s) in built output:`);
      for (const f of result.findings) console.error(`  ${f.route} [${f.surface}] "${f.term}": ${f.snippet}`);
      process.exitCode = 1;
    } else {
      console.log(`OK: no retired product terms across ${result.pages.length} built page(s) plus ${TEXT_ENDPOINTS.join(" and ")}.`);
    }
  } catch (error) {
    console.error(`COULD NOT EVALUATE canonical terms: ${error.message}`);
    process.exitCode = 2;
  }
}
