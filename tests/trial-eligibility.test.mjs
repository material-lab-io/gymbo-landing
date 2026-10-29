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

// gy-r0h3d: a plainly typed typographic dash must not defeat the day trigger.
const DASHES = { hyphen: "-", "en dash": "–", "em dash": "—", "figure dash": "‒", "non-breaking hyphen": "‑", "minus sign": "−", space: " " };

test("POSITIVE CONTROL: every dash form, in digit and word, fails unqualified and passes qualified", () => {
  for (const [name, dash] of Object.entries(DASHES)) {
    for (const count of ["7", "seven", "Seven"]) {
      const bare = `Start your ${count}${dash}day free trial.`;
      assert.equal(scanText(bare, "/", "t").length, 1, `${name} ${count}: ${bare}`);
      assert.equal(scanText(`If eligible, start your ${count}${dash}day free trial.`, "/", "t").length, 0, `${name} ${count} qualified`);
    }
  }
  assert.equal(scanText("Start your 7 – day free trial.", "/", "t").length, 1, "spaced en dash");
});

test("POSITIVE CONTROL: week forms of the trial claim fail unqualified", () => {
  for (const text of ["Try it free for a week.", "A one-week free trial.", "Your 1–week trial is free."]) {
    assert.equal(scanText(text, "/", "t").length, 1, text);
  }
  assert.equal(scanText("Eligible subscribers get a one-week free trial.", "/", "t").length, 0);
});

test("over-breadth stays green: dashed day text with no free/trial claim", () => {
  for (const text of ["Pay within 7–day terms.", "Reports run on a seven—day cycle.", "Book a week ahead."]) {
    assert.equal(scanText(text, "/", "t").length, 0, text);
  }
});

// ---- gy-id5zl: the classes tester's attack on gy-r0h3d found still fail-open (33/182) ----
const flagged = (s) => scanText(s, "/", "t").length > 0;
const QUAL = " Eligible subscribers only.";

test("gy-id5zl class 1: named dash entities are decoded (each RED unqualified, GREEN qualified)", () => {
  for (const ent of ["ndash", "mdash", "hyphen", "dash", "minus", "horbar"]) {
    const claim = `Start your 7&${ent};day free trial today.`;
    assert.equal(flagged(claim), true, `&${ent}; must be caught`);
    assert.equal(flagged(claim + QUAL), false, `&${ent}; qualified must pass`);
  }
});

test("gy-id5zl class 2: filler words between the number and the unit, and the week forms", () => {
  for (const claim of [
    "Get 7 free days of Gymbo.", "Enjoy 7 trial days.", "Try seven full days free.", "Try 7 whole days free.",
    "Try 7 calendar days free.", "Free for 7 consecutive days.", "Enjoy a full week free.", "Enjoy a whole week free.",
    "Your first week is free.", "The first week free.", "One-week free trial.",
  ]) {
    assert.equal(flagged(claim), true, claim);
    assert.equal(flagged(claim + QUAL), false, `${claim} (qualified)`);
  }
});

test("gy-id5zl class 3: a claim split across sentences or separators is read as one", () => {
  for (const claim of [
    "Try Gymbo free. Seven days, no card.", "Free trial. Seven days.", "Free. 7-day access.",
    "Free | 7-day access", "Free · 7-day access", "Free trial\n7-day access",
  ]) {
    assert.equal(flagged(claim), true, JSON.stringify(claim));
    assert.equal(flagged(claim + QUAL), false, `${JSON.stringify(claim)} (qualified)`);
  }
});

test("gy-id5zl class 4: only the whole word 'eligible' qualifies ('ineligible' and 'eligibility' alone do not)", () => {
  assert.equal(flagged("Start your 7-day free trial, ineligible users excluded elsewhere."), true);
  assert.equal(flagged("Start your 7-day free trial. Eligibility rules apply to some accounts."), true);
  assert.equal(flagged("Eligible subscribers can try Gymbo free for 7 days."), false);
  assert.equal(flagged("Start your 7-day free trial if you are eligible."), false);
});

test("gy-id5zl over-breadth: no free/trial word near a 7-day figure stays green", () => {
  for (const ok of [
    "Packages run for 7 days after purchase.", "Your first week of sessions is booked.",
    "Reminders go out 7 days before a renewal.", "Cancel any time. Then Rs 399 a month.",
  ]) {
    assert.equal(flagged(ok), false, ok);
  }
});

