// Screenshot capture-provenance gate (gy-v9pwo.2).
//
// The producer contract lives at
// Gymbo-v1/appstore/metadata/capture-provenance-contract.md. This consumer
// reads only the emitted capture-provenance.json beside the masters it
// describes — never the hand-transcribed legacy manifest.
//
// Exit 0 = every rendered master is byte-bound to a clean capture whose
// TestFlight mapping is matched. Exit 1 = NOT_FRESH or UNKNOWN. UNKNOWN is
// intentionally visible and non-passing: absent mapping evidence is not proof
// of freshness.

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SCREENS } from "./screens-map.mjs";

const MASTERS_DIR = "public/screens/real";
const PROVENANCE_PATH = join(MASTERS_DIR, "capture-provenance.json");
const expectedFiles = Object.values(SCREENS);
const rows = [];
let failed = false;
let unknown = false;

function row(state, file, detail) {
  rows.push(`${state.padEnd(9)} ${file.padEnd(34)} ${detail}`);
}

function failUnknown(detail) {
  unknown = true;
  failed = true;
  for (const file of expectedFiles) row("UNKNOWN", file, detail);
}

function isIsoTimestamp(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function hasContractShape(value) {
  return value
    && value.schema_version === 1
    && value.profile === "landing"
    && isIsoTimestamp(value.captured_at)
    && (value.capture_commit === null || /^[a-f0-9]{40}$/i.test(value.capture_commit))
    && (value.capture_commit_short === null || /^[a-f0-9]{12}$/i.test(value.capture_commit_short))
    && [true, false, null].includes(value.capture_tree_dirty)
    && typeof value.capture_branch === "string"
    && isIsoTimestamp(value.capture_commit_committed_at)
    && typeof value.app_version === "string"
    && (typeof value.app_build === "string" || typeof value.app_build === "number" || value.app_build === null)
    && Number.isInteger(value.expected_width) && value.expected_width > 0
    && Number.isInteger(value.expected_height) && value.expected_height > 0
    && Number.isInteger(value.image_count) && value.image_count >= 0
    && Array.isArray(value.images);
}

let provenance;
try {
  provenance = JSON.parse(await readFile(PROVENANCE_PATH, "utf8"));
} catch (error) {
  failUnknown(`capture provenance unavailable (${error.code ?? "invalid JSON"})`);
}

if (provenance) {
  if (!hasContractShape(provenance)) {
    failUnknown("invalid capture-provenance contract fields");
  } else {
    const mapping = provenance.build_mapping;
    if (!mapping || !["matched", "not_a_shipped_build", "unknown"].includes(mapping.status)
      || (mapping.status === "matched" && (mapping.reason !== null || !mapping.build))) {
      failUnknown("capture provenance has invalid build_mapping status");
    } else if (mapping.status === "unknown") {
      failUnknown(`TestFlight mapping unresolved${mapping.reason ? `: ${mapping.reason}` : ""}`);
    } else if (mapping.status === "not_a_shipped_build") {
      failed = true;
      for (const file of expectedFiles) row("NOT_FRESH", file, "capture commit is not a shipped TestFlight build");
    } else if (provenance.capture_tree_dirty !== false) {
      failed = true;
      for (const file of expectedFiles) row("NOT_FRESH", file, "capture tree was dirty or could not be determined");
    } else {
      const images = new Map(provenance.images.map((image) => [image.file, image]));
      if (provenance.image_count !== provenance.images.length) {
        failed = true;
        row("FAIL", "provenance", "image_count does not equal images array length");
      }

      for (const file of expectedFiles) {
        const image = images.get(file);
        if (!image || typeof image.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(image.sha256)) {
          failed = true;
          row("FAIL", file, "missing valid producer sha256");
          continue;
        }

        try {
          const actual = createHash("sha256").update(await readFile(join(MASTERS_DIR, file))).digest("hex");
          if (actual !== image.sha256.toLowerCase()) {
            failed = true;
            row("FAIL", file, "PNG bytes do not match capture provenance");
          } else {
            row("FRESH", file, `matched TestFlight build ${mapping.build?.build_number ?? "(unnumbered)"}`);
          }
        } catch (error) {
          failed = true;
          row("FAIL", file, `cannot hash master (${error.code ?? "read error"})`);
        }
      }
    }
  }
}

console.log("Screenshot capture-provenance gate:");
for (const value of rows) console.log(`  ${value}`);

if (failed) {
  const verdict = unknown ? "UNKNOWN" : "NOT_FRESH";
  console.error(`\n${verdict}: screenshot freshness did not pass. See the producer contract and capture-provenance.json.`);
  process.exit(1);
}

console.log("\nOK: every gated screenshot is byte-bound to a clean, matched TestFlight capture.");
