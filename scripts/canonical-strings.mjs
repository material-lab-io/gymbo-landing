// gy-uu7mt: content's canonical strings, VENDORED verbatim (src/canonical/), and what the
// built site must do with them. A pin a human retypes is a pin that drifts, so this module
// never contains a string: it reads content's JSON, checks it is byte-identical to the
// recorded source, and turns it into ruled entries for the copy baseline plus presence checks.
//
// WHAT THIS CHECKS, stated so a green is not over-read (content's caveat 2): it checks the
// LISTED web surfaces for PRESENCE IN THE DOCUMENT, not visibility to a reader (gy-vawlh): home meta description, og/JSON-LD description, twitter description,
// the gallery caption, the trial line, the trial detail and the comparison row. 'Ask Gymbo'
// and 'punch' are pinned as TERMS only. Free-form sentences that use them are pinned only
// by the copy-change-detector as `observed`. So green here is NOT "no retired wording anywhere".
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { norm } from "./copy-blocks.mjs";

export const CANON_DIR = "src/canonical";
export const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

export function loadCanonical(dir = CANON_DIR) {
  const need = ["gymbo-canonical-strings.json", "SOURCE.json", "web-surface-map.json"].map((f) => join(dir, f));
  for (const f of need) if (!existsSync(f)) throw new Error(`${f} is missing; the vendored canonical strings are part of the gate`);
  const raw = readFileSync(need[0]);
  const doc = JSON.parse(raw.toString("utf8"));
  const source = JSON.parse(readFileSync(need[1], "utf8"));
  const map = JSON.parse(readFileSync(need[2], "utf8")).map;
  if (!Array.isArray(doc.strings) || !doc.strings.length) throw new Error("canonical strings file has no strings; refusing a vacuous pass");
  return { doc, source, map, sha: sha256(raw) };
}

// CONSTANTS-FILE CHECK (v3 `facts`): content rules the NUMBERS; src/lib/trialAccess.ts must EQUAL them.
// It is NOT a price check on the built site: see findBuiltPrices for what it does not read.
// Price sentences are worded per surface and are deliberately not string-pinned, so this is the
// only thing that ties the constants to what content ruled. It covers the CONSTANTS FILE only:
// a price typed by hand in Terms.tsx or index.html is not read here (copy-facts.spec.ts and the
// copy-change-detector are what watch those).
export function loadFactsMap(dir = CANON_DIR) {
  const f = join(dir, "facts-map.json");
  if (!existsSync(f)) throw new Error(`${f} is missing; the facts-to-constants map is part of the gate`);
  return JSON.parse(readFileSync(f, "utf8"));
}

// Strip comments BEFORE matching (a block comment quoting the old declaration was read as the constant:
// tester F2) and require EXACTLY ONE declaration. Both are regex-on-source, so this is still a heuristic
// for "what tsc will compile": it fails closed (cannot-read-constant) whenever it is not sure.
const stripTsComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
export function readConstants(src, names) {
  const code = stripTsComments(src);
  const out = {};
  for (const n of names) {
    const all = [...code.matchAll(new RegExp(`^\\s*export const ${n}\\s*=\\s*([^;\\n]*);`, "gm"))];
    if (all.length !== 1) continue;
    const m = all[0][1].trim().match(/^-?\d+$/);
    if (m) out[n] = Number(m[0]);
  }
  return out;
}

export function checkFacts(doc, factsMap, tsSource) {
  const findings = [];
  const facts = doc.facts;
  if (!facts || typeof facts !== "object") return [{ kind: "facts-missing", detail: "the vendored canonical file has no `facts` block; refusing a vacuous pass" }];
  const keys = Object.keys(facts).filter((k) => !k.startsWith("_"));
  if (!keys.length) return [{ kind: "facts-missing", detail: "the `facts` block is empty; refusing a vacuous pass" }];
  for (const k of keys) if (!factsMap.map[k]) findings.push({ kind: "unmapped-fact", id: k, detail: "content added a fact that facts-map.json does not tie to a constant; map it" });
  for (const k of Object.keys(factsMap.map)) if (!keys.includes(k)) findings.push({ kind: "unknown-fact-mapping", id: k, detail: "facts-map.json names a fact that is not in the vendored file" });
  const names = Object.values(factsMap.map);
  const got = readConstants(tsSource, names);
  for (const [k, name] of Object.entries(factsMap.map)) {
    if (!keys.includes(k)) continue;
    if (!(name in got)) { findings.push({ kind: "cannot-read-constant", id: k, detail: `${name} is not declared exactly once, outside comments, as a plain \`export const ${name} = <integer>;\` in ${factsMap.file}; fail closed rather than skip` }); continue; }
    if (got[name] !== facts[k]) findings.push({ kind: "fact-mismatch", id: k, detail: `${name} = ${got[name]} in ${factsMap.file}, content ruled ${facts[k]}` });
  }
  return findings;
}

