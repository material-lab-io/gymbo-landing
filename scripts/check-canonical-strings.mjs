// gy-uu7mt: assert content's vendored canonical strings are byte-identical to their recorded
// source and appear in the BUILT site on the surfaces named in src/canonical/web-surface-map.json.
// See scripts/canonical-strings.mjs for what this does and does not protect.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCanonical, checkCanonical, CANON_DIR } from "./canonical-strings.mjs";
import { scanDist } from "./copy-lock.mjs";

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
    const canon = loadCanonical(opt("--canon", CANON_DIR));
    const { surfaces } = scanDist(opt("--root", "dist"));
    const { findings, notes } = checkCanonical(canon, surfaces, opt("--today"));
    for (const n of notes) console.log(`  ${n}`);
    if (findings.length) {
      console.error(`FAIL: ${findings.length} canonical-string finding(s):`);
      for (const f of findings) console.error(`  ${f.kind}${f.id ? ` ${f.id}` : ""}${f.route ? ` ${f.route} [${f.surface}]` : ""}${f.text ? `: ${f.text.slice(0, 120)}` : ""}${f.detail ? ` (${f.detail})` : ""}`);
      process.exitCode = 1;
    } else console.log(`OK: content's canonical strings (${canon.source.commit.slice(0, 8)}, sha256 ${canon.sha.slice(0, 12)}) are byte-identical to the record and present on every mapped surface; ${notes.length} waived divergence(s) listed above. Pins the LISTED surfaces only.`);
  } catch (error) { console.error(`COULD NOT EVALUATE canonical strings: ${error.message}`); process.exitCode = 2; }
}
