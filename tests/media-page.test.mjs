// gy-a2xps.9 AC1-AC3 + gy-gcr22 — the public media page's rendering rules.
//
// These run WITHOUT a network or a database: the anon RPC is stubbed, so each
// case fixes the exact response shape under test. That is the point -- the rules
// being proved here are about what the page REFUSES to render, and you cannot
// reliably produce a row with missing provenance against a database whose CHECK
// constraints exist to prevent exactly that.
//
// gy-gcr22 (2026-09-14): /m/ no longer holds a service-role key. It calls ONE
// anon RPC (MEDIA_PAGE_RPC) and builds PUBLIC object URLs from the returned
// paths. The contract under test is the one posted on gy-s8z4z:
//   zero rows            -> not found
//   state 'withdrawn'    -> withdrawn, no data
//   state 'unavailable'  -> unavailable, no data
//   state 'ok'           -> attribution + video_object_path (RENDITION) + poster_object_path
//
// Run: node --test tests/media-page.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

const MOD = "../functions/m/[id].js";
// A service key IS present in this env on purpose: the page must not use it.
const ENV = { SUPABASE_SERVICE_ROLE_KEY: "test-service-key", MEDIA_BUCKET: "exercise-media" };
const ID = "11111111-2222-3333-4444-555555555555";

const WGER_OK = {
  state: "ok", source: "wger", asset_kind: "video",
  author: "Goulart", author_url: null, work_title: null,
  source_url: "https://wger.de/en/exercise/512/view/",
  licence_id: "CC-BY-SA-4.0", licence_name: "Creative Commons Attribution Share Alike 4",
  licence_url: "https://creativecommons.org/licenses/by-sa/4.0/deed.en",
  is_derivative: true,
  modification_note: "Transcoded from H.265/HEVC to H.264 for playback compatibility.",
  video_object_path: "wger/512/720p.mp4",
  poster_object_path: "wger/512/poster.jpg",
};
const FEDB_OK = {
  state: "ok", source: "fedb", asset_kind: "still",
  author: null, author_url: null, work_title: null, source_url: null,
  licence_id: "Unlicense", licence_name: "The Unlicense", licence_url: null,
  is_derivative: false, modification_note: null,
  video_object_path: "fedb/x.jpg", poster_object_path: null,
};
// What the RPC returns for a suppressed row: a state and NOTHING else.
const stateOnly = (state) => ({
  state, source: null, asset_kind: null, author: null, author_url: null, work_title: null,
  source_url: null, licence_id: null, licence_name: null, licence_url: null,
  is_derivative: null, modification_note: null, video_object_path: null, poster_object_path: null,
});

let calls = [];
function stub(rows, { status = 200, throws = false } = {}) {
  calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (throws) throw new Error("network down");
    return new Response(JSON.stringify(rows), { status });
  };
}

const render = async (rows, opts) => {
  stub(rows, opts);
  const { onRequestGet } = await import(MOD);
  const res = await onRequestGet({ env: ENV, params: { id: ID } });
  return { status: res.status, html: await res.text() };
};

test("POSITIVE CONTROL: a complete wger row renders the RENDITION, its poster AND its credit", async () => {
  const { status, html } = await render([WGER_OK]);
  assert.equal(status, 200);
  assert.match(html, /<video/, "the asset itself must render");
  assert.match(html, /\/storage\/v1\/object\/public\/exercise-media\/wger\/512\/720p\.mp4/);
  assert.match(html, /poster="[^"]*\/storage\/v1\/object\/public\/exercise-media\/wger\/512\/poster\.jpg"/);
  assert.match(html, /preload="none"/, "nothing is fetched until the viewer presses play");
  // AC1: every element of the credit comes from the returned fields.
  assert.match(html, /Goulart/);
  assert.match(html, /Creative Commons Attribution Share Alike 4/);
  assert.match(html, /creativecommons\.org\/licenses\/by-sa\/4\.0/);
  assert.match(html, /wger\.de\/en\/exercise\/512/);
  assert.match(html, /Transcoded from H\.265/, "modification must be indicated");
});

test("gy-gcr22: the page calls the anon RPC with the anon key and NEVER sends the service key", async () => {
  await render([WGER_OK]);
  assert.equal(calls.length, 1, "exactly one upstream call: the RPC. No table read, no signing call");
  const { url, init } = calls[0];
  assert.match(url, /\/rest\/v1\/rpc\/media_page$/);
  assert.equal(init.method, "POST");
  assert.deepEqual(JSON.parse(init.body), { p_media_id: ID });
  const sent = JSON.stringify(init.headers);
  assert.doesNotMatch(sent, /test-service-key/, "the service-role key must not be sent even when bound");
  assert.match(init.headers.apikey, /^eyJ/, "the public anon key is the credential");
  assert.equal(init.headers.Authorization, `Bearer ${init.headers.apikey}`);
});

test("gy-gcr22: no signing call is ever made (objects are served by public URL)", async () => {
  await render([WGER_OK]);
  assert.ok(calls.every((c) => !c.url.includes("/storage/v1/object/sign/")));
});

