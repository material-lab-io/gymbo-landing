// gy-oyjpys: analytics must never gate the app. On 2026-11-07 analytics.getgymbo.com hung and getgymbo.com stopped being
// interactive, because `<script defer src=analytics...>` sat before the module bundle: deferred classic and module scripts run
// in document order, so the app waited for analytics. Rule: every <script src> that loads analytics.getgymbo.com carries `async`
// and not `defer`, so it can neither block nor order the app. Scans every .html under the root (source shells and built output).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SKIP_DIRS = new Set(["node_modules", ".git", "test-results", "playwright-report"]);
const TAG = /<script\b[^>]*>/gi;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (!SKIP_DIRS.has(name)) yield* walk(p); }
    else if (name.endsWith(".html")) yield p;
  }
}

export function checkHtml(html) {
  const problems = [];
  let loads = 0;
  for (const m of html.matchAll(TAG)) {
    const tag = m[0];
    if (!/\bsrc\s*=\s*["']?[^"'\s>]*analytics\.getgymbo\.com/i.test(tag)) continue;
    loads++;
    const attrs = tag.replace(/(["'])[^"']*\1/g, '""'); // drop attribute values so a data-* value cannot fake a keyword
    if (/\bdefer\b/i.test(attrs)) problems.push("loaded with defer (runs in order with the module bundle)");
    if (!/\basync\b/i.test(attrs)) problems.push("loaded without async");
    if (/\btype\s*=\s*["']?module/i.test(attrs)) problems.push("loaded as a module script");
  }
  return { loads, problems };
}

export function scanTree(root) {
  const findings = [];
  let files = 0, loads = 0;
  for (const file of walk(root)) {
    files++;
    const r = checkHtml(readFileSync(file, "utf8"));
    loads += r.loads;
    for (const p of r.problems) findings.push({ file: relative(root, file).split(sep).join("/"), problem: p });
  }
  return { files, loads, findings };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const root = resolve(args.includes("--root") ? args[args.indexOf("--root") + 1] : ".");
  if (!existsSync(root)) { console.error(`check-analytics-async: ${root} does not exist`); process.exit(2); }
  const { files, loads, findings } = scanTree(root);
  // COULD-NOT-EVALUATE: a scan that saw no html or no analytics tag has proved nothing.
  if (files === 0 || loads === 0) { console.error(`check-analytics-async: COULD-NOT-EVALUATE (html files ${files}, analytics tags ${loads})`); process.exit(2); }
  if (findings.length) {
    console.error(`check-analytics-async: ${findings.length} analytics tag(s) can block the app (gy-oyjpys):`);
    for (const f of findings) console.error(`  ${f.file}: ${f.problem}`);
    process.exit(1);
  }
  console.log(`check-analytics-async: OK (${loads} analytics tags in ${files} html files, all async)`);
}
