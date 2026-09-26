// gy-jbax2: the STANDING time-fuse control for the copy detector (gy-rro9u).
//
// "The gate is green today" and "this build has no time fuse" are different claims, and only a
// build on a DIFFERENT day supports the second. gy-rro9u: the detector pinned sitemap <lastmod>
// (the build date), so the first build of every UTC day went red and skipped the deploy.
//
// What this does, on every run:
//   1. builds the site with the real clock and again with the JS clock shifted forward by more
//      than a year (and by one day), then compares EVERY output file. A file may differ only in
//      the ALLOW-LISTED volatile way (sitemap.xml <lastmod> dates); anything else is a time fuse.
//   2. runs the copy gates on the shifted output (under the shifted clock too, so a date check
//      inside a gate is exercised).
//   3. --self-test: PLANTS a fuse and requires the control to go RED. A shifted-clock job that
//      has only ever been green proves nothing, which is the defect it exists to catch. It also
//      requires that the shifted build really differed (the shim reached the build): no
//      difference at all means the instrument did not run, and that is a failure, not a pass.
//
// WHAT THIS CARRIES THAT NOTHING ELSE DOES: the copy-change detector does not read JS/CSS at all
// (gy-ylbzu), so the two-build diff in step 1 is the ONLY control that covers a date stamped
// inside a bundle. The banner below says so every run.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { maskVolatile } from "./copy-change-detector.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const SHIM = join(HERE, "shift-clock.cjs");
// The ONLY files allowed to differ between a real-clock and a shifted-clock build, and only in
// the way maskVolatile masks (the date inside <lastmod>). Adding a file here is a review decision.
export const VOLATILE_ALLOWED = ["sitemap.xml"];
const CODE = new Set([".js", ".mjs", ".css"]);

function walk(root, dir = root, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(root, p, out); else if (e.isFile()) out.push(relative(root, p));
  }
  return out.sort();
}

// Compare two build outputs. `mask` folds the allowed volatile bytes; pass identity to see raw diffs.
export function compareBuilds(realDir, shiftedDir, { mask = maskVolatile } = {}) {
  const a = new Set(walk(realDir)), b = new Set(walk(shiftedDir));
  const findings = [], volatile = [];
  for (const f of a) if (!b.has(f)) findings.push({ kind: "only-in-real-build", file: f });
  for (const f of b) if (!a.has(f)) findings.push({ kind: "only-in-shifted-build", file: f });
  const bundles = [];
  for (const f of [...a].filter((x) => b.has(x)).sort()) {
    const ba = readFileSync(join(realDir, f)), bb = readFileSync(join(shiftedDir, f));
    if (CODE.has(extname(f).toLowerCase())) bundles.push(f);
    if (ba.equals(bb)) continue;
    const text = /\.(html?|txt|md|xml|json|svg|js|mjs|css|webmanifest|vtt|csv|map)$/i.test(f) || !extname(f);
    if (text && mask(ba.toString("utf8")) === mask(bb.toString("utf8"))) {
      if (VOLATILE_ALLOWED.includes(f)) volatile.push(f);
      else findings.push({ kind: "unexpected-volatile-file", file: f, detail: "differs only by an <lastmod> date, but this file is not on the volatile allow-list" });
    } else {
      findings.push({ kind: "time-fuse", file: f, detail: "differs between a real-clock and a shifted-clock build" });
    }
  }
  return { findings, volatile, bundles };
}

// The instrument RAN if the sitemap differed at all between the two builds: as an allowed volatile
// file OR as a finding. If NOTHING differed, the clock shim never reached the build and a green
// result would prove nothing (a two-outcome frame with no room for a broken instrument).
export const instrumentRan = (volatile, findings) =>
  volatile.includes("sitemap.xml") || findings.some((f) => f.file === "sitemap.xml" && f.kind !== "only-in-real-build" && f.kind !== "only-in-shifted-build");

