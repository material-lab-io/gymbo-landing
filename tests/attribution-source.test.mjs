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
import { readFileSync } from "node:fs";
import {
  ATTRIBUTION_SOURCES,
  sourceSlug,
  sourceFromReferrer,
  resolveSource,
  resolveAttribution,
  normalizeAttributionTuple,
  normalizeAttributionPayload,
  visitId,
  SOURCE_MAX_LENGTH,
} from "../src/lib/sourceSlug.mjs";

test("the /ig entry point emits the exact registry-v5 bio tuple", () => {
  const redirects = readFileSync(new URL("../public/_redirects", import.meta.url), "utf8");
  assert.match(
    redirects,
    /^\/ig https:\/\/getgymbo\.com\/\?utm_source=instagram&utm_medium=organic_social&utm_campaign=bio 301$/m,
  );
  assert.doesNotMatch(redirects, /utm_medium=social/);
});

test("AC1/AC3: exactly the registry-v5 sources survive the source-only API", () => {
  assert.deepEqual(ATTRIBUTION_SOURCES, [
    "instagram", "unknown", "referral", "directory",
    "google", "bing", "duckduckgo", "yahoo", "yandex",
  ]);
  for (const v of ATTRIBUTION_SOURCES) {
    assert.equal(sourceSlug(v), v, `${v} must round-trip unchanged`);
  }
  assert.equal(sourceSlug("direct"), null);
});

test("AC7: nothing measured stores NULL, never a placeholder", () => {
  for (const v of [null, undefined, "", "   ", "undefined", "null", "none",
                   "n/a", "-", "----"]) {
    assert.equal(sourceSlug(v), null, `${JSON.stringify(v)} must be null`);
  }
});

test("AC2/AC3: valid-shape raw and PII-like values are refused, never slugged", () => {
  for (const raw of [
    "9876543210",
    "damini-rathi",
    "summer20",
    "naveen_maharashi_06",
    "x?email=someone@example.com&z=2",
    "a".repeat(SOURCE_MAX_LENGTH),
  ]) {
    assert.equal(sourceSlug(raw), null, `${raw} must not become an analytics source`);
    assert.equal(resolveSource({ utmSource: raw }), "unknown");
  }
});

test("normalization is limited to casing and whitespace, never reshaping", () => {
  assert.equal(sourceSlug("instagram-"), null);
  assert.equal(sourceSlug("Instagram"), "instagram");
  assert.equal(sourceSlug(" instagram "), "instagram");
});

test("AC8: every canonical registry-v5 tuple is accepted exactly", () => {
  const referral = "ref_0123456789abcdef0123456789abcdef";
  const fixtures = [
    ["instagram", "organic_social", "bio"],
    ["instagram", "direct_message", "founder_outreach"],
    ["instagram", "organic_social", "android_referrer"],
    ["unknown", null, null],
    ...["google", "bing", "duckduckgo", "yahoo", "yandex"].map((source) => [source, "organic", null]),
    ["referral", "referral", referral],
    ...["softwaresuggest", "capterra", "getapp", "alternativeto", "saashub", "g2"]
      .map((campaign) => ["directory", "listing", campaign]),
  ];

  for (const [source, medium, campaign] of fixtures) {
    assert.deepEqual(
      normalizeAttributionTuple({ source, medium, campaign }),
      { source, medium, campaign },
      `${source}/${medium}/${campaign} must survive exactly`,
    );
  }
});

test("crossed, partial, and raw referral tuples are refused", () => {
  const invalid = [
    { source: "instagram", medium: "social", campaign: "bio" },
    { source: "instagram", medium: null, campaign: null },
    { source: "google", medium: "organic_social", campaign: null },
    { source: "unknown", medium: "organic", campaign: null },
    { source: "referral", medium: "referral", campaign: "summer20" },
    { source: "referral", medium: "referral", campaign: "priya-trainer" },
    { source: "directory", medium: "listing", campaign: "summer20" },
  ];
  for (const tuple of invalid) assert.equal(normalizeAttributionTuple(tuple), null);
});

