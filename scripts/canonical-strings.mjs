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

// v3 `facts`: content rules the NUMBERS; the site's constants (src/lib/trialAccess.ts) must EQUAL them.
// Price sentences are worded per surface and are deliberately not string-pinned, so this is the
// only thing that ties the constants to what content ruled. It covers the CONSTANTS FILE only:
// a price typed by hand in Terms.tsx or index.html is not read here (copy-facts.spec.ts and the
// copy-change-detector are what watch those).
export function loadFactsMap(dir = CANON_DIR) {
  const f = join(dir, "facts-map.json");
  if (!existsSync(f)) throw new Error(`${f} is missing; the facts-to-constants map is part of the gate`);
  return JSON.parse(readFileSync(f, "utf8"));
}

export function readConstants(src, names) {
  const out = {};
  for (const n of names) {
    const m = src.match(new RegExp(`^export const ${n}\\s*=\\s*(-?\\d+)\\s*;`, "m"));
    if (m) out[n] = Number(m[1]);
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
    if (!(name in got)) { findings.push({ kind: "cannot-read-constant", id: k, detail: `${name} is not a plain \`export const ${name} = <integer>;\` in ${factsMap.file}; fail closed rather than skip` }); continue; }
    if (got[name] !== facts[k]) findings.push({ kind: "fact-mismatch", id: k, detail: `${name} = ${got[name]} in ${factsMap.file}, content ruled ${facts[k]}` });
  }
  return findings;
}

// Files that type a rupee price BY HAND. checkFacts reads only the constants file, so these are the
// surfaces it does NOT read; the gate prints them on every green so "price pin OK" is never read as
// "every price on the site is pinned" (pm, gy-uu7mt 17:0xZ). Informational, never a failure.
export function findHandTypedPrices(root = ".", exclude = ["src/lib/trialAccess.ts"]) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(join(root, d))) {
      const rel = d ? `${d}/${e}` : e; const st = statSync(join(root, rel));
      if (st.isDirectory()) { if (e !== "node_modules") walk(rel); continue; }
      if (exclude.includes(rel) || !/\.(tsx?|html)$/.test(e)) continue;
      const n = (readFileSync(join(root, rel), "utf8").match(/\u20b9\s?\d/g) || []).length;
      if (n) out.push({ file: rel, count: n });
    }
  };
  walk("src"); if (existsSync(join(root, "index.html")) && !exclude.includes("index.html")) { const n = (readFileSync(join(root, "index.html"), "utf8").match(/\u20b9\s?\d/g) || []).length; if (n) out.push({ file: "index.html", count: n }); }
  return out.sort((a, b) => a.file.localeCompare(b.file));
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
