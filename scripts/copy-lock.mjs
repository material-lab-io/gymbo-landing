// gy-uu7mt: a POSITIVE PIN over everything the built site ships as copy.
//
// The canonical-terms gate is a DENYLIST: it asks "is this one of the wrong things?" and
// a paraphrase always walks around it (measured 2026-09-24: 1 of 10 unseen paraphrases
// caught). This gate asks the other question: "is this exactly the copy we approved?"
// A paraphrase cannot pass it, because a paraphrase simply is not the pinned string.
//
// copy-lock.json is a snapshot of every block of copy in dist/, per route, sorted, one
// entry per line so a change is reviewable as a diff. The check fails on:
//   - a block that ships but is not in the lock        (unapproved copy)
//   - a block in the lock that no longer ships         (removed copy)
//   - an html/text file that ships but is not in the lock (UNPINNED SURFACE: coverage)
//   - a file whose type this script does not classify  (fail closed, not skipped)
//   - a RULED string (copy-lock-ruled.json) that is missing from the site
// Coverage is enumerated from the FILESYSTEM of the artifact, not from sitemap.xml, so a
// page that ships but is not in the sitemap is still a surface (the existing gates find
// pages through the sitemap only).
//
// Every entry carries provenance: `ruled` (matches a string content ruled) or `observed`
// (a snapshot of what shipped, pinned so it cannot change unreviewed, but NOT vouched
// for). `observed` is honest debt: it is reported, never hidden.
//
// LIMIT, stated so it is not rediscovered: `--write` regenerates the lock from dist, and a
// regenerate can rubber-stamp a bad change exactly as a visual-baseline refresh can. The
// defence is that the lock diff is printed, is in the PR, and `ruled` strings cannot be
// changed by regenerating (they are checked against copy-lock-ruled.json separately).
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { copyBlocks, servedTextBlocks, norm } from "./copy-blocks.mjs";
import { loadCanonical, canonicalRuled, CANON_DIR } from "./canonical-strings.mjs";

export const LOCK_FILE = "copy-lock.json";
export const RULED_FILE = "copy-lock-ruled.json";

// Every file type dist can hold is classified. An unknown extension FAILS the check, so a
// new kind of shipped file cannot slip through as "not something we look at".
export const HTML = new Set([".html"]);
export const TEXT = new Set([".txt", ".md", ".json", ".xml", ".svg", ".webmanifest", ".vtt", ".csv", ".map"]);
export const TEXT_NAMES = new Set(["_headers", "_redirects"]);
export const BINARY = new Set([".png", ".webp", ".jpg", ".jpeg", ".gif", ".avif", ".ico", ".mp4", ".webm", ".woff", ".woff2", ".ttf", ".otf"]);
// Bundled code. Runtime-only strings (form errors, modal text) live here and are NOT
// pinned; that is a named gap (gy-uu7mt), not an oversight.
export const CODE = new Set([".js", ".mjs", ".css"]);

export function walk(root, dir = root, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(root, full, out);
    else out.push("/" + relative(root, full).split(sep).join("/"));
  }
  return out;
}

export function routeOfFile(path) {
  if (path.endsWith("/index.html")) return path.slice(0, -"index.html".length);
  return path;
}

// Cloudflare rewrites e-mail addresses to "[email protected]" on the deployed site, so a
// live comparison must mask addresses on BOTH sides. The lock itself keeps the real one.
export const maskEmails = (s) => String(s).replace(/\[email\s*protected\]/gi, "<email>").replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "<email>");

export function collectBlocks(read, files) {
  const surfaces = new Map();   // route -> [{surface,text}]
  const unclassified = [];
  const code = [];
  for (const path of files) {
    const ext = extname(path).toLowerCase();
    const name = path.split("/").pop();
    if (HTML.has(ext)) surfaces.set(routeOfFile(path), copyBlocks(read(path), routeOfFile(path)));
    else if (TEXT.has(ext) || TEXT_NAMES.has(name)) surfaces.set(path, servedTextBlocks(read(path)));
    else if (BINARY.has(ext)) continue;
    else if (CODE.has(ext)) code.push(path);
    else unclassified.push(path);
  }
  return { surfaces, unclassified, code };
}

const entryKey = (surface, text) => `${surface}\u0000${text}`;

