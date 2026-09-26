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
  SOURCE_VOCABULARY,
  isRegistrySource,
  registrySource,
} from "../src/lib/sourceSlug.mjs";
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

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
});


// ===========================================================================
// gy-ufxgo.8 — THE REGISTRY-v5 ALLOWLIST (pm ruling 2026-09-26T13:18Z).
// The shape rule above is a NORMALISER, not the boundary: a value that survives it is still
// not a channel unless registry v5 names it. registrySource() is the boundary, applied by the
// browser AND re-applied by both server handlers. Source only: no visitor ID, no medium, no
// campaign on either handler (those are pm-ruled OUT of this change).
// ===========================================================================
const V5 = ["instagram", "unknown", "referral", "directory", "google", "bing", "duckduckgo", "yahoo", "yandex"];
const FORBIDDEN_VALID_SHAPE = ["9876543210", "damini-rathi", "summer20", "naveen_maharashi_06"];   // AC3, verbatim

test("AC1: the vocabulary is EXACTLY registry v5 (independent literal), and every member passes the boundary", () => {
  assert.deepEqual([...SOURCE_VOCABULARY].sort(), [...V5].sort(), "change the list and this literal together, on purpose");
  for (const v of V5) {
    assert.equal(registrySource(v), v, `${v} is a canonical source`);
    assert.equal(isRegistrySource(v), true);
    assert.equal(resolveSource({ utmSource: v, selfHost: "getgymbo.com" }), v, `${v} passes the resolver as an explicit tag`);
  }
  assert.equal(isRegistrySource("direct"), false, "'direct' is NOT registry v5: it is a claim about behaviour we cannot observe");
  assert.equal(isRegistrySource("Instagram"), false, "membership is exact; case-folding is the normaliser's job before the boundary");
});

test("AC3: valid-SHAPE forbidden values (a phone number, a person, a campaign, a person-token) NORMALISE TO unknown and are never echoed", () => {
  for (const bad of FORBIDDEN_VALID_SHAPE) {
    assert.match(sourceSlug(bad), /^[a-z0-9_-]{1,32}$/, `${bad}: it PASSES the shape rule, which is exactly why the shape rule is not enough`);
    assert.equal(registrySource(bad), "unknown", `${bad} must become unknown`);
    assert.equal(resolveSource({ utmSource: bad, selfHost: "getgymbo.com" }), "unknown");
    // an off-registry TAG does not let the referrer speak for a link we do not understand
    assert.equal(resolveSource({ utmSource: bad, referrer: "https://www.google.com/", selfHost: "getgymbo.com" }), "unknown", `${bad} + google referrer`);
    assert.ok(!String(registrySource(bad)).includes(bad.slice(0, 5)), `${bad} is not echoed`);
  }
  for (const bad of ["direct", "newsletter", "facebook", "x?email=someone@example.com&z=2"]) assert.equal(registrySource(bad), "unknown", bad);
});

test("AC7 (inverted): 'x?email=someone@example.com' is REFUSED at the boundary, it no longer becomes a stored slug", () => {
  assert.equal(registrySource("x?email=someone@example.com&z=2"), "unknown");
  assert.notEqual(registrySource("x?email=someone@example.com&z=2"), sourceSlug("x?email=someone@example.com&z=2"), "the normaliser's output is never what gets stored");
});

test("AC1/AC2: NULL stays NULL (nothing measured / a broken caller), and unknown is a measurement, not a gap", () => {
  for (const v of [null, undefined, "", "   ", "undefined", "null", "none", "n/a", "-", "----"]) assert.equal(registrySource(v), null, JSON.stringify(v));
  assert.equal(registrySource("unknown"), "unknown");
});

