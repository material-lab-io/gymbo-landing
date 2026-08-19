// No-bezel gate (gy-k095b, enforcing founder rule gy-r4nzh).
//
// FOUNDER RULE (Kaushik, 2026-08-14, standing, site-wide): getgymbo.com shows
// REAL app screenshots with NO phone bezels or device frames. "Bezels give away
// AI" — device chrome reads as AI-generated/fake. No bezel'd or device-framed
// mockup ships anywhere on the site.
//
// A rule that lives only in a bead gets re-broken by the next person who adds a
// section and reaches for the nearest phone mockup. This is the mechanical,
// fail-closed version: it fails the build if any known device-frame asset,
// component, or path reappears in the SOURCE we author (src/) or in the BUILT
// OUTPUT we deploy (dist/). Checking dist/ matters as much as src/ — the old
// frame art lived in public/, which Vite copies into dist/ without any source
// file referencing it.
//
// Run: node scripts/check-no-bezel.mjs [--dist]
//   (no flag) scan src/ only — fast, runs before the build
//   --dist    also scan dist/ — runs after the build, catches copied assets
//
// Exit 0 = clean. Exit 1 = a bezel came back; this must block the deploy.
//
// SELF-TEST: .github/workflows/gate-selftest.yml feeds this gate a fixture that
// violates the rule and fails if the gate passes anyway ("a gate never seen to
// fail is not a gate", gy-ruxbj).

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

/* Each entry is a string that must not appear in shipped source, plus WHY, so a
   future hit is diagnosable without archaeology. Substring match, case-sensitive
   — these are file/asset names, not prose. */
const DENYLIST = [
  ["iphone-frame-single", "the punched single-phone frame PNG the gallery composited into"],
  ["hero-three-panel", "the baked three-iPhone MockupWorld raster the hero used"],
  ["frame-single-holed", "the intermediate aperture-punched frame from the old hero build"],
  ["preview_frame", "device-frame preview art"],
  ["assets/hero-source", "the device-mockup source tree"],
  ["public/mockups", "the served device-art directory (now assets-src/mockups, unserved)"],
];

/* Any *-frame-*.png / .webp style device art used in a shipped mockup. Kept
   separate from the literal denylist because it is a shape, not a known name —
   this is what catches the NEXT bezel asset, which by definition is not on the
   list above. */
const DEVICE_ART_PATTERN = /[\w-]*-frame-[\w-]*\.(png|webp|jpg|jpeg|svg)/;

/* Files that are ABOUT the rule rather than breaking it: this gate, the archive
   README, and the spec/doc trail. They legitimately name the banned strings. */
const ALLOW_PATHS = [/^scripts\/check-no-bezel\.mjs$/, /^assets-src\//, /^docs\//, /\.md$/];

const SCAN_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".css", ".html", ".json", ".svg", ".txt"]);

const roots = ["src"];
if (process.argv.includes("--dist")) roots.push("dist");

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT") return; // dist/ absent on a source-only run
    throw err;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".git") continue;
      yield* walk(full);
    } else {
      yield full;
    }
  }
}

const violations = [];

for (const root of roots) {
  for await (const file of walk(root)) {
    const rel = file.split(path.sep).join("/");
    if (ALLOW_PATHS.some((re) => re.test(rel))) continue;

    // A banned asset can violate the rule by EXISTING (a .png copied into dist/),
    // not just by being named inside a text file. Check the filename either way.
    for (const [needle, why] of DENYLIST) {
      if (rel.includes(needle)) violations.push({ file: rel, needle, why, how: "filename" });
    }
    const nameOnly = path.basename(rel);
    if (DEVICE_ART_PATTERN.test(nameOnly)) {
      violations.push({ file: rel, needle: nameOnly, why: "device-frame art (matched *-frame-*)", how: "filename" });
    }

    if (!SCAN_EXT.has(path.extname(rel))) continue;
    const { size } = await stat(file);
    if (size > 8 * 1024 * 1024) continue; // skip giant bundles/maps
    const text = await readFile(file, "utf8").catch(() => null);
    if (text === null) continue;

    for (const [needle, why] of DENYLIST) {
      if (text.includes(needle)) violations.push({ file: rel, needle, why, how: "content" });
    }
    const m = text.match(DEVICE_ART_PATTERN);
    if (m) violations.push({ file: rel, needle: m[0], why: "device-frame art reference (matched *-frame-*)", how: "content" });
  }
}

console.log(`No-bezel gate (gy-r4nzh) — scanned: ${roots.join(", ")}`);

if (violations.length === 0) {
  console.log("  OK: no device-frame asset, component or path found.");
  process.exit(0);
}

console.error("\nFAIL: device-frame / phone-bezel material is back on getgymbo.com.\n");
for (const v of violations) {
  console.error(`  ${v.file}`);
  console.error(`      ${v.how === "filename" ? "path contains" : "references"} "${v.needle}" — ${v.why}`);
}
console.error(
  "\nFOUNDER RULE gy-r4nzh (standing, site-wide): the site shows REAL app screenshots\n" +
    "with NO phone bezels or device frames. Bezels read as AI-generated.\n\n" +
    "Use the ScreenCard component (src/components/ScreenCard.tsx) — a real screenshot,\n" +
    "Forge card radius, elevation-4 shadow, no device chrome. Device-framed SOURCE art\n" +
    "belongs in assets-src/ (never served); see assets-src/README.md.\n"
);
process.exit(1);
