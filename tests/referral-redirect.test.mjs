// gy-ufxgo.9 — /r/<code> translates the public code to an opaque ref_<32hex>
// campaign via HMAC-SHA-256. Fixture key only; no production secret is used.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { referralLocation, onRequestGet, canonicalCode, DOMAIN } from "../functions/r/[token].js";

const KEY = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"; // FIXTURE, not a real key
const env = { REFERRAL_HMAC_KEY_V1: KEY };
const q = (loc) => new URL(loc).searchParams;
const expected = (code) => "ref_" + createHmac("sha256", Buffer.from(KEY, "hex")).update(DOMAIN + code).digest().subarray(0, 16).toString("hex");

test("a valid code redirects as referral with exactly ref_<32hex>, matching an independent HMAC", async () => {
  const { location } = await referralLocation("ABCD234", env);
  assert.equal(q(location).get("utm_source"), "referral");
  assert.equal(q(location).get("utm_medium"), "referral");
  assert.match(q(location).get("utm_campaign"), /^ref_[0-9a-f]{32}$/);
  assert.equal(q(location).get("utm_campaign"), expected("ABCD234"));
});

test("raw code never appears in Location (incl. raw values from the registry controls)", async () => {
  const { location } = await referralLocation("abcd234", env);
  assert.ok(!/abcd234/i.test(location), "raw code leaked into Location");
  for (const raw of ["summer20", "naveen_maharashi_06"]) {
    const out = await referralLocation(raw, env);
    assert.equal(out.location, "https://getgymbo.com/", `${raw} must land untagged`);
  }
});

test("deterministic, case-insensitive, trimmed; distinct codes give distinct values", async () => {
  const a = q((await referralLocation("ABCD234", env)).location).get("utm_campaign");
  const b = q((await referralLocation(" abcd234 ", env)).location).get("utm_campaign");
  const c = q((await referralLocation("ABCD235", env)).location).get("utm_campaign");
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("a different key gives a different value (key actually participates)", async () => {
  const other = { REFERRAL_HMAC_KEY_V1: "ff".repeat(32) };
  const a = q((await referralLocation("ABCD234", env)).location).get("utm_campaign");
  const b = q((await referralLocation("ABCD234", other)).location).get("utm_campaign");
  assert.notEqual(a, b);
});

test("off-grammar values reach the plain untagged site, with no partial tuple", async () => {
  // I, O, 0, 1 are outside the alphabet; also length, unicode, slash, whitespace.
  for (const bad of ["ABCD23", "ABCD2345", "ABCDI23", "ABCDO23", "ABCD023", "ABCD123", "AB%4123", "ABC/234", "ünïcode", "   ", "", null, undefined]) {
    const out = await referralLocation(bad, env);
    assert.equal(out.location, "https://getgymbo.com/", `${JSON.stringify(bad)} must be untagged`);
    assert.equal(new URL(out.location).search, "");
  }
  assert.equal(canonicalCode("abcd234"), "ABCD234");
});

test("a valid code with a missing/empty/malformed key fails visibly, never redirects", async () => {
  for (const bad of [undefined, "", "abc", "zz".repeat(32), "00".repeat(31), "00".repeat(33)]) {
    const out = await referralLocation("ABCD234", { REFERRAL_HMAC_KEY_V1: bad });
    assert.ok(out.error && !out.location, `key ${JSON.stringify(bad)} must fail closed`);
  }
  assert.ok((await referralLocation("ABCD234", undefined)).error);
  const res = await onRequestGet({ request: new Request("https://getgymbo.com/r/ABCD234"), params: { token: "ABCD234" }, env: {} });
  assert.equal(res.status, 503);
  assert.equal(res.headers.get("Location"), null);
});

test("an invalid code needs no key and still 301s to the untagged site", async () => {
  const res = await onRequestGet({ request: new Request("https://getgymbo.com/r/nope"), params: { token: "nope" }, env: {} });
  assert.equal(res.status, 301);
  assert.equal(res.headers.get("Location"), "https://getgymbo.com/");
});

test("the handler answers 301 with the opaque campaign; a percent-encoded path is untagged", async () => {
  const ok = await onRequestGet({ request: new Request("https://getgymbo.com/r/abcd234"), params: { token: "abcd234" }, env });
  assert.equal(ok.status, 301);
  assert.equal(q(ok.headers.get("Location")).get("utm_campaign"), expected("ABCD234"));
  // Pages may decode %41 -> A before params; the raw path still shows the '%'.
  const enc = await onRequestGet({ request: new Request("https://getgymbo.com/r/%41BCD234"), params: { token: "ABCD234" }, env });
  assert.equal(enc.headers.get("Location"), "https://getgymbo.com/");
});

test("exactly one route handles /r: no /r/ rule in public/_redirects", async () => {
  const { readFileSync } = await import("node:fs");
  const rules = readFileSync(new URL("../public/_redirects", import.meta.url), "utf8")
    .split("\n").filter((l) => l.trim() && !l.trim().startsWith("#"));
  assert.deepEqual(rules.filter((l) => /^\/r(\/|\s|$)/.test(l.trim())), []);
});
