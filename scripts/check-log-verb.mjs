// gy-uu7mt: INVERTED gate for ONE retired concept, the "log" verb (Voice Guide sec 5: a
// class is punched, not logged). check-canonical-terms.mjs asks "does a banned phrase
// appear" and so passes every phrasing nobody listed ("Your clients just train. You log
// it."). This gate asks the opposite question: does a log verb appear ANYWHERE the site
// ships, and if so is that exact sentence JUSTIFIED by an entry in
// canonical-log-verb-registry.json? Unjustified means FAIL.
//
// A registry that only checks its entries EXIST is a laundering mechanism (tester, PR 222:
// twelve junk characters bought an exemption, and an entry could DECLARE a tool sentence to
// be advice). So an entry is only valid when BOTH of these hold, and neither is a name:
//   1. its reason class has a MECHANICAL PREDICATE the sentence must satisfy. The gate tests
//      the sentence (and the route it ships on); the entry's claim about itself is never
//      believed. A predicate can only REFUTE a class, never prove it, so the ruling below
//      is what covers the rest;
//   2. CONTENT RULED THIS SENTENCE, in a file content owns. src/canonical/gymbo-sentence-
//      rulings.json is vendored VERBATIM from Gymbo-v1 (sha256 recorded in
//      SENTENCE-RULINGS-SOURCE.json, byte-checked here exactly as canonical strings are), and
//      each of its entries records the normalised sentence, the class, the bead AND the exact
//      bead comment it came from. A registry entry must match one of them on class + sentence
//      + comment id + bead, and that comment must be by content or pm. There is no fuzzy tie:
//      a comment that only MENTIONS a class cannot rule a sentence (pm 22:37Z). CI never calls
//      bd (a Dolt hiccup must not become a public deploy outage): a scheduled Gas City order
//      must run content's docs/rulings/vendor_sentence_rulings.py --verify against the LIVE
//      beads to catch the vendored copy going stale. THAT ORDER DOES NOT EXIST YET (pm owes it,
//      to be created when the file is on Gymbo-v1 main; gy-uu7mt). Until it does, the forgery
//      gap is real: the file and its sha256 record can be edited together in one PR and this
//      gate will accept it. Gate = this check; drift detector = that order, once it exists.
// Guards against silent growth stay: reviewed repo file, entry count printed every run,
// stale entries fail, editing a sentence re-opens it, kind and route are part of the key.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { scanDist, walk, routeOfFile } from "./copy-change-detector.mjs";
import { matchable } from "./text-normalise.mjs";

export const REGISTRY_FILE = "canonical-log-verb-registry.json";
export const RULINGS_FILE = "src/canonical/gymbo-sentence-rulings.json";
export const RULINGS_SOURCE_FILE = "src/canonical/SENTENCE-RULINGS-SOURCE.json";
export const REASONS = ["advice-to-reader", "attributed-quote", "competitor-description", "unrelated-log", "legal-text"];
export const KINDS = ["visible", "metadata", "json-ld", "attribute", "served-text"];
export const RULING_AUTHORS = ["gymbo/gymbo-crew.content", "gymbo/gymbo-crew.pm"];

// ONE normaliser (scripts/text-normalise.mjs, PR 223): entities decoded, NFKC, invisibles stripped,
// look-alikes and hyphen forms folded. This gate used to carry its own copy, which is exactly how
// the copy gates ended up disagreeing about what "the same text" is (tester, PR 222: after 223
// decodes &lrm; to U+200E a private list that omits it misses it). Its known residue (unlisted
// entities, Default_Ignorable code points, wider look-alikes) is listed on gy-illzd and is fixed
// there ONCE, for every gate.
export const normalise = (s) => matchable(s).trim();

