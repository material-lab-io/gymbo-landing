// gy-t9mm8 — the client workout page's refusal and fail-closed rules.
//
// The ACs on this bead are written as NEGATIVE CONTROLS: what the page must
// REFUSE to do. Those are exactly the cases you cannot stage against a real
// database, because the schema exists to make them impossible — so Supabase is
// stubbed here and each test fixes the precise row shape under test.
// The happy path is proved for real in the browser journey (client-journey.spec.ts).
//
// 🔴 gy-t9mm8 / gy-emboo (pm 2026-09-28): reads now go through
// functions/w/_workout_rpc.js's stub, which queries exercise_media_for_app
// directly (the ratified-primary, complete-attribution view — gy-g1ihn/
// gy-5ksjw) instead of the retired byte_size tie-break, and returns PUBLIC
// object URLs (no signing — gy-h8a7o.1's public-bucket-plus-quarantine model).
// Fixtures and assertions below were rewritten to match that contract. The
// write path (onRequestPost) is UNCHANGED and so are its tests.
import { test } from "node:test";
import assert from "node:assert/strict";

const MOD = "../functions/w/[token].js";
const ENV = { SUPABASE_SERVICE_ROLE_KEY: "test-key", SUPABASE_URL: "https://stub.invalid" };
const TOKEN = "abcdefghijklmnopqrstuvwxyz01";
const LINK = { id: "aaaaaaaa-1111-2222-3333-444444444444", assignment_id: "bbbbbbbb-1111-2222-3333-444444444444",
               expires_at: new Date(Date.now() + 864e5).toISOString(), revoked_at: null, completed_at: null };
const BLOCK = { id: "cccccccc-1111-2222-3333-444444444444", position: 0,
                exercise_id: "dddddddd-1111-2222-3333-444444444444",
                exercise_name: "Bench Press", sets: 3, reps: "10", load: "40kg", rest_seconds: 60, notes: null };
const MEDIA_ID = "eeeeeeee-1111-2222-3333-444444444444";
// exercise_media_for_app's own row shape (gy-g1ihn) — the view, not the table.
const VIEW_ROW_OK = {
  exercise_id: BLOCK.exercise_id, media_id: MEDIA_ID,
  video_object_path: "wger/x.mp4", poster_object_path: "wger/x-poster.jpg",
  author: "Goulart", author_url: "https://wger.de/en/user/goulart", work_title: "Bench Press",
  source_url: "https://wger.de/en/exercise/512/view/", licence_id: "CC-BY-SA-4.0",
  licence_name: "Creative Commons Attribution Share Alike 4",
  licence_url: "https://creativecommons.org/licenses/by-sa/4.0/deed.en",
  modification_note: "Transcoded to H.264.",
};
// exercise_media's source/asset_kind/is_derivative — joined back by media_id,
// same shape media_page's own RPC body joins (gy-s8z4z).
const SOURCE_ROW_OK = { id: MEDIA_ID, source: "wger", asset_kind: "video", is_derivative: true };

// Route each PostgREST path to a fixture.
function stub({ link = LINK, blocks = [BLOCK], viewRows = [VIEW_ROW_OK], sourceRows = [SOURCE_ROW_OK], done = [] } = {}) {
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes("workout_share_links?token=")) return new Response(JSON.stringify(link ? [link] : []), { status: 200 });
    if (u.includes("workout_assignments?id=")) return new Response(JSON.stringify([{ workout_id: "ffffffff-1111-2222-3333-444444444444" }]), { status: 200 });
    if (u.includes("workouts?id=")) return new Response(JSON.stringify([{ name: "Push day", notes: null }]), { status: 200 });
    if (u.includes("workout_blocks?")) return new Response(JSON.stringify(blocks), { status: 200 });
    if (u.includes("workout_share_block_completions?")) return new Response(JSON.stringify(done), { status: 200 });
    if (u.includes("exercise_media_for_app?")) return new Response(JSON.stringify(viewRows), { status: 200 });
    if (u.includes("exercise_media?id=in.")) return new Response(JSON.stringify(sourceRows), { status: 200 });
    if (init?.method === "PATCH" || init?.method === "POST") return new Response(null, { status: 201 });
    return new Response("[]", { status: 200 });
  };
}

const get = async (opts, token = TOKEN, env = ENV) => {
  stub(opts);
  const { onRequestGet } = await import(MOD);
  const res = await onRequestGet({ env, params: { token } });
  return { status: res.status, html: await res.text() };
};