test("RFC 4122 v4 IDs are accepted; decorative and wrong-version IDs are dropped", () => {
  const valid = "7b9c3e1a-52d4-4f86-a7c8-91e2d5f0ab34";
  assert.equal(visitId(valid), valid);
  for (const invalid of [
    "11111111-1111-4111-8111-111111111111",
    "7b9c3e1a-52d4-3f86-a7c8-91e2d5f0ab34",
    "7b9c3e1a-52d4-4f86-77c8-91e2d5f0ab34",
    "not-a-uuid",
  ]) {
    assert.equal(visitId(invalid), null);
  }
  assert.deepEqual(
    normalizeAttributionPayload({
      source: "unknown",
      medium: null,
      campaign: null,
      funnel_visit_id: valid,
      anonymous_visitor_id: "not-a-uuid",
    }),
    {
      source: "unknown",
      medium: null,
      campaign: null,
      funnel_visit_id: valid,
      anonymous_visitor_id: null,
      schema_version: 5,
    },
  );
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
  assert.deepEqual(
    resolveAttribution({
      utmSource: "instagram",
      utmMedium: "organic_social",
      utmCampaign: "bio",
      referrer: "https://www.google.com/",
      selfHost: "getgymbo.com",
    }),
    { source: "instagram", medium: "organic_social", campaign: "bio" },
  );
});

test("an invalid explicit tuple cannot poison or outrank a valid referrer", () => {
  assert.deepEqual(
    resolveAttribution({
      utmSource: "damini-rathi",
      utmMedium: "organic",
      utmCampaign: "summer20",
      referrer: "https://www.google.co.in/search?q=gymbo",
      selfHost: "getgymbo.com",
    }),
    { source: "google", medium: "organic", campaign: null },
  );
  assert.deepEqual(
    resolveAttribution({
      utmSource: "damini-rathi",
      utmMedium: "organic",
      utmCampaign: "summer20",
      referrer: "",
      selfHost: "getgymbo.com",
    }),
    { source: "unknown", medium: null, campaign: null },
  );
});

test("🔴 NO 'direct' FALLBACK — absent referrer is unknown, not direct traffic", () => {
  // Instagram's in-app browser sends NO referrer, so untagged IG traffic is
  // indistinguishable from genuine direct traffic. Writing "direct" here would
  // manufacture the precise answer Damini asked us to stop guessing at, and it
  // would do it most often for the channel she cares about most.
  //
  // 🔴 UPDATED 2026-09-12 BY marketer's gy-ufxgo v2 RULING, and the rule this
  // test defends is UNCHANGED — only the spelling of the answer moved. It used
  // to assert null; it now asserts "unknown". The thing being forbidden is still
  // "direct", and that assertion is now explicit rather than implied by null.
  // Recorded rather than quietly edited: a test that reverses without saying why
  // reads as someone bending the suite to fit the code.
  assert.equal(resolveSource({ utmSource: null, referrer: "", selfHost: "getgymbo.com" }), "unknown");
  assert.equal(resolveSource({}), "unknown");
  assert.notEqual(resolveSource({}), "direct");
});

test("NEGATIVE CONTROL — the detector is not just returning 'unknown' for everything", () => {
  // Every assertion above about the unattributed case is worthless if the
  // function cannot return anything else. Two positive results, by both routes.
  // (Premise updated with the v2 ruling: the uniform answer it could collapse to
  // is now "unknown" rather than null, so that is what this rules out.)
  assert.equal(resolveSource({ utmSource: "instagram" }), "instagram");
  assert.equal(
    resolveSource({ utmSource: null, referrer: "https://www.bing.com/s", selfHost: "getgymbo.com" }),
    "bing",
  );
});

// gy-0v33y follow-up, 2026-09-12 — THE REGIONAL / www HOLE.
//
// 🔴 FOUND BY EXECUTING THE FUNCTION, NOT BY READING IT. The host map listed
// "www.google.com" but only the bare "google.co.in", so www.google.co.in — the
// single most likely organic referrer in our ONLY market — returned null and was
// recorded as unmeasured. Every other regional Google was null too. The map read
// as fine; the inconsistency was invisible until the values were compared.
//
// marketer had already caught the neighbouring half of this (store the ENGINE,
// not the hostname, so google.co.in does not become its own channel). That fix
// was applied to the VALUE and the KEY list kept the bug.
test("organic search: regional and www host forms all resolve to one engine", () => {
  for (const referrer of [
    "https://www.google.co.in/search?q=gymbo",
    "https://google.co.in/search?q=gymbo",
    "https://www.google.com/search?q=gymbo",
    "https://google.com/search?q=gymbo",
    "https://www.google.co.uk/search?q=gymbo",
    "https://www.google.com.au/search?q=gymbo",
  ]) {
    assert.equal(
      sourceFromReferrer(referrer, "getgymbo.com"),
      "google",
      `${referrer} must record the ENGINE, not null and not a per-region channel`,
    );
  }
  assert.equal(sourceFromReferrer("https://www.bing.com/search?q=g", "getgymbo.com"), "bing");
});

