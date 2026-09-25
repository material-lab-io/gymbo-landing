// gy-o0ent: controls for the shared text normaliser. The defect: the copy gates that MATCH
// wording each decoded only a handful of entities and never folded invisible characters, so
// "AI-po&shy;wered" and friends passed every one of them. Each form below is planted into the
// gate that owns the rule and must go RED; the over-breadth cases must stay green.
import { test } from "node:test";
import assert from "node:assert/strict";
import { scanHtmlTerms } from "../scripts/check-canonical-terms.mjs";
import { scanHtmlTrial } from "../scripts/check-trial-eligibility.mjs";
import { decodeEntities, copyBlocks } from "../scripts/copy-blocks.mjs";
import { matchable, INVISIBLES } from "../scripts/text-normalise.mjs";

const page = (body, head = "") => `<!doctype html><html><head><title>Gymbo</title>${head}</head><body><p>${body}</p></body></html>`;

// every way to hide a character inside a word
const HIDE = {
  "named soft hyphen": "&shy;", "numeric soft hyphen": "&#173;", "hex soft hyphen": "&#xAD;", "raw soft hyphen": "­",
  "named zwj": "&zwj;", "named zwnj": "&zwnj;", "named ZeroWidthSpace": "&ZeroWidthSpace;", "numeric ZWSP": "&#8203;", "raw ZWSP": "​",
  "raw ZWJ": "‍", "raw word joiner": "⁠", "raw BOM": "﻿", "named NoBreak": "&NoBreak;", "named lrm": "&lrm;", "raw RLM": "‏",
};

for (const [name, hide] of Object.entries(HIDE)) {
  test(`canonical-terms: a retired term split by ${name} goes RED`, () => {
    assert.ok(scanHtmlTerms(page(`Meet the AI-po${hide}wered app.`), "/").length > 0, name);
    assert.ok(scanHtmlTerms(page(`We help you lo${hide}g classes in a chat assistant.`), "/").length > 0, name);
  });
  test(`trial-eligibility: an unqualified trial claim split by ${name} goes RED`, () => {
    assert.ok(scanHtmlTrial(page(`Start your 7-da${hide}y free trial.`), "/").length > 0, name);
  });
}

test("canonical-terms: Cyrillic look-alikes in a retired term go RED (the site is English)", () => {
  assert.ok(scanHtmlTerms(page("Meet the AI-pоwеred app."), "/").length > 0);
  assert.ok(scanHtmlTrial(page("Start your 7-day frее trial."), "/").length > 0);
});

test("NFKC: compatibility forms of a retired term go RED (non-breaking hyphen, full-width letters)", () => {
  assert.ok(scanHtmlTerms(page("Meet the AI\u2011powered app."), "/").length > 0);
  assert.ok(scanHtmlTerms(page("Meet the \uFF21\uFF29-powered app."), "/").length > 0);
});

test("OVER-BREADTH: canonical copy, entities and curly quotes still pass both gates", () => {
  const ok = "Punch a class in one tap. Ask Gymbo (AI chat) answers questions&nbsp;about your business. It&#39;s “yours” &amp; simple.";
  assert.equal(scanHtmlTerms(page(ok), "/").length, 0);
  assert.equal(scanHtmlTrial(page("Eligible subscribers can try Gymbo free for 7 days."), "/").length, 0);
  assert.equal(scanHtmlTrial(page("Eli&shy;gible subscribers can try Gymbo free for 7&zwj; days."), "/").length, 0, "an invisible inside the qualifier must not un-qualify it");
});

test("copy-blocks.decodeEntities DECODES the named invisibles to the real character (it does not fold)", () => {
  assert.equal(decodeEntities("a&shy;b"), "a­b");
  assert.equal(decodeEntities("a&zwj;b&zwnj;c&ZeroWidthSpace;d"), "a‍b‌c​d");
  assert.equal(decodeEntities("a&amp;shy;b"), "a&shy;b", "a double-encoded entity stays literal text, decoded exactly once");
});

test("THE PIN STAYS FAITHFUL: the change detector's block text still differs when ONLY an invisible character is inserted", () => {
  const a = copyBlocks(page("Meet the app."), "/").map((b) => b.text).join("|");
  const b = copyBlocks(page("Meet the a&shy;pp."), "/").map((b) => b.text).join("|");
  assert.notEqual(a, b);
  assert.ok(INVISIBLES.test(b));
});

test("matchable folds for matching: invisibles gone, look-alikes mapped, quotes and space normalised", () => {
  INVISIBLES.lastIndex = 0;
  assert.equal(matchable("AI-po&shy;w​ered"), "AI-powered");
  assert.equal(matchable("lоg it"), "log it");
  assert.equal(matchable("‘hi’ “there”"), "'hi' \"there\"");
});