// BUILT files that state a rupee amount. The facts check compares NONE of them to content's ruled
// numbers (it reads only the constants file), so on every green the gate names them: a price change
// can leave every one of these stale with all gates OK (tester's 399->449 drill left eight stale:
// 3 alternatives, 2 blogs, the compare page, llms.txt, pricing.md). This scans dist/, the thing that
// ships, not src/, because src cannot see public/ files or generated JSON-LD. It reads html, md, txt,
// xml and json only: text inside the .js bundles is NOT scanned, and neither are images.
// Informational, never a failure. Includes competitor prices and constant-derived text on purpose:
// the point is which files the check does not verify, not which are wrong.
export function findBuiltPrices(root = "dist") {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(join(root, d))) {
      const rel = d ? `${d}/${e}` : e;
      if (statSync(join(root, rel)).isDirectory()) { walk(rel); continue; }
      if (!/\.(html?|md|txt|xml|json)$/i.test(e)) continue;
      const n = priceOccurrences(readFileSync(join(root, rel), "utf8")).length;
      if (n) out.push({ file: rel.replace(/\/index\.html$/, "/").replace(/^index\.html$/, "/"), count: n });
    }
  };
  if (!existsSync(root)) throw new Error(`${root} does not exist; cannot list the built files the price check does not read`);
  walk("");
  return out.sort((x, y) => x.file.localeCompare(y.file));
}