// The three planted fuses that must each turn the control RED. `detect(dir)` returns the copy
// gate's exit status on a directory (injected so tests need no build).
export function selfTest({ realDir, shiftedDir, detect, scratch, compare = compareBuilds }) {
  const results = [];
  const shiftedDate = (/<lastmod>(\d{4}-\d{2}-\d{2})/.exec(readFileSync(join(shiftedDir, "sitemap.xml"), "utf8")) ?? [])[1] ?? "2099-01-01";
  const planted = (name, mutate) => {
    const d = join(scratch, name);
    rmSync(d, { recursive: true, force: true });   // never plant into a leftover copy: it could hide a missing file
    cpSync(shiftedDir, d, { recursive: true });
    mutate(d);
    return d;
  };
  // 1. a date stamped into a served text file: the comparator AND the detector must both go red
  const visible = planted("fuse-visible", (d) => appendFileSync(join(d, "llms.txt"), `\nUpdated ${shiftedDate}.\n`));
  results.push({ name: "date stamped into a served text file: the two-build diff goes RED", ok: compare(realDir, visible).findings.some((f) => f.kind === "time-fuse" && f.file === "llms.txt") });
  results.push({ name: "date stamped into a served text file: the copy detector goes RED", ok: detect(visible) !== 0 });
  // 2. a date stamped inside a bundle: only the two-build diff can see it (the detector cannot; gy-ylbzu)
  const bundle = planted("fuse-bundle", (d) => {
    const js = walk(d).find((f) => f.endsWith(".js"));
    if (!js) throw new Error("no .js file in the build to plant a bundle fuse in");
    appendFileSync(join(d, js), `\n/*built ${shiftedDate}*/\n`);
  });
  results.push({ name: "date stamped inside a JS bundle: the two-build diff goes RED (the ONLY control that can)", ok: compare(realDir, bundle).findings.some((f) => f.kind === "time-fuse" && f.file.endsWith(".js")) });
  results.push({ name: "  (informational) the copy detector on that bundle fuse exits", ok: true, info: `${detect(bundle)} (0 means it did NOT see it, which is the gy-ylbzu gap)` });
  // 3. the known fuse, unmasked: proves the comparator can see sitemap lastmod and that the mask is what allows it
  results.push({ name: "the known sitemap lastmod fuse is visible when the mask is OFF", ok: compare(realDir, shiftedDir, { mask: (s) => s }).findings.some((f) => f.file === "sitemap.xml") });
  return results;
}