test("gy-wx6ja AC1 NEG: a row with no rendition shows the empty state and NEVER a master", async () => {
  // Even if a future RPC version leaked the master path under its old name, the
  // page must not read it.
  const { status, html } = await render([{ ...WGER_OK, video_object_path: null, object_path: "wger/512/h264.mp4" }]);
  assert.equal(status, 404);
  assert.doesNotMatch(html, /<video/);
  assert.doesNotMatch(html, /h264\.mp4/, "the master path must not reach the page");
  assert.match(html, /not currently available/i);
});

test("AC1: changing the stored author changes the rendered credit, with no source edit", async () => {
  const { html } = await render([{ ...WGER_OK, author: "A Different Creator" }]);
  assert.match(html, /A Different Creator/);
  assert.doesNotMatch(html, /Goulart/, "the credit must not be hard-coded anywhere");
});

test("AC3: an 'ok' row missing its author does NOT render (the page is never looser than the RPC)", async () => {
  const { status, html } = await render([{ ...WGER_OK, author: null }]);
  assert.equal(status, 404);
  assert.doesNotMatch(html, /<video/, "media must not render without a credit");
  assert.match(html, /not available/i, "and must say so truthfully, not blankly");
});

test("AC3: a derivative with no modification note does NOT render", async () => {
  const { status, html } = await render([{ ...WGER_OK, modification_note: "  " }]);
  assert.equal(status, 404);
  assert.doesNotMatch(html, /<video/);
});

test("AC5: a withdrawn asset is suppressed on the public page and says why", async () => {
  const { status, html } = await render([stateOnly("withdrawn")]);
  assert.equal(status, 404);
  assert.doesNotMatch(html, /<video/, "a suppressed clip must not keep serving here");
  assert.match(html, /withdrawn following a removal request/i);
});

test("an 'unavailable' state and an UNKNOWN future state both refuse to render", async () => {
  for (const s of ["unavailable", "pending_review"]) {
    const { status, html } = await render([{ ...WGER_OK, state: s }]);
    assert.equal(status, 404, s);
    assert.doesNotMatch(html, /<video/, `state ${s} must not render media, even with data present`);
    assert.match(html, /not currently available/i, s);
  }
});

test("zero rows is 'not found', worded as such", async () => {
  const { status, html } = await render([]);
  assert.equal(status, 404);
  assert.match(html, /does not point to a video we have/i);
});

test("NEG: an RPC failure is NOT reported as 'not found' (a trainer holding a real link must not be told it is fake)", async () => {
  for (const opts of [{ status: 500 }, { status: 401 }, { throws: true }]) {
    const { status, html } = await render({ message: "boom" }, opts);
    assert.equal(status, 404, JSON.stringify(opts));
    assert.match(html, /cannot be shown right now/i, JSON.stringify(opts));
    assert.doesNotMatch(html, /does not point to a video we have/i, JSON.stringify(opts));
  }
});

test("AC2: a FEDB still is public-domain and is NEVER given wger attribution", async () => {
  const { status, html } = await render([FEDB_OK]);
  assert.equal(status, 200);
  assert.match(html, /Public domain/i);
  assert.match(html, /The Unlicense/);
  assert.doesNotMatch(html, /Creative Commons/, "public-domain media must not inherit the CC licence");
  assert.doesNotMatch(html, /wger/i, "nor its source");
});

test("a stored path cannot break out of the bucket prefix or add a query string", async () => {
  const { html } = await render([{ ...WGER_OK, video_object_path: "wger/../../x?y=1#z.mp4" }]);
  assert.match(html, /exercise-media\/wger\/\.\.\/\.\.\/x%3Fy%3D1%23z\.mp4/);
  assert.doesNotMatch(html, /x\?y=1/);
});

test("AC7: no DRM or added reuse restriction is written into the page", async () => {
  const { html } = await render([WGER_OK]);
  for (const banned of [/do not share/i, /for personal use/i, /all rights reserved/i,
                        /may not be redistributed/i, /do not download/i]) {
    assert.doesNotMatch(html, banned, `added-restriction copy ${banned} must not appear`);
  }
});

test("XSS: third-party provenance text is escaped, not executed", async () => {
  const { html } = await render([{ ...WGER_OK, author: `<script>alert(1)</script>` }]);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /&lt;script&gt;/);
});

test("the takedown route is reachable from the page, including when unavailable", async () => {
  const live = await render([WGER_OK]);
  const gone = await render([stateOnly("withdrawn")]);
  assert.match(live.html, /\/m\/takedown/);
  assert.match(gone.html, /\/m\/takedown/);
});

test("a malformed id is refused before it reaches the database", async () => {
  let called = false;
  globalThis.fetch = async () => { called = true; return new Response("[]", { status: 200 }); };
  const { onRequestGet } = await import(MOD);
  const res = await onRequestGet({ env: ENV, params: { id: "not-a-uuid" } });
  assert.equal(res.status, 404);
  assert.equal(called, false, "no upstream call should be made for a malformed id");
});

test("no key of any kind appears in the rendered HTML", async () => {
  const { html } = await render([WGER_OK]);
  assert.doesNotMatch(html, /test-service-key/);
  assert.doesNotMatch(html, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(html, /eyJhbGci/, "not even the public anon key belongs in the markup");
});
