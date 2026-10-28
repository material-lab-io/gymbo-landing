// gm-7xj / gy-pbnxi: 'one tap' is NOT true on the shipped build (the punch flow is drawer-gated, gy-jf8hj build 5945) and
// the workout builder has no voice or paste import. Content ruled both claims out on every surface (canonical v5,
// 2026-10-25). This scans the SOURCE a visitor's page is built from (src/, public/, the route HTML shells) so a
// reintroduced claim fails before a build exists. The built-site gates (canonical-terms, copy-change-detector) stay as they are.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const BANNED = [
  { kind: "one-tap", re: /\bone[\s-]+tap\b/gi },
  { kind: "single-tap", re: /\bsingle[\s-]+tap\b/gi },
  { kind: "voice-import", re: /\bvoice(?:\s+and\s+|\s*\/\s*|\s+or\s+|\s+)(?:paste\s+)?import\b/gi },
  { kind: "paste-import", re: /\bpaste\s+import\b/gi },
];
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "dist-ssr", "tests", "docs", "evidence", "test-results", "playwright-report", "review-artifacts", "scripts", "ops", "supabase", "functions"]);
const EXT = /\.(?:tsx?|html|txt|json|md)$/i;

function* walk(dir, root) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    // src/canonical is content's byte-pinned vendored file (sha256 in SOURCE.json); its provenance prose may quote the retired
    // phrase, and the built-site gates assert the pinned strings, so a scan here would only flag history.
    if (st.isDirectory()) { if (!SKIP_DIRS.has(name) && relative(root, p).split(sep).join("/") !== "src/canonical") yield* walk(p, root); }
    else if (EXT.test(name) && !/^(?:package(?:-lock)?|tsconfig.*|copy-baseline|copy-ruled-strings|product-contract|canonical-log-verb-registry)\.json$/.test(name)) yield p;
  }
}

export function scanTree(root) {
  const findings = [];
  for (const file of walk(root, root)) {
    const rel = relative(root, file).split(sep).join("/");
    readFileSync(file, "utf8").split("\n").forEach((line, i) => {
      for (const { kind, re } of BANNED) {
        re.lastIndex = 0;
        for (const m of line.matchAll(re)) findings.push({ kind, file: rel, line: i + 1, text: line.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40).trim() });
      }
    });
  }
  return findings;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const root = resolve(args.includes("--root") ? args[args.indexOf("--root") + 1] : ".");
  if (!existsSync(root)) { console.error(`check-no-one-tap: ${root} does not exist`); process.exit(2); }
  const findings = scanTree(root);
  if (findings.length) {
    console.error(`check-no-one-tap: ${findings.length} banned claim(s) in source (gm-7xj):`);
    for (const f of findings) console.error(`  [${f.kind}] ${f.file}:${f.line}  …${f.text}…`);
    process.exit(1);
  }
  console.log("check-no-one-tap: OK (no 'one tap' / 'single tap' / voice-paste import in source)");
}
