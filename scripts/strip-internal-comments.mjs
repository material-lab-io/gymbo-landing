// gy-454k3: build-time strip of internal comments from dist/. Runs LAST in `npm run build`.
// FAIL-CLOSED on damage: every JS bundle and every inline <script> is parsed before AND after;
// a strip that turns parseable code into unparseable code aborts the build instead of shipping it.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";
import { stripMarkedComments, kindOf } from "./internal-markers.mjs";

export function walk(dir, out = []) { for (const n of readdirSync(dir).sort()) { const p = join(dir, n); statSync(p).isDirectory() ? walk(p, out) : out.push(p); } return out; }
const parses = (code) => { try { transformSync(code, { loader: "js", logLevel: "silent" }); return true; } catch { return false; } };
const inlineScripts = (html) => [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)].filter((m) => !/type\s*=\s*["']?(?:application\/(?:ld\+)?json|text\/template)/i.test(m[1])).map((m) => m[2]).filter((s) => s.trim());

export function stripFile(path, before) {
  const kind = kindOf(path);
  const after = stripMarkedComments(before, kind);
  if (after === before) return { changed: false, text: before };
  if (kind === "js" && parses(before) && !parses(after)) throw new Error(`${path}: stripping internal comments BROKE this bundle's syntax; refusing to ship it`);
  if (kind === "html") {
    const b = inlineScripts(before), a = inlineScripts(after);
    a.forEach((code, i) => { if (parses(b[i] ?? "") && !parses(code)) throw new Error(`${path}: stripping broke inline <script> #${i}; refusing to ship it`); });
  }
  return { changed: true, text: after, removed: before.length - after.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] ?? "dist");
  let files = 0, changed = 0, bytes = 0;
  for (const p of walk(root)) {
    if (!kindOf(p)) continue;
    files++;
    const r = stripFile(p, readFileSync(p, "utf8"));
    if (r.changed) { writeFileSync(p, r.text); changed++; bytes += r.removed; }
  }
  if (!files) { console.error(`COULD NOT EVALUATE: no html/css/js under ${root}`); process.exit(2); }
  console.log(`strip-internal-comments: ${changed} of ${files} file(s) had marked comments removed (${bytes} bytes); comments without a bead id or a named person are untouched.`);
}
