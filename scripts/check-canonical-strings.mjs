// gy-uu7mt: assert content's vendored canonical strings are byte-identical to their recorded
// source and appear in the BUILT site on the surfaces named in src/canonical/web-surface-map.json.
// See scripts/canonical-strings.mjs for what this does and does not protect.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { loadCanonical, loadFactsMap, checkCanonical, checkFacts, findBuiltPrices, CANON_DIR } from "./canonical-strings.mjs";
import { scanDist } from "./copy-change-detector.mjs";

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
    const canon = loadCanonical(opt("--canon", CANON_DIR));
    const { surfaces } = scanDist(opt("--root", "dist"));
    const { findings, notes } = checkCanonical(canon, surfaces, opt("--today"));
    const factsMap = loadFactsMap(opt("--canon", CANON_DIR));
    findings.push(...checkFacts(canon.doc, factsMap, readFileSync(opt("--constants", factsMap.file), "utf8")));
    for (const n of notes) console.log(`  ${n}`);
    const typed = findBuiltPrices(opt("--root", "dist"));
    if (findings.length) {
      console.error(`FAIL: ${findings.length} canonical-string finding(s):`);
      for (const f of findings) console.error(`  ${f.kind}${f.id ? ` ${f.id}` : ""}${f.route ? ` ${f.route} [${f.surface}]` : ""}${f.text ? `: ${f.text.slice(0, 120)}` : ""}${f.detail ? ` (${f.detail})` : ""}`);
      process.exitCode = 1;
    } else {
      console.log(`  NOT READ by the constants-file check: ${typed.length} BUILT file(s) state a rupee amount and NONE is compared to content's ruled numbers: ${typed.map((f) => `${f.file} x${f.count}`).join(", ") || "none"}. A price change can leave every one stale with this gate green. (Scans html/md/txt/xml/json in ${opt("--root", "dist")}; the .js bundles are not scanned. Includes competitor prices.)`);
      console.log(`OK: content's canonical strings (${canon.source.commit.slice(0, 8)}, sha256 ${canon.sha.slice(0, 12)}) are byte-identical to the record and present on every mapped surface, and CONSTANTS FILE ONLY: the ${Object.keys(factsMap.map).length} ruled facts equal the constants in ${factsMap.file}, which is NOT a check on prices in built pages (see NOT READ above); ${notes.length} waived divergence(s) listed above. Checks the LISTED surfaces for PRESENCE in the document only (not visibility to a reader: gy-vawlh).`);
    }
  } catch (error) { console.error(`COULD NOT EVALUATE canonical strings: ${error.message}`); process.exitCode = 2; }
}
