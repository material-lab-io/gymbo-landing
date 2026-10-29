// gy-x0pdi / gy-o71gz: structured data must say what the page says. The check runs on BUILT html, so these
// tests build small dist trees and run the real CLI, plus the pure per-page function.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pageDrift, findJsonLdDrift, words } from "../scripts/check-jsonld-sync.mjs";

const SCRIPT = resolve(import.meta.dirname, "..", "scripts", "check-jsonld-sync.mjs");

const Q = "At what point should a trainer move off WhatsApp and a diary?";
const A = "Usually when admin starts eating multiple hours a week and payments become hard to track. The signal: when you're no longer sure who's paid.";

// A page with one FAQ in JSON-LD and the same FAQ visible. `visibleAnswer` / `ldAnswer` let a test make them differ.
function page({ ldAnswer = A, visibleAnswer = A, ldQuestion = Q, steps = [], visibleExtra = "" } = {}) {
  const ld = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: [{ "@type": "Question", name: ldQuestion, acceptedAnswer: { "@type": "Answer", text: ldAnswer } }] };
  const howto = steps.length ? `<script type="application/ld+json">${JSON.stringify({ "@type": "HowTo", name: "x", step: steps.map((s) => ({ "@type": "HowToStep", name: s.name, text: s.text })) })}</script>` : "";
  return `<!doctype html><html><head><title>t</title><script type="application/ld+json">${JSON.stringify(ld)}</script>${howto}</head>` +
    `<body><main><h1>Title</h1><details><summary><span>${Q}</span></summary><p>${visibleAnswer}</p></details>${visibleExtra}</main></body></html>`;
}

function dist(files) {
  const root = mkdtempSync(join(tmpdir(), "jsonld-sync-"));
  for (const [rel, html] of Object.entries(files)) {
    const p = join(root, rel); mkdirSync(join(p, ".."), { recursive: true }); writeFileSync(p, html);
  }
  return root;
}
const run = (root) => spawnSync(process.execPath, [SCRIPT, "--root", root], { encoding: "utf8" });

test("POSITIVE CONTROL: a page whose JSON-LD answer is its visible answer is clean", () => {
  const r = pageDrift(page(), "/blog/x/");
  assert.equal(r.drift.length, 0);
  assert.equal(r.checked, 2, "the question and the answer were both looked at (a gate that checked nothing would also be 'clean')");
});

test("SEEDED CONTROL: one changed word in the JSON-LD answer is caught and named", () => {
  const r = pageDrift(page({ ldAnswer: A.replace("hard to track", "difficult to track") }), "/blog/x/");
  assert.equal(r.drift.length, 1);
  assert.match(r.drift[0].surface, /acceptedAnswer\.text$/);
  assert.equal(r.drift[0].route, "/blog/x/");
});

test("THE MEASURED LEAK: an unsourced threshold kept in the JSON-LD after the visible text dropped it fails", () => {
  const leaked = A.replace("hard to track.", "hard to track, commonly around 15 clients.");
  assert.equal(pageDrift(page({ ldAnswer: leaked }), "/blog/x/").drift.length, 1);
});

test("a question whose JSON-LD name differs from the visible question is caught too", () => {
  const r = pageDrift(page({ ldQuestion: "When should a trainer stop using WhatsApp?" }), "/blog/x/");
  assert.equal(r.drift.length, 1);
  assert.match(r.drift[0].surface, /mainEntity\[\]\.name$/);
});

test("DECISION: punctuation-only differences are accepted (colon vs comma, parentheses)", () => {
  assert.equal(pageDrift(page({ ldAnswer: "Akton is gym-management software, built around members (and staff).", visibleAnswer: "Akton is gym-management software: built around members, and staff." }), "/x/").drift.length, 0);
  // ...but a changed NUMBER or CURRENCY symbol is not punctuation
  assert.equal(pageDrift(page({ ldAnswer: "Costs ₹399/mo.", visibleAnswer: "Costs ₹449/mo." }), "/x/").drift.length, 1);
  assert.equal(pageDrift(page({ ldAnswer: "Costs ₹399/mo.", visibleAnswer: "Costs $399/mo." }), "/x/").drift.length, 1);
  // ...and a dropped negation is a dropped word
  assert.equal(pageDrift(page({ ldAnswer: "It does not support UPI.", visibleAnswer: "It does support UPI." }), "/x/").drift.length, 1);
});

test("an HTML-entity apostrophe in the visible text still matches the decoded JSON-LD string", () => {
  const html = page({ ldAnswer: "You'll know when who's paid is unclear.", visibleAnswer: "You&#x27;ll know when who&#x27;s paid is unclear." });
  assert.equal(pageDrift(html, "/x/").drift.length, 0);
});

test("HowTo steps are NOT enforced but are counted, so the gap is visible and not silent", () => {
  const html = page({ steps: [{ name: "Do the thing", text: "A step the visible page never shows." }] });
  const r = pageDrift(html, "/guide/x/");
  assert.equal(r.drift.length, 0, "not enforced");
  assert.equal(r.howto.length, 2, "name and text are both counted");
});

test("CLI: green tree exits 0 and says what it checked; seeded drift exits 1 naming route and surface", () => {
  const ok = dist({ "blog/x/index.html": page(), "index.html": "<html><body>no structured data here</body></html>" });
  try {
    const r = run(ok);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /OK: FAQ structured data matches visible text: 2 question\/answer string\(s\) across 1 page\(s\)/);
  } finally { rmSync(ok, { recursive: true, force: true }); }
  const bad = dist({ "blog/x/index.html": page({ ldAnswer: A + " Commonly around 15 clients." }) });
  try {
    const r = run(bad);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /FAIL: check-jsonld-sync: 1 structured-data string/);
    assert.match(r.stderr, /\/blog\/x\/ JSON-LD \$\.mainEntity\[\]\.acceptedAnswer\.text/);
  } finally { rmSync(bad, { recursive: true, force: true }); }
});

test("CLI: the gate refuses a vacuous pass (JSON-LD present, zero FAQ strings extracted) and a missing dist", () => {
  const blind = dist({ "x/index.html": `<html><head><script type="application/ld+json">{"@type":"Organization","name":"x"}</script></head><body>hi</body></html>` });
  try {
    const r = run(blind);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /checked 0 FAQ strings/);
  } finally { rmSync(blind, { recursive: true, force: true }); }
  const missing = run(join(tmpdir(), "definitely-not-a-dist-" + process.pid));
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /does not exist/);
});

test("the pure function and the tree walker agree, across nested routes", () => {
  const root = dist({ "a/index.html": page(), "b/c/index.html": page({ ldAnswer: "Something else entirely." }) });
  try {
    const r = findJsonLdDrift(root);
    assert.equal(r.pages, 2);
    assert.deepEqual(r.findings.map((f) => f.route), ["/b/c/"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("words(): lower-cased word sequence, punctuation collapsed, currency and percent kept", () => {
  assert.equal(words("Costs ₹2,999/year, save 37%."), " costs ₹2 999 year save 37% ");
});
