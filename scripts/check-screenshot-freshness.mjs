// Screenshot staleness gate (gy-a73px.15; placement corrected by gy-7anl3).
//
// Kaushik caught the same stale app screenshots on the live site twice
// (2026-08-06, 2026-08-08) with no mechanical detector — just a human
// noticing a rendering detail. This script is that mechanical detector.
//
// WHAT IS GATED: every screenshot actually composited into the site — the
// SCREENS map in scripts/screens-map.mjs, i.e. the marketing masters under
// public/screens/ that the gallery renders. Nothing else. It does not gate
// the site's code, copy, routes, legal pages, or any other asset.
//
// ── gy-7anl3: WHY THIS SCRIPT HAS TWO VERDICTS AND NOT ONE ──────────────────
// It used to exit 1 on all four of its findings alike, and it runs inside
// `deploy`, which is the SOLE required check on main. So a question about
// marketing art also decided "can we publish ANY change to a live public
// site?" — including an emergency legal or privacy correction. On 2026-09-06
// that pinned getgymbo.com to the 2026-08-31 build with no path to publish.
//
// The four findings are not the same kind of thing:
//
//   no manifest entry     ┐ INTEGRITY. A property of the CHANGE, not of the
//   unverified            ├ calendar. Deterministic: a re-run gives the same
//   invalid capturedAt    ┘ answer, and the author can fix it. STAYS BLOCKING.
//
//   older than maxAgeDays   AGING. A property of WALL CLOCK. It is monotonic,
//                           so no re-run can ever go green, and the fix lives
//                           with the capture crew on a different bead entirely.
//                           A monotonic input inside a required check is a
//                           scheduled outage (gy-fs7pe).
//
// So aging BLOCKS when this change PUBLISHES the artifact — you may not publish
// or re-publish a stale master, which is the thing the gate exists to stop —
// (published = its master PNG is touched; or a manifest edit adds or changes its
// entry, puts it back on the site, or touches its gallery derivatives. A manifest
// edit that cannot be compared with --base publishes every entry. gy-sk86p2) —
// and WARNS LOUDLY when the master is merely one that was already live and has
// since aged. Moving a gate must not delete an alarm (this gate was already
// silently fail-open 08-12 to 08-19, see MANIFEST.md), so every aged master is
// still named on every run, in an annotation and in the job summary.
//
// Do NOT "fix" a staleness failure by raising maxAgeDays, adding a bypass
// flag, or backfilling manifest entries — pm has ruled all three out. The
// staleness alarm is TRUE. Recapture is gy-iit8q.
//
// Run: node scripts/check-screenshot-freshness.mjs [options]
//   --changed <file>  newline-delimited list of paths this change touches.
//                     An aged master in this set is a FAIL, not a warning.
//                     If the file is unreadable this script exits 1 rather
//                     than silently downgrading every aged master — a
//                     could-not-look must never render as a look-that-passed.
//   --strict          aging blocks unconditionally (the pre-gy-7anl3
//                     behaviour). Used by the gate self-test's negative
//                     control, and available if the split is ever revoked.
//
// Exit 0 = nothing blocking. Exit 1 = an integrity failure, a stale artifact
// this change touches, or a could-not-look.

import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { appendFileSync, readFileSync } from "node:fs";
import { SCREENS } from "./screens-map.mjs";

// gy-dwxbm: the manifest and its README are INTERNAL crew documents; they live under ops/, NOT
// public/, so they are not served on getgymbo.com. SCREENS_DIR stays public/screens/ (the PNGs).
const MANIFEST_PATH = "ops/screens/manifest.json";
const SCREENS_DIR = "public/screens/";
// The master PNGs live in real/, their served derivatives in gallery/.
const MASTERS_DIR = `${SCREENS_DIR}real/`;
const GALLERY_DIR = `${SCREENS_DIR}gallery/`;
const SCREENS_MAP_PATH = "scripts/screens-map.mjs";
// gy-dwxbm: where the manifest lived before it moved out of the public tree. Only used to tell a
// RELOCATION (same bytes, new path) from an EDIT. Delete once no open branch predates the move.
const LEGACY_MANIFEST_PATHS = ["public/screens/manifest.json"];

const argv = process.argv.slice(2);
const STRICT = argv.includes("--strict");
const changedIdx = argv.indexOf("--changed");
const changedFile = changedIdx === -1 ? null : argv[changedIdx + 1];
const baseIdx = argv.indexOf("--base");
const baseRef = baseIdx === -1 ? null : argv[baseIdx + 1];

// Was the manifest EDITED, or only touched (moved)? Fail-closed: anything git cannot answer is an
// edit. "Same bytes as the base's copy at its current OR legacy path" is the ONLY way to be a
// relocation, so a move plus any change to any entry still counts as an edit.
export function manifestEdited(read, gitShow, base, paths) {
  if (!base) return true;
  let current;
  try { current = read(); } catch { return true; }
  for (const path of paths) {
    let before;
    try { before = gitShow(base, path); } catch { continue; }
    if (before !== null && before === current) return false;
  }
  return true;
}