function sh(cmd, args, { shift, days, cwd } = {}) {
  const env = { ...process.env };
  if (shift) {
    env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ""} --require ${SHIM}`.trim();
    env.GYMBO_SHIFT_DAYS = String(days);
  }
  return spawnSync(cmd, args, { cwd, env, stdio: "inherit" });
}
function build(shift, days) {
  const r = sh("npm", ["run", "build"], { shift, days });
  if (r.status !== 0) throw new Error(`npm run build ${shift ? `under a +${days} day clock ` : ""}exited ${r.status}`);
  const out = mkdtempSync(join(tmpdir(), shift ? `gymbo-shift-${days}-` : "gymbo-real-"));
  rmSync(out, { recursive: true, force: true });
  cpSync("dist", out, { recursive: true });
  return out;
}

export const GATES = [
  ["copy-change-detector", "scripts/copy-change-detector.mjs", true],
  ["canonical terms", "scripts/check-canonical-terms.mjs", true],
  ["trial eligibility", "scripts/check-trial-eligibility.mjs", true],
  ["log verb", "scripts/check-log-verb.mjs", true],
  // a deliberate DATE rule (waivers expire), not a build-time fuse: run on the real clock so a
  // legitimately expiring waiver is not reported as a time fuse.
  // This job checks out with depth 1, so the ledger's BASE commit does not exist here; it tests clock independence, not ledger
  // history. The append-only check is enforced by deploy.yml (full history). The opt-out is explicit, reasoned and printed.
  ["canonical strings (real clock: it has an intentional waiver-expiry date rule)", "scripts/check-canonical-strings.mjs", false, ["--skip-ledger-base", "time-fuse harness: shallow checkout has no base commit and this job tests clock independence; deploy.yml (full history) enforces append-only"]],
];

// The argv a gate is spawned with: [script, "--root", <shifted build>, ...its own extra args]. One function, so the harness and its test
// cannot disagree about what a gate is invoked with.
export const gateArgs = ([, script, , extraArgs = []], root) => [script, "--root", root, ...extraArgs];

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
  const days = String(opt("--days", "1,400")).split(",").map((x) => Number(x.trim())).filter((x) => Number.isFinite(x) && x > 0);
  const scratch = mkdtempSync(join(tmpdir(), "gymbo-time-fuse-"));
  let failed = 0;
  try {
    if (!days.length || Math.max(...days) < 366) console.log("NOTE: no shift over a year was requested; a year- or month-boundary fuse would not be caught.");
    console.log(`time-fuse control: real-clock build, then shifted builds of +${days.join(", +")} day(s).`);
    const real = build(false);
    let widest;
    for (const d of days) {
      const shifted = build(true, d);
      const { findings, volatile, bundles } = compareBuilds(real, shifted);
      console.log(`\n== +${d} day(s): ${walk(shifted).length} output files compared`);
      console.log(`   allowed volatile (date inside <lastmod> only): ${volatile.join(", ") || "NONE"}`);
      if (!instrumentRan(volatile, findings)) {
        findings.push({ kind: "instrument-did-not-run", file: "sitemap.xml", detail: "the shifted build did not differ from the real one anywhere, so the clock shim did not reach the build; a pass here would prove nothing" });
      }
      for (const f of findings) console.error(`   FAIL ${f.kind}: ${f.file}${f.detail ? ` (${f.detail})` : ""}`);
      failed += findings.length;
      for (const entry of GATES) {
        const [label, script, shim] = entry;
        if (!existsSync(script)) { console.log(`   skip ${label}: ${script} is not on this branch`); continue; }
        const env = { ...process.env };
        if (shim) { env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ""} --require ${SHIM}`.trim(); env.GYMBO_SHIFT_DAYS = String(d); }
        const r = spawnSync(process.execPath, gateArgs(entry, shifted), { env, encoding: "utf8" });
        console.log(`   ${r.status === 0 ? "ok  " : "FAIL"} ${label} on the +${d}d build (exit ${r.status})`);
        if (r.status !== 0) { failed++; console.error(String(r.stdout) + String(r.stderr)); }
      }
      if (d === Math.max(...days)) widest = { shifted, bundles };
      if (d !== Math.max(...days)) rmSync(shifted, { recursive: true, force: true });
    }
    console.log(`\nBUNDLE GAP (gy-ylbzu), stated every run so a future reader knows what this job carries: the copy-change detector does NOT read JS/CSS. ${widest.bundles.length} bundle file(s) were compared here, and this two-build diff is currently the ONLY control that would notice a date stamped inside one. Strings that exist only in a bundle are also outside the copy pin.`);
    if (args.includes("--self-test")) {
      console.log("\n== positive controls (each planted fuse MUST turn the control red)");
      const detect = (dir) => spawnSync(process.execPath, ["scripts/copy-change-detector.mjs", "--root", dir], { encoding: "utf8" }).status;
      for (const r of selfTest({ realDir: real, shiftedDir: widest.shifted, detect, scratch })) {
        console.log(`   ${r.ok ? "ok  " : "FAIL"} ${r.name}${r.info ? ` ${r.info}` : ""}`);
        if (!r.ok) failed++;
      }
    }
    rmSync(real, { recursive: true, force: true });
    rmSync(widest.shifted, { recursive: true, force: true });
  } catch (e) {
    console.error(`COULD NOT EVALUATE the time-fuse control: ${e.message}`);
    rmSync(scratch, { recursive: true, force: true });
    process.exit(2);
  }
  rmSync(scratch, { recursive: true, force: true });
  if (failed) { console.error(`\nFAIL: ${failed} time-fuse finding(s). A build that depends on the date will go red for a real visitor's day, not today's.`); process.exit(1); }
  console.log("\nOK: no output depends on the date (differences confined to the allow-listed sitemap lastmod), every copy gate passes on the shifted builds, and each planted fuse went red.");
}
