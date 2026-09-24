// gy-uu7mt: a COPY CHANGE-DETECTOR over the built site. NOT a positive pin of every block, and
// it must not be described as one (pm ruling 2026-09-24T15:4xZ, after tester's attack).
//
// WHAT IT DOES. copy-baseline.json is a reviewed snapshot of the blocks of copy in dist/ (html
// and text files), per route, sorted, one entry per line so a change is a reviewable diff. The
// check fails on: a block that ships but is not in the baseline (unapproved-copy), a baselined
// block that no longer ships (removed-copy), an html/text file in no baseline
// (unbaselined-surface), a file type it does not classify (fail closed), and a RULED string
// (copy-ruled-strings.json + content's vendored file) that is missing from the document.
// Enumeration is from the FILESYSTEM, not sitemap.xml. It made a paraphrase of any baselined
// block visible: 10 of 10 unseen paraphrases (a denylist caught 1 of 10).
//
// WHAT IT DOES NOT DO, so nobody reads green as more than it is:
//   1. PRESENCE, NOT VISIBILITY. A ruled string hidden with display:none still passes: the check
//      reads the document, not the page a person sees (gy-vawlh, P1).
//   2. STRUCTURE-BLIND. Blocks are a SET per route and surface: swapping two FAQ answers in the
//      JSON-LD, or moving or repeating a baselined block, passes.
//   3. NOT READ: <script type=json>-style data, strings that exist only in .js/.css bundles,
//      text inside images, function-rendered pages, outbound e-mail (gy-ylbzu).
//   4. Live parity masks e-mail addresses (Cloudflare rewrites them), so it cannot see an
//      address change on the deployed site. The LOCAL check does not mask them.
//   5. `--write` regenerates the baseline from dist and can rubber-stamp a bad change exactly as a
//      visual-baseline refresh can. The defence is the printed diff and the diff in the PR.
//   6. Gate self-test: tester's adversarial mutants of this gate were caught 7 of 10 (mine, 10 of
//      10, were mutants I chose). Two survivors are fixed here; treat 7/10 as the honest headline.
//
// PROVENANCE. `ruled:<id>` is stamped ONLY on a block that is BYTE-EQUAL to a ruled string. A
// block that merely CONTAINS one is `observed+mentions:<id>`: stamping ruled: on a contains-match
// would launder an unreviewed sentence appended to a reviewed one through a reviewed label.
// `observed` is a snapshot of what shipped, not a judgement that it is right.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { copyBlocks, servedTextBlocks, norm } from "./copy-blocks.mjs";
import { loadCanonical, canonicalRuled, CANON_DIR } from "./canonical-strings.mjs";

export const BASELINE_FILE = "copy-baseline.json";
export const RULED_FILE = "copy-ruled-strings.json";

// Every file type dist can hold is classified. An unknown extension FAILS the check, so a
// new kind of shipped file cannot slip through as "not something we look at".
export const HTML = new Set([".html"]);
export const TEXT = new Set([".txt", ".md", ".json", ".xml", ".svg", ".webmanifest", ".vtt", ".csv", ".map"]);
export const TEXT_NAMES = new Set(["_headers", "_redirects"]);
export const BINARY = new Set([".png", ".webp", ".jpg", ".jpeg", ".gif", ".avif", ".ico", ".mp4", ".webm", ".woff", ".woff2", ".ttf", ".otf"]);
// Bundled code. Runtime-only strings (form errors, modal text) live here and are NOT
// covered; that is a named gap (gy-uu7mt), not an oversight.
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
  const equal = [], mention = [];
  for (const r of ruled) {
    if (r.route && r.route !== route) continue;
    if (r.surface && r.surface !== surface) continue;
    if (r.equals !== undefined) { if (norm(r.equals) === text) equal.push(r.id); }
    else if (r.contains !== undefined && text.includes(norm(r.contains))) {
      // A contains-match says the block MENTIONS a ruled string. It says nothing about the
      // rest of the block, so it can never make the block `ruled`.
      if (norm(r.contains) === text) equal.push(r.id); else mention.push(r.id);
    }
  }
  const tail = mention.length ? `+mentions:${mention.join("+")}` : "";
  return equal.length ? `ruled:${equal.join("+")}${tail}` : `observed${tail}`;
}

