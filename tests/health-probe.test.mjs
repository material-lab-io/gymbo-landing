// gy-gcr22 — the DB reachability probe that would have caught the outage.
//
// /w/<token> and /m/<id> were 100% dead in production from the day they shipped.
// The Pages production environment had no SUPABASE_SERVICE_ROLE_KEY, so every
// read 401'd and both handlers fell through to their uniform refusal. That
// refusal is a deliberate privacy property, but it also makes a total outage
// byte-for-byte identical to a correct refusal: measured 2026-09-11, a VALID
// prod-minted token and the string "not-a-token" both returned HTTP 404 at
// exactly 3884 bytes.
//
// 🔴 THIS FILE EXISTS TO KEEP THE PROBE ABLE TO FAIL. A probe is only worth its
// deploy if each distinct failure it claims to distinguish actually produces a
// distinct answer, so every branch is exercised here — INCLUDING the healthy
// one. Without that positive control this would just be a machine for saying
// "broken", and a green from it would prove nothing.
import { test } from "node:test";
import assert from "node:assert/strict";

const MOD = "../functions/api/health.js";
const body = async (res) => JSON.parse(await res.text());
const realFetch = globalThis.fetch;

test("an ABSENT binding reports 'unconfigured' — the gy-gcr22 case itself", async () => {
  const { onRequestGet } = await import(MOD);
  const res = await onRequestGet({ env: {} });
  assert.equal(res.status, 503);
  const b = await body(res);
  assert.equal(b.db, "unconfigured");
  // An unconfigured deployment and a broken database need different people to
  // fix them, so they must never report the same way.
  assert.notEqual(b.db, "unreachable");
});

test("a REJECTED key reports 'rejected', not 'unconfigured'", async () => {
  globalThis.fetch = async () => new Response("", { status: 401 });
  try {
    const { onRequestGet } = await import(MOD);
    const res = await onRequestGet({ env: { SUPABASE_SERVICE_ROLE_KEY: "bogus" } });
    assert.equal(res.status, 503);
    assert.equal((await body(res)).db, "rejected");
  } finally { globalThis.fetch = realFetch; }
});

test("POSITIVE CONTROL — a working read reports ok", async () => {
  globalThis.fetch = async () => new Response("[]", { status: 200 });
  try {
    const { onRequestGet } = await import(MOD);
    const res = await onRequestGet({ env: { SUPABASE_SERVICE_ROLE_KEY: "good" } });
    assert.equal(res.status, 200);
    assert.equal((await body(res)).db, "ok");
  } finally { globalThis.fetch = realFetch; }
});

test("a network failure is 503, never a silent pass", async () => {
  globalThis.fetch = async () => { throw new Error("boom"); };
  try {
    const { onRequestGet } = await import(MOD);
    const res = await onRequestGet({ env: { SUPABASE_SERVICE_ROLE_KEY: "good" } });
    assert.equal(res.status, 503);
  } finally { globalThis.fetch = realFetch; }
});

test("🔴 the service_role key never appears in a response body", async () => {
  globalThis.fetch = async () => new Response("", { status: 500 });
  try {
    const { onRequestGet } = await import(MOD);
    const text = await (await onRequestGet({ env: { SUPABASE_SERVICE_ROLE_KEY: "SUPER_SECRET_KEY" } })).text();
    // A leak here is rotate-everything, not fix-forward.
    assert.ok(!text.includes("SUPER_SECRET_KEY"));
  } finally { globalThis.fetch = realFetch; }
});

test("the probe returns no row data, only a verdict", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify([{ id: "leak-me" }]), { status: 200 });
  try {
    const { onRequestGet } = await import(MOD);
    const text = await (await onRequestGet({ env: { SUPABASE_SERVICE_ROLE_KEY: "good" } })).text();
    assert.ok(!text.includes("leak-me"), "the probe must not echo rows it read");
  } finally { globalThis.fetch = realFetch; }
});

// ===========================================================================
// gy-gcr22 AC5 — THE PROBE MUST COVER THE PATH /m/ ACTUALLY DEPENDS ON NOW.
//
// Until gy-gcr22's /m/ change, every server-rendered surface read with the
// service_role key, so ONE service-key probe spoke for all of them. /m/ now
// reads through the anon media_page RPC and holds no service key at all. That
// splits the surface across TWO credentials:
//
//   service_role  -> /w/<token>, /m/takedown      (probed by "db" above)
//   anon + EXECUTE on media_page -> /m/<id>        (probed by "m_rpc" here)
//
// 🔴 WHY THIS IS NOT BELT-AND-BRACES. The original outage was "100% dead in
// production and nothing noticed", and the reason nothing noticed is that the
// only live checks asked a question the broken path did not answer. Shipping
// /m/ back onto a NEW credential while the probe still watches the OLD one
// rebuilds that exact blind spot: revoke the anon EXECUTE grant and /m/ dies
// for every viewer while /api/health still reports db:ok.
//
// The grant is live but deliberately narrow (REVOKE ALL ... FROM PUBLIC,
// authenticated; GRANT EXECUTE ... TO anon), so it is precisely the kind of
// thing a later security tightening removes without knowing /m/ depends on it.
// ===========================================================================

