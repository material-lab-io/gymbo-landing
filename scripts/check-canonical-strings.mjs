// gy-uu7mt: assert content's vendored canonical strings are byte-identical to their recorded
// source and appear in the BUILT site on the surfaces named in src/canonical/web-surface-map.json.
// See scripts/canonical-strings.mjs for what this does and does not protect.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { loadCanonical, loadFactsMap, checkCanonical, checkFacts, findBuiltPrices, loadPriceSurfaces, checkBuiltPricePin, checkPriceLedger, checkLedgerAppendOnly, ledgerBaseFromEnv, readBaseLedger, priceDrill, CANON_DIR } from "./canonical-strings.mjs";
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
    const reg = loadPriceSurfaces(opt("--canon", CANON_DIR));
    findings.push(...checkPriceLedger(canon.doc.facts, reg));
    // R3: the ledger is append-only against its base (--base-ledger FILE, --base REF, or the CI event's base)
    let appendNote;
    // The ONE explicit opt-out, for the time-fuse harness only: that job checks out with depth 1 (the base commit does not
    // exist there) and tests clock independence, not ledger history. deploy.yml checks out full history and is where
    // the check is enforced. A test pins that this flag appears nowhere but here and scripts/shifted-clock-control.mjs.
    if (args.includes("--skip-ledger-base")) {
      const why = opt("--skip-ledger-base", "");
      if (!why || why.trim().length < 15) findings.push({ kind: "price-ledger-skip-needs-reason", detail: "--skip-ledger-base needs a reason of at least 15 characters saying why the base is unavailable and where the check IS enforced" });
      else appendNote = `ledger append-only SKIPPED by explicit flag (--skip-ledger-base): ${why}`;
    } else if (opt("--base-ledger")) { findings.push(...checkLedgerAppendOnly(JSON.parse(readFileSync(opt("--base-ledger"), "utf8")), reg.priceLedger)); appendNote = `ledger append-only vs ${opt("--base-ledger")}`; }
    else {
      const b = opt("--base") ? { ref: opt("--base") } : ledgerBaseFromEnv(process.env);
      if (b.mergeBase) { const m = spawnSync("git", ["-C", opt("--canon", CANON_DIR), "merge-base", "HEAD", b.mergeBase], { encoding: "utf8" }); if (m.status === 0 && m.stdout.trim()) b.ref = m.stdout.trim(); else b.error = `no merge-base with ${b.mergeBase} (${(m.stderr || "").trim() || "git failed"}); a manual dispatch needs it to find the ledger's base`; }
      if (b.error) findings.push({ kind: "price-ledger-base-unknown", detail: b.error });
      else if (b.ref) { const r = readBaseLedger({ ref: b.ref, canonDir: opt("--canon", CANON_DIR) }); if (r.error) findings.push({ kind: "price-ledger-base-unknown", detail: r.error }); else { findings.push(...checkLedgerAppendOnly(r.ledger, reg.priceLedger)); appendNote = `ledger append-only vs ${b.ref.slice(0, 12)}${r.ledger ? "" : " (base has no ledger yet)"}`; } }
      else appendNote = "ledger append-only check SKIPPED: no base (not in CI and no --base given); CI runs it";
    }
    if (appendNote) console.log(`  ${appendNote}`);
    findings.push(...checkBuiltPricePin(canon.doc.facts, reg, opt("--root", "dist")));
    const drill = priceDrill(canon.doc.facts, reg, opt("--root", "dist"));
    if (drill.missed.length) findings.push({ kind: "price-pin-blind", detail: `the standing drill (every price bumped) did NOT go red for ${drill.missed.length} listed (file,key) or occurrence(s): ${drill.missed.slice(0, 6).join("; ")}` });
    if (findings.length) {
      console.error(`FAIL: ${findings.length} canonical-string finding(s):`);
      for (const f of findings) console.error(`  ${f.kind}${f.id ? ` ${f.id}` : ""}${f.route ? ` ${f.route} [${f.surface}]` : ""}${f.text ? `: ${f.text.slice(0, 120)}` : ""}${f.detail ? ` (${f.detail})` : ""}`);
      process.exitCode = 1;
    } else {
      console.log(`  PRICE PIN (gy-53qq5): ${Object.keys(reg.surfaces).length} built file(s) pinned to content's ruled prices; standing drill (all prices bumped) went RED on ${drill.total} of ${drill.total} listed (file,key) and on every one of ${drill.occurrences} occurrence(s) of a Gymbo amount in those files, in whatever spelling, and on all ${drill.claims} savings-percent claim(s) in every phrasing. DECLARED UNREAD: ${typed.length} built file(s) state a rupee amount in all; amounts that are not a ruled Gymbo fact (competitor prices, research figures, guide arithmetic) are not compared to anything: ${typed.map((f) => `${f.file} x${f.count}`).join(", ") || "none"}. (Scans html/md/txt/xml/json/js/css/svg/webmanifest in ${opt("--root", "dist")}; images are not scanned.)`);
      console.log(`OK: content's canonical strings (${canon.source.commit.slice(0, 8)}, sha256 ${canon.sha.slice(0, 12)}) are byte-identical to the record and present on every mapped surface, and the ${Object.keys(factsMap.map).length} ruled facts equal the constants in ${factsMap.file}, and the PRICE PIN above checks Gymbo's three ruled amounts and the save-percent on the listed built pages; ${notes.length} waived divergence(s) listed above. Checks the LISTED surfaces for PRESENCE in the document only (not visibility to a reader: gy-vawlh).`);
    }
  } catch (error) { console.error(`COULD NOT EVALUATE canonical strings: ${error.message}`); process.exitCode = 2; }
}