export function serialiseLock(lock) {
  const lines = ['{', '  "version": 1,',
    '  "note": "Reviewed snapshot of the copy blocks the built site ships (gy-uu7mt); a COPY CHANGE-DETECTOR, not a positive pin (see scripts/copy-change-detector.mjs for what it does not cover). Regenerate with npm run copy-baseline:write and REVIEW THE DIFF. Provenance: ruled:<id> = byte-equal to a ruled string; observed = snapshot, not vouched for; +mentions:<id> = the block contains a ruled string.",',
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
  for (const route of [...shipped].sort()) if (!locked.has(route)) findings.push({ kind: "unbaselined-surface", route, detail: `${surfaces.get(route).length} block(s) ship on a file/page that is in no baseline` });
  for (const route of [...locked].sort()) if (!shipped.has(route)) findings.push({ kind: "removed-surface", route, detail: "baselined file/page no longer ships" });
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
  lines.push(`FAIL: ${findings.length} copy-change-detector finding(s): ${Object.entries(by).map(([k, v]) => `${k} x${v}`).join(", ")}`);
  for (const f of findings.slice(0, limit)) lines.push(`  ${f.kind} ${f.route}${f.surface ? ` [${f.surface}]` : ""}${f.text ? `: ${f.text.slice(0, 150)}` : ""}${f.detail ? ` (${f.detail})` : ""}`);
  if (findings.length > limit) lines.push(`  ... ${findings.length - limit} more`);
  lines.push("A change to shipped copy is intended? Rebuild, run `npm run copy-baseline:write`, and REVIEW the printed diff and the lock diff in the PR. It is not a way to turn this red green.");
  return lines.join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
    const root = opt("--root", "dist"), lockPath = opt("--baseline", BASELINE_FILE), ruledPath = opt("--ruled", RULED_FILE);
    // Ruled strings come from TWO places: content's vendored canonical strings (derived, never
    // retyped) and copy-ruled-strings.json (landing-cited rulings content has not yet added to
    // its file). `--canon none` is for fixtures.
    const canonDir = opt("--canon", CANON_DIR);
    const ruled = [...(canonDir === "none" ? [] : canonicalRuled(loadCanonical(canonDir))), ...loadRuled(ruledPath)];
    const { surfaces, unclassified, code } = scanDist(root);
    if (args.includes("--write")) {
      const next = toLock(surfaces, ruled);
      const prev = existsSync(lockPath) ? JSON.parse(readFileSync(lockPath, "utf8")) : { routes: {} };
      const findings = diffAgainstLock(surfaces, prev);
      console.log(`copy-change-detector --write: ${Object.keys(next.routes).length} route/file(s); changes vs the previous lock: ${findings.length}`);
      for (const f of findings.slice(0, 60)) console.log(`  ${f.kind} ${f.route}${f.surface ? ` [${f.surface}]` : ""}${f.text ? `: ${f.text.slice(0, 140)}` : ""}`);
      if (unclassified.length) throw new Error(`unclassified file type(s), classify them in copy-change-detector.mjs before writing: ${unclassified.join(", ")}`);
      writeFileSync(lockPath, serialiseLock(next));
      const prov = {}; for (const r of Object.values(next.routes)) for (const [, , p] of r) { const k = p.startsWith("ruled") ? "ruled" : p; prov[k] = (prov[k] || 0) + 1; }
      console.log(`wrote ${lockPath}: ${JSON.stringify(prov)}`);
    } else if (opt("--origin")) {
      throw new Error("live parity is run by scripts/copy-change-detector-live.mjs");
    } else {
      if (!existsSync(lockPath)) throw new Error(`${lockPath} is missing; refusing a vacuous pass (run npm run copy-baseline:write and review it)`);
      const lock = JSON.parse(readFileSync(lockPath, "utf8"));
      if (!lock.routes || !Object.keys(lock.routes).length) throw new Error(`${lockPath} pins nothing; refusing a vacuous pass`);
      const findings = [
        ...unclassified.map((f) => ({ kind: "unclassified-file-type", route: f, detail: "classify this extension in copy-change-detector.mjs (pin it, or list it as binary/code)" })),
        ...diffAgainstLock(surfaces, lock),
        ...checkRuled(surfaces, ruled),
      ];
      if (findings.length) { console.error(report(findings)); process.exitCode = 1; }
      else console.log(`OK: no change to shipped copy since the reviewed baseline: ${Object.keys(lock.routes).length} route/file(s), ${Object.values(lock.routes).reduce((n, r) => n + r.length, 0)} block(s), ${ruled.length} ruled string(s) present; ${code.length} code file(s) NOT covered (runtime-only strings, named gap gy-ylbzu). (ruled strings are checked for PRESENCE in the document, not visibility: gy-vawlh; see the header for what this does not cover)`);
    }
  } catch (error) {
    console.error(`COULD NOT EVALUATE copy change-detector: ${error.message}`);
    process.exitCode = 2;
  }
}
