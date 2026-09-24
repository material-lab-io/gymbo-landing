// gy-uu7mt: INVERTED gate for ONE retired concept, the "log" verb (Voice Guide sec 5: a
// class is punched, not logged). check-canonical-terms.mjs asks "does a banned phrase
// appear" and so passes every phrasing nobody listed ("Your clients just train. You log
// it."). This gate asks the opposite question: does a log verb appear ANYWHERE the site
// ships, and if so is that exact sentence JUSTIFIED by a content ruling in
// canonical-log-verb-registry.json? Unjustified means FAIL, so a new phrasing cannot
// pass by being unknown.
//
// The registry fails the other way (it can only grow permissive), so it is guarded:
//   * a reviewed file in the repo, never a runtime store;
//   * the entry count is PRINTED on every run, broken down by reason, so growth is visible;
//   * an entry with no content-ruling reference, an unknown reason, or a sentence that
//     holds no log verb is INVALID and REFUSED (fails closed, never skipped or warned);
//   * an entry that matches nothing shipped is STALE and fails, so the count stays true;
//   * an entry is keyed on the exact normalised sentence, so editing the sentence re-opens
//     the question.
// Scope: every route and every served text file (enumerated from the filesystem, the same
// enumeration copy-change-detector uses), per surface KIND: visible, metadata, JSON-LD,
// attribute, served text. It covers ONE concept; it says nothing about other vocabulary.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { scanDist } from "./copy-change-detector.mjs";

export const REGISTRY_FILE = "canonical-log-verb-registry.json";
export const REASONS = ["advice-to-reader", "attributed-quote", "competitor-description", "unrelated-log", "legal-text"];
export const KINDS = ["visible", "metadata", "json-ld", "attribute", "served-text"];

// "log in / log out / login / logo / catalog" are not the attendance verb.
const LOG_VERB = /(?<![A-Za-z])(?:log|logs|logged|logging|logger)(?![A-Za-z])(?!-?\s*(?:in|out|on|off)\b)/i;

export const ADVICE_FORBIDDEN = /\bGymbo\b|\bone[- ]tap\b/i;

export const kindOf = (surface) => {
  if (surface === "visible block") return "visible";
  if (surface === "served line") return "served-text";
  if (surface.startsWith("metadata")) return "metadata";
  if (surface.startsWith("JSON-LD")) return "json-ld";
  return "attribute";
};

