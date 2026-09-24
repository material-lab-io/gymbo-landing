// gy-dwxbm: content-hash the self-hosted font assets in dist/fonts/ and rewrite every reference.
//
// WHY. public/_headers serves /fonts/* as `Cache-Control: public, max-age=31536000, immutable`.
// That is only safe for a URL that names its content. /fonts/fonts.css and the two .woff2 files were
// UNHASHED, so any change to them ships to nobody: an edge copy or a visitor's browser holds the old
// bytes for a year and never revalidates. It already happened: PR 215 stripped a bead-id comment out
// of fonts.css, the origin serves the clean 355 B file, and visitors were still served a 47-day-old
// 644 B copy carrying it. A purge cannot reach browser caches; a NEW URL does.
//
// WHAT. Runs LAST in `npm run build` (after strip-internal-comments, so the hash is of the final
// bytes). For each file in dist/fonts/: binary fonts first (hash of their bytes), then any CSS there
// (its url() references are rewritten to the hashed font names BEFORE it is hashed, so the CSS hash
// covers them), then every html/css/js/svg/txt/md file under dist/ is rewritten from the old URL to
// the new. The unhashed names are NOT left behind, so the old URLs 404 at the origin.
//
// FAIL-CLOSED, because a silent partial rewrite ships a page with a broken font:
//   - a renamed file that nothing references           -> error (orphan)
//   - a reference to /fonts/<name> with no such file    -> error (dangling)
//   - any old name still present in dist after rewrite  -> error (leftover)
// (No 'unhashed file left' assertion: every non-hashed file is renamed unconditionally and renameSync
// throws on failure, so such a check could never fire; it was removed as dead code, not kept as decoration.)
// It does NOT change font rendering: font-display and the font bytes are untouched (the
// font-display / layout-shift question is a designer decision, see tests/audit-perf.spec.ts).
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { extname, join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HASHED = /\.[0-9a-f]{10}\.[a-z0-9]+$/;
const TEXT = /\.(html?|css|m?js|svg|txt|md|json|xml)$/i;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const digest = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 10);

function walk(dir, out = []) {
  for (const n of readdirSync(dir).sort()) { const p = join(dir, n); statSync(p).isDirectory() ? walk(p, out) : out.push(p); }
  return out;
}

// A reference to /fonts/<name>: name ends at the first char that cannot be part of a file name.
const refRe = (name) => new RegExp(`/fonts/${esc(name)}(?![\\w.-])`, "g");

export function hashFontAssets(distRoot) {
  const root = resolve(distRoot);
  const fontsDir = join(root, "fonts");
  if (!existsSync(fontsDir)) throw new Error(`${fontsDir} does not exist; refusing to report a vacuous pass`);
  const names = readdirSync(fontsDir).filter((n) => statSync(join(fontsDir, n)).isFile());
  if (!names.length) throw new Error(`${fontsDir} has no files; refusing to report a vacuous pass`);
  const todo = names.filter((n) => !HASHED.test(n));
  const all = walk(root).filter((p) => TEXT.test(p));
  const read = (p) => readFileSync(p, "utf8");
  const mapping = [];

  const rename = (oldName, buf) => {
    const ext = extname(oldName); const stem = basename(oldName, ext);
    const next = `${stem}.${digest(buf)}${ext}`;
    renameSync(join(fontsDir, oldName), join(fontsDir, next));
    mapping.push({ from: oldName, to: next });
    return next;
  };
  const rewriteAll = (from, to) => {
    let n = 0;
    for (const p of walk(root).filter((q) => TEXT.test(q))) {
      const t = read(p); const re = refRe(from); const c = (t.match(re) || []).length;
      if (c) { writeFileSync(p, t.replace(re, `/fonts/${to}`)); n += c; }
    }
    return n;
  };

  // 1. binary fonts (anything that is not CSS): hash their bytes.
  const refCounts = new Map();
  for (const n of todo.filter((x) => !/\.css$/i.test(x))) {
    const to = rename(n, readFileSync(join(fontsDir, n)));
    refCounts.set(n, rewriteAll(n, to));
  }
  // 2. CSS in dist/fonts: its url() now names hashed fonts, so hash the FINAL bytes.
  for (const n of todo.filter((x) => /\.css$/i.test(x))) {
    const to = rename(n, readFileSync(join(fontsDir, n)));
    refCounts.set(n, rewriteAll(n, to));
  }

  // 3. fail-closed assertions over the finished tree.
  const problems = [];
  for (const [n, c] of refCounts) if (c === 0) problems.push(`orphan: /fonts/${n} was renamed but nothing in dist references it`);
  const present = new Set(readdirSync(fontsDir));
  for (const p of walk(root).filter((q) => TEXT.test(q))) {
    const t = read(p);
    for (const m of t.matchAll(/\/fonts\/([A-Za-z0-9._-]+\.(?:css|woff2?|ttf|otf))(?![\w.-])/g)) {
      if (!present.has(m[1])) problems.push(`dangling: ${p.slice(root.length)} references /fonts/${m[1]}, which is not in dist/fonts (${mapping.some((x) => x.from === m[1]) ? "leftover unhashed name after rewrite" : "no such file"})`);
    }
  }
  if (problems.length) throw new Error(`hash-font-assets FAILED, refusing to ship a page with a broken or stale font URL:\n  ${[...new Set(problems)].join("\n  ")}`);
  return { mapping, scanned: all.length, alreadyHashed: names.length - todo.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const r = hashFontAssets(process.argv[2] ?? "dist");
    console.log(`hash-font-assets: ${r.mapping.length} font file(s) renamed to content-hashed names (${r.alreadyHashed} already hashed), references rewritten across ${r.scanned} text file(s); no dangling, orphaned or unhashed font left.`);
    for (const m of r.mapping) console.log(`  /fonts/${m.from} -> /fonts/${m.to}`);
  } catch (e) { console.error(e.message); process.exit(1); }
}
