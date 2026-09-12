// gy-0v33y — controls for the lead-source rule (src/lib/sourceSlug.mjs).
//
// 🔴 WHAT THESE EXIST TO CATCH. The column being written here has carried
// DEFAULT 'getgymbo.com' since the table was created and was never written by
// anything, so EVERY row claimed to come from the website — including the ones
// that came from Instagram. The failure mode to avoid is not "no data"; it is
// CONFIDENT WRONG DATA. An attribution column that records a guess is worse
// than an empty one (AC7), so most of these controls assert on NULL.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sourceSlug,
  sourceFromReferrer,
  resolveSource,
  SOURCE_MAX_LENGTH,
} from "../src/lib/sourceSlug.mjs";

test("the two emitters that actually exist today survive verbatim", () => {
  // public/_redirects:4  /ig        → utm_source=instagram
  // public/_redirects:9  /r/:token  → utm_source=referral
  assert.equal(sourceSlug("instagram"), "instagram");
  assert.equal(sourceSlug("referral"), "referral");
});

test("marketer's six channels all survive the shape rule", () => {
  // gy-ufxgo, marketer 2026-09-12. Channels 3 (direct) and 2's medium are not
  // sourced here — see the direct-traffic test and Phase B — but every value
  // that IS written must round-trip unchanged, or the registry normalises a
  // column full of near-misses.
  for (const v of ["instagram", "direct", "google", "bing", "duckduckgo",
                   "yahoo", "yandex", "referral", "directory"]) {
    assert.equal(sourceSlug(v), v, `${v} must round-trip unchanged`);
  }
});

test("AC7: nothing measured stores NULL, never a placeholder", () => {
  for (const v of [null, undefined, "", "   ", "undefined", "null", "none",
                   "n/a", "-", "----"]) {
    assert.equal(sourceSlug(v), null, `${JSON.stringify(v)} must be null`);
  }
});

test("AC5: a value is bounded in shape and length, so no query string or PII lands", () => {
  assert.equal(sourceSlug("x?email=someone@example.com&z=2"), "x-email-someone-example-com-z-2");
  assert.match(sourceSlug("x?email=someone@example.com&z=2"), /^[a-z0-9_-]+$/);
  const long = sourceSlug("a".repeat(200));
  assert.equal(long.length, SOURCE_MAX_LENGTH);
  assert.match(long, /^[a-z0-9_-]+$/);
});

test("truncation cannot mint a second channel", () => {
  // "instagram-" and "instagram" must not become two rows in a GROUP BY.
  assert.equal(sourceSlug("instagram-"), "instagram");
  assert.equal(sourceSlug("Instagram"), "instagram");
  assert.equal(sourceSlug(" instagram "), "instagram");
});

test("organic search stores the ENGINE, not the hostname", () => {
  // marketer caught this one against the shape rule: storing the matched
  // hostname would turn google.co.in into "google-co-in" and split one engine
  // into several channels.
  assert.equal(sourceFromReferrer("https://www.google.com/search?q=pt+app", "getgymbo.com"), "google");
  assert.equal(sourceFromReferrer("https://google.co.in/", "getgymbo.com"), "google");
  assert.equal(sourceFromReferrer("https://search.yahoo.com/x", "getgymbo.com"), "yahoo");
  assert.equal(sourceFromReferrer("https://duckduckgo.com/", "getgymbo.com"), "duckduckgo");
});

test("the referrer's query string is never inspected or stored", () => {
  // A referrer can carry anything (AC5). Only the hostname is ever read.
  const s = sourceFromReferrer("https://www.google.com/search?q=my+name+and+email", "getgymbo.com");
  assert.equal(s, "google");
});

test("an off-allowlist referrer is unknown, not a channel", () => {
  assert.equal(sourceFromReferrer("https://t.co/abc", "getgymbo.com"), null);
  assert.equal(sourceFromReferrer("https://evil.example/?x=1", "getgymbo.com"), null);
  assert.equal(sourceFromReferrer("not a url", "getgymbo.com"), null);
  assert.equal(sourceFromReferrer("", "getgymbo.com"), null);
});

test("our own pages are not a referral to ourselves", () => {
  assert.equal(sourceFromReferrer("https://getgymbo.com/guide/x", "getgymbo.com"), null);
  assert.equal(sourceFromReferrer("https://www.getgymbo.com/", "getgymbo.com"), null);
});

test("an explicit tag beats an inferred one", () => {
  assert.equal(
    resolveSource({ utmSource: "instagram", referrer: "https://www.google.com/", selfHost: "getgymbo.com" }),
    "instagram",
  );
});

test("🔴 NO 'direct' FALLBACK — absent referrer is unknown, not direct traffic", () => {
  // Instagram's in-app browser sends NO referrer, so untagged IG traffic is
  // indistinguishable from genuine direct traffic. Writing "direct" here would
  // manufacture the precise answer Damini asked us to stop guessing at, and it
  // would do it most often for the channel she cares about most. Unknown stays
  // NULL and is honestly countable as unknown.
  assert.equal(resolveSource({ utmSource: null, referrer: "", selfHost: "getgymbo.com" }), null);
  assert.equal(resolveSource({}), null);
});

test("NEGATIVE CONTROL — the detector is not just returning null for everything", () => {
  // Every assertion above about NULL is worthless if the function cannot
  // return anything else. Two positive results, by both routes.
  assert.equal(resolveSource({ utmSource: "instagram" }), "instagram");
  assert.equal(
    resolveSource({ utmSource: null, referrer: "https://www.bing.com/s", selfHost: "getgymbo.com" }),
    "bing",
  );
});
