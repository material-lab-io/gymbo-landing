import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanHtmlTerms, scanText, BANNED } from "../scripts/check-canonical-terms.mjs";

const SCRIPT = new URL("../scripts/check-canonical-terms.mjs", import.meta.url).pathname;
const scratch = mkdtempSync(join(tmpdir(), "gymbo-canonical-terms-"));
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));
let serial = 0;

const CLEAN_TEXT = "Punch a class in one tap. Ask Gymbo answers questions about your business.";

function page(body, head = "") {
  return `<!doctype html><html><head><title>Gymbo</title>${head}</head><body>${body}</body></html>`;
}

function fixture(home, { llms = CLEAN_TEXT, pricing = CLEAN_TEXT } = {}) {
  const root = join(scratch, `case-${++serial}`);
  mkdirSync(join(root, "auth", "callback"), { recursive: true });
  writeFileSync(root + "/sitemap.xml", '<?xml version="1.0"?><urlset><url><loc>https://getgymbo.com/</loc></url></urlset>');
  writeFileSync(root + "/index.html", home);
  writeFileSync(join(root, "auth", "callback", "index.html"), page("<p>Opening Gymbo.</p>"));
  writeFileSync(root + "/404.html", page("<p>Page not found</p>"));
  if (llms !== null) writeFileSync(root + "/llms.txt", llms);
  if (pricing !== null) writeFileSync(root + "/pricing.md", pricing);
  return root;
}

const run = (root) => spawnSync(process.execPath, [SCRIPT, "--root", root], { encoding: "utf8" });

test("NEGATIVE CONTROL: canonical copy passes, and the pages were actually read", () => {
  const result = run(fixture(page(`<p>${CLEAN_TEXT}</p>`)));
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /across 3 built page\(s\) plus llms\.txt and pricing\.md/);
});

test("POSITIVE CONTROL: one generic AI label in visible text fails by name", () => {
  const result = run(fixture(page("<p>Gymbo includes an AI assistant for your business.</p>")));
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /\[visible text\] "AI assistant"/);
});

test("POSITIVE CONTROL: a seeded Gymbo feature sentence using log a session fails", () => {
  const result = run(fixture(page("<p>With Gymbo you can log a session in one tap.</p>")));
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /"log a session"/);
});

test("POSITIVE CONTROL: the retired terms fail in metadata, JSON-LD, alt text, llms.txt and pricing.md", () => {
  const head = '<meta name="description" content="One-tap session logging for trainers"><script type="application/ld+json">{"text":"Gymbo runs your back office"}</script>';
  const html = page('<img alt="Gymbo dashboard and payment logging" src="x.png"><p>Clean.</p>', head);
  const findings = scanHtmlTerms(html, "/");
  assert.deepEqual(
    findings.map(({ surface, term }) => `${surface}|${term}`).sort(),
    ["JSON-LD $.text|back office", "accessibility alt|payment logging", "metadata description|session logging"].sort(),
  );
  const root = fixture(page("<p>Clean.</p>"), { llms: "An AI chat assistant.", pricing: "One-tap session logging." });
  const result = run(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /\/llms\.txt \[served text\] "AI chat assistant"/);
  assert.match(result.stderr, /\/pricing\.md \[served text\] "session logging"/);
});

test("every banned term is caught, including through HTML entities and line breaks", () => {
  for (const term of BANNED) {
    const mangled = term.replace(" ", "\n  ").replace("'", "&#x27;");
    const terms = scanText(`Gymbo: ${mangled}.`, "/", "visible text").map((finding) => finding.term);
    assert.ok(terms.includes(term), `${term} not caught (got ${JSON.stringify(terms)})`);
  }
});

test("the spreadsheet exception is one sentence, not a licence for Gymbo copy", () => {
  const spreadsheet = "A spreadsheet can hold this, but it doesn&#x27;t log a session with one tap between clients.";
  assert.equal(scanText(spreadsheet, "/guide/x/", "visible text").length, 0);
  assert.equal(scanText(`${spreadsheet} Gymbo lets you log a session in one tap.`, "/guide/x/", "visible text").length, 1);
});

test("a missing text endpoint is COULD-NOT-EVALUATE (exit 2), never a pass", () => {
  const result = run(fixture(page("<p>Clean.</p>"), { llms: null }));
  assert.equal(result.status, 2, result.stdout);
  assert.match(result.stderr, /COULD NOT EVALUATE/);
});