test("POSITIVE CONTROL: a valid token shows the workout, the video and the tick control", async () => {
  const { status, html } = await get({});
  assert.equal(status, 200);
  assert.match(html, /Push day/);
  assert.match(html, /Bench Press/);
  assert.match(html, /3 × 10 @ 40kg/, "the prescription must render from the stored fields");
  // 🔴 NO AUTOPLAY (pm ruling 09-17, gy-emboo AC8): `controls` gives a native
  // tap-to-play, poster shows the frame at rest. muted/loop/playsinline are
  // kept for once the client DOES tap play.
  assert.match(html, /<video[^>]+controls[^>]+muted[^>]+loop/, "tap-to-play, not autoplay");
  assert.doesNotMatch(html, /autoplay/, "AC8/AC2 amendment: autoplay pulls up to 720p unrequested");
  assert.match(html, /playsinline/, "without playsinline iOS takes the video fullscreen on play");
  assert.match(html, /poster="[^"]*x-poster\.jpg/, "AC8: a poster path must render for every playable exercise");
  assert.doesNotMatch(html, /\/storage\/v1\/object\/sign\//, "public bucket, no signed URLs (gy-h8a7o.1)");
  assert.match(html, /Mark done/);
});

test("AC1 NEG: an unknown (tampered) token is refused", async () => {
  const { status, html } = await get({ link: null }, "zzzzzzzzzzzzzzzzzzzzzzzzzzzz");
  assert.equal(status, 404);
  assert.match(html, /not available/i);
  assert.doesNotMatch(html, /Bench Press/, "no workout content may leak on a refusal");
});

test("AC1 NEG: an EXPIRED link is refused", async () => {
  const expired = { ...LINK, expires_at: new Date(Date.now() - 1000).toISOString() };
  const { status, html } = await get({ link: expired });
  assert.equal(status, 404);
  assert.doesNotMatch(html, /Bench Press/);
});

test("AC1 NEG: a REVOKED link is refused", async () => {
  const revoked = { ...LINK, revoked_at: new Date().toISOString() };
  const { status } = await get({ link: revoked });
  assert.equal(status, 404);
});

test("a malformed token never reaches the database", async () => {
  let called = false;
  globalThis.fetch = async () => { called = true; return new Response("[]", { status: 200 }); };
  const { onRequestGet } = await import(MOD);
  const res = await onRequestGet({ env: ENV, params: { token: "../../etc/passwd" } });
  assert.equal(res.status, 404);
  assert.equal(called, false);
});

test("every refusal reason produces the SAME response — no oracle for a guesser", async () => {
  // Distinguishing "expired" from "never existed" confirms to someone guessing
  // tokens that a real link once lived at that URL.
  const unknown = await get({ link: null }, "zzzzzzzzzzzzzzzzzzzzzzzzzzzz");
  const expired = await get({ link: { ...LINK, expires_at: new Date(Date.now() - 1000).toISOString() } });
  const revoked = await get({ link: { ...LINK, revoked_at: new Date().toISOString() } });
  assert.equal(unknown.html, expired.html);
  assert.equal(expired.html, revoked.html);
  assert.equal(unknown.status, revoked.status);
});

test("AC2 NEG: an exercise with NO media shows a defined empty state, not a broken player", async () => {
  const { status, html } = await get({ viewRows: [], sourceRows: [] });
  assert.equal(status, 200, "the rest of the workout must still be usable");
  assert.match(html, /Bench Press/);
  assert.match(html, /No video for this exercise/);
  assert.doesNotMatch(html, /<video/, "a broken or empty player is exactly what this AC forbids");
});

test("AC3 NEG: a clip that does not qualify for exercise_media_for_app (incomplete attribution, not primary, or unavailable) FAILS CLOSED", async () => {
  // The view's OWN WHERE clause (gy-5ksjw/gy-g1ihn) is the licence gate now —
  // author/licence_name/licence_url/source_url NOT NULL, is_primary, available,
  // has a rendition. Any of those failing means the view returns NO row for
  // this exercise, which is indistinguishable from "no media" at this layer,
  // and that is the point: the page cannot show what the view will not name.
  const { status, html } = await get({ viewRows: [], sourceRows: [] });
  assert.equal(status, 200);
  assert.doesNotMatch(html, /<video/, "unattributable/non-primary media must not play");
  assert.match(html, /No video for this exercise/);
});

test("AC3: attribution renders from stored fields for a complete clip", async () => {
  const { html } = await get({});
  assert.match(html, /Goulart/);
  assert.match(html, /Creative Commons Attribution Share Alike 4/);
  assert.match(html, /by-sa\/4\.0/);
  assert.match(html, /Transcoded to H\.264/);
});

