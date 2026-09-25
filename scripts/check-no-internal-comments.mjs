// gy-454k3 (pm condition d): the strip must not be a snapshot. Fails if ANY comment carrying a bead
// id or a named person is still in dist/, and asserts the deliberate public text SURVIVED so a
// future stripper cannot eat the byline or the grievance contact.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findMarkedComments, kindOf } from "./internal-markers.mjs";
import { walk } from "./strip-internal-comments.mjs";

export const MUST_SURVIVE = [
  { file: "index.html", text: "Kaushik Naarayan", why: "public founder byline / JSON-LD Person" },
  { file: "privacy/index.html", text: "grievance@getgymbo.com", why: "privacy grievance contact" },
  { file: "privacy/index.html", text: "<!--email_off-->", why: "Cloudflare e-mail-protection directive that keeps the grievance address readable" },
];

export function scanDist(root, read = (p) => readFileSync(p, "utf8"), files = walk(root)) {
  const leaks = []; let scanned = 0;
  for (const p of files) { const k = kindOf(p); if (!k) continue; scanned++; for (const c of findMarkedComments(read(p), k)) leaks.push({ file: p.slice(root.length + 1), comment: c }); }
  const missing = MUST_SURVIVE.filter((m) => { try { return !read(resolve(root, m.file)).includes(m.text); } catch { return true; } });
  return { scanned, leaks, missing };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root = resolve(process.argv[2] ?? "dist");
    const { scanned, leaks, missing } = scanDist(root);
    if (!scanned) throw new Error(`no html/css/js under ${root}; refusing a vacuous pass`);
    if (leaks.length || missing.length) {
      console.error(`FAIL: ${leaks.length} internal comment(s) ship, ${missing.length} required public text(s) missing:`);
      for (const l of leaks.slice(0, 25)) console.error(`  LEAK ${l.file}: ${l.comment}`);
      for (const m of missing) console.error(`  MISSING ${m.file}: "${m.text}" (${m.why})`);
      process.exitCode = 1;
    } else console.log(`OK: no comment carrying a bead id or a named person ships (${scanned} html/css/js file(s) scanned); byline, grievance contact and e-mail directive survive.`);
  } catch (e) { console.error(`COULD NOT EVALUATE internal comments: ${e.message}`); process.exitCode = 2; }
}