test("DRIFT GUARD: everything the referrer resolver can return is INSIDE the vocabulary (an engine row added outside v5 cannot slip in)", () => {
  for (const ref of ["https://www.google.com/", "https://www.google.co.in/", "https://google.co.uk/", "https://bing.com/", "https://duckduckgo.com/", "https://search.yahoo.com/", "https://yandex.com/", "android-app://com.google.android.googlequicksearchbox/", "android-app://com.instagram.android/"]) {
    const got = sourceFromReferrer(ref, "getgymbo.com");
    assert.ok(isRegistrySource(got), `${ref} resolves to ${got}, which must be a v5 source`);
  }
});

// ---- both handlers re-apply the SAME rule and carry the source ONLY -------------------------------------------------
const ENV = { SUPABASE_URL: "https://stub.invalid", SUPABASE_ANON_KEY: "stub-key" };
function stubFetch(status, json) {
  const calls = [], real = globalThis.fetch;
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), body: JSON.parse(init.body) }); return new Response(json ? JSON.stringify(json) : null, { status }); };
  return { calls, restore: () => { globalThis.fetch = real; } };
}
const waitlistCtx = (body) => ({ request: { json: async () => body }, env: {}, waitUntil: () => {} });
const resourceCtx = (body) => ({ request: { json: async () => body }, env: ENV });
const RL_OK = { resource_lead_id: "11111111-2222-3333-4444-555555555555", access_granted: true };
const RL_BASE = { resource_id: "workout-builder-starter-pack", email: "t@example.invalid", delivery_consent: true, delivery_consent_notice_version: "v1" };
async function postWaitlist(extra) { const f = stubFetch(201); try { const { onRequestPost } = await import("../functions/api/waitlist.js"); const r = await onRequestPost(waitlistCtx({ email: "t@example.invalid", ...extra })); return { r, sent: f.calls[0]?.body }; } finally { f.restore(); } }
async function postResource(extra) { const f = stubFetch(200, RL_OK); try { const { onRequestPost } = await import("../functions/api/resource-lead.js"); const r = await onRequestPost(resourceCtx({ ...RL_BASE, ...extra })); return { r, sent: f.calls[0]?.body }; } finally { f.restore(); } }

test("AC4: the SERVER re-applies the allowlist on BOTH handlers, and an off-registry source never persists and never fails the submission", async () => {
  for (const bad of FORBIDDEN_VALID_SHAPE) {
    const w = await postWaitlist({ source: bad }); assert.equal(w.r.status, 200, `waitlist ${bad}: the submission is NOT failed`); assert.equal(w.sent.source, "unknown", `waitlist ${bad}`);
    const r = await postResource({ source: bad }); assert.equal(r.r.status, 200, `resource-lead ${bad}: the submission is NOT failed`); assert.equal(r.sent.p_source, "unknown", `resource-lead ${bad}`);
    assert.ok(!JSON.stringify([w.sent, r.sent]).includes(bad), `${bad} never reaches the database`);
  }
  for (const v of V5) { assert.equal((await postWaitlist({ source: v })).sent.source, v); assert.equal((await postResource({ source: v })).sent.p_source, v); }
});

test("AC1: a legacy/non-form POST with NO source key stays NULL on the waitlist; the resource endpoint never sends the forbidden 'landing' default", async () => {
  assert.equal((await postWaitlist({})).sent.source, null, "waitlist: an absent key is NULL, never promoted to unknown");
  assert.equal((await postWaitlist({ source: "none" })).sent.source, null, "waitlist: a broken caller's 'none' is NULL");
  const r = await postResource({});
  assert.notEqual(r.sent.p_source, "landing", "the forbidden landing default is gone");
  assert.equal(r.sent.p_source, "unknown", "resource_leads.source is NOT NULL today, so an absent source is recorded as unknown, never NULL and never a guess");
});

