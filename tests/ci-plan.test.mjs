// gcf-cl9g4: pins scripts/ci-plan.mjs from both sides. A deny-list that is too wide skips a gate that would have
// failed; too narrow wastes runner time. Each NON_GATED root must be provably unread, and every gated class must stay heavy.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { isHeavy, NON_GATED } from "../scripts/ci-plan.mjs";

test("non-gated-only change sets are light", () => {
  assert.equal(isHeavy(["evidence/gy-1/a.png", "docs/design/x.md", "review-artifacts/r/y.json", "TOPOLOGY.md"]), false);
});

test("any gated path makes the whole PR heavy", () => {
  for (const f of ["src/App.tsx", "functions/w/_x.js", "public/pricing.md", "index.html", "guide/index.html", "blog/a/index.html",
    "scripts/x.mjs", "tests/a.test.mjs", ".github/workflows/deploy.yml", "package.json", "package-lock.json", "vite.config.ts",
    "README.md", "docs/copy/claim-truth-pass-1.md", "docs/GYMBO-CANONICAL-STRINGS.json", "ops/utm-vocabulary.md",
    "research/state-of-indias-independent-trainers-2026/index.html", "supabase/migrations/1.sql", "brand-new-dir/file.txt"]) {
    assert.equal(isHeavy([f]), true, f);
    assert.equal(isHeavy(["evidence/a.png", f]), true, `mixed with ${f}`);
  }
});

test("an empty change set fails open", () => assert.equal(isHeavy([]), true));

// Planted control: a deny-list entry that a gate DOES read must be caught by the scan below.
function readersOf(entries, files) {
  const reads = [];
  for (const [f, src] of files) {
    for (const g of entries) {
      if (g.endsWith("/**")) {
        if (new RegExp(`["'\`/]${g.slice(0, -3)}/`).test(src)) reads.push(`${f} -> ${g}`);
      } else if (src.includes(`"${g}"`) || src.includes(`'${g}'`)) reads.push(`${f} -> ${g}`);
    }
  }
  return reads;
}

test("the reader scan catches a planted read", () => {
  assert.deepEqual(readersOf(["docs/design/**"], [["scripts/x.mjs", 'readFileSync("docs/design/a.md")']]), ["scripts/x.mjs -> docs/design/**"]);
});

test("no script, test, source or config reads a non-gated path", () => {
  const roots = ["scripts", "tests", "src", "functions", "playwright.config.ts", "playwright.journey.config.ts", "vite.config.ts", "package.json"];
  const self = /ci-plan(\.test)?\.mjs$/;
  // writers and by-name skippers, not readers: capture scripts write evidence/, the two scanners list it in a SKIP set
  // forge-tokens-paths.test.mjs uses "evidence/x.png" only as an unrelated-path fixture for its own filter
  const exempt = /capture-|check-focus-visible|check-no-one-tap|signup-event-semantics|forge-tokens-paths/;
  const files = [];
  const walk = (p) => {
    const s = statSync(p);
    if (s.isDirectory()) readdirSync(p).forEach((n) => walk(join(p, n)));
    else if (/\.(m?js|ts|tsx|sh|json)$/.test(p) && !self.test(p) && !exempt.test(p)) files.push([p, readFileSync(p, "utf8")]);
  };
  for (const r of roots) { try { walk(r); } catch (e) { if (e.code !== "ENOENT") throw e; } }
  assert.deepEqual(readersOf(NON_GATED, files), [], "a gate reads a path the planner treats as skippable");
});
