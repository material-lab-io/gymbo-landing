// gy-a2xps.9 AC1-AC3 — the public media page's rendering rules.
//
// These run WITHOUT a network or a database: Supabase REST and Storage are
// stubbed, so each case fixes the exact row shape under test. That is the point
// -- the rules being proved here are about what the page REFUSES to render, and
// you cannot reliably produce a row with missing provenance against a database
// whose CHECK constraints exist to prevent exactly that.
//
// Run: node --test tests/media-page.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

const MOD = "../functions/m/[id].js";
const ENV = { SUPABASE_SERVICE_ROLE_KEY: "test-service-key", MEDIA_BUCKET: "exercise-media" };
const ID = "11111111-2222-3333-4444-555555555555";

const WGER_OK = {
  id: ID, source: "wger", asset_kind: "video", availability: "available",
  author: "Goulart", source_url: "https://wger.de/en/exercise/512/view/",
  licence_id: "CC-BY-SA-4.0", licence_name: "Creative Commons Attribution Share Alike 4",
  licence_url: "https://creativecommons.org/licenses/by-sa/4.0/deed.en",
  object_path: "wger/x.mp4", is_derivative: true,
  modification_note: "Transcoded from H.265/HEVC to H.264 for playback compatibility.",
};
const FEDB_OK = {
  id: ID, source: "fedb", asset_kind: "still", availability: "available",
  author: null, source_url: null, licence_id: "Unlicense", licence_name: "The Unlicense",
  licence_url: null, object_path: "fedb/x.jpg", is_derivative: false, modification_note: null,
};

// Stub both upstreams. Storage always signs successfully so that any refusal
// below is attributable to the RULE under test and never to a signing failure.
function stub(row) {
  globalThis.fetch = async (url) => {
    if (String(url).includes("/storage/v1/object/sign/")) {
      return new Response(JSON.stringify({ signedURL: "/object/signed/x?token=t" }), { status: 200 });
    }
    return new Response(JSON.stringify(row ? [row] : []), { status: 200 });
  };
}

const render = async (row, id = ID) => {
  stub(row);
  const { onRequestGet } = await import(MOD);
  const res = await onRequestGet({ env: ENV, params: { id } });
  return { status: res.status, html: await res.text() };
};

test("POSITIVE CONTROL: a complete wger row renders the video AND its credit", async () => {
  const { status, html } = await render(WGER_OK);
  assert.equal(status, 200);
  assert.match(html, /<video/, "the asset itself must render");
  // AC1: every element of the credit comes from the stored fields.
  assert.match(html, /Goulart/);
  assert.match(html, /Creative Commons Attribution Share Alike 4/);
  assert.match(html, /creativecommons\.org\/licenses\/by-sa\/4\.0/);
  assert.match(html, /wger\.de\/en\/exercise\/512/);
  assert.match(html, /Transcoded from H\.265/, "modification must be indicated");
});

test("AC1: changing the stored author changes the rendered credit, with no source edit", async () => {
  const { html } = await render({ ...WGER_OK, author: "A Different Creator" });
  assert.match(html, /A Different Creator/);
  assert.doesNotMatch(html, /Goulart/, "the credit must not be hard-coded anywhere");
});

test("AC3: a row missing its author does NOT render the media", async () => {
  // The DB refuses this row today. The page must refuse it too: if the two ever
  // disagree, the page has to be the stricter one.
  const { status, html } = await render({ ...WGER_OK, author: null });
  assert.equal(status, 404);
  assert.doesNotMatch(html, /<video/, "media must not render without a credit");
  assert.match(html, /not available/i, "and must say so truthfully, not blankly");
});

test("AC3: a derivative with no modification note does NOT render", async () => {
  const { status, html } = await render({ ...WGER_OK, modification_note: "  " });
  assert.equal(status, 404);
  assert.doesNotMatch(html, /<video/);
});

test("AC5: a withdrawn asset is suppressed on the public page and says why", async () => {
  const { status, html } = await render({ ...WGER_OK, availability: "withdrawn" });
  assert.equal(status, 404);
  assert.doesNotMatch(html, /<video/, "a suppressed clip must not keep serving here");
  assert.match(html, /withdrawn following a removal request/i);
});

test("AC2: a FEDB still is public-domain and is NEVER given wger attribution", async () => {
  const { status, html } = await render(FEDB_OK);
  assert.equal(status, 200);
  assert.match(html, /Public domain/i);
  assert.match(html, /The Unlicense/);
  assert.doesNotMatch(html, /Creative Commons/, "public-domain media must not inherit the CC licence");
  assert.doesNotMatch(html, /wger/i, "nor its source");
});

test("AC7: no DRM or added reuse restriction is written into the page", async () => {
  const { html } = await render(WGER_OK);
  // CC-BY-SA forbids imposing further restrictions, so this copy must never
  // appear near licensed media -- it would be a licence breach authored in the
  // design layer rather than a bug.
  for (const banned of [/do not share/i, /for personal use/i, /all rights reserved/i,
                        /may not be redistributed/i, /do not download/i]) {
    assert.doesNotMatch(html, banned, `added-restriction copy ${banned} must not appear`);
  }
});

test("XSS: third-party provenance text is escaped, not executed", async () => {
  // Attribution is rendered from strings a third party controls. An author field
  // containing markup would otherwise be script execution on getgymbo.com.
  const { html } = await render({ ...WGER_OK, author: `<script>alert(1)</script>` });
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /&lt;script&gt;/);
});

test("the takedown route is reachable from the page, including when unavailable", async () => {
  const live = await render(WGER_OK);
  const gone = await render({ ...WGER_OK, availability: "withdrawn" });
  // Someone checking whether their request took effect lands on the unavailable
  // page, so that is exactly where the route must still be offered.
  assert.match(live.html, /\/m\/takedown/);
  assert.match(gone.html, /\/m\/takedown/);
});

test("FAIL-CLOSED: with no service_role key configured, nothing is served", async () => {
  stub(WGER_OK);
  const { onRequestGet } = await import(MOD);
  const res = await onRequestGet({ env: { }, params: { id: ID } });
  assert.equal(res.status, 404);
  assert.doesNotMatch(await res.text(), /<video/,
    "a page that cannot check suppression must not serve media");
});

test("a malformed id is refused before it reaches the database", async () => {
  let called = false;
  globalThis.fetch = async () => { called = true; return new Response("[]", { status: 200 }); };
  const { onRequestGet } = await import(MOD);
  const res = await onRequestGet({ env: ENV, params: { id: "not-a-uuid" } });
  assert.equal(res.status, 404);
  assert.equal(called, false, "no upstream call should be made for a malformed id");
});

test("the service_role key never appears in the rendered HTML", async () => {
  // The whole architecture rests on this. Cheap to assert, catastrophic to miss.
  const { html } = await render(WGER_OK);
  assert.doesNotMatch(html, /test-service-key/);
  assert.doesNotMatch(html, /SUPABASE_SERVICE_ROLE_KEY/);
});