export function toLock(surfaces, ruled = []) {
  const routes = {};
  for (const route of [...surfaces.keys()].sort()) {
    const seen = new Map();
    for (const { surface, text } of surfaces.get(route)) seen.set(entryKey(surface, text), { surface, text });
    routes[route] = [...seen.values()]
      .sort((a, b) => a.surface.localeCompare(b.surface) || a.text.localeCompare(b.text))
      .map(({ surface, text }) => [surface, text, provenanceOf(route, surface, text, ruled)]);
  }
  return { version: 1, routes };
}

export function provenanceOf(route, surface, text, ruled) {
  const ids = [];
  for (const r of ruled) {
    if (r.route && r.route !== route) continue;
    if (r.surface && r.surface !== surface) continue;
    if (r.equals !== undefined ? norm(r.equals) === text : r.contains !== undefined && text.includes(norm(r.contains))) ids.push(r.id);
  }
  return ids.length ? `ruled:${ids.join("+")}` : "observed";
}

export function serialiseLock(lock) {
  const lines = ['{', '  "version": 1,',
    '  "note": "Positive pin over every block of copy the built site ships (gy-uu7mt). Regenerate with npm run copy-lock:write and REVIEW THE DIFF; provenance ruled:<id> = matches copy-lock-ruled.json, observed = pinned but not vouched for.",',
    '  "routes": {'];
  const routes = Object.keys(lock.routes);
  routes.forEach((route, i) => {
    lines.push(`    ${JSON.stringify(route)}: [`);
    lock.routes[route].forEach((e, j) => lines.push(`      ${JSON.stringify(e)}${j < lock.routes[route].length - 1 ? "," : ""}`));
    lines.push(`    ]${i < routes.length - 1 ? "," : ""}`);
  });
  lines.push("  }", "}", "");
  return lines.join("\n");
}

export function diffAgainstLock(surfaces, lock, { mask = (s) => s } = {}) {
  const findings = [];
  const shipped = new Set(surfaces.keys());
  const locked = new Set(Object.keys(lock.routes));
  for (const route of [...shipped].sort()) if (!locked.has(route)) findings.push({ kind: "unpinned-surface", route, detail: `${surfaces.get(route).length} block(s) ship on a file/page that has no pin` });
  for (const route of [...locked].sort()) if (!shipped.has(route)) findings.push({ kind: "removed-surface", route, detail: "pinned file/page no longer ships" });
  for (const route of [...shipped].filter((r) => locked.has(r)).sort()) {
    const have = new Map(surfaces.get(route).map(({ surface, text }) => [entryKey(surface, mask(text)), { surface, text }]));
    const pinned = new Map(lock.routes[route].map(([surface, text]) => [entryKey(surface, mask(text)), { surface, text }]));
    for (const [k, v] of have) if (!pinned.has(k)) findings.push({ kind: "unapproved-copy", route, surface: v.surface, text: v.text });
    for (const [k, v] of pinned) if (!have.has(k)) findings.push({ kind: "removed-copy", route, surface: v.surface, text: v.text });
  }
  return findings;
}

export function checkRuled(surfaces, ruled) {
  const findings = [];
  for (const r of ruled) {
    const want = norm(r.equals ?? r.contains);
    const pool = [...surfaces.entries()].filter(([route]) => !r.route || route === r.route).flatMap(([, blocks]) => blocks).filter((b) => !r.surface || b.surface === r.surface);
    const ok = pool.some((b) => (r.equals !== undefined ? b.text === want : b.text.includes(want)));
    if (!ok) findings.push({ kind: "ruled-string-missing", route: r.route || "(any)", surface: r.surface || "(any)", text: want, detail: `ruled ${r.id} (${r.ref})` });
  }
  return findings;
}

export function loadRuled(path) {
  if (!existsSync(path)) throw new Error(`${path} is missing; the ruled-strings list is part of the gate`);
  const doc = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(doc.ruled) || !doc.ruled.length) throw new Error(`${path} has no ruled strings; refusing a vacuous pass`);
  for (const r of doc.ruled) if (!r.id || (r.equals === undefined && r.contains === undefined) || !r.ref) throw new Error(`${path}: ruled entry needs id, ref and equals|contains: ${JSON.stringify(r).slice(0, 100)}`);
  return doc.ruled;
}

