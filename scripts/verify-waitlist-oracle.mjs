// gy-rh2rj — NEGATIVE CONTROL for the waitlist enumeration oracle, with a
// POSITIVE CONTROL in the same run.
//
// The claim under test: POST /api/waitlist answers a KNOWN-ABSENT contact and a
// KNOWN-PRESENT contact identically, so the response cannot be used to probe
// whether someone is on the waitlist.
//
// WHY THERE IS A POSITIVE CONTROL. "The two responses were identical" is a
// worthless sentence if the comparator is blind — a comparator that returns
// "same" for everything passes this test on a completely broken endpoint. So
// this script ALSO runs the pre-fix implementation through the SAME comparator
// in the SAME run and REQUIRES it to report DIFFERENT. If the positive control
// does not fail, the negative control proves nothing and the script exits red.
//
// Run: node scripts/verify-waitlist-oracle.mjs
// No network, no deps: Supabase is stubbed so 201 (new) and 409 (duplicate) are
// produced on demand.

import { onRequestPost } from "../functions/api/waitlist.js";

// The pre-fix handler, reproduced verbatim in its observable behaviour. This is
// the instrument's calibration weight, not dead code: it is the shape we are
// claiming to have removed.
async function preFixHandler(supabaseStatus) {
  if (supabaseStatus === 201) return Response.json({ ok: true }, { status: 201 });
  if (supabaseStatus === 409) return Response.json({ ok: true, already: true }, { status: 200 });
  return Response.json({ error: "failed to join" }, { status: 502 });
}

// Capture everything a probing client can actually see.
async function observe(res) {
  const headers = [...res.headers.entries()]
    .filter(([k]) => k !== "date")
    .sort()
    .map(([k, v]) => `${k}: ${v}`);
  return JSON.stringify({
    status: res.status,
    headers,
    bodyBytes: [...new Uint8Array(await res.clone().arrayBuffer())],
  });
}

function stubContext(supabaseStatus, payload) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: supabaseStatus });
  return {
    request: { json: async () => payload },
    env: {}, // notify intentionally unconfigured — it must not affect the response
    waitUntil: (p) => { void p; },
    restore: () => { globalThis.fetch = realFetch; },
  };
}

async function runCurrent(supabaseStatus, payload) {
  const ctx = stubContext(supabaseStatus, payload);
  try {
    return await observe(await onRequestPost(ctx));
  } finally {
    ctx.restore();
  }
}

let failures = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `\n        ${detail}` : ""}`);
  if (!ok) failures++;
};

// --- POSITIVE CONTROL: the comparator must SEE the old oracle -----------------
{
  const absent = await observe(await preFixHandler(201));
  const present = await observe(await preFixHandler(409));
  check(
    "POSITIVE CONTROL — pre-fix implementation is distinguishable (comparator is not blind)",
    absent !== present,
    absent === present ? "comparator reported SAME on the known-leaky version — every result below is meaningless" : "old: 201 {ok:true}  vs  200 {ok:true,already:true}",
  );
}

// --- NEGATIVE CONTROL: email ---------------------------------------------------
for (const [label, payload] of [
  ["email-only", { name: "A", email: "probe@example.com" }],
  ["phone-only", { name: "A", phone: "9876543210" }],
  ["both", { name: "A", email: "probe@example.com", phone: "9876543210" }],
]) {
  const absent = await runCurrent(201, payload); // insert succeeded => NOT on the list before
  const present = await runCurrent(409, payload); // unique violation => ALREADY on the list
  check(
    `NEGATIVE CONTROL — ${label}: known-absent and known-present are byte-identical`,
    absent === present,
    absent === present ? absent : `absent=${absent}\n        present=${present}`,
  );
}

// --- gy-ds3fn: the funnel must actually accept a phone-only signup -------------
{
  const r = await runCurrent(201, { name: "A", phone: "9876543210" });
  check("gy-ds3fn — phone-only signup is ACCEPTED (was 400 'valid email required')", JSON.parse(r).status === 200, r);

  const neither = await runCurrent(201, { name: "A" });
  check("gy-ds3fn — neither email nor phone is still REJECTED", JSON.parse(neither).status === 400, neither);

  const badEmail = await runCurrent(201, { email: "nope" });
  check("gy-ds3fn — a supplied but invalid email is still REJECTED", JSON.parse(badEmail).status === 400, badEmail);

  const badPhone = await runCurrent(201, { phone: "123" });
  check("gy-ds3fn — a supplied but implausible phone is REJECTED", JSON.parse(badPhone).status === 400, badPhone);
}

// --- the empty-string trap -----------------------------------------------------
// lower('') is a real value under waitlist_email_idx, so sending "" instead of
// NULL would make the SECOND phone-only signup collide with the first.
{
  let sent = null;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (_u, init) => { sent = JSON.parse(init.body); return new Response(null, { status: 201 }); };
  await onRequestPost({ request: { json: async () => ({ phone: "9876543210" }) }, env: {}, waitUntil: () => {} });
  globalThis.fetch = realFetch;
  check(
    "empty identity fields are sent as NULL, never '' (would collide on the unique index)",
    sent && sent.email === null && sent.name === null && sent.phone === "9876543210",
    JSON.stringify(sent),
  );
}

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
