import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanHtmlTerms, scanText, BANNED, META_ONLY_BANNED, EXCEPTIONS } from "../scripts/check-canonical-terms.mjs";

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

test("POSITIVE CONTROL: the homepage meta shape that shipped ('AI-powered ... Log sessions') fails on every field", () => {
  const head = [
    '<meta name="description" content="AI-powered business app for trainers. Log sessions, track payments.">',
    '<meta property="og:description" content="AI-powered business app for trainers. Log sessions, track payments.">',
    '<meta name="twitter:description" content="AI-powered business app for independent personal trainers.">',
    '<script type="application/ld+json">{"description":"AI-powered business app. Log sessions, track payments."}</script>',
  ].join("");
  const found = scanHtmlTerms(page("<p>Clean.</p>", head), "/").map(({ surface, term }) => `${surface}|${term}`).sort();
  assert.deepEqual(found, [
    "JSON-LD $.description|AI-powered",
    "JSON-LD $.description|log sessions",
    "metadata description|AI-powered",
    "metadata description|log sessions",
    "metadata og:description|AI-powered",
    "metadata og:description|log sessions",
    "metadata twitter:description|AI-powered",
  ].sort());
});

test("NEGATIVE CONTROL: 'log sessions' in a guide page's JSON-LD (general editorial advice) still passes", () => {
  const head = '<script type="application/ld+json">{"name":"Log sessions as they happen"}</script>';
  assert.equal(scanHtmlTerms(page("<p>Clean.</p>", head), "/guide/get-organized-personal-trainer/").length, 0);
  assert.equal(scanHtmlTerms(page("<p>Clean.</p>", head), "/").length, 1);
});

test("NEGATIVE CONTROL: 'log sessions' is banned in metadata only, so general editorial body copy still passes", () => {
  assert.ok(META_ONLY_BANNED.includes("log sessions"));
  assert.equal(scanText("Log sessions as they happen, one tap at the end of each session.", "/guide/x/", "visible text").length, 0);
  assert.equal(scanText("Log sessions as they happen.", "/", "metadata description").length, 1);
});

test("the ruled homepage meta is clean", () => {
  const head = '<meta name="description" content="Built for independent personal trainers: punch classes in one tap, see who owes you, manage clients. From ₹399/mo, 7-day free trial for eligible subscribers.">';
  assert.equal(scanHtmlTerms(page("<p>Clean.</p>", head), "/").length, 0);
});

test("POSITIVE CONTROL: the blog sentence that shipped ('a builder plus voice/paste import and a chat assistant') fails; the ruled one passes", () => {
  const shipped = "For a solo trainer it gives you a builder plus voice/paste import and a chat assistant.";
  assert.deepEqual(scanText(shipped, "/blog/x/", "visible text").map((f) => f.term), ["chat assistant"]);
  const ruled = "it gives you a builder plus voice/paste import, and Ask Gymbo for answers about your clients and payments.";
  assert.equal(scanText(ruled, "/blog/x/", "visible text").length, 0);
});

// ---- gy-uu7mt: the gate polices the CONCEPT, not a list of phrases ----------------
// Every seed below is a paraphrase that is on NO exact-phrase list. Before the families
// existed, all of these passed on real built output (measured 2026-09-24, 8314c9df).
const SEEDS = {
  "attendance-logging": ["an app for logging sessions and payments", "an app that logs your sessions", "log your sessions in one tap", "class logging with automatic balances", "your classes, logged in seconds"],
  "generic-ai-label": ["an AI chat helper for trainers", "an AI-driven trainer app", "an AI companion for scheduling", "a friendly chatbot", "your virtual assistant", "a copilot for your business"],
};

test("POSITIVE CONTROL: none of the seeded paraphrases is on the exact-phrase list (so a pass would prove nothing)", () => {
  for (const seeds of Object.values(SEEDS)) for (const seed of seeds) {
    const lower = seed.toLowerCase();
    assert.ok(!BANNED.some((term) => lower.includes(term.toLowerCase())), `${seed} contains an exact banned phrase`);
  }
});

