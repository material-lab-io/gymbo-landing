// gy-t9mm8 — the client workout page's refusal and fail-closed rules.
//
// The ACs on this bead are written as NEGATIVE CONTROLS: what the page must
// REFUSE to do. Those are exactly the cases you cannot stage against a real
// database, because the schema exists to make them impossible — so Supabase is
// stubbed here and each test fixes the precise row shape under test.
// The happy path is proved for real in the browser journey (client-journey.spec.ts).
//
// 🔴 gy-t9mm8 / gy-emboo (pm 2026-09-28 22:17Z): reads now go through the REAL
// shared_workout_page(p_token) RPC (functions/w/_workout_rpc.js), called with
// the anon key only. Fixtures below build the RPC's actual row shape — one row
// per live block, workout columns repeated, block_id NULL for a zero-block
// workout — instead of stubbing the OLD multi-table service-role REST reads.
// The write path (onRequestPost) is UNCHANGED and so are its tests: the
// completion-write RPC is gy-nm6ii, a separate still-open bead.
import { test } from "node:test";
import assert from "node:assert/strict";
import { _resetRateLimitStateForTests } from "../functions/w/_ratelimit.js";
import { SUPABASE_ANON_KEY } from "../functions/m/_shared.js";

const MOD = "../functions/w/[token].js";
const ENV = { SUPABASE_URL: "https://stub.invalid" };
const WRITE_ENV = { SUPABASE_SERVICE_ROLE_KEY: "test-key", SUPABASE_URL: "https://stub.invalid" };
const TOKEN = "abcdefghijklmnopqrstuvwxyz01";
const LINK = { completed_at: null };
const BLOCK = { id: "cccccccc-1111-2222-3333-444444444444",
                exercise_name: "Bench Press", sets: 3, reps: "10", load: "40kg", rest_seconds: 60 };
// shared_workout_page's own media columns for a complete, attributable wger clip.
const MEDIA_OK = {
  source: "wger", asset_kind: "video", is_derivative: true,
  author: "Goulart", author_url: "https://wger.de/en/user/goulart", work_title: "Bench Press",
  source_url: "https://wger.de/en/exercise/512/view/", licence_id: "CC-BY-SA-4.0",
  licence_name: "Creative Commons Attribution Share Alike 4",
  licence_url: "https://creativecommons.org/licenses/by-sa/4.0/deed.en",
  modification_note: "Transcoded to H.264.",
  video_object_path: "wger/x.mp4", poster_object_path: "wger/x-poster.jpg",
};

// Build ONE shared_workout_page(p_token) output row — the RPC's real shape,
// not the old per-table REST fixtures. `block: null` builds the ONE row a
// zero-block workout returns (block_id NULL is the whole point of that row).
function row(block, { link = LINK, media = null, done = false, workoutName = "Push day", workoutNotes = null } = {}) {
  return {
    workout_name: workoutName, workout_notes: workoutNotes, completed_at: link.completed_at,
    block_id: block ? block.id : null, block_position: 0, block_type: "exercise", group_index: null,
    exercise_name: block ? block.exercise_name : null,
    sets: block?.sets ?? null, reps: block?.reps ?? null, load: block?.load ?? null,
    rest_seconds: block?.rest_seconds ?? null, duration_seconds: null, distance_m: null,
    block_done: done,
    source: media?.source ?? null, asset_kind: media?.asset_kind ?? null,
    author: media?.author ?? null, author_url: media?.author_url ?? null, work_title: media?.work_title ?? null,
    source_url: media?.source_url ?? null, licence_id: media?.licence_id ?? null,
    licence_name: media?.licence_name ?? null, licence_url: media?.licence_url ?? null,
    is_derivative: media?.is_derivative ?? null, modification_note: media?.modification_note ?? null,
    video_object_path: media?.video_object_path ?? null, poster_object_path: media?.poster_object_path ?? null,
  };
}

// Route the RPC POST to a fixed row set. Everything else (the write path's
// OWN REST calls, unchanged from before) falls through to a benign default —
// the POST-path tests below install their own, more specific stub.
function stub(rows) {
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("/rest/v1/rpc/shared_workout_page")) return new Response(JSON.stringify(rows), { status: 200 });
    return new Response("[]", { status: 200 });
  };
}

const get = async (rows, token = TOKEN, env = ENV) => {
  _resetRateLimitStateForTests();
  stub(rows);
  const { onRequestGet } = await import(MOD);
  const res = await onRequestGet({ env, params: { token } });
  return { status: res.status, html: await res.text() };
};

