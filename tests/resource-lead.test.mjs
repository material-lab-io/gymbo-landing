// gy-p3ebo AC3/AC5 — the resource-capture endpoint's contract, exercised against the REAL
// handler module. Nothing here re-implements the function; every test imports
// functions/api/resource-lead.js and calls it, because a suite that tests a copy proves
// something about the copy.
//
// 🔴 WHAT THIS FILE IS DEFENDING. Two properties that fail SILENTLY if they regress:
//   (1) analytics may receive ONLY the opaque resource_lead_id — a leak of email or name
//       into the response body is invisible in every green deploy until someone reads the
//       analytics store, and by then it has been collected;
//   (2) the access grant must come from the SERVER'S gate, never from "the call returned
//       2xx" — a decorative grant looks identical to a real one from the browser.
// Each therefore has a test that fails LOUDLY on the exact regression, and each negative
// has a positive control so a green means the test could have gone red.
import { test } from "node:test";
import assert from "node:assert/strict";

const MOD = "../functions/api/resource-lead.js";
const ENV = { SUPABASE_URL: "https://stub.invalid", SUPABASE_ANON_KEY: "stub-key" };

const ctx = (body) => ({ request: { json: async () => body }, env: ENV });
const VALID = {
  resource_id: "workout-builder-starter-pack",
  email: "Trainer@Example.Invalid",
  name: "A Trainer",
  delivery_consent: true,
  delivery_consent_notice_version: "v1",
};

/** Stub global fetch; returns the calls it saw so tests can assert on the payload. */
function stubFetch(responder) {
  const calls = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return responder();
  };
  return { calls, restore: () => { globalThis.fetch = real; } };
}
const rpcOk = (extra = {}) => () =>
  new Response(JSON.stringify({ resource_lead_id: "11111111-2222-3333-4444-555555555555",
                                access_granted: true, ...extra }), { status: 200 });

test("HAPPY PATH — a consented submission returns the gate and the opaque id", async () => {
  const { onRequestPost } = await import(MOD);
  const f = stubFetch(rpcOk());
  try {
    const res = await onRequestPost(ctx(VALID));
    assert.equal(res.status, 200);
    const b = await res.json();
    assert.equal(b.ok, true);
    assert.equal(b.access_granted, true);
    assert.equal(b.resource_lead_id, "11111111-2222-3333-4444-555555555555");
    // POSITIVE CONTROL for every "no call was made" assertion below: this path DOES
    // reach the RPC. Without it, those tests would also pass if the handler were inert.
    assert.equal(f.calls.length, 1);
    assert.match(f.calls[0].url, /\/rest\/v1\/rpc\/resource_lead_submit$/);
  } finally { f.restore(); }
});

test("🔴 AC5 LEAK GUARD — the response body carries the id and NOTHING else, even when the RPC hands back more", async () => {
  const { onRequestPost } = await import(MOD);
  // The RPC is made to return contact data and the withdrawal capability alongside the
  // id. This is the shape a careless future migration, or a spread of the RPC result,
  // would produce. The handler must drop all of it.
  const f = stubFetch(rpcOk({
    email: "trainer@example.invalid",
    name: "A Trainer",
    withdrawal_token: "99999999-8888-7777-6666-555555555555",
    raw_contact: { email: "trainer@example.invalid" },
  }));
  try {
    const b = await (await onRequestPost(ctx(VALID))).json();
    assert.deepEqual(Object.keys(b).sort(), ["access_granted", "ok", "resource_lead_id"],
      "an unexpected key escaped the endpoint — analytics may only ever see resource_lead_id");
    const serialised = JSON.stringify(b);
    for (const leaked of ["trainer@example.invalid", "A Trainer", "99999999-8888-7777-6666-555555555555"]) {
      assert.equal(serialised.includes(leaked), false, `leaked ${leaked}`);
    }
  } finally { f.restore(); }
});

test("🔴 AC3 — access_granted:false from the server is a REFUSAL, not a grant", async () => {
  const { onRequestPost } = await import(MOD);
  const f = stubFetch(() => new Response(JSON.stringify({ resource_lead_id: "x", access_granted: false }), { status: 200 }));
  try {
    const res = await onRequestPost(ctx(VALID));
    assert.notEqual(res.status, 200);
    const b = await res.json();
    assert.equal(b.ok, false);
    assert.equal(b.resource_lead_id, undefined, "a refused submission must not hand back an id");
  } finally { f.restore(); }
});

test("🔴 AC3 — a 2xx with no gate at all is a refusal; 'it did not throw' is not a grant", async () => {
  const { onRequestPost } = await import(MOD);
  const f = stubFetch(() => new Response(JSON.stringify({ resource_lead_id: "x" }), { status: 200 }));
  try {
    const b = await (await onRequestPost(ctx(VALID))).json();
    assert.equal(b.ok, false);
  } finally { f.restore(); }
});