// The anchoring is the entire safety argument for using a pattern instead of a
// row per ccTLD. Without both anchors a lookalike host would be credited to
// Google, which is a worse failure than the null it replaced.
test("organic search: the google pattern is anchored at BOTH ends", () => {
  for (const hostile of [
    "https://notgoogle.com/",
    "https://mygoogle.com/",
    "https://google.com.attacker.test/",
    "https://google.co.in.evil.test/",
    "https://evil.test/?x=google.com",
  ]) {
    assert.equal(
      sourceFromReferrer(hostile, "getgymbo.com"),
      null,
      `${hostile} must NOT be credited to google`,
    );
  }
});

// Our own pages are not a referral to ourselves, in either host form. A visitor
// moving from /guide to the form must not be re-credited as organic.
test("organic search: our own site is never a source, www or bare", () => {
  assert.equal(sourceFromReferrer("https://getgymbo.com/guide/", "getgymbo.com"), null);
  assert.equal(sourceFromReferrer("https://www.getgymbo.com/guide/", "getgymbo.com"), null);
});

// gy-ufxgo registry v2 (marketer ruling, 2026-09-12) — "unknown", not "direct",
// and not null.
//
// marketer's registry first specified `direct` for a visit with no UTM and no
// referrer. It is the same SEMANTICS as our null and a different CLAIM: IG's
// in-app browser sends no referrer, so untagged Instagram traffic is identical
// to genuine direct traffic at classification time. "direct" asserts the visitor
// typed the URL in, and would assert it most often for the one channel Damini is
// actually asking about. marketer ruled for "unknown".
test("an unattributable visit records unknown — a measurement, not a gap", () => {
  assert.equal(resolveSource({ selfHost: "getgymbo.com" }), "unknown");
  assert.equal(resolveSource({ referrer: "", selfHost: "getgymbo.com" }), "unknown");
  assert.equal(
    resolveSource({ referrer: "https://unrecognised.example/x", selfHost: "getgymbo.com" }),
    "unknown",
  );
  // Never "direct": that is a claim about behaviour we cannot observe.
  assert.notEqual(resolveSource({ selfHost: "getgymbo.com" }), "direct");
});

// 🔴 THE TRAP THIS PINS. "unknown" reads like it belongs in NOT_A_MEASUREMENT,
// right beside "none" and "n/a", and tidying it in there would silently NULL
// every honestly-unattributed visit — destroying the exact value the registry
// ruling created. The distinction: those strings are what a BROKEN CALLER emits
// when it meant to send nothing; "unknown" is what our own resolver deliberately
// emits after looking and finding nothing.
test("sourceSlug must NOT treat 'unknown' as a non-measurement", () => {
  assert.equal(sourceSlug("unknown"), "unknown");
  assert.equal(sourceSlug("UNKNOWN"), "unknown");
  // The genuine non-measurements still collapse to null.
  for (const junk of ["undefined", "null", "none", "n/a", "-"]) {
    assert.equal(sourceSlug(junk), null, `${junk} must not be stored as a channel`);
  }
});

// gy-ufxgo v2 — Android app referrers. Organic search on the platform most of
// our market uses was resolving to null, so search was undercounted there.
test("the Android Google app referrer is organic search, and lookalikes are not", () => {
  const H = "getgymbo.com";
  assert.equal(sourceFromReferrer("android-app://com.google.android.googlequicksearchbox/", H), "google");
  assert.equal(sourceFromReferrer("android-app://com.google.android.googlequicksearchbox", H), "google");
  // Exact package match only — no pattern, no suffix matching.
  assert.equal(sourceFromReferrer("android-app://com.evil.googlequicksearchbox/", H), null);
  assert.deepEqual(
    resolveAttribution({
      referrer: "android-app://com.google.android.googlequicksearchbox/",
      selfHost: H,
    }),
    { source: "google", medium: "organic", campaign: null },
  );
});

// marketer ruling 2026-09-18 (gy-ufxgo): the Instagram app's referrer IS credited.
// This test was previously pinned to null, recording that crediting it was a
// decision still to be made; it has now been made.
test("the Android Instagram app referrer is instagram, and lookalikes are not", () => {
  const H = "getgymbo.com";
  assert.equal(sourceFromReferrer("android-app://com.instagram.android/", H), "instagram");
  assert.equal(sourceFromReferrer("android-app://com.instagram.android", H), "instagram");
  // Exact package match only: another app, or a package merely containing the name.
  assert.equal(sourceFromReferrer("android-app://com.instagram.lite/", H), null);
  assert.equal(sourceFromReferrer("android-app://com.evil.instagram.android/", H), null);
  assert.equal(sourceFromReferrer("android-app://com.instagram.android.evil/", H), null);
  assert.deepEqual(
    resolveAttribution({ referrer: "android-app://com.instagram.android/", selfHost: H }),
    { source: "instagram", medium: "organic_social", campaign: "android_referrer" },
  );
});
