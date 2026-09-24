// gy-afarz.1: fail when the BUILT public site names a Gymbo product action with a
// retired term. Voice Guide v13: Gymbo punches classes, records payments, and its
// AI chat is "Ask Gymbo". Source grep is not enough: head metadata and JSON-LD are
// hand-written in per-route index.html, and llms.txt / pricing.md are served as-is.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverBuiltPages, pageSurfaces } from "./check-no-em-dash.mjs";

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
];

const TEXT_ENDPOINTS = ["llms.txt", "pricing.md"];

function normalise(value) {
  return String(value)
    .replace(/&#x27;|&#0*39;|&apos;|[‘’]/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;| /gi, " ")
    .replace(/\s+/g, " ");
}

export function scanText(value, route, surface) {
  const text = normalise(value);
  const findings = [];
  const terms = isMetaSurface(surface, route) ? [...BANNED, ...META_ONLY_BANNED] : BANNED;
  for (const term of terms) {
    const pattern = new RegExp(`(?<![A-Za-z])${term.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}(?![A-Za-z])`, "gi");
    for (const match of text.matchAll(pattern)) {
      const window = text.slice(Math.max(0, match.index - 90), match.index + match[0].length + 60);
      if (EXCEPTIONS.some((exception) => exception.context.test(window))) continue;
      findings.push({ route, surface, term, snippet: window.trim() });
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