// Sentences of one block. A block with no sentence punctuation (a table cell, a caption)
// is one sentence, which is the safe direction: it can only be MORE specific.
export const sentencesOf = (text) =>
  String(text).split(/(?<=[.!?])\s+(?=[A-Z0-9*"'(])/).map((s) => s.trim()).filter(Boolean);

export const keyOf = (route, kind, sentence) => `${route}\u0000${kind}\u0000${sentence}`;

export function occurrencesIn(surfaces) {
  const found = new Map();
  for (const [route, blocks] of surfaces) {
    for (const { surface, text } of blocks) {
      const kind = kindOf(surface);
      for (const sentence of sentencesOf(text)) {
        if (LOG_VERB.test(sentence)) found.set(keyOf(route, kind, sentence), { route, kind, sentence });
      }
    }
  }
  return found;
}

export function validateRegistry(registry) {
  const problems = [];
  if (!registry || registry.version !== 1 || !Array.isArray(registry.entries)) {
    return [{ kind: "invalid-registry", detail: 'expected {"version":1,"entries":[...]}' }];
  }
  const seen = new Set();
  registry.entries.forEach((e, i) => {
    const where = `entry #${i} (${e?.route ?? "?"})`;
    const bad = (detail) => problems.push({ kind: "invalid-entry", route: e?.route, sentence: e?.sentence, detail: `${where}: ${detail}` });
    if (!e || typeof e !== "object") return bad("not an object");
    if (typeof e.route !== "string" || !e.route.startsWith("/")) return bad("route must be a string starting with /");
    if (typeof e.sentence !== "string" || !LOG_VERB.test(e.sentence)) return bad("sentence must be the exact normalised sentence and contain a log verb");
    if (!Array.isArray(e.kinds) || !e.kinds.length || e.kinds.some((k) => !KINDS.includes(k))) return bad(`kinds must be a non-empty subset of ${KINDS.join("|")}`);
    if (!REASONS.includes(e.reason)) return bad(`reason must be one of ${REASONS.join("|")}`);
    // content's condition (2026-09-24 21:51Z): the ADVICE carve-out is only for sentences that
    // describe how a trainer works. One that names Gymbo or says "one tap" is describing the
    // product, so it can never be registered as advice, whatever the sentence says.
    if (e.reason === "advice-to-reader" && ADVICE_FORBIDDEN.test(e.sentence)) return bad("an advice-to-reader sentence must not name Gymbo or say 'one tap'; it describes the product, so it is not advice");
    if (typeof e.ruling !== "string" || e.ruling.trim().length < 12) return bad("ruling must cite the content ruling that allows this sentence; an entry without one is refused");
    for (const kind of e.kinds) {
      const key = keyOf(e.route, kind, e.sentence);
      if (seen.has(key)) bad(`duplicate of another entry for ${kind}`);
      seen.add(key);
    }
  });
  return problems;
}

export function checkLogVerbs(surfaces, registry) {
  const findings = validateRegistry(registry);
  const invalid = new Set(findings.filter((f) => f.kind === "invalid-entry").map((f) => `${f.route}\u0000${f.sentence}`));
  const occurrences = occurrencesIn(surfaces);
  const justified = new Map();
  for (const e of Array.isArray(registry?.entries) ? registry.entries : []) {
    if (invalid.has(`${e?.route}\u0000${e?.sentence}`)) continue;   // an invalid entry justifies nothing
    for (const kind of e.kinds ?? []) justified.set(keyOf(e.route, kind, e.sentence), e);
  }
  const used = new Set();
  for (const [key, o] of occurrences) {
    if (justified.has(key)) used.add(key);
    else findings.push({ kind: "unjustified-log-verb", route: o.route, surface: o.kind, sentence: o.sentence });
  }
  for (const [key, e] of justified) {
    if (!used.has(key)) {
      const kind = key.split("\u0000")[1];
      findings.push({ kind: "stale-entry", route: e.route, surface: kind, sentence: e.sentence, detail: "matches no shipped sentence; remove it or the sentence was edited" });
    }
  }
  const byReason = {};
  for (const e of Array.isArray(registry?.entries) ? registry.entries : []) byReason[e.reason] = (byReason[e.reason] || 0) + 1;
  return { findings, occurrences: occurrences.size, entries: Array.isArray(registry?.entries) ? registry.entries.length : 0, byReason };
}

export function loadRegistry(path = REGISTRY_FILE) {
  if (!existsSync(path)) throw new Error(`${resolve(path)} is missing; refusing to run with no registry (that would read as "nothing is justified" or "nothing is checked")`);
  return JSON.parse(readFileSync(path, "utf8"));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
    const { surfaces } = scanDist(opt("--root", "dist"));
    const registry = loadRegistry(opt("--registry", REGISTRY_FILE));
    const r = checkLogVerbs(surfaces, registry);
    const summary = `log-verb registry: ${r.entries} entr${r.entries === 1 ? "y" : "ies"} (${Object.entries(r.byReason).map(([k, v]) => `${k} ${v}`).join(", ") || "none"}); ${r.occurrences} log-verb sentence(s) shipped.`;
    if (args.includes("--propose")) {
      // Authoring aid only: prints the unjustified sentences as entry skeletons. It never
      // writes the registry, and reason + ruling must be filled in by a human from a ruling.
      const skeleton = r.findings.filter((f) => f.kind === "unjustified-log-verb")
        .map((f) => ({ route: f.route, kinds: [f.surface], sentence: f.sentence, reason: "", ruling: "" }));
      console.log(JSON.stringify(skeleton, null, 2));
      console.error(summary);
    } else if (r.findings.length) {
      console.error(`FAIL: ${r.findings.length} log-verb finding(s). ${summary}`);
      for (const f of r.findings.slice(0, 60)) console.error(`  ${f.kind} ${f.route ?? ""}${f.surface ? ` [${f.surface}]` : ""}: ${f.sentence ? f.sentence.slice(0, 170) : ""}${f.detail ? ` (${f.detail})` : ""}`);
      if (r.findings.length > 60) console.error(`  ... ${r.findings.length - 60} more`);
      console.error("A new log verb is either copy to fix (Voice Guide sec 5: punch, not log) or a sentence content has RULED allowed. Add a registry entry only with the ruling cited; an entry without one is refused.");
      process.exitCode = 1;
    } else {
      console.log(`OK: every log verb the site ships is justified by a cited content ruling. ${summary}`);
    }
  } catch (error) {
    console.error(`COULD NOT EVALUATE log-verb gate: ${error.message}`);
    process.exitCode = 2;
  }
}
