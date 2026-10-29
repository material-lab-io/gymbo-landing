// gy-sl9amm (content copy sheet, 29 Oct): the empty-submit error must not repeat the
// permanent contact hint (a screen reader hears both), and a failed send must be
// announced like the validation errors are.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SRC = readFileSync(new URL("../src/components/WaitlistForm.tsx", import.meta.url), "utf8");

const HINT = SRC.match(/(Add a WhatsApp number or an email: either one is enough\.)/)?.[1];
const NEEDS_CONTACT = SRC.match(/status === "needs-contact" && \([\s\S]*?>\s*\n\s*([^<{\n]+)\n\s*<\/span>/)?.[1]?.trim();

test("the empty-submit error and the permanent hint are different sentences", () => {
  assert.ok(HINT, "hint line not found");
  assert.ok(NEEDS_CONTACT, "needs-contact error text not found");
  assert.notEqual(NEEDS_CONTACT, HINT);
  assert.equal(NEEDS_CONTACT, "Nothing to reach you on yet. Add a WhatsApp number or an email.");
});

test("planted control: the old error text opened with the hint's own words", () => {
  const OLD = "Add a WhatsApp number or an email so we can reach you.";
  const opening = (s) => s.toLowerCase().replace(/[^a-z ]/g, "").split(/\s+/).slice(0, 7).join(" ");
  assert.equal(opening(OLD), opening(HINT), "the control must read as a near-duplicate of the hint");
  assert.notEqual(opening(NEEDS_CONTACT), opening(HINT), "the new text must not open with the hint's words");
});

test("the send-failed span carries role=alert and the destructive token", () => {
  const block = SRC.match(/status === "error" && \([\s\S]*?<\/span>/)?.[0] ?? "";
  assert.match(block, /role="alert"/);
  assert.match(block, /status-destructive-dark/);
  assert.doesNotMatch(block, /grey-muted/);
});