// An all-zeros uuid: well-formed, so it reaches the grant check, and matches no
// row, so a healthy answer is an empty array and the probe reads NOBODY's data.
const okRpc = () => new Response("[]", { status: 200 });
const okRest = () => new Response("[]", { status: 200 });

// Route the two probes independently so each branch can be driven on its own.
const stubBoth = ({ rest = okRest, rpc = okRpc } = {}) => {
  globalThis.fetch = async (url) =>
    String(url).includes("/rpc/media_page") ? rpc() : rest();
};

test("POSITIVE CONTROL — both credentials healthy reports ok for each", async () => {
  stubBoth();
  try {
    const { onRequestGet } = await import(MOD);
    const res = await onRequestGet({ env: { SUPABASE_SERVICE_ROLE_KEY: "good" } });
    assert.equal(res.status, 200);
    const b = await body(res);
    assert.equal(b.db, "ok");
    assert.equal(b.m_rpc, "ok", "the anon /m/ path must report too, not be assumed");
  } finally { globalThis.fetch = realFetch; }
});

test("🔴 a REVOKED anon grant is caught even though the service key is fine", async () => {
  // This is the whole point: db is ok, and /m/ is dead for every viewer.
  stubBoth({
    rpc: () => new Response(
      JSON.stringify({ code: "42501", message: "permission denied for function media_page" }),
      { status: 401 },
    ),
  });
  try {
    const { onRequestGet } = await import(MOD);
    const res = await onRequestGet({ env: { SUPABASE_SERVICE_ROLE_KEY: "good" } });
    const b = await body(res);
    assert.equal(b.db, "ok", "the service path really is healthy here");
    assert.equal(b.m_rpc, "denied");
    assert.equal(res.status, 503, "a dead /m/ must not return 200 just because /w/ is up");
  } finally { globalThis.fetch = realFetch; }
});

test("a MISSING or renamed RPC reports 'missing', not 'denied'", async () => {
  // PGRST202 is what PostgREST says when the function is not in the schema
  // cache at all — a different fix (a migration) from a missing grant.
  stubBoth({
    rpc: () => new Response(
      JSON.stringify({ code: "PGRST202", message: "Could not find the function" }),
      { status: 404 },
    ),
  });
  try {
    const { onRequestGet } = await import(MOD);
    const b = await body(await onRequestGet({ env: { SUPABASE_SERVICE_ROLE_KEY: "good" } }));
    assert.equal(b.m_rpc, "missing");
    assert.notEqual(b.m_rpc, "denied");
  } finally { globalThis.fetch = realFetch; }
});

test("an anon-path network failure is 503, never a silent pass", async () => {
  stubBoth({ rpc: () => { throw new Error("boom"); } });
  try {
    const { onRequestGet } = await import(MOD);
    const res = await onRequestGet({ env: { SUPABASE_SERVICE_ROLE_KEY: "good" } });
    assert.equal(res.status, 503);
    assert.equal((await body(res)).m_rpc, "unreachable");
  } finally { globalThis.fetch = realFetch; }
});

test("the anon probe reads no rows and echoes none", async () => {
  stubBoth({ rpc: () => new Response(JSON.stringify([{ author: "leak-me" }]), { status: 200 }) });
  try {
    const { onRequestGet } = await import(MOD);
    const text = await (await onRequestGet({ env: { SUPABASE_SERVICE_ROLE_KEY: "good" } })).text();
    assert.ok(!text.includes("leak-me"), "the probe must not echo anything it read");
  } finally { globalThis.fetch = realFetch; }
});

test("the anon probe asks for a uuid that matches nothing", async () => {
  let sentBody = null;
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).includes("/rpc/media_page")) sentBody = init.body;
    return new Response("[]", { status: 200 });
  };
  try {
    const { onRequestGet } = await import(MOD);
    await onRequestGet({ env: { SUPABASE_SERVICE_ROLE_KEY: "good" } });
    assert.equal(
      JSON.parse(sentBody).p_media_id,
      "00000000-0000-0000-0000-000000000000",
      "a real id would make this probe read someone's asset, and could go red for a benign reason",
    );
  } finally { globalThis.fetch = realFetch; }
});

test("🔴 /m/ being dead is NOT excused by the service key being unbound", async () => {
  // The gy-gcr22 allowance in getgymbo-smoke.sh is pinned to db:"unconfigured".
  // /m/ no longer needs that key, so an unbound key must still report the anon
  // path honestly rather than hiding it behind the allowance.
  stubBoth({ rpc: () => new Response(JSON.stringify({ code: "42501" }), { status: 401 }) });
  try {
    const { onRequestGet } = await import(MOD);
    const b = await body(await onRequestGet({ env: {} }));
    assert.equal(b.db, "unconfigured");
    assert.equal(b.m_rpc, "denied", "the anon verdict must be reported even with no service key");
  } finally { globalThis.fetch = realFetch; }
});