// gy-53qq5: THE PRICE PIN ON BUILT FILES. findBuiltPrices only NAMES files; this one FAILS. Content's
// `facts` rule the amounts; price-surfaces.json says which built files must state which. Amounts are
// read from the facts, never retyped, so when content bumps a price every listed file still carrying
// the old number goes red (the 399 -> 449 drill), and a file that states a current Gymbo amount but is
// not listed fails too (a new page cannot quote the price unwatched).
//
// NORMALISED (tester's attack2, M1+M2): an amount is read the way a person reads it, not the way a
// template wrote it. Marker = rupee sign (raw, entity, or JSON escape), 'Rs', 'Rs.', 'INR', or a
// trailing 'rupees'. Between the marker and the digits the gap may hold whitespace, nbsp, HTML comments
// and tags: React's own render emits '\u20b9<!-- -->399', so an ordinary edit produces that form.
// Grouping commas are optional ('2,999' and '2999' are one amount).
//
// EVERY amount in a LISTED file is then classified: a current ruled price, or a third-party figure
// declared in price-surfaces.json with a reason. Anything else is price-unclassified, printed in the
// form it was written. That is what turns a leftover old price into a red naming that occurrence,
// whatever spelling it is in. Still NOT covered: .js/.svg/.webmanifest (gy-53qq5.1 M4), presence-not-
// truth of the NEW amount (M3), '% savings' phrasings (M5), and a third-party amount declared at the
// same figure as a stale Gymbo price (the declaration hides it).
const PRICE_KEYS = ["monthlyINR", "annualINR", "annualMonthlyEquivalentINR"];
export const rupees = (n) => `\u20b9${Number(n).toLocaleString("en-IN")}`;
const GAP = String.raw`(?:\s|&nbsp;|&#160;|&#xa0;|<!--[\s\S]*?-->|<[^>]*>)*`;
const MARK = String.raw`(?:\u20b9|\\u20b9|&#8377;|&#x20b9;|(?<![A-Za-z])Rs\.?|(?<![A-Za-z])INR)`;
const NUM = String.raw`(\d[\d,]*(?:\.\d+)?)`;
const AMOUNT_RE = () => new RegExp(`${MARK}${GAP}${NUM}|${NUM}\\s*rupees?\\b`, "gi");
export function priceOccurrences(text) {
  return [...text.matchAll(AMOUNT_RE())].map((m) => ({ raw: m[0], value: Number((m[1] ?? m[2]).replace(/,/g, "")), index: m.index }));
}
const listBuiltText = (root) => {
  const out = new Map();
  const walk = (d) => {
    for (const e of readdirSync(join(root, d))) {
      const rel = d ? `${d}/${e}` : e;
      if (statSync(join(root, rel)).isDirectory()) { walk(rel); continue; }
      if (/\.(html?|md|txt|xml|json)$/i.test(e)) out.set(rel, readFileSync(join(root, rel), "utf8"));
    }
  };
  if (!existsSync(root)) throw new Error(`${root} does not exist; cannot check prices on a build that is not there`);
  walk("");
  return out;
};
export function loadPriceSurfaces(dir = CANON_DIR) {
  const f = join(dir, "price-surfaces.json");
  if (!existsSync(f)) throw new Error(`${f} is missing; the price pin's surface list is part of the gate`);
  const j = JSON.parse(readFileSync(f, "utf8"));
  if (!j.surfaces || !Object.keys(j.surfaces).length) throw new Error("price-surfaces.json lists no surfaces; refusing a vacuous pass");
  return j;
}
export function checkBuiltPricePin(facts, reg, root = "dist") {
  const findings = [];
  const files = listBuiltText(root);
  const amt = Object.fromEntries(PRICE_KEYS.map((k) => [k, facts[k]]));
  for (const k of PRICE_KEYS) if (!Number.isInteger(amt[k])) findings.push({ kind: "price-fact-missing", id: k, detail: `facts.${k} is not an integer; refusing a vacuous pass` });
  if (findings.length) return findings;
  const current = new Set(Object.values(amt));
  const tp = new Set((reg.thirdPartyAmounts?.entries || []).map((e) => `${e.file}|${e.amount}`));
  const shown = (o) => o.raw.replace(/\s+/g, " ").slice(0, 60);
  for (const [file, keys] of Object.entries(reg.surfaces)) {
    const text = files.get(file);
    if (text === undefined) { findings.push({ kind: "price-surface-missing", file, detail: "listed in price-surfaces.json but not in the build; remove it or fix the path" }); continue; }
    const occ = priceOccurrences(text);
    for (const key of keys) {
      if (key === "annualSavingsPercent") {
        const found = [...text.matchAll(/save\s+(\d+)\s?%/gi)].map((m) => Number(m[1]));
        if (!found.includes(facts.annualSavingsPercent)) findings.push({ kind: "price-stale", file, id: key, detail: `no 'Save ${facts.annualSavingsPercent}%' in the built file (found: ${found.join(", ") || "none"})` });
        continue;
      }
      if (!PRICE_KEYS.includes(key)) { findings.push({ kind: "price-registry-unknown-key", file, id: key, detail: "not a price fact this check knows" }); continue; }
      if (!occ.some((o) => o.value === amt[key])) findings.push({ kind: "price-stale", file, id: key, detail: `${file} does not state ${rupees(amt[key])} (${key}); the ruled price changed or the page did not follow` });
    }
    for (const o of occ) if (!current.has(o.value) && !tp.has(`${file}|${o.value}`)) findings.push({ kind: "price-unclassified", file, value: o.value, form: shown(o), detail: `${file} states ${JSON.stringify(shown(o))} (${o.value}), which is neither a current ruled price nor a declared third-party amount; if it is Gymbo's OLD price it is stale, otherwise declare it in thirdPartyAmounts with a reason` });
  }
  for (const [file, text] of files) {
    if (reg.surfaces[file]) continue;
    const seen = new Set();
    for (const o of priceOccurrences(text)) {
      const k = PRICE_KEYS.find((x) => amt[x] === o.value);
      if (k && !tp.has(`${file}|${o.value}`) && !seen.has(o.value)) { seen.add(o.value); findings.push({ kind: "price-unregistered", file, id: k, detail: `${file} states ${JSON.stringify(shown(o))} (${rupees(o.value)}) but is not in price-surfaces.json; list it (so it is pinned) or declare it thirdPartyAmounts with a reason` }); }
    }
  }
  for (const [file, text] of files) for (const m of text.matchAll(/save\s+(\d+)\s?%/gi)) if (Number(m[1]) !== facts.annualSavingsPercent) findings.push({ kind: "price-stale", file, id: "annualSavingsPercent", detail: `${file} says 'Save ${m[1]}%', content ruled ${facts.annualSavingsPercent}` });
  return findings;
}

