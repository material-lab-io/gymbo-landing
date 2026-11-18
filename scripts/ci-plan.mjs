#!/usr/bin/env node
// gcf-cl9g4 (CI-diet path filters). Decides whether a pull request can reach any gate in deploy.yml / web-audit.yml.
// Reads changed file paths (one per line) on stdin and prints `heavy=true|false`. The CHANGE SET is the only input,
// so the same call runs locally: git diff --name-only origin/main...HEAD | node scripts/ci-plan.mjs
//
// FAIL-OPEN BY CONSTRUCTION: this is a deny-list of paths that NO gate reads. Anything not listed (a new top-level
// directory, a renamed script, an empty change set) is heavy. An allow-list would fail closed to skipping, which for
// the required `deploy` check means a green that tested nothing.
// tests/ci-plan.test.mjs proves each NON_GATED root is unread and every gated class stays heavy.
import { readFileSync } from "node:fs";

// Verified unread by every gate: check-no-one-tap and signup-event-semantics skip evidence/ and review-artifacts/ by name,
// docs/design/ is prose only, and the other entries are not imported by the build or any test.
export const NON_GATED = ["evidence/**", "review-artifacts/**", "docs/design/**", "TOPOLOGY.md", "schema.sql", "LICENSE"];

const globToRe = (g) => new RegExp(`^${g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*")}$`);
const NON_GATED_RE = NON_GATED.map(globToRe);

/** True when at least one changed path can reach a gate; an empty change set is heavy (could not look). */
export function isHeavy(files) {
  const changed = files.map((f) => f.trim()).filter(Boolean);
  if (changed.length === 0) return true;
  return changed.some((f) => !NON_GATED_RE.some((re) => re.test(f)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = readFileSync(0, "utf8").split("\n");
  console.log(`heavy=${isHeavy(files)}`);
}
