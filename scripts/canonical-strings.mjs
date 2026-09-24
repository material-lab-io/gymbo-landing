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
import { existsSync, readFileSync } from "node:fs";
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