test("gy-id5zl planted controls: reverting each class turns a case red", async () => {
  const { readFileSync, writeFileSync, rmSync } = await import("node:fs");
  const dir = new URL("../scripts/", import.meta.url);
  const trialSrc = readFileSync(new URL("check-trial-eligibility.mjs", dir), "utf8");
  const normSrc = readFileSync(new URL("text-normalise.mjs", dir), "utf8");
  let n = 0;
  // Writes mutated copies NEXT TO the real scripts (so relative imports resolve), loads them, removes them.
  async function mutant({ trial = (x) => x, norm = (x) => x }) {
    const id = `${process.pid}-${++n}`;
    const t = new URL(`.mutant-trial-${id}.mjs`, dir), m = new URL(`.mutant-norm-${id}.mjs`, dir);
    const tSrc = trial(trialSrc).replace('"./text-normalise.mjs"', `"./.mutant-norm-${id}.mjs"`);
    writeFileSync(m, norm(normSrc));
    writeFileSync(t, tSrc);
    try { return await import(t.href); } finally { rmSync(t); rmSync(m); }
  }
  const swap = (from, to) => (x) => { assert.ok(x.includes(from), `mutation target missing: ${from}`); return x.replace(from, to); };

  const good = await mutant({});
  assert.equal(good.scanText("7&ndash;day free trial", "/", "t").length, 1, "unmutated copy flags the entity form");
  assert.equal((await mutant({ norm: swap("const NAMED_DASHES = /&(?:ndash|mdash|hyphen|dash|minus|horbar);/gi;", "const NAMED_DASHES = /(?!)/g;") }))
    .scanText("7&ndash;day free trial", "/", "t").length, 0, "no entity decoding must miss &ndash;");
  assert.equal((await mutant({ trial: swap("/\\beligible\\b/i", "/eligib/i") }))
    .scanText("7-day free trial, ineligible users", "/", "t").length, 0, "/eligib/ must wrongly qualify 'ineligible'");
  assert.equal((await mutant({ trial: swap("[sentences[i - 1], sentence, sentences[i + 1]]", "[sentence]") }))
    .scanText("Free trial. Seven days.", "/", "t").length, 0, "a one-sentence window must miss a split claim");
  assert.equal((await mutant({ trial: (x) => x.replace(/\$\{FILL\}/g, "") }))
    .scanText("Get 7 free days of Gymbo.", "/", "t").length, 0, "no filler words must miss '7 free days'");
});

// ---- gy-6cc9n: the cost-free lexicon and double notation (tester's re-attack of gy-id5zl) ----
test("gy-6cc9n: cost-free wording with a 7-day span is RED unqualified, GREEN with 'eligible'", () => {
  for (const claim of [
    "Seven days on us.", "Your first 7 days are on us.", "Enjoy 7 days at no cost.", "Seven days, no charge.",
    "7 days complimentary.", "A complimentary seven-day start.", "Gratis for 7 days.", "7 days for Rs 0.",
    "Get 7 days for \u20b90.", "7 days for Rs. 0.", "Seven days, no card needed.", "Try Gymbo for seven days at no cost, cancel anytime.", "7 days complimentary - cancel anytime.",
    "Cancel anytime: your first 7 days are on us.", "Cancel anytime - seven days at no cost.", "7 days complimentary - cancel within the first month.", "Cancel anytime: for your first 7 days it's on us.", "Cancel anytime - in your first 7 days there is no cost.",
    "Cancel in the app whenever you like, then enjoy 7 days complimentary.", "Seven days, no card needed, cancel whenever.", "7 days for Rs 0, refund if not happy.", "One week on us.", "A week at no cost.",
  ]) {
    assert.equal(flagged(claim), true, claim);
    assert.equal(flagged(claim + QUAL), false, `${claim} (qualified)`);
  }
});

test("gy-6cc9n: double notation 'seven (7) days' is the same number", () => {
  for (const claim of ["Try seven (7) days free.", "Try 7 (seven) days free.", "A seven (7)-day free trial.", "Try 7 (7) days free."]) {
    assert.equal(flagged(claim), true, claim);
    assert.equal(flagged(claim + QUAL), false, `${claim} (qualified)`);
  }
});