// Key order and whitespace are not an edit; any value is.
const canon = (v) => JSON.stringify(v, (_, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x));

// gy-sk86p2 (pm ruling 26 Nov): which gated masters does a manifest EDIT publish? Those whose entry
// is added or differs from the base's in any field, and those the base's SCREENS map did not publish
// (a master put back on the site). `redated`: the subset whose capture date is new or moved.
// Returns null when the two cannot be compared, or when a top-level setting changed: the caller then
// counts EVERY master (fail-closed).
export function publishedByManifestEdit(head, base, baseScreens, screens) {
  if (!head?.entries || !base?.entries || !baseScreens) return null;
  const settings = ({ entries, ...rest }) => canon(rest);
  if (settings(head) !== settings(base)) return null;
  const onBaseSite = new Set(Object.values(baseScreens));
  const published = new Set();
  const redated = new Set();
  for (const file of Object.values(screens)) {
    const now = head.entries[file];
    const was = base.entries[file];
    if (!was || canon(was) !== canon(now) || !onBaseSite.has(file)) published.add(file);
    if (!was || was.capturedAt !== now?.capturedAt) redated.add(file);
  }
  return { published, redated };
}

// ── which artifacts does THIS change touch? ────────────────────────────────
// Absent --changed, nothing is considered touched, so aging is warn-only.
// Present but unreadable is a could-not-look and exits 1 below.
let touched = null;
let touchedAll = false;
let fromManifest = null; // set only for a manifest edit that could be compared with the base
if (changedFile) {
  let raw;
  try {
    raw = await readFile(changedFile, "utf8");
  } catch (err) {
    console.error(
      `::error::Screenshot gate COULD NOT LOOK: --changed ${changedFile} is unreadable (${err.code}). ` +
        `Refusing to run, because treating an unknown change set as "touched nothing" would downgrade ` +
        `every stale master to a warning — a could-not-look must never render as a look-that-passed.`
    );
    process.exit(1);
  }
  touched = new Set(raw.split("\n").map((l) => l.trim()).filter(Boolean));
  // A manifest edit publishes the entries it adds or changes. When the base
  // cannot be compared, it counts as touching all of them: it blocks in the
  // direction of not publishing stale art.
  touchedAll = touched.has(MANIFEST_PATH) || LEGACY_MANIFEST_PATHS.some((p) => touched.has(p));
  if (touchedAll) {
    const gitShow = (ref, path) => execFileSync("git", ["show", `${ref}:${path}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const paths = [MANIFEST_PATH, ...LEGACY_MANIFEST_PATHS];
    const edited = manifestEdited(() => readFileSync(MANIFEST_PATH, "utf8"), gitShow, baseRef, paths);
    if (!edited) {
      touchedAll = false;
      console.log(`manifest was RELOCATED (byte-identical to ${baseRef}'s copy), not edited: it does not re-publish any entry.`);
    } else if (baseRef) {
      try {
        const basePath = paths.find((path) => { try { gitShow(baseRef, path); return true; } catch { return false; } });
        const baseMap = await import(`data:text/javascript,${encodeURIComponent(gitShow(baseRef, SCREENS_MAP_PATH))}`);
        fromManifest = publishedByManifestEdit(JSON.parse(await readFile(MANIFEST_PATH, "utf8")), JSON.parse(gitShow(baseRef, basePath)), baseMap.SCREENS, SCREENS);
      } catch (err) {
        console.log(`manifest edit could not be compared with ${baseRef} (${String(err.message).split("\n")[0]}): every entry counts as published.`);
      }
      if (fromManifest) touchedAll = false;
    }
  }
}

const masterTouched = (sourceFile) =>
  touched !== null && (touched.has(`${MASTERS_DIR}${sourceFile}`) || touched.has(`${SCREENS_DIR}${sourceFile}`));
const derivativeTouched = (slug) =>
  [...(touched ?? [])].some((p) => p.startsWith(GALLERY_DIR) && p.slice(GALLERY_DIR.length).replace(/(-\d+)?\.(webp|png)$/, "") === slug);
const isTouched = (slug, sourceFile) =>
  touchedAll || masterTouched(sourceFile) || (fromManifest !== null && (fromManifest.published.has(sourceFile) || derivativeTouched(slug)));

const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
const maxAgeDays = manifest.maxAgeDays ?? 21;
const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
const now = Date.now();

const rows = [];
const integrityFailures = [];
const publishFailures = [];
const agedWarnings = [];

for (const [slug, sourceFile] of Object.entries(SCREENS)) {
  const entry = manifest.entries?.[sourceFile];
  const label = `${slug.padEnd(12)} ${sourceFile.padEnd(34)}`;

  const integrity = (reason) => {
    integrityFailures.push({ slug, sourceFile, reason });
    rows.push(`FAIL  ${label} ${reason}`);
  };

  if (!entry) integrity("no manifest entry");
  else if (entry.verified !== true) integrity(`unverified (verified: ${entry.verified})`);
  else {
    const capturedAt = Date.parse(entry.capturedAt ?? "");
    if (Number.isNaN(capturedAt)) integrity("invalid/missing capturedAt");
    else {
      const ageDays = Math.floor((now - capturedAt) / (24 * 60 * 60 * 1000));
      if (now - capturedAt > maxAgeMs) {
        const aged = { slug, sourceFile, ageDays };
        if (STRICT || isTouched(slug, sourceFile)) {
          publishFailures.push(aged);
          rows.push(`FAIL  ${label} ${ageDays}d old (max ${maxAgeDays}d) — ${STRICT ? "strict mode" : "and this change publishes it"}`);
        } else {
          agedWarnings.push(aged);
          rows.push(`WARN  ${label} ${ageDays}d old (max ${maxAgeDays}d) — already live, not touched here`);
        }
      } else if (fromManifest?.redated.has(sourceFile) && !masterTouched(sourceFile)) {
        // A newer date on the same pixels is a stale capture restated as current.
        integrity(`capturedAt is new or moved but ${MASTERS_DIR}${sourceFile} is not in this change: a date without a new capture`);
      } else {
        rows.push(`OK    ${label} ${ageDays}d old`);
      }
    }
  }
}

console.log(
  `Screenshot freshness gate (maxAgeDays=${maxAgeDays}, ` +
    `mode=${STRICT ? "strict" : changedFile ? "split" : "split/no-changeset"}):`
);
for (const row of rows) console.log(`  ${row}`);

// ── the alarm, which survives the gate no longer blocking ──────────────────
// AC2: a deploy carrying stale masters must still be LOUD. An annotation puts
// it on the run's face; the job summary puts it somewhere a human triaging the
// deploy will actually be standing.
for (const a of agedWarnings) {
  console.log(
    `::warning file=${SCREENS_DIR}${a.sourceFile}::Marketing screenshot ${a.sourceFile} ` +
      `is ${a.ageDays}d old (max ${maxAgeDays}d). Deploy is NOT blocked — this master was ` +
      `already live and this change does not touch it — but the site is publishing stale ` +
      `app art. Recapture: gy-iit8q.`
  );
}

if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = ["## Screenshot freshness", ""];
  if (agedWarnings.length) {
    lines.push(
      `### ⚠️ ${agedWarnings.length} stale master(s) shipping to getgymbo.com`,
      "",
      `These are past \`maxAgeDays=${maxAgeDays}\` and this deploy is publishing them anyway.`,
      "The deploy is deliberately not blocked on them (gy-7anl3); the staleness is real (gy-iit8q).",
      "",
      "| screenshot | age |",
      "| --- | --- |",
      ...agedWarnings.map((a) => `| \`${a.sourceFile}\` | ${a.ageDays}d |`),
      ""
    );
  }
  if (publishFailures.length) {
    lines.push(
      `### ❌ ${publishFailures.length} stale master(s) this change PUBLISHES — blocking`,
      "",
      ...publishFailures.map((a) => `- \`${a.sourceFile}\` — ${a.ageDays}d old`),
      ""
    );
  }
  if (integrityFailures.length) {
    lines.push(
      `### ❌ ${integrityFailures.length} integrity failure(s) — blocking`,
      "",
      ...integrityFailures.map((f) => `- \`${f.sourceFile}\` — ${f.reason}`),
      ""
    );
  }
  if (!agedWarnings.length && !publishFailures.length && !integrityFailures.length) {
    lines.push("All gated screenshots verified and fresh.", "");
  }
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
}

if (integrityFailures.length || publishFailures.length) {
  console.error(
    `\nFAIL: ${integrityFailures.length} integrity failure(s), ` +
      `${publishFailures.length} stale artifact(s) ` +
      (STRICT ? "(strict mode: age blocks unconditionally).\n" : "this change publishes.\n") +
      "Integrity failures (missing entry / unverified / invalid capturedAt) are properties of the\n" +
      "change and are always blocking. A stale artifact blocks only when this change touches it.\n" +
      "See ops/screens/MANIFEST.md for how the capture crew backfills a real entry (gy-5xmxm)."
  );
  process.exit(1);
}

console.log(
  agedWarnings.length
    ? `\nOK to deploy: no integrity failures and nothing stale is being published here — ` +
        `but ${agedWarnings.length} already-live master(s) are stale. See the warnings above.`
    : "\nOK: all gated screenshots verified and fresh."
);