test("POSITIVE CONTROL: every family goes RED on every surface class, seeded with a paraphrase", () => {
  for (const [family, seeds] of Object.entries(SEEDS)) {
    for (const seed of seeds) {
      const sentence = `Gymbo is ${seed}.`;
      const surfaces = {
        "visible text": scanHtmlTerms(page(`<p>${sentence}</p>`), "/"),
        "metadata": scanHtmlTerms(page("<p>Clean.</p>", `<meta name="description" content="${sentence}">`), "/"),
        "JSON-LD": scanHtmlTerms(page("<p>Clean.</p>", `<script type="application/ld+json">{"description":"${sentence}"}</script>`), "/"),
        "accessibility alt": scanHtmlTerms(page(`<img alt="${sentence}" src="x.png"><p>Clean.</p>`), "/"),
        "served text": scanText(sentence, "/llms.txt", "served text"),
      };
      for (const [surface, findings] of Object.entries(surfaces)) {
        assert.ok(findings.some((f) => f.term.startsWith(`${family}:`)), `${family} missed "${seed}" in ${surface} (got ${JSON.stringify(findings.map((f) => f.term))})`);
      }
    }
  }
});

test("POSITIVE CONTROL: a paraphrase fails the real CLI end to end, in llms.txt and pricing.md too", () => {
  const cli = run(fixture(page("<p>Clean.</p>"), { llms: "Gymbo is an AI-driven trainer app.", pricing: "Gymbo lets you log your sessions." }));
  assert.equal(cli.status, 1, cli.stdout);
  assert.match(cli.stderr, /\/llms\.txt \[served text\] "generic-ai-label: AI-driven"/);
  assert.match(cli.stderr, /\/pricing\.md \[served text\] "attendance-logging: log your sessions"/);
});

test("NEGATIVE CONTROL: the canonical vocabulary still passes, including the /privacy/ processor heading", () => {
  for (const clean of [
    "Punch a class in one tap. Record a payment. Ask Gymbo answers questions about your business.",
    "Ask Gymbo (AI chat): Anthropic (Claude). What it does: answers questions about your clients.",
    "Sign in to see who owes you. Class history and payment records, all in one place.",
    "Gymbo does not generate workouts with AI.",
  ]) assert.equal(scanText(clean, "/", "visible text").length, 0, clean);
});

test("NEGATIVE CONTROL: on a guide/research route only text that names Gymbo nearby counts", () => {
  const general = "Log sessions as they happen, one tap at the end of each session.";
  assert.equal(scanText(general, "/guide/get-organized-personal-trainer/", "visible text").length, 0);
  assert.equal(scanText(general, "/", "visible text").length, 1, "the same sentence on a marketing route must fail");
  assert.ok(scanText("With Gymbo you log your sessions in one tap.", "/guide/x/", "visible text").length >= 1);
  // proximity, not sentence: advice sitting within GYMBO_CONTEXT_CHARS of a Gymbo mention counts too
  assert.equal(scanText(`With Gymbo you punch a class. ${general}`, "/guide/x/", "visible text").length, 1);
  assert.equal(scanText(`With Gymbo you punch a class. ${"Filler sentence about pricing and plans. ".repeat(8)}${general}`, "/guide/x/", "visible text").length, 0);
  // blog is scanned in full: its product paragraphs refer back by pronoun, so no proximity test is safe
  assert.equal(scanText("It gives you a builder, and an app for logging sessions.", "/blog/x/", "visible text").length, 1);
});

test("the removed testimonial's sentence is NO LONGER waived: it is flagged like any other logging copy (compliance ruled DO NOT RETAIN, gy-v9pwo.5; pm 09-26 gy-l6dsr)", () => {
  const quote = "With Gymbo, I open the app, log the session, and move on.";
  assert.equal(scanText(quote, "/", "visible text").length >= 1, true, "a permit for a sentence that no longer ships is a loophole for its return");
  assert.equal(scanText(`${quote} Gymbo lets you log your sessions.`, "/", "visible text").length >= 1, true);
  assert.equal(EXCEPTIONS.some((e) => e.context.test(quote)), false, "no standing exception matches the retired sentence");
  assert.equal(EXCEPTIONS.length, 1, "only the spreadsheet-comparison exception remains");
});

test("an exact-phrase hit is reported once, not again by the family that also matches it", () => {
  const findings = scanText("One-tap session logging for trainers.", "/", "visible text");
  assert.deepEqual(findings.map((f) => f.term), ["session logging"]);
});
