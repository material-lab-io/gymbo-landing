import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanHtmlTrial, scanText } from "../scripts/check-trial-eligibility.mjs";

const SCRIPT = new URL("../scripts/check-trial-eligibility.mjs", import.meta.url).pathname;
const scratch = mkdtempSync(join(tmpdir(), "gymbo-trial-eligibility-"));
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));
let serial = 0;

const CLEAN_TEXT = "Eligible subscribers can try Gymbo free for 7 days. Then Rs 399 a month.";

const page = (body, head = "") => `<!doctype html><html><head><title>Gymbo</title>${head}</head><body>${body}</body></html>`;

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

test("NEGATIVE CONTROL: qualified copy passes, and the pages were actually read", () => {
  const result = run(fixture(page(`<p>${CLEAN_TEXT}</p>`)));
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /across 3 built page\(s\) plus llms\.txt and pricing\.md/);
});

test("POSITIVE CONTROL: the former universal strings each fail", () => {
  for (const text of [
    "Your first 7 days are free on every plan.",
    "Your 7-day trial is free.",
    "From 399 a month, 7 days free.",
    "Free for your first 7 days.",
    "Unlimited clients on every plan; 7-day free trial",
  ]) {
    assert.equal(scanText(text, "/", "visible text").length, 1, text);
  }
});

test("POSITIVE CONTROL: an unqualified promise fails in visible text, metadata, JSON-LD, llms.txt and pricing.md", () => {
  const head = '<meta name="description" content="From 399 a month, 7 days free."><script type="application/ld+json">{"text":"Your first 7 days are free."}</script>';
  assert.deepEqual(
    scanHtmlTrial(page("<p>Your 7-day free trial starts once you are in.</p>", head), "/").map((f) => f.surface).sort(),
    ["JSON-LD $.text", "metadata description", "visible text"],
  );
  const root = fixture(page("<p>Clean.</p>"), { llms: "7-day free trial", pricing: "Your **first 7 days are free**." });
  const result = run(root);
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /\/llms\.txt \[served text\]/);
  assert.match(result.stderr, /\/pricing\.md \[served text\]/);
});

test("a qualified renewal sentence and unrelated 7-day text are not flagged", () => {
  assert.equal(scanText("If you are eligible for the introductory offer, your 7-day trial is free.", "/", "t").length, 0);
  assert.equal(scanText("Pay within 7 days of the invoice date.", "/", "t").length, 0);
});

test("COULD NOT EVALUATE: a missing served text file is exit 2, never a pass", () => {
  const result = run(fixture(page(`<p>${CLEAN_TEXT}</p>`), { llms: null }));
  assert.equal(result.status, 2, result.stdout);
});
