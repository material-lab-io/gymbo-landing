// gy-gcr22 / gy-7a8qs — the reachability probe that would have caught the outage.
//
// /w/<token> and /m/<id> were 100% dead in production from the day they shipped.
// Their uniform refusal is a deliberate privacy property, but it makes a total
// outage byte-for-byte identical to a correct refusal (measured 2026-09-11: a
// VALID prod-minted token and "not-a-token" both returned HTTP 404 at exactly
// 3884 bytes). The probe asks the question those routes cannot answer.
//
// gy-7a8qs: both surfaces now read through ANON RPCs and hold no service-role
// key, so the probe covers shared_workout_page ("w_rpc") and media_page
// ("m_rpc"). The old service-key "db" verdict is gone: an unbound key is not a
// fault any more, and reporting it kept Prod Watch red for 40 runs.
//
// 🔴 THIS FILE EXISTS TO KEEP THE PROBE ABLE TO FAIL. Every branch is exercised,
// INCLUDING the healthy one, and each surface is driven independently.
import { test } from "node:test";
import assert from "node:assert/strict";

const MOD = "../functions/api/health.js";
const body = async (res) => JSON.parse(await res.text());
const realFetch = globalThis.fetch;

const ok = () => new Response("[]", { status: 200 });
const denied = (name) => () => new Response(JSON.stringify({ code: "42501", message: `permission denied for function ${name}` }), { status: 401 });
const missing = () => new Response(JSON.stringify({ code: "PGRST202", message: "Could not find the function" }), { status: 404 });

// Route the two probes independently so each branch can be driven on its own.
const stub = ({ w = ok, m = ok } = {}) => {
  globalThis.fetch = async (url) => (String(url).includes("/rpc/shared_workout_page") ? w() : m());
};
const run = async (env = {}) => {
  const { onRequestGet } = await import(MOD);
  const res = await onRequestGet({ env });
  return { res, b: JSON.parse(await res.clone().text()), text: await res.text() };
};

test("POSITIVE CONTROL — both anon RPCs healthy reports ok for each, HTTP 200", async () => {
  stub();
  try {
    const { res, b } = await run();
    assert.equal(res.status, 200);
    assert.equal(b.w_rpc, "ok");
    assert.equal(b.m_rpc, "ok");
  } finally { globalThis.fetch = realFetch; }
});

test("🔴 an UNBOUND service key is NOT a fault (gy-7a8qs): no env, still healthy", async () => {
  stub();
  try {
    const { res, b } = await run({});
    assert.equal(res.status, 200);
    assert.ok(!("db" in b), "the retired service-key verdict must not come back");
  } finally { globalThis.fetch = realFetch; }
});

test("a REVOKED anon grant on /w/ is caught alone, with /m/ still ok", async () => {
  stub({ w: denied("shared_workout_page") });
  try {
    const { res, b } = await run();
    assert.equal(b.w_rpc, "denied");
    assert.equal(b.m_rpc, "ok");
    assert.equal(res.status, 503, "a dead /w/ must not return 200 just because /m/ is up");
    assert.match(b.w_rpc_detail, /\/w\/ is dead/);
  } finally { globalThis.fetch = realFetch; }
});

test("a REVOKED anon grant on /m/ is caught alone, with /w/ still ok", async () => {
  stub({ m: denied("media_page") });
  try {
    const { res, b } = await run();
    assert.equal(b.m_rpc, "denied");
    assert.equal(b.w_rpc, "ok");
    assert.equal(res.status, 503);
    assert.match(b.m_rpc_detail, /\/m\/ is dead/);
  } finally { globalThis.fetch = realFetch; }
});

test("a MISSING or renamed RPC reports 'missing', not 'denied' (a migration, not a grant)", async () => {
  stub({ w: missing });
  try {
    const { b } = await run();
    assert.equal(b.w_rpc, "missing");
    assert.notEqual(b.w_rpc, "denied");
  } finally { globalThis.fetch = realFetch; }
});

test("a network failure on either path is 503 'unreachable', never a silent pass", async () => {
  for (const side of ["w", "m"]) {
    stub({ [side]: () => { throw new Error("boom"); } });
    try {
      const { res, b } = await run();
      assert.equal(res.status, 503, side);
      assert.equal(b[`${side}_rpc`], "unreachable", side);
    } finally { globalThis.fetch = realFetch; }
  }
});

test("an unrecognised non-OK status reports 'error' with the status, not ok", async () => {
  stub({ w: () => new Response("", { status: 500 }) });
  try {
    const { res, b } = await run();
    assert.equal(res.status, 503);
    assert.equal(b.w_rpc, "error");
    assert.equal(b.w_rpc_status, 500);
  } finally { globalThis.fetch = realFetch; }
});

test("both probes run even when the first fails (neither short-circuits)", async () => {
  stub({ w: denied("shared_workout_page"), m: missing });
  try {
    const { b } = await run();
    assert.equal(b.w_rpc, "denied");
    assert.equal(b.m_rpc, "missing");
  } finally { globalThis.fetch = realFetch; }
});

test("the probes read no rows and echo none", async () => {
  stub({
    w: () => new Response(JSON.stringify([{ workout_name: "leak-me" }]), { status: 200 }),
    m: () => new Response(JSON.stringify([{ author: "leak-me" }]), { status: 200 }),
  });
  try {
    const { text } = await run();
    assert.ok(!text.includes("leak-me"), "the probe must not echo anything it read");
  } finally { globalThis.fetch = realFetch; }
});

test("the probes ask for ids that match nothing, with the anon key only", async () => {
  const sent = {};
  globalThis.fetch = async (url, init = {}) => {
    sent[String(url).split("/rpc/")[1]] = { body: JSON.parse(init.body), auth: init.headers.Authorization };
    return ok();
  };
  try {
    await run({ SUPABASE_SERVICE_ROLE_KEY: "SUPER_SECRET_KEY" });
    assert.equal(sent.media_page.body.p_media_id, "00000000-0000-0000-0000-000000000000");
    assert.match(sent.shared_workout_page.body.p_token, /^[A-Za-z0-9_-]{20,64}$/, "must satisfy /w/'s token shape or it never reaches the grant check");
    assert.equal(new Set(sent.shared_workout_page.body.p_token).size, 1, "a real-looking token could collide with a live share link");
    for (const { auth } of Object.values(sent)) {
      assert.ok(!auth.includes("SUPER_SECRET_KEY"), "a service key, if bound, must never be used or sent");
    }
  } finally { globalThis.fetch = realFetch; }
});

test("🔴 no key or token value appears in a response body", async () => {
  stub({ w: () => new Response("", { status: 500 }) });
  try {
    const { text } = await run({ SUPABASE_SERVICE_ROLE_KEY: "SUPER_SECRET_KEY" });
    assert.ok(!text.includes("SUPER_SECRET_KEY"));
    assert.ok(!text.includes("0".repeat(32)), "the probe token must not be echoed");
  } finally { globalThis.fetch = realFetch; }
});