test("gy-6cc9n over-breadth: price figures and cost words without a 7-day span stay green", () => {
  for (const ok of [
    "Rs 399 a month.", "Rs 0.50 per message.", "From \u20b9399 a month, no charge for extra clients.",
    "Pay within 7 days of the invoice date.", "We are on us time zone.", "Your data stays with us.",
    "Complimentary tea for visitors.", "Rs 0 outstanding.",
    // tester #293 144f238f: natural policy phrasing
    "Refunds within 7 days, no charge to you.", "Cancel within 7 days at no cost.", "cancel within seven days with no charge",
    "Full refund within 7 days of purchase, no charge for cancelling.", "If you cancel after 7 days there is no charge.",
    // tester #293 false reds, one test per sentence
    "You can count on us. Support is open 7 days a week.", "No card needed to browse the demo. We reply within 7 days.",
    "Cancel in the first 7 days with no charge.", "INR 0 platform fee. Payouts arrive in 7 days.",
  ]) {
    assert.equal(flagged(ok), false, ok);
  }
});

test("gy-6cc9n planted controls: reverting the lexicon or the double notation turns a case red", async () => {
  const { readFileSync, writeFileSync, rmSync } = await import("node:fs");
  const dir = new URL("../scripts/", import.meta.url);
  const trialSrc = readFileSync(new URL("check-trial-eligibility.mjs", dir), "utf8");
  let n = 0;
  async function mutant(fn) {
    const id = `6cc9n-${process.pid}-${++n}`;
    const t = new URL(`.mutant-trial-${id}.mjs`, dir);
    writeFileSync(t, fn(trialSrc));
    try { return await import(t.href); } finally { rmSync(t); }
  }
  const good = await mutant((x) => x);
  assert.equal(good.scanText("Seven days on us.", "/", "t").length, 1, "unmutated copy flags 'on us'");
  assert.equal(good.scanText("Try seven (7) days free.", "/", "t").length, 1, "unmutated copy flags double notation");
  const noCost = await mutant((x) => { assert.ok(x.includes("(span && costFree)")); return x.replace("(span && costFree)", "false"); });
  assert.equal(noCost.scanText("Seven days on us.", "/", "t").length, 0, "no cost-free trigger must miss 'on us'");
  assert.equal(noCost.scanText("7 days for Rs 0.", "/", "t").length, 0, "no cost-free trigger must miss 'Rs 0'");
  const noCancelGuard = await mutant((x) => { assert.ok(x.includes('!(first && CANCEL_CONTEXT.test(sentence.slice(0, first.index + first[0].length)))')); return x.replace('!(first && CANCEL_CONTEXT.test(sentence.slice(0, first.index + first[0].length)))', "true"); });
  assert.equal(noCancelGuard.scanText("Cancel in the first 7 days with no charge.", "/", "t").length, 1, "dropping the cancel guard must re-flag the benign sentence");
  const anywhere = await mutant((x) => { assert.ok(x.includes("sentence.slice(0, first.index + first[0].length)")); return x.replace("CANCEL_CONTEXT.test(sentence.slice(0, first.index + first[0].length))", "CANCEL_CONTEXT.test(sentence)"); });
  assert.equal(anywhere.scanText("7 days complimentary - cancel within the first month.", "/", "t").length, 0, "a whole-sentence cancel guard must miss 'cancel anytime' after the span");
  const windowed = await mutant((x) => { assert.ok(x.includes("TRIGGER_COSTFREE.test(sentence)")); return x.replace("TRIGGER_COSTFREE.test(sentence)", "TRIGGER_COSTFREE.test(window)"); });
  assert.equal(windowed.scanText("You can count on us. Support is open 7 days a week.", "/", "t").length, 1, "a window-wide cost-free test must re-flag 'count on us'");
  const noNum = await mutant((x) => x.replace(/const NUM = [^\n]*\n/, "const NUM = String.raw`(?:7|seven)`;\n"));
  assert.equal(noNum.scanText("Try seven (7) days free.", "/", "t").length, 0, "no double notation must miss 'seven (7) days'");
});
