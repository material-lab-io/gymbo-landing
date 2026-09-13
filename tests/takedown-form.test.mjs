// gy-9ggf3 — the takedown form's choice controls.
//
// 🔴 THE DEFECT THESE EXIST FOR: the Reason <select> clipped its longest option,
// "It shows me and I did not agree to this use" — the one an actual rightsholder
// picks — while every DOM assertion passed. The option WAS in the markup and the
// select DID exist; neither fact says a human can read it. A native select
// reports scrollWidth === clientWidth even while clipping, so the browser itself
// will not tell you.
//
// The control is now radios, which wrap, so no option can be cut at any width.
// The width proof is scripts/check-option-text-fits.mjs against the SERVED page —
// it cannot be done here, because layout does not exist in a string. What IS
// provable here is the contract: the same names and values the backend reads.
import { test } from "node:test";
import assert from "node:assert/strict";

const MOD = "../functions/m/takedown.js";
const ENV = { SUPABASE_SERVICE_ROLE_KEY: "k", SUPABASE_URL: "https://stub.invalid" };

const html = async () => {
  globalThis.fetch = async () => new Response("[]", { status: 200 });
  const { onRequestGet } = await import(MOD);
  const res = await onRequestGet({ env: ENV, request: new Request("https://x/m/takedown"), params: {} });
  return res.text();
};

test("gy-9ggf3: the choice controls are RADIOS — a select cannot be proven readable", async () => {
  const h = await html();
  // Assert on the tags a real control would carry, not the string "<select>":
  // the CSS comment explaining WHY this is not a select is itself served, and an
  // assertion that its own documentation trips is a test nobody keeps.
  assert.doesNotMatch(h, /<option\b/i, "an <option> means a select survived the swap");
  assert.doesNotMatch(h, /<\/select>/i, "a closing </select> means a select survived the swap");
  assert.match(h, /type="radio"[^>]*name="requester_role"/);
  assert.match(h, /type="radio"[^>]*name="claim_kind"/);
});

test("gy-9ggf3: every value the backend reads still exists, unchanged", async () => {
  // The handler does form.get("requester_role") / form.get("claim_kind"). If a
  // value were renamed in the swap the form would submit something the backend
  // silently maps to "other" — a data defect with no error anywhere.
  const h = await html();
  for (const v of ["performer", "rightsholder", "agent", "other"])
    assert.match(h, new RegExp(`name="requester_role" value="${v}"`), `requester_role/${v} missing`);
  for (const v of ["likeness", "copyright", "licence", "privacy", "other"])
    assert.match(h, new RegExp(`name="claim_kind" value="${v}"`), `claim_kind/${v} missing`);
});

test("gy-9ggf3: one option in each group is pre-selected, as the select was", async () => {
  // A select always submits something. Radios with nothing checked submit
  // NOTHING, and the handler would default silently to "other" — quietly
  // mislabelling every request from someone who did not touch the control.
  const h = await html();
  const checked = [...h.matchAll(/<input type="radio" name="(\w+)" value="(\w+)" checked>/g)];
  const groups = checked.map((m) => m[1]);
  assert.ok(groups.includes("requester_role"), "no default for requester_role");
  assert.ok(groups.includes("claim_kind"), "no default for claim_kind");
  assert.equal(checked.length, 2, "exactly one default per group, or the browser picks the last");
});

test("gy-9ggf3: the longest option text is still present in full", async () => {
  // Presence is NOT the property that failed — readability was. This asserts we
  // did not "fix" the clipping by shortening the claimant's own words.
  const h = await html();
  assert.match(h, /It shows me and I did not agree to this use/);
});
