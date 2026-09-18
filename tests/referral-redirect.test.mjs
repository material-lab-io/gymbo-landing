// gy-3jb0t — /r/<token> must forward the token itself, not the literal ":token".
import { test } from "node:test";
import assert from "node:assert/strict";
import { referralLocation, onRequestGet } from "../functions/r/[token].js";

const campaign = (loc) => new URL(loc).searchParams.get("utm_campaign");

test("a well-formed token survives the redirect as utm_campaign", () => {
  const loc = referralLocation("testtoken001");
  assert.equal(campaign(loc), "testtoken001");
  const q = new URL(loc).searchParams;
  assert.equal(q.get("utm_source"), "referral");
  assert.equal(q.get("utm_medium"), "referral");
  // The regression this bead exists for.
  assert.notEqual(campaign(loc), ":token");
});

test("a token that is not already a slug is dropped, never reshaped", () => {
  for (const bad of ["Ab.1", "has space", "a?b=c", "x".repeat(33), "none", "-lead", "trail-", "ünï"]) {
    const loc = referralLocation(bad);
    assert.equal(campaign(loc), null, `${JSON.stringify(bad)} must not be forwarded`);
    // Still a referral visit: only WHOSE is unknown.
    assert.equal(new URL(loc).searchParams.get("utm_source"), "referral");
  }
  assert.equal(campaign(referralLocation("")), null);
  assert.equal(campaign(referralLocation(undefined)), null);
});

test("the function answers 301 to the site root with the token forwarded", async () => {
  const res = onRequestGet({ params: { token: "testtoken001" } });
  assert.equal(res.status, 301);
  const loc = new URL(res.headers.get("Location"));
  assert.equal(loc.origin + loc.pathname, "https://getgymbo.com/");
  assert.equal(loc.searchParams.get("utm_campaign"), "testtoken001");
});