export function scanDist(root) {
  const base = resolve(root);
  if (!existsSync(base)) throw new Error(`${base} is missing; run the build before this gate`);
  const files = walk(base);
  if (!files.some((f) => f.endsWith(".html"))) throw new Error(`${base} contains no html; refusing a vacuous pass`);
  return collectBlocks((p) => readFileSync(join(base, p), "utf8"), files);
}

function report(findings, limit = 40) {
  const lines = [];
  const by = {};
  for (const f of findings) by[f.kind] = (by[f.kind] || 0) + 1;
  lines.push(`FAIL: ${findings.length} copy-lock finding(s): ${Object.entries(by).map(([k, v]) => `${k} x${v}`).join(", ")}`);
  for (const f of findings.slice(0, limit)) lines.push(`  ${f.kind} ${f.route}${f.surface ? ` [${f.surface}]` : ""}${f.text ? `: ${f.text.slice(0, 150)}` : ""}${f.detail ? ` (${f.detail})` : ""}`);
  if (findings.length > limit) lines.push(`  ... ${findings.length - limit} more`);
  lines.push("A change to shipped copy is intended? Rebuild, run `npm run copy-lock:write`, and REVIEW the printed diff and the lock diff in the PR. It is not a way to turn this red green.");
  return lines.join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
    const root = opt("--root", "dist"), lockPath = opt("--lock", LOCK_FILE), ruledPath = opt("--ruled", RULED_FILE);
    // Ruled strings come from TWO places: content's vendored canonical strings (derived, never
    // retyped) and copy-lock-ruled.json (landing-cited rulings content has not yet added to
    // its file). `--canon none` is for fixtures.
    const canonDir = opt("--canon", CANON_DIR);
    const ruled = [...(canonDir === "none" ? [] : canonicalRuled(loadCanonical(canonDir))), ...loadRuled(ruledPath)];
    const { surfaces, unclassified, code } = scanDist(root);
    if (args.includes("--write")) {
      const next = toLock(surfaces, ruled);
      const prev = existsSync(lockPath) ? JSON.parse(readFileSync(lockPath, "utf8")) : { routes: {} };
      const findings = diffAgainstLock(surfaces, prev);
      console.log(`copy-lock --write: ${Object.keys(next.routes).length} route/file(s); changes vs the previous lock: ${findings.length}`);
      for (const f of findings.slice(0, 60)) console.log(`  ${f.kind} ${f.route}${f.surface ? ` [${f.surface}]` : ""}${f.text ? `: ${f.text.slice(0, 140)}` : ""}`);
      if (unclassified.length) throw new Error(`unclassified file type(s), classify them in copy-lock.mjs before writing: ${unclassified.join(", ")}`);
      writeFileSync(lockPath, serialiseLock(next));
      const prov = {}; for (const r of Object.values(next.routes)) for (const [, , p] of r) { const k = p.startsWith("ruled") ? "ruled" : p; prov[k] = (prov[k] || 0) + 1; }
      console.log(`wrote ${lockPath}: ${JSON.stringify(prov)}`);
    } else if (opt("--origin")) {
      throw new Error("live parity is run by scripts/copy-lock-live.mjs");
    } else {
      if (!existsSync(lockPath)) throw new Error(`${lockPath} is missing; refusing a vacuous pass (run npm run copy-lock:write and review it)`);
      const lock = JSON.parse(readFileSync(lockPath, "utf8"));
      if (!lock.routes || !Object.keys(lock.routes).length) throw new Error(`${lockPath} pins nothing; refusing a vacuous pass`);
      const findings = [
        ...unclassified.map((f) => ({ kind: "unclassified-file-type", route: f, detail: "classify this extension in copy-lock.mjs (pin it, or list it as binary/code)" })),
        ...diffAgainstLock(surfaces, lock),
        ...checkRuled(surfaces, ruled),
      ];
      if (findings.length) { console.error(report(findings)); process.exitCode = 1; }
      else console.log(`OK: every block of shipped copy is pinned: ${Object.keys(lock.routes).length} route/file(s), ${Object.values(lock.routes).reduce((n, r) => n + r.length, 0)} block(s), ${ruled.length} ruled string(s) present; ${code.length} code file(s) not pinned (runtime-only strings, named gap).`);
    }
  } catch (error) {
    console.error(`COULD NOT EVALUATE copy lock: ${error.message}`);
    process.exitCode = 2;
  }
}