test("NEGATIVE CONTROL per handler: no visitor/funnel/session id and no medium/campaign reaches the database, even when the browser supplies them", async () => {
  const PROBE = "0b8f6e1a-7c3d-4e2b-9a1f-5d4c3b2a1908";   // an RFC 4122 v4 shaped id
  const supplied = { source: "instagram", funnel_visit_id: PROBE, anonymous_visitor_id: PROBE, funnelVisitId: PROBE, anonymousVisitorId: PROBE, visitor_id: PROBE, session_id: PROBE, medium: "organic_social", campaign: "summer20", utm_medium: "social", utm_campaign: "summer20", p_funnel_visit_id: PROBE, p_anonymous_visitor_id: PROBE, p_medium: "x", p_campaign: "y" };
  const w = await postWaitlist(supplied), r = await postResource(supplied);
  for (const [who, sent] of [["waitlist", w.sent], ["resource-lead", r.sent]]) {
    assert.doesNotMatch(Object.keys(sent).join(" "), /funnel|visitor|session|medium|campaign/i, `${who}: no such KEY reaches the database`);
    assert.ok(!JSON.stringify(sent).includes(PROBE), `${who}: the id VALUE never reaches the database`);
  }
  assert.deepEqual(Object.keys(w.sent).sort(), ["email", "name", "phone", "source"], "waitlist: the row carries exactly these keys, so a new one is a deliberate act");
  assert.deepEqual(Object.keys(r.sent).sort(), ["p_delivery_consent", "p_delivery_consent_notice_version", "p_email", "p_marketing_consent", "p_marketing_consent_notice_version", "p_name", "p_resource_id", "p_source"], "resource-lead: exactly these RPC args");
  assert.equal(w.sent.source, "instagram"); assert.equal(r.sent.p_source, "instagram");
});

test("gy-674s8 NAME GUARD (kept green here so CI enforces it): resource-lead p_name is ALWAYS null, whatever the browser sends", async () => {
  const r = await postResource({ name: "Probe Name 674s8", source: "google" });
  assert.equal(r.sent.p_name, null); assert.ok(!JSON.stringify(r.sent).includes("Probe Name"));
  assert.equal("p_name" in r.sent, true, "the KEY stays: the RPC has no default for p_name");
});

// ---- the repo-wide KEY-NAME GATE: the #203 visitor-ID plumbing cannot creep back --------------------------------------
const FORBIDDEN_NAMES = /funnel_visit_id|anonymous_visitor_id|funnelVisit|anonymousVisitor|gymbo\.anonymous/i;   // non-overlapping: each alternative catches a spelling the others cannot
function forbiddenNameHits(root) {
  const hits = [];
  const walk = (dir) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) { if (e.name !== "node_modules") walk(p); } else if (/\.(m?js|cjs|ts|tsx|jsx|json|html|css)$/.test(e.name) && FORBIDDEN_NAMES.test(readFileSync(p, "utf8"))) hits.push(p); } };
  walk(root); return hits;
}
const REPO = new URL("..", import.meta.url).pathname;
test("KEY-NAME GATE: none of the visitor-id names appear anywhere in functions/ or src/", () => {
  assert.deepEqual([...forbiddenNameHits(join(REPO, "functions")), ...forbiddenNameHits(join(REPO, "src"))].map((p) => p.replace(REPO, "")), []);
});
test("KEY-NAME GATE has TEETH: planted names in a scratch tree are found, each spelling, and a clean tree is empty", () => {
  const dir = mkdtempSync(join(tmpdir(), "gate-")); mkdirSync(join(dir, "functions"), { recursive: true });
  assert.deepEqual(forbiddenNameHits(dir), [], "control: clean");
  for (const [i, n] of ["funnel_visit_id", "anonymous_visitor_id", "funnelVisitId", "anonymousVisitorId", "gymbo.anonymousVisitor.v1", "ANONYMOUS_VISITOR_ID", "gymbo.anonymousId", "funnelVisit"].entries()) {
    writeFileSync(join(dir, "functions", `f${i}.js`), `const x = { ${JSON.stringify(n)}: 1 };`);
    assert.equal(forbiddenNameHits(dir).length, i + 1, `${n} is caught`);
  }
});
