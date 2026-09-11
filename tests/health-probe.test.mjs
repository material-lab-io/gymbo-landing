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
