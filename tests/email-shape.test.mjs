// gy-e60uc.2 — the waitlist email shape rule: it refuses what Resend would 422 on and accepts what a real
// trainer types, and the edge function's copy of the rule is byte-identical to the shared one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { looksLikeEmail, EMAIL_MAX_LENGTH } from "../src/lib/emailShape.mjs";

const ROOT = new URL("..", import.meta.url).pathname;

// LIVENESS: a rule that refuses everything passes every negative case, so the accepts come first.
const VALID = [
  "x@gmail.com",
  "first.last+tag@sub.example.co.in",
  "a_b-c@d-e.io",
  "trainer@örebro.se",
  "n@x.ai",
];
// NEGATIVE CONTROL: "a@b" and "a@gmail" are the row-29 class: one "@", no valid domain, HTML type=email accepts them.
const INVALID = [
  "a@b", "a@gmail", "a@b.c", "a@gmail,com", "a@gmail;com", "a@@b.com", "@b.com", "a@.com", "a@b..com", "a@b.",
  "a b@c.com", "a@b .com", " a@b.com", "a@b.com ", "a@b.com,c@d.com", "<a@b.com>", 'a"b@c.com', "a(b)@c.com",
  "", "@", "plainaddress", "a@b@c.com",
];

test("accepts the addresses real trainers type (liveness)", () => {
  for (const v of VALID) assert.equal(looksLikeEmail(v), true, `should accept: ${v}`);
});

test("refuses the malformed shapes Resend would 422 on (negative control)", () => {
  for (const v of INVALID) assert.equal(looksLikeEmail(v), false, `should refuse: ${JSON.stringify(v)}`);
});

test("refuses non-strings and over-long input", () => {
  for (const v of [undefined, null, 5, {}, ["a@b.com"]]) assert.equal(looksLikeEmail(v), false);
  const long = "a".repeat(EMAIL_MAX_LENGTH) + "@b.com";
  assert.equal(looksLikeEmail(long), false);
});

const block = (file) => {
  const s = readFileSync(ROOT + file, "utf8");
  const a = s.indexOf("// EMAIL_SHAPE-BEGIN");
  const b = s.indexOf("// EMAIL_SHAPE-END");
  assert.ok(a !== -1 && b > a, `${file}: EMAIL_SHAPE markers not found`);
  return s.slice(a, b + "// EMAIL_SHAPE-END".length);
};

test("DRIFT: the edge function's copy of the rule is byte-identical to src/lib/emailShape.mjs", () => {
  assert.equal(block("supabase/functions/waitlist-notify/index.ts"), block("src/lib/emailShape.mjs"));
});

test("DRIFT CONTROL: the comparison can fail (a one-character change to the copy is caught)", () => {
  const shared = block("src/lib/emailShape.mjs");
  const mutated = shared.replace("{2,}", "{1,}");
  assert.notEqual(mutated, shared, "the mutation did not change the block, so this control would be blind");
  assert.notEqual(block("supabase/functions/waitlist-notify/index.ts"), mutated);
});