test("AC2 — an unconsented submission is refused and NEVER reaches the database", async () => {
  const { onRequestPost } = await import(MOD);
  const f = stubFetch(rpcOk());
  try {
    for (const bad of [
      { ...VALID, delivery_consent: false },
      { ...VALID, delivery_consent: "true" },          // a string is not consent
      { ...VALID, delivery_consent_notice_version: "" }, // consent with no notice version
    ]) {
      const res = await onRequestPost(ctx(bad));
      assert.equal(res.status, 400);
      assert.equal((await res.json()).ok, false);
    }
    assert.equal(f.calls.length, 0, "an unconsented submission must not create a lead row");
  } finally { f.restore(); }
});

test("AC7 — marketing consent defaults FALSE and only an explicit boolean true grants it", async () => {
  const { onRequestPost } = await import(MOD);
  const f = stubFetch(rpcOk());
  try {
    for (const variant of [{}, { marketing_consent: false }, { marketing_consent: "true" },
                           { marketing_consent: 1 }, { marketing_consent: null }]) {
      await onRequestPost(ctx({ ...VALID, ...variant }));
    }
    for (const c of f.calls) {
      assert.equal(c.body.p_marketing_consent, false);
      assert.equal(c.body.p_marketing_consent_notice_version, null);
    }
    // POSITIVE CONTROL — the field CAN be set, so the five falses above mean something.
    await onRequestPost(ctx({ ...VALID, marketing_consent: true, marketing_consent_notice_version: "v1" }));
    assert.equal(f.calls.at(-1).body.p_marketing_consent, true);
    assert.equal(f.calls.at(-1).body.p_marketing_consent_notice_version, "v1");
  } finally { f.restore(); }
});

test("a marketing grant with no notice version is refused before it reaches the database", async () => {
  const { onRequestPost } = await import(MOD);
  const f = stubFetch(rpcOk());
  try {
    const res = await onRequestPost(ctx({ ...VALID, marketing_consent: true }));
    assert.equal(res.status, 400);
    assert.equal(f.calls.length, 0);
  } finally { f.restore(); }
});

test("🔴 the RPC's consent raise arrives as HTTP 401 — refuse as CALLER fault, not a 502", async () => {
  // Measured against a real stack 2026-09-22: PostgREST maps the function's
  // insufficient_privilege raise to 401, NOT 403. A handler that branches on the HTTP
  // status reports a correctly-refused submission as a server error. This test pins the
  // status the wire actually carries, so the mapping cannot drift back.
  const { onRequestPost } = await import(MOD);
  const f = stubFetch(() => new Response(
    JSON.stringify({ code: "42501", message: "resource_lead_submit: delivery consent (with a notice version) is required" }),
    { status: 401 }));
  try {
    const res = await onRequestPost(ctx(VALID));
    assert.equal(res.status, 400);
    const b = await res.json();
    assert.equal(b.ok, false);
    assert.equal(b.resource_lead_id, undefined);
    assert.equal(JSON.stringify(b).includes("resource_lead_submit"), false,
      "the database's own message must not be forwarded to the browser");
  } finally { f.restore(); }
});

test("🔴 DISCRIMINATION — a 401 that is NOT the consent raise is OUR fault (502), not the visitor's", async () => {
  // An expired or misconfigured anon key also produces 401. If that were folded into the
  // 400 branch, a total auth outage would present to every visitor as "your submission
  // was refused" and to us as a normal rejection rate — the site would look like it was
  // turning users away when it could not authenticate at all. The SQLSTATE is what
  // separates them, so this is the control that proves the mapping discriminates.
  const { onRequestPost } = await import(MOD);
  const f = stubFetch(() => new Response(
    JSON.stringify({ message: "Invalid authentication credentials" }), { status: 401 }));
  try {
    const res = await onRequestPost(ctx(VALID));
    assert.equal(res.status, 502, "a credential failure must not be reported as a consent refusal");
    assert.equal((await res.json()).ok, false);
  } finally { f.restore(); }
});

test("NO ORACLE — a first-time lead and a returning one are byte-for-byte indistinguishable", async () => {
  const { onRequestPost } = await import(MOD);
  // The RPC upserts, so both outcomes return the same id for the same (resource, email).
  // The endpoint must not add a tell of its own (a different status, or an `already` flag),
  // or anyone could POST an address and learn whether that person had signed up — the
  // exact leak gy-rh2rj found in /api/waitlist, which lived in the CONSTRAINT not a grant.
  const f = stubFetch(rpcOk());
  try {
    const first = await onRequestPost(ctx(VALID));
    const second = await onRequestPost(ctx(VALID));
    assert.equal(first.status, second.status);
    assert.equal(JSON.stringify(await first.json()), JSON.stringify(await second.json()));
  } finally { f.restore(); }
});

test("email is required and malformed input is refused without a database round trip", async () => {
  const { onRequestPost } = await import(MOD);
  const f = stubFetch(rpcOk());
  try {
    for (const bad of [{ ...VALID, email: "" }, { ...VALID, email: "not-an-email" }, { ...VALID, resource_id: "" }]) {
      assert.equal((await onRequestPost(ctx(bad))).status, 400);
    }
    assert.equal(f.calls.length, 0);
  } finally { f.restore(); }
});