// The verb and its variants (logbook, relog, loggers). "blog", "catalog", "login", "logo"
// have a letter before or after and never match.
const LOG_VERB = /(?<![A-Za-z])(?:re)?(?:log|logs|logged|logging|logger|loggers|logbook|logbooks)(?![A-Za-z])/i;
// The AUTH sense ("log in to your account") needs its object or a clause boundary. "log in
// one tap", "log on your phone", "log off each session", "log out the class" are the verb.
const AUTH = /(?<![A-Za-z])log\s+(?:in|out|on|off)(?=\s*(?:$|[.,;:!?)"”]|\s(?:to|with|via|using|again|first|here|now|instead|and|or)\b))/gi;
// A sentence in which a product lets the reader do the logging is never the auth sense.
const LETS = /\b(?:lets|helps|allows|enables)\s+you\b|\bmakes\s+it\s+(?:easy|simple)\b|\bautomatically\b/i;

export const hasLogVerb = (raw) => {
  const s = normalise(raw);
  return LOG_VERB.test(LETS.test(s) ? s : s.replace(AUTH, " "));
};

// ---- class predicates: each returns null when the sentence FITS the class, else why not ----
const NAME = /\bGymbo\b|\b(?:we|we're|our|us)\b/i;
const TAP = /\b(?:one|single|1)[- ]?(?:tap|click)\b|\btaps?\s+to\b|\ba\s+(?:tap|click)\b/i;
const TOOL_SUBJECT = /\b(?:app|apps|software|tool|tools|platform|tracker|dashboard|system|assistant|feature)\b(?:\s+\S+){0,3}?\s+(?:logs?|logging|logged)\b/i;
const FIRST_PERSON = /\b(?:I|I'm|I've|my|me)\b/;
const QUOTE_MARK = /[“”"]/;
const SERVER_LOG = /\b(?:standard|server|access|error|system|security|application|crash|diagnostic|audit|web)\s+logs\b/i;
const VERB_OBJECT = /\blogs?\s+(?:the|your|every|each|all|sessions?|classes|class|attendance|payments?|workouts?)\b/i;
const route = (r, ...prefixes) => prefixes.some((p) => r === p || r === `${p}/` || r.startsWith(`${p}/`));

export const PREDICATES = {
  // Advice describes how a TRAINER works. It cannot name Gymbo, speak as we/our/us, claim a
  // tap, let the reader do it, or have a tool as the subject of the log verb, and it can
  // only live on an editorial route.
  "advice-to-reader": (s, r) =>
    !route(r, "/guide", "/research", "/blog") ? "advice is only for /guide/, /research/ and /blog/ routes"
      : NAME.test(s) ? "names Gymbo or speaks as we/our/us: that is product voice, not advice"
      : TAP.test(s) ? "claims a one-tap action: that is a product claim"
      : LETS.test(s) ? "says something lets or automatically does it for you: that describes a tool"
      : TOOL_SUBJECT.test(s) ? "a tool (app, software, tracker...) is the subject of the log verb: that describes a tool"
      : null,
  // A competitor row describes someone else's product: never Gymbo's own claim.
  "competitor-description": (s, r) =>
    !route(r, "/alternatives", "/compare") ? "competitor descriptions live on /alternatives/ and /compare/ only"
      : NAME.test(s) ? "names Gymbo or speaks as we/our/us: that is Gymbo's own claim"
      : TAP.test(s) ? "claims a one-tap action"
      : null,
  // Contract and notice wording. It may name the service (contracts do) but is never marketing.
  "legal-text": (s, r) =>
    !route(r, "/terms", "/privacy") ? "legal text lives on /terms/ and /privacy/ only"
      : TAP.test(s) || LETS.test(s) ? "a tap or 'lets you' claim is marketing, not legal text"
      : TOOL_SUBJECT.test(s) ? "a tool is the subject of the log verb"
      : null,
  // A testimonial is a person speaking in the first person inside quotation marks.
  "attributed-quote": (s, r) =>
    r !== "/" ? "the ruled testimonial lives on the home page only; content's ruling names a sentence, not a route, so any other route needs its own ruling and a widened predicate (tester, PR 222)"
      : !FIRST_PERSON.test(s) ? "not first person: a testimonial is a person speaking"
      : !QUOTE_MARK.test(s) ? "no quotation mark: not marked as a quoted testimonial"
      : null,
  // Server logs in a privacy or terms notice: "log" is a NOUN, and no verb-object follows.
  "unrelated-log": (s, r) =>
    !route(r, "/privacy", "/terms") ? "server-log wording lives in /privacy/ and /terms/ only"
      : !SERVER_LOG.test(s) ? "not a server/access/error/system log noun"
      : VERB_OBJECT.test(s) ? "a log verb with an object: that is the attendance verb, not a server log"
      : null,
};

export const kindOf = (surface) => {
  if (surface === "visible block") return "visible";
  if (surface === "served line") return "served-text";
  if (surface.startsWith("metadata")) return "metadata";
  if (surface.startsWith("JSON-LD")) return "json-ld";
  return "attribute";
};

export const sentencesOf = (text) =>
  normalise(text).split(/(?<=[.!?])\s+(?=[A-Z0-9*"'“(])/).map((s) => s.trim()).filter(Boolean);

export const keyOf = (r, kind, sentence) => `${r}\u0000${kind}\u0000${normalise(sentence)}`;

// What copy-change-detector's block extractor does not hand us: <noscript> text (stripped
// there by design) and every attribute VALUE. Read from the raw html so nothing user-facing
// or crawler-facing hides in a place the block extractor skips.
const SKIP_ATTR = new Set(["class", "id", "href", "src", "srcset", "style", "d", "for", "rel", "type", "charset", "crossorigin", "integrity", "as", "sizes", "viewbox", "xmlns", "media", "target", "role", "lang", "name", "property", "http-equiv", "content"]);   // content: <meta> is already read as a metadata block
export function htmlExtras(html) {
  const out = [];
  for (const m of html.matchAll(/<noscript\b[^>]*>([\s\S]*?)<\/noscript\s*>/gi)) {
    const text = normalise(m[1].replace(/<[^>]+>/g, " "));
    if (text) out.push({ surface: "visible block", text });
  }
  const tags = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  for (const tag of tags.matchAll(/<[a-zA-Z][^>]*>/g)) {
    for (const a of tag[0].matchAll(/\s([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      if (SKIP_ATTR.has(a[1].toLowerCase())) continue;
      const text = normalise(a[2] ?? a[3] ?? "");
      if (a[1].toLowerCase().startsWith("data-") && !/\s/.test(text)) continue;   // an identifier (data-demo-id="log-payment"), not copy
      if (text) out.push({ surface: `attribute ${a[1].toLowerCase()}`, text });
    }
  }
  return out;
}

export function occurrencesIn(surfaces) {
  const found = new Map();
  for (const [r, blocks] of surfaces) {
    for (const { surface, text } of blocks) {
      const kind = kindOf(surface);
      for (const sentence of sentencesOf(text)) {
        if (hasLogVerb(sentence)) found.set(keyOf(r, kind, sentence), { route: r, kind, sentence });
      }
    }
  }
  return found;
}

const loose = (x) => normalise(x).toLowerCase().replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[\s"'.!?]+$/g, "").trim();
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

export function validateRegistry(registry, rulings) {
  const problems = [];
  if (!registry || registry.version !== 1 || !Array.isArray(registry.entries)) {
    return [{ kind: "invalid-registry", detail: 'expected {"version":1,"entries":[...]}' }];
  }
  if (!rulings || !Array.isArray(rulings.entries)) return [{ kind: "invalid-registry", detail: `no rulings file loaded (${RULINGS_FILE})` }];
  problems.push(...(rulings.problems ?? []));
  if (problems.length) return problems;   // a rulings file that fails its own checks rules nothing
  const seen = new Set();
  registry.entries.forEach((e, i) => {
    const sentence = typeof e?.sentence === "string" ? normalise(e.sentence) : undefined;
    const bad = (detail) => problems.push({ kind: "invalid-entry", route: e?.route, sentence, detail: `entry #${i} (${e?.route ?? "?"}): ${detail}` });
    if (!e || typeof e !== "object") return bad("not an object");
    if (typeof e.route !== "string" || !e.route.startsWith("/")) return bad("route must be a string starting with /");
    if (!sentence || !hasLogVerb(sentence)) return bad("sentence must be the exact normalised sentence and contain a log verb");
    if (!Array.isArray(e.kinds) || !e.kinds.length || e.kinds.some((k) => !KINDS.includes(k))) return bad(`kinds must be a non-empty subset of ${KINDS.join("|")}`);
    if (!REASONS.includes(e.reason)) return bad(`reason must be one of ${REASONS.join("|")}`);
    // 1. the class must be TRUE of the sentence, tested, whatever the entry claims
    const why = PREDICATES[e.reason](sentence, e.route);
    if (why) return bad(`not ${e.reason}: ${why}`);
    // 2. CONTENT must have ruled THIS sentence, in this class, in a specific comment
    const ru = e.ruling;
    if (!ru || typeof ru !== "object" || typeof ru.bead !== "string" || typeof ru.comment !== "string") {
      return bad("ruling must be {bead, comment}: the exact bead comment content ruled this sentence in; free text is not a reference");
    }
    const ofSentence = rulings.entries.filter((v) => typeof v?.sentence === "string" && loose(v.sentence) === loose(sentence));
    if (!ofSentence.length) return bad("content has not ruled this sentence: it is not in the vendored rulings file (a comment that merely mentions a class rules nothing)");
    const ofClass = ofSentence.filter((v) => v.class === e.reason);
    if (!ofClass.length) return bad(`content ruled this sentence as ${[...new Set(ofSentence.map((v) => v.class))].join("/")}, not ${e.reason}`);
    const v = ofClass.find((x) => x.commentId === ru.comment);
    if (!v) return bad(`content's ruling for this sentence is comment ${ofClass.map((x) => x.commentId).join(", ")}, not ${ru.comment}`);
    if (v.bead !== ru.bead) return bad(`comment ${ru.comment} is on ${v.bead}, not ${ru.bead}`);
    if (v.ruling !== "RULED") return bad(`the vendored ruling is '${v.ruling}', not RULED`);
    if (!RULING_AUTHORS.includes(v.commentAuthor)) return bad(`comment ${ru.comment} was written by ${v.commentAuthor}; only ${RULING_AUTHORS.join(" or ")} can rule`);
    for (const kind of e.kinds) {
      const key = keyOf(e.route, kind, sentence);
      if (seen.has(key)) bad(`duplicate of another entry for ${kind}`);
      seen.add(key);
    }
  });
  return problems;
}

export function checkLogVerbs(surfaces, registry, rulings, extra = {}) {
  const findings = validateRegistry(registry, rulings);
  const invalid = new Set(findings.filter((f) => f.kind === "invalid-entry").map((f) => `${f.route}\u0000${f.sentence}`));
  for (const f of extra.unclassified ?? []) findings.push({ kind: "unclassified-file", route: `/${f}`, detail: "a file type this gate does not know is not scanned; classify it or remove it (fail closed)" });
  const occurrences = occurrencesIn(surfaces);
  const justified = new Map();
  for (const e of Array.isArray(registry?.entries) ? registry.entries : []) {
    if (typeof e?.sentence !== "string") continue;
    if (invalid.has(`${e.route}\u0000${normalise(e.sentence)}`)) continue;   // an invalid entry justifies nothing
    for (const kind of e.kinds ?? []) justified.set(keyOf(e.route, kind, e.sentence), e);
  }
  const used = new Set();
  for (const [key, o] of occurrences) {
    if (justified.has(key)) used.add(key);
    else findings.push({ kind: "unjustified-log-verb", route: o.route, surface: o.kind, sentence: o.sentence });
  }
  for (const [key, e] of justified) {
    if (!used.has(key)) {
      findings.push({ kind: "stale-entry", route: e.route, surface: key.split("\u0000")[1], sentence: normalise(e.sentence), detail: "matches no shipped sentence; remove it or the sentence was edited" });
    }
  }
  const byReason = {};
  for (const e of Array.isArray(registry?.entries) ? registry.entries : []) byReason[e.reason] = (byReason[e.reason] || 0) + 1;
  return { findings, occurrences: occurrences.size, entries: Array.isArray(registry?.entries) ? registry.entries.length : 0, byReason };
}

const load = (path, what) => {
  if (!existsSync(path)) throw new Error(`${resolve(path)} is missing; refusing to run without the ${what} (that would read as "nothing is justified" or "nothing is checked")`);
  return JSON.parse(readFileSync(path, "utf8"));
};
export const loadRegistry = (path = REGISTRY_FILE) => load(path, "registry");
// The vendored rulings file is byte-checked against its recorded sha256, exactly as content's
// canonical strings are. Any problem here is reported as a finding, so a modified file makes the
// whole gate red rather than being skipped.
export function loadRulings(path = RULINGS_FILE, sourcePath = RULINGS_SOURCE_FILE) {
  for (const [p, what] of [[path, "vendored rulings file"], [sourcePath, "rulings provenance record"]]) {
    if (!existsSync(p)) throw new Error(`${resolve(p)} is missing; refusing to run without the ${what}`);
  }
  const bytes = readFileSync(path);
  const source = JSON.parse(readFileSync(sourcePath, "utf8"));
  const doc = JSON.parse(bytes.toString("utf8"));
  const problems = [];
  if (typeof source.sha256 !== "string" || sha256(bytes) !== source.sha256) {
    problems.push({ kind: "rulings-file-modified", detail: `${path} sha256 ${sha256(bytes).slice(0, 12)} differs from the recorded ${String(source.sha256).slice(0, 12)}: the file is vendored VERBATIM from content and is never hand-edited; re-vendor it with a new content ruling` });
  }
  if (doc.version !== 1 || !Array.isArray(doc.entries)) problems.push({ kind: "invalid-registry", detail: "the rulings file must be {version: 1, entries: [...]}" });
  else if (!doc.entries.length) problems.push({ kind: "invalid-registry", detail: "the rulings file has no entries; an empty file proves nothing" });
  return { entries: Array.isArray(doc.entries) ? doc.entries : [], problems, source, sha: sha256(bytes) };
}

export function collectSurfaces(root) {
  const { surfaces, unclassified, code } = scanDist(root);
  const base = resolve(root);
  for (const f of walk(base)) {
    if (!f.endsWith(".html")) continue;
    const r = routeOfFile(f);
    surfaces.set(r, [...(surfaces.get(r) ?? []), ...htmlExtras(readFileSync(join(base, f), "utf8"))]);
  }
  return { surfaces, unclassified, code };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
    const { surfaces, unclassified, code } = collectSurfaces(opt("--root", "dist"));
    const registry = loadRegistry(opt("--registry", REGISTRY_FILE));
    const rulings = loadRulings(opt("--rulings", RULINGS_FILE), opt("--rulings-source", RULINGS_SOURCE_FILE));
    const r = checkLogVerbs(surfaces, registry, rulings, { unclassified });
    const summary = `log-verb registry: ${r.entries} entr${r.entries === 1 ? "y" : "ies"} (${Object.entries(r.byReason).map(([k, v]) => `${k} ${v}`).join(", ") || "none"}); ${r.occurrences} log-verb sentence(s) shipped; rulings ${rulings.sha.slice(0, 12)} from ${rulings.source.mergedToMain ? "Gymbo-v1 main" : "an OPEN Gymbo-v1 PR (not on main yet)"} ${String(rulings.source.commit).slice(0, 8)}; drift order: ${rulings.source.driftOrder?.exists ? "declared to exist (this gate cannot check that)" : "NOT YET CREATED, so a rulings file and its sha256 record forged together in one PR pass this gate (gy-uu7mt)"}; ${code.length} code file(s) NOT scanned (named gap: strings that exist only in a JS/CSS bundle).`;
    if (args.includes("--propose")) {
      // Authoring aid only: never writes the registry. reason + ruling must come from a real ruling.
      const skeleton = r.findings.filter((f) => f.kind === "unjustified-log-verb")
        .map((f) => ({ route: f.route, kinds: [f.surface], sentence: f.sentence, reason: "", ruling: { bead: "", comment: "" } }));
      console.log(JSON.stringify(skeleton, null, 2));
      console.error(summary);
    } else if (r.findings.length) {
      console.error(`FAIL: ${r.findings.length} log-verb finding(s). ${summary}`);
      for (const f of r.findings.slice(0, 60)) console.error(`  ${f.kind} ${f.route ?? ""}${f.surface ? ` [${f.surface}]` : ""}: ${f.sentence ? f.sentence.slice(0, 170) : ""}${f.detail ? ` (${f.detail})` : ""}`);
      if (r.findings.length > 60) console.error(`  ... ${r.findings.length - 60} more`);
      console.error("A new log verb is either copy to fix (Voice Guide sec 5: punch, not log) or a sentence content has RULED allowed. An entry must satisfy its class predicate AND match a sentence-level ruling content vendored (class + sentence + comment id); neither can be asserted.");
      process.exitCode = 1;
    } else {
      console.log(`OK: every log verb the site ships is justified by a class the gate verified and a sentence-level ruling content vendored. ${summary}`);
    }
  } catch (error) {
    console.error(`COULD NOT EVALUATE log-verb gate: ${error.message}`);
    process.exitCode = 2;
  }
}