test("AC3: changing the stored author changes the credit — nothing is hard-coded", async () => {
  const { html } = await get({ viewRows: [{ ...VIEW_ROW_OK, author: "Someone Else" }] });
  assert.match(html, /Someone Else/);
  assert.doesNotMatch(html, /Goulart/);
});

test("🔴 the page collects NOTHING about the person", async () => {
  const { html } = await get({});
  // A founder-confirmed constraint: the token identifies the workout, not the
  // client. Any of these inputs would make this a new consent surface.
  assert.doesNotMatch(html, /<input[^>]+type=["']?(email|tel)/i);
  assert.doesNotMatch(html, /<textarea/i);
  assert.doesNotMatch(html, /name=["']?(name|email|phone|comment|feedback)["']?/i);
  // And it must not DISPLAY a person either — this URL gets forwarded.
  assert.doesNotMatch(html, /client_id|trainer_id/i);
});

test("no JavaScript is required to tick an exercise", async () => {
  const { html } = await get({});
  assert.match(html, /<form method="POST">/, "ticking must be a plain form post");
  assert.doesNotMatch(html, /<script/i, "the page must work with scripting off");
});

test("a completed exercise renders as done", async () => {
  const { html } = await get({ done: [{ block_id: BLOCK.id }] });
  assert.match(html, /✓ Done/);
});

test("POST redirects instead of re-rendering, so a refresh cannot re-submit", async () => {
  stub({});
  const { onRequestPost } = await import(MOD);
  const req = { formData: async () => new Map([["block", BLOCK.id]]) };
  const res = await onRequestPost({ env: ENV, request: req, params: { token: TOKEN } });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get("Location"), `/w/${TOKEN}`);
});

test("a write against an expired link is refused, not silently accepted", async () => {
  // Otherwise the link stops SHOWING the workout but keeps ACCEPTING data.
  stub({ link: { ...LINK, expires_at: new Date(Date.now() - 1000).toISOString() } });
  const { onRequestPost } = await import(MOD);
  const req = { formData: async () => new Map([["block", BLOCK.id]]) };
  const res = await onRequestPost({ env: ENV, request: req, params: { token: TOKEN } });
  assert.equal(res.status, 404);
});

test("AC4: the service_role key never appears in the rendered HTML", async () => {
  const { html } = await get({});
  assert.doesNotMatch(html, /test-key/);
  assert.doesNotMatch(html, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("FAIL-CLOSED: with no service_role key configured, nothing is served (the real RPC does not exist yet)", async () => {
  // functions/w/_workout_rpc.js's fetchSharedWorkout returns {ok:false,
  // reason:"no_rpc"} when the key is absent — the exact state real production
  // is in today, and will stay in until gy-emboo ships and this stub branch
  // is deleted.
  const { status } = await get({}, TOKEN, {});
  assert.equal(status, 404);
});

// ---------------------------------------------------------------------------
// gy-nm6ii — the scoping and the honest-write rules.
//
// 🔴 These cover a defect that was LIVE in the code above: POST accepted any
// well-formed uuid as a block id and wrote it against the resolved link, and it
// swallowed the write result entirely. So a token for workout A could mark a
// block of workout B, and a write that failed still answered with the same 303
// as one that worked. Both are now refusals with their own response.
//
// UNCHANGED from the pre-gy-emboo version: onRequestPost's data path was never
// touched by the RPC stub (only reads moved).

// A stub that answers the SCOPED block lookup (id + workout_id + is_deleted)
// separately from the page's list query, so "is this block in this workout?" can
// be made false on its own.
function stubScope({ inScope = true, writeStatus = 201 } = {}) {
  const writes = [];
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes("workout_share_links?token=")) return new Response(JSON.stringify([LINK]), { status: 200 });
    if (u.includes("workout_assignments?id="))
      return new Response(JSON.stringify([{ workout_id: "ffffffff-1111-2222-3333-444444444444" }]), { status: 200 });
    // the scoped lookup blockBelongsToLink performs
    if (u.includes("workout_blocks?id="))
      return new Response(JSON.stringify(inScope ? [{ id: BLOCK.id }] : []), { status: 200 });
    if (init?.method === "POST" || init?.method === "PATCH") {
      writes.push(u);
      return new Response(null, { status: writeStatus });
    }
    return new Response("[]", { status: 200 });
  };
  return writes;
}

const post = async (body) => {
  const { onRequestPost } = await import(MOD);
  return onRequestPost({ env: ENV, request: { formData: async () => new Map(body) }, params: { token: TOKEN } });
};

test("AC3 NEG: a block from ANOTHER workout is refused, and nothing is written", async () => {
  const writes = stubScope({ inScope: false });
  const res = await post([["block", "99999999-1111-2222-3333-444444444444"]]);
  assert.equal(res.status, 404, "a token for one workout must not mark another workout's exercise");
  assert.equal(writes.length, 0, "the refusal must happen BEFORE the write, not be cleaned up after it");
});

test("AC3 POSITIVE CONTROL: a block inside this workout still ticks", async () => {
  // Without this, the refusal above is equally explained by "no tick ever works".
  const writes = stubScope({ inScope: true });
  const res = await post([["block", BLOCK.id]]);
  assert.equal(res.status, 303);
  assert.equal(writes.length, 1);
});

test("a double-tap (409 from the unique index) is still success, not an error", async () => {
  stubScope({ inScope: true, writeStatus: 409 });
  const res = await post([["block", BLOCK.id]]);
  assert.equal(res.status, 303, "a repeat tap is the same event; an error toast for one would be our bug");
});

test("🔴 a write that FAILS is not answered with the same redirect as one that worked", async () => {
  stubScope({ inScope: true, writeStatus: 500 });
  const res = await post([["block", BLOCK.id]]);
  assert.equal(res.status, 503);
  assert.match(await res.text(), /did not save/i, "the client must be told the tick was not recorded");
});

test("a failed 'I finished this workout' is not reported as finished", async () => {
  stubScope({ inScope: true, writeStatus: 500 });
  const res = await post([["finish", "1"]]);
  assert.equal(res.status, 503);
});

test("a malformed block id is refused without touching the database", async () => {
  const writes = stubScope({ inScope: true });
  const res = await post([["block", "not-a-uuid"]]);
  assert.equal(res.status, 404);
  assert.equal(writes.length, 0);
});

test("🔴 the DPDP notice is present and appears BEFORE the first tap control", async () => {
  // Compliance's REVISED ruling (gy-rt68e): required, not recommended, because
  // this is the first time a client is the direct SOURCE of a write to us.
  // The ordering assertion is the substance — a notice rendered after the
  // control it describes is not a notice.
  const { html } = await get({});
  const notice = html.indexOf("Tapping records that you finished each exercise");
  const firstTap = html.indexOf("Mark done");
  assert.notEqual(notice, -1, "the required notice copy is missing from the page");
  assert.ok(notice < firstTap, "the notice must render above the first tap control, not below it");
  assert.match(html, /We don't collect your name, email, or phone number on this page\./);
  // It must not creep back to the word compliance and I both refused: a
  // completion IS attributable via workout_assignments.client_id.
  assert.doesNotMatch(html, /anonymous/i);
});

// ---------------------------------------------------------------------------
// gy-emboo — the read now comes from exercise_media_for_app, not a hand-rolled
// tie-break. gy-16f0e's old byte_size/id ordering tests are RETIRED: the view
// itself is the single source of "which clip wins" (is_primary, gy-g1ihn), so
// there is no longer a query-order or a reducer decision for this page to get
// wrong. What remains to prove is that the page reads the RIGHT view and joins
// back to the right table for source/asset_kind, matching media_page's own
// RPC body (gy-s8z4z) so /w/, /m/ and the app can never disagree.

test("gy-emboo: the read queries exercise_media_for_app (the ratified-primary view), not exercise_media directly", async () => {
  const urls = [];
  const inner = async (url, init) => {
    urls.push(String(url));
    return stub._lastFetch(url, init);
  };
  stub({});
  stub._lastFetch = globalThis.fetch;
  globalThis.fetch = inner;
  const { onRequestGet } = await import(MOD);
  await onRequestGet({ env: ENV, params: { token: TOKEN } });
  const viewUrl = urls.find((u) => u.includes("exercise_media_for_app?"));
  assert.ok(viewUrl, "the page never queried exercise_media_for_app");
  assert.match(viewUrl, /exercise_id=in\./, "must scope to this workout's exercises, not read the whole view");
});

test("gy-emboo: source/asset_kind are joined back from exercise_media by media_id, same shape as media_page's RPC", async () => {
  const urls = [];
  const inner = async (url, init) => {
    urls.push(String(url));
    return stub._lastFetch(url, init);
  };
  stub({});
  stub._lastFetch = globalThis.fetch;
  globalThis.fetch = inner;
  const { onRequestGet } = await import(MOD);
  await onRequestGet({ env: ENV, params: { token: TOKEN } });
  const sourceUrl = urls.find((u) => u.includes("exercise_media?id=in."));
  assert.ok(sourceUrl, "the page never joined back to exercise_media for source/asset_kind");
  assert.match(sourceUrl, new RegExp(MEDIA_ID), "must join on the view's own media_id, not the exercise_id");
});