test("POSITIVE CONTROL: a valid token shows the workout, the video and the tick control", async () => {
  const { status, html } = await get([row(BLOCK, { media: MEDIA_OK })]);
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

test("AC1 NEG: zero rows (unknown, tampered, expired, revoked or orphaned — the RPC collapses all of them) is refused", async () => {
  // shared_workout_page's own WHERE clause is what collapses "never existed",
  // "expired" and "revoked" into the SAME empty result (proven server-side by
  // coach's SQL test suite on gy-emboo, and by the live anon-call evidence
  // posted on gy-emboo 22:16Z: four distinct bad tokens, four times zero rows).
  // This layer has nothing left to distinguish — it only has to refuse
  // correctly on the one shape it can ever see: zero rows.
  const { status, html } = await get([]);
  assert.equal(status, 404);
  assert.match(html, /not available/i);
  assert.doesNotMatch(html, /Bench Press/, "no workout content may leak on a refusal");
});

test("a malformed token never reaches the database", async () => {
  _resetRateLimitStateForTests();
  let called = false;
  globalThis.fetch = async () => { called = true; return new Response("[]", { status: 200 }); };
  const { onRequestGet } = await import(MOD);
  const res = await onRequestGet({ env: ENV, params: { token: "../../etc/passwd" } });
  assert.equal(res.status, 404);
  assert.equal(called, false);
});

test("AC2 NEG: an exercise with NO qualifying media shows a defined empty state, not a broken player", async () => {
  const { status, html } = await get([row(BLOCK, { media: null })]);
  assert.equal(status, 200, "the rest of the workout must still be usable");
  assert.match(html, /Bench Press/);
  assert.match(html, /No video for this exercise/);
  assert.doesNotMatch(html, /<video/, "a broken or empty player is exactly what this AC forbids");
});

test("gy-pgxiv: a block whose exercise is unlinked (exercise_id NULL) renders as a plain named exercise — no player, no crash", async () => {
  // shared_workout_page LEFT JOINs media ON b.exercise_id: an unlinked block's
  // media columns are simply NULL, which is indistinguishable from "no
  // qualifying media" at this layer BY DESIGN (see _workout_rpc.js's
  // shapeMedia). Named separately from the AC2 test above because it is a
  // different real-world cause (gy-pgxiv's 152/164 legacy blocks with no
  // exercise_id), even though this file sees the identical row shape.
  const unlinked = { id: "abababab-1111-2222-3333-444444444444", exercise_name: "Farmer carry",
                     sets: null, reps: null, load: null, rest_seconds: null };
  const { status, html } = await get([row(unlinked, { media: null })]);
  assert.equal(status, 200);
  assert.match(html, /Farmer carry/);
  assert.match(html, /No video for this exercise/);
  assert.doesNotMatch(html, /<video/);
  assert.doesNotMatch(html, /undefined|null/i, "no raw field leakage for a block with nothing to prescribe");
});

test("a workout with zero blocks renders (the ONE block_id-NULL row is the workout, not a fake exercise)", async () => {
  const { status, html } = await get([row(null)]);
  assert.equal(status, 200);
  assert.match(html, /Push day/);
  assert.doesNotMatch(html, /class="ex"/, "no exercise section may be synthesised from the workout-only row");
  assert.match(html, /I finished this workout/);
});

test("AC3: attribution renders from stored fields for a complete clip", async () => {
  const { html } = await get([row(BLOCK, { media: MEDIA_OK })]);
  assert.match(html, /Goulart/);
  assert.match(html, /Creative Commons Attribution Share Alike 4/);
  assert.match(html, /by-sa\/4\.0/);
  assert.match(html, /Transcoded to H\.264/);
});

test("AC3: changing the stored author changes the credit — nothing is hard-coded", async () => {
  const { html } = await get([row(BLOCK, { media: { ...MEDIA_OK, author: "Someone Else" } })]);
  assert.match(html, /Someone Else/);
  assert.doesNotMatch(html, /Goulart/);
});

test("🔴 the page collects NOTHING about the person", async () => {
  const { html } = await get([row(BLOCK, { media: MEDIA_OK })]);
  // A founder-confirmed constraint: the token identifies the workout, not the
  // client. Any of these inputs would make this a new consent surface.
  assert.doesNotMatch(html, /<input[^>]+type=["']?(email|tel)/i);
  assert.doesNotMatch(html, /<textarea/i);
  assert.doesNotMatch(html, /name=["']?(name|email|phone|comment|feedback)["']?/i);
  // And it must not DISPLAY a person either — this URL gets forwarded. The RPC
  // itself never returns a client/trainer/assignment/link id (gy-emboo AC).
  assert.doesNotMatch(html, /client_id|trainer_id/i);
});

test("no JavaScript is required to tick an exercise", async () => {
  const { html } = await get([row(BLOCK, { media: MEDIA_OK })]);
  assert.match(html, /<form method="POST">/, "ticking must be a plain form post");
  assert.doesNotMatch(html, /<script/i, "the page must work with scripting off");
});

test("a completed exercise renders as done", async () => {
  const { html } = await get([row(BLOCK, { media: MEDIA_OK, done: true })]);
  assert.match(html, /✓ Done/);
});

test("AC4: no service-role key ever appears in the rendered HTML, even if one happens to be present in env", async () => {
  // The GET path never fetches, imports or references SUPABASE_SERVICE_ROLE_KEY
  // at all now — proved here by passing an env that HAS one and asserting it
  // still never surfaces, which is stronger than merely "env has none".
  const { html } = await get([row(BLOCK, { media: MEDIA_OK })], TOKEN, WRITE_ENV);
  assert.doesNotMatch(html, /test-key/);
  assert.doesNotMatch(html, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("the read calls shared_workout_page by POST with p_token, using the anon key — never the service-role key", async () => {
  _resetRateLimitStateForTests();
  let seenUrl, seenInit;
  globalThis.fetch = async (url, init) => {
    seenUrl = String(url); seenInit = init;
    return new Response(JSON.stringify([row(BLOCK, { media: MEDIA_OK })]), { status: 200 });
  };
  const { onRequestGet } = await import(MOD);
  await onRequestGet({ env: WRITE_ENV, params: { token: TOKEN } });
  assert.match(seenUrl, /\/rest\/v1\/rpc\/shared_workout_page$/);
  assert.equal(seenInit.method, "POST");
  assert.deepEqual(JSON.parse(seenInit.body), { p_token: TOKEN });
  assert.equal(seenInit.headers.apikey, SUPABASE_ANON_KEY, "must call with the PUBLIC anon key");
  assert.equal(seenInit.headers.Authorization, `Bearer ${SUPABASE_ANON_KEY}`);
  assert.doesNotMatch(seenInit.headers.Authorization, /test-key/, "must never send the service-role key to this RPC");
});

// ---------------------------------------------------------------------------
// gy-emboo — the edge rate limit on /w/ (functions/w/_ratelimit.js). A
// per-isolate counter: real protection against one script hammering candidate
// tokens from one connection, not a claim of a global/cross-colo limit (see
// that file's own header for what this is and is not).

test("gy-emboo: hammering /w/ from one IP past the window trips the rate limit", async () => {
  _resetRateLimitStateForTests();
  stub([row(BLOCK, { media: MEDIA_OK })]);
  const { onRequestGet } = await import(MOD);
  const req = { headers: new Map([["CF-Connecting-IP", "203.0.113.9"]]) };
  req.headers.get = Map.prototype.get.bind(req.headers);
  let last;
  for (let i = 0; i < 25; i++) {
    last = await onRequestGet({ env: ENV, params: { token: TOKEN }, request: req });
  }
  assert.equal(last.status, 429, "a script hammering one IP must eventually be told to slow down");
  const body = await last.text();
  assert.match(body, /Too many requests/i);
});

test("gy-emboo NEG: a single request from a fresh IP is NEVER rate-limited (positive control for the test above)", async () => {
  _resetRateLimitStateForTests();
  stub([row(BLOCK, { media: MEDIA_OK })]);
  const { onRequestGet } = await import(MOD);
  const req = { headers: new Map([["CF-Connecting-IP", "203.0.113.200"]]) };
  req.headers.get = Map.prototype.get.bind(req.headers);
  const res = await onRequestGet({ env: ENV, params: { token: TOKEN }, request: req });
  assert.equal(res.status, 200, "the limiter must not have false-positived on the first request from a fresh key");
});

test("gy-emboo: a request with no CF-Connecting-IP (e.g. an unusual proxy path) fails OPEN, not closed", async () => {
  _resetRateLimitStateForTests();
  stub([row(BLOCK, { media: MEDIA_OK })]);
  const { onRequestGet } = await import(MOD);
  const req = { headers: new Map() };
  req.headers.get = Map.prototype.get.bind(req.headers);
  const res = await onRequestGet({ env: ENV, params: { token: TOKEN }, request: req });
  assert.equal(res.status, 200, "no key to rate-limit on is not a reason to refuse a real visitor");
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
// touched by the read swap (only the GET path moved to the real RPC).
const LEGACY_LINK = { id: "aaaaaaaa-1111-2222-3333-444444444444", expires_at: new Date(Date.now() + 864e5).toISOString(), revoked_at: null };
const LEGACY_BLOCK_ID = BLOCK.id;

// A stub that answers the SCOPED block lookup (id + workout_id + is_deleted)
// separately from the page's list query, so "is this block in this workout?" can
// be made false on its own.
function stubScope({ inScope = true, writeStatus = 201, link = LEGACY_LINK } = {}) {
  _resetRateLimitStateForTests();
  const writes = [];
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes("workout_share_links?token=")) return new Response(JSON.stringify([link]), { status: 200 });
    if (u.includes("workout_assignments?id="))
      return new Response(JSON.stringify([{ workout_id: "ffffffff-1111-2222-3333-444444444444" }]), { status: 200 });
    // the scoped lookup blockBelongsToLink performs
    if (u.includes("workout_blocks?id="))
      return new Response(JSON.stringify(inScope ? [{ id: LEGACY_BLOCK_ID }] : []), { status: 200 });
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
  return onRequestPost({ env: WRITE_ENV, request: { formData: async () => new Map(body) }, params: { token: TOKEN } });
};

test("a write with no service-role key configured still fails closed (gy-nm6ii unbuilt — unchanged)", async () => {
  _resetRateLimitStateForTests();
  const { onRequestPost } = await import(MOD);
  const req = { formData: async () => new Map([["block", LEGACY_BLOCK_ID]]) };
  const res = await onRequestPost({ env: ENV, request: req, params: { token: TOKEN } });
  assert.equal(res.status, 404);
});

test("AC3 NEG: a block from ANOTHER workout is refused, and nothing is written", async () => {
  const writes = stubScope({ inScope: false });
  const res = await post([["block", "99999999-1111-2222-3333-444444444444"]]);
  assert.equal(res.status, 404, "a token for one workout must not mark another workout's exercise");
  assert.equal(writes.length, 0, "the refusal must happen BEFORE the write, not be cleaned up after it");
});

test("AC3 POSITIVE CONTROL: a block inside this workout still ticks", async () => {
  // Without this, the refusal above is equally explained by "no tick ever works".
  const writes = stubScope({ inScope: true });
  const res = await post([["block", LEGACY_BLOCK_ID]]);
  assert.equal(res.status, 303);
  assert.equal(writes.length, 1);
});

test("a double-tap (409 from the unique index) is still success, not an error", async () => {
  stubScope({ inScope: true, writeStatus: 409 });
  const res = await post([["block", LEGACY_BLOCK_ID]]);
  assert.equal(res.status, 303, "a repeat tap is the same event; an error toast for one would be our bug");
});

test("🔴 a write that FAILS is not answered with the same redirect as one that worked", async () => {
  stubScope({ inScope: true, writeStatus: 500 });
  const res = await post([["block", LEGACY_BLOCK_ID]]);
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

test("a write against an expired link is refused, not silently accepted", async () => {
  // Otherwise the link stops SHOWING the workout but keeps ACCEPTING data.
  stubScope({ inScope: true, link: { ...LEGACY_LINK, expires_at: new Date(Date.now() - 1000).toISOString() } });
  const res = await post([["block", LEGACY_BLOCK_ID]]);
  assert.equal(res.status, 404);
});

test("POST redirects instead of re-rendering, so a refresh cannot re-submit", async () => {
  stubScope({ inScope: true });
  const { onRequestPost } = await import(MOD);
  const req = { formData: async () => new Map([["block", LEGACY_BLOCK_ID]]) };
  const res = await onRequestPost({ env: WRITE_ENV, request: req, params: { token: TOKEN } });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get("Location"), `/w/${TOKEN}`);
});

test("🔴 the DPDP notice is present and appears BEFORE the first tap control", async () => {
  // Compliance's REVISED ruling (gy-rt68e): required, not recommended, because
  // this is the first time a client is the direct SOURCE of a write to us.
  // The ordering assertion is the substance — a notice rendered after the
  // control it describes is not a notice.
  const { html } = await get([row(BLOCK, { media: MEDIA_OK })]);
  const notice = html.indexOf("Tapping records that you finished each exercise");
  const firstTap = html.indexOf("Mark done");
  assert.notEqual(notice, -1, "the required notice copy is missing from the page");
  assert.ok(notice < firstTap, "the notice must render above the first tap control, not below it");
  assert.match(html, /We don't collect your name, email, or phone number on this page\./);
  // It must not creep back to the word compliance and I both refused: a
  // completion IS attributable via workout_assignments.client_id.
  assert.doesNotMatch(html, /anonymous/i);
});
