// gcf-i272q (CI-diet path filters): forge-tokens.yml holds no required check, so its pull_request trigger carries a
// workflow-level `paths:` allow-list. An allow-list fails CLOSED TO SKIPPING, so this test pins it from the other side:
// every input the workflow's gates read must match a pattern, an unrelated path must not, and the filter must not leak
// onto the push / dispatch triggers. Each check also runs against a mutated copy that must go red.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const WF = ".github/workflows/forge-tokens.yml";
const SRC = readFileSync(new URL(`../${WF}`, import.meta.url), "utf8");

function triggerBlock(src, name) {
  const m = src.match(new RegExp(`^  ${name}:\\n((?:    .*\\n)*)`, "m"));
  return m ? m[1] : null;
}

function prPaths(src) {
  const pr = triggerBlock(src, "pull_request");
  assert.ok(pr, "forge-tokens.yml has no pull_request trigger");
  const m = pr.match(/^    paths:\n((?:      - .*\n)+)/m);
  assert.ok(m, "pull_request has no paths: allow-list");
  return m[1].split("\n").filter(Boolean).map((l) => l.replace(/^\s*-\s*/, "").replace(/^['"]|['"]$/g, ""));
}

// GitHub path-filter globs: `**` crosses directories, `*` does not.
function globToRe(g) {
  const re = g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*");
  return new RegExp(`^${re}$`);
}
const matches = (patterns, file) => patterns.some((p) => globToRe(p).test(file));

// Everything the workflow's gates read, derived from the workflow and the repo, not typed in here.
function guardedInputs() {
  const scripts = [...SRC.matchAll(/node scripts\/([\w.-]+\.mjs)/g)].map((m) => `scripts/${m[1]}`);
  const forgeScripts = readdirSync(new URL("../scripts", import.meta.url)).filter((f) => /forge/.test(f)).map((f) => `scripts/${f}`);
  return [...new Set([
    ...scripts, ...forgeScripts, WF,
    "src/forge/forge.css", "src/forge/forge.pin.json", "src/theme.css", "src/forge-ui.tsx", // check-forge-tokens SCAN root + pin
    "functions/_forge.js", "functions/w/[token].js", "functions/m/[id].js",                  // SCAN root functions/
    "public/logo.svg", "public/screens/x.svg",                                               // ASSET_SCAN root public/
  ])];
}

test("every forge gate input is covered by the pull_request paths allow-list", () => {
  const patterns = prPaths(SRC);
  const uncovered = guardedInputs().filter((f) => !matches(patterns, f));
  assert.deepEqual(uncovered, [], `filter too narrow, a PR touching these would SILENTLY skip the gate: ${uncovered}`);
});

test("the workflow's own node script calls are non-empty (the derivation can see the gates)", () => {
  assert.ok([...SRC.matchAll(/node scripts\/([\w.-]+\.mjs)/g)].length >= 4);
});

test("paths that no forge gate reads do NOT trigger it (this is a filter, not a no-op)", () => {
  const patterns = prPaths(SRC);
  for (const f of ["README.md", "docs/copy/claim-truth-pass-1.md", "ops/utm-vocabulary.md", "tests/audit.spec.ts",
    "evidence/x.png", ".github/workflows/deploy.yml", "package.json", "scripts/check-tracked-symlinks.sh"]) {
    assert.equal(matches(patterns, f), false, `${f} must not trigger forge-tokens`);
  }
});

test("push and workflow_dispatch triggers are untouched: no paths filter, main only", () => {
  const push = triggerBlock(SRC, "push");
  assert.ok(push && /branches: \[main\]/.test(push), "push must stay main-only");
  assert.ok(!/paths/.test(push), "push must not carry a paths filter");
  assert.ok(/^  workflow_dispatch:/m.test(SRC), "workflow_dispatch must stay");
});

test("every runs-on stays [self-hosted, pool]", () => {
  const labels = [...SRC.matchAll(/runs-on:\s*(.+)/g)].map((m) => m[1].trim());
  assert.ok(labels.length >= 1);
  for (const l of labels) assert.equal(l, "[self-hosted, pool]");
});

test("MUTANTS: dropping any guarded pattern turns the coverage check red", () => {
  const patterns = prPaths(SRC);
  for (let i = 0; i < patterns.length; i++) {
    const mutated = patterns.filter((_, j) => j !== i);
    const uncovered = guardedInputs().filter((f) => !matches(mutated, f));
    assert.ok(uncovered.length > 0, `dropping "${patterns[i]}" left every input covered: the pattern guards nothing, remove it`);
  }
});