// The standing negative control: bump every price and require the pin to go RED for EVERY listed
// (file, key) AND for EVERY occurrence, in whatever spelling, of a current Gymbo amount in a listed
// file (gy-53qq5 AC4 + tester's M1/M2: a pin that has never been seen to catch each form is not evidence).
export function priceDrill(facts, reg, root = "dist", bump = 37) {
  const drifted = { ...facts, monthlyINR: facts.monthlyINR + bump, annualINR: facts.annualINR + bump, annualMonthlyEquivalentINR: facts.annualMonthlyEquivalentINR + bump, annualSavingsPercent: facts.annualSavingsPercent + 1 };
  const red = checkBuiltPricePin(drifted, reg, root);
  const got = new Set(red.filter((f) => f.kind === "price-stale").map((f) => `${f.file}|${f.id}`));
  const missed = [];
  for (const [file, keys] of Object.entries(reg.surfaces)) for (const k of keys) if (!got.has(`${file}|${k}`)) missed.push(`${file}|${k}`);
  const files = listBuiltText(root);
  const now = new Set(PRICE_KEYS.map((k) => facts[k]));
  let occurrences = 0;
  for (const file of Object.keys(reg.surfaces)) {
    const mine = priceOccurrences(files.get(file) || "").filter((o) => now.has(o.value));
    occurrences += mine.length;
    for (const v of now) {
      const want = mine.filter((o) => o.value === v).length;
      const have = red.filter((f) => f.kind === "price-unclassified" && f.file === file && f.value === v).length;
      if (have < want) missed.push(`${file}|${want - have} of ${want} occurrence(s) of ${v}`);
    }
  }
  return { missed, total: Object.values(reg.surfaces).reduce((n, k) => n + k.length, 0), occurrences };
}

export const isWebId = (id, source) => (source.webSurfaceIdPrefixes || ["site.", "trial."]).some((p) => id.startsWith(p));

// Ruled entries for the copy baseline: every NON-waived target of every mapped web string.
export function canonicalRuled({ doc, source, map }) {
  const byId = new Map(doc.strings.map((s) => [s.id, s]));
  const out = [];
  for (const [id, m] of Object.entries(map)) {
    const s = byId.get(id);
    if (!s) continue;
    for (const t of m.targets) {
      if (t.waiver) continue;
      out.push({ id: `canonical.${id}`, route: t.route, surface: t.surface, [t.mode]: s.text, ref: `content canonical strings ${source.commit.slice(0, 8)} (${source.guideVersion})` });
    }
  }
  return out;
}

export function checkCanonical({ doc, source, map, sha }, surfaces, today = new Date().toISOString().slice(0, 10)) {
  const findings = [];
  const notes = [];
  if (sha !== source.sha256) findings.push({ kind: "canonical-hash-mismatch", detail: `vendored file sha256 ${sha.slice(0, 16)}... != recorded ${source.sha256.slice(0, 16)}... (hand edit, or a re-vendor without updating SOURCE.json)` });
  const byId = new Map(doc.strings.map((s) => [s.id, s]));
  for (const s of doc.strings) if (isWebId(s.id, source) && !map[s.id]) findings.push({ kind: "unmapped-web-string", id: s.id, detail: "content added a web-surface string that no target in web-surface-map.json says where to find; map it (or ask content to use an app-side id)" });
  for (const id of Object.keys(map)) if (!byId.has(id)) findings.push({ kind: "unknown-mapping", id, detail: "web-surface-map.json names an id that is not in the vendored strings" });
  const blocksOf = (t) => (surfaces.get(t.route) || []).filter((b) => b.surface === t.surface);
  const has = (t, text) => blocksOf(t).some((b) => (t.mode === "equals" ? b.text === norm(text) : b.text.includes(norm(text))));
  for (const [id, m] of Object.entries(map)) {
    const s = byId.get(id); if (!s) continue;
    for (const t of m.targets) {
      const where = `${t.route} [${t.surface}]`;
      // v2 adds `match` to a string that is a sentence inside larger blocks. Landing's map must
      // agree with content's own statement of how the string is matched, or it is a finding.
      if (s.match && s.match !== t.mode) findings.push({ kind: "match-mode-disagrees", id, route: t.route, surface: t.surface, detail: `content says match:${s.match}, web-surface-map.json says ${t.mode}` });
      const present = has(t, s.text);
      if (!t.waiver) { if (!present) findings.push({ kind: "canonical-string-missing", id, route: t.route, surface: t.surface, text: norm(s.text), detail: `${t.mode} on ${where}` }); continue; }
      if (present) { findings.push({ kind: "stale-waiver", id, route: t.route, surface: t.surface, detail: `the canonical string IS present on ${where}; remove the waiver` }); continue; }
      if (t.waiver.expires < today) findings.push({ kind: "waiver-expired", id, route: t.route, surface: t.surface, detail: `waiver expired ${t.waiver.expires} (${t.waiver.ref})` });
      if (!has(t, t.waiver.observed)) findings.push({ kind: "waiver-observed-missing", id, route: t.route, surface: t.surface, text: norm(t.waiver.observed), detail: "the text the waiver says the site carries is gone or changed: the divergence moved" });
      notes.push(`WAIVED ${id} on ${where}: site carries ${JSON.stringify(t.waiver.observed).slice(0, 90)} not the canonical string (${t.waiver.ref}; expires ${t.waiver.expires})`);
    }
  }
  return { findings, notes };
}
