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
    // A signal that matches nothing is state 3: NO attribution (null), never the explicit
    // `unknown` tuple. The legacy resolver asserted "unknown" here, which pinned the very
    // coercion gy-ufxgo.8 exists to remove.
    assert.equal(resolveAttribution({ utmSource: raw }), null, `${raw} is a signal that matched nothing: send no attribution`);
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

test("RFC 4122 v4 IDs are atomic with the tuple; partial v5 payloads are refused", () => {
  const funnelId = "7b9c3e1a-52d4-4f86-a7c8-91e2d5f0ab34";
  const visitorId = "c4d8e2a1-79b5-4f03-8c6d-2a9e7b1f5034";
  assert.equal(visitId(funnelId), funnelId);
  for (const invalid of [
    "11111111-1111-4111-8111-111111111111",
    "7b9c3e1a-52d4-3f86-a7c8-91e2d5f0ab34",
    "7b9c3e1a-52d4-4f86-77c8-91e2d5f0ab34",
    "not-a-uuid",
  ]) {
    assert.equal(visitId(invalid), null);
  }
  assert.equal(
    normalizeAttributionPayload({
      source: "unknown",
      medium: null,
      campaign: null,
      funnel_visit_id: funnelId,
      anonymous_visitor_id: "not-a-uuid",
    }),
    null,
  );
  assert.deepEqual(
    normalizeAttributionPayload({
      source: "unknown",
      medium: null,
      campaign: null,
      funnel_visit_id: funnelId,
      anonymous_visitor_id: visitorId,
    }),
    {
      source: "unknown",
      medium: null,
      campaign: null,
      funnel_visit_id: funnelId,
      anonymous_visitor_id: visitorId,
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

// gy-ufxgo.8, marketer ruling 2026-09-23: a signal that matches no registry entry
// resolves to NULL (send no attribution), never to `unknown`. `unknown` is only
// for a visit with no signal at all.
test("an attempted invalid UTM tuple resolves to null instead of crediting a valid referrer", () => {
  for (const referrer of ["https://www.google.co.in/search?q=gymbo", ""]) {
    assert.equal(
      resolveAttribution({
        utmSource: "damini-rathi",
        utmMedium: "organic",
        utmCampaign: "summer20",
        referrer,
        selfHost: "getgymbo.com",
      }),
      null,
    );
  }
  assert.equal(resolveAttribution({ utmSource: "instagram" }), null, "partial tuple");
  assert.equal(resolveAttribution({ utmSource: "foo", utmMedium: "bar", utmCampaign: "baz" }), null);
});

test("an unmatched referrer resolves to null, and no signal at all resolves to unknown", () => {
  const H = "getgymbo.com";
  const UNKNOWN = { source: "unknown", medium: null, campaign: null };
  assert.equal(resolveAttribution({ referrer: "https://news.example.com/x", selfHost: H }), null);
  assert.equal(resolveAttribution({ referrer: "not a url", selfHost: H }), null);
  assert.equal(resolveAttribution({ referrer: "android-app://com.evil.app/", selfHost: H }), null);
  assert.deepEqual(resolveAttribution({ selfHost: H }), UNKNOWN);
  assert.deepEqual(resolveAttribution({ referrer: "", selfHost: H }), UNKNOWN);
  assert.deepEqual(resolveAttribution({}), UNKNOWN);
  // Own pages are internal navigation, not a signal.
  assert.deepEqual(resolveAttribution({ referrer: "https://www.getgymbo.com/x", selfHost: H }), UNKNOWN);
  // Blank UTM values are not a signal either.
  assert.deepEqual(resolveAttribution({ utmSource: "", utmMedium: " ", utmCampaign: null, selfHost: H }), UNKNOWN);
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

// gy-ufxgo.8: registry shape 4 at the server boundary. A tuple that is ENTIRELY absent plus
// both trustworthy visit ids is "judged, matched nothing" and is kept at schema 5. Anything
// merely present-but-wrong stays null (shape 1): only the browser classifies state 3.
test("server boundary: an empty tuple with both visit ids is shape 4, stored at schema 5", () => {
  const ids = {
    funnel_visit_id: "5d1c8e37-a2f4-4b69-8e10-3c7fa96b2d45",
    anonymous_visitor_id: "e94b7a03-16cd-4f28-b5a1-d08c3e7f9126",
  };
  assert.deepEqual(normalizeAttributionPayload({ ...ids }), {
    source: null, medium: null, campaign: null, ...ids, schema_version: 5,
  });
  assert.deepEqual(normalizeAttributionPayload({ source: "", medium: null, campaign: " ", ...ids }), {
    source: null, medium: null, campaign: null, ...ids, schema_version: 5,
  });
  // Near-misses all degrade to null (shape 1), never to shape 4 and never to a stored raw value.
  assert.equal(normalizeAttributionPayload({ source: "foo", medium: "bar", campaign: "baz", ...ids }), null);
  assert.equal(normalizeAttributionPayload({ medium: "organic", ...ids }), null, "partial tuple");
  assert.equal(normalizeAttributionPayload({ campaign: "bio", ...ids }), null, "partial tuple");
  assert.equal(normalizeAttributionPayload({}), null, "no ids at all is unmeasured");
  assert.equal(normalizeAttributionPayload({ funnel_visit_id: ids.funnel_visit_id }), null, "one id");
  assert.equal(normalizeAttributionPayload({ ...ids, anonymous_visitor_id: "damini-rathi" }), null, "bad id");
});

test("the legacy fall-through resolver is GONE, so it cannot be called or re-pinned (gy-ufxgo.8, marketer condition 2026-09-22)", async () => {
  const mod = await import("../src/lib/sourceSlug.mjs");
  assert.equal(mod.resolveSource, undefined, "resolveSource coerced 'signal that matched nothing' to 'unknown'");
  assert.equal(typeof mod.resolveAttribution, "function", "liveness: the module loaded and exports the real resolver");
  // and an unmatched signal still never becomes the explicit unknown tuple
  assert.equal(mod.resolveAttribution({ utmSource: "summer20" }), null);
  assert.deepEqual(mod.resolveAttribution({}), { source: "unknown", medium: null, campaign: null }, "state 2: no signal at all is the explicit unknown tuple");
});
