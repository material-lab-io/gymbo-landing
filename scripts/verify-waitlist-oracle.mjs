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
// No network, no deps: Supabase and waitlist-notify are stubbed. The handler calls the join_waitlist RPC,
// which answers a NEW signup and a KNOWN contact with a 200 and a fresh uuid each (gy-rh2rj option Z), so the
// two "worlds" are stubbed as different fixed uuids: a handler that leaks or branches on the receipt is then
// visible as a difference between them.

import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

// The handler under test. WAITLIST_HANDLER exists ONLY so tests/waitlist-oracle-verifier.test.mjs can
// point this script at a copy with a planted defect and require it to go RED (gy-rh2rj: a verifier
// that has only ever been seen green proves nothing). A handler that cannot be LOADED is exit 2,
// never a pass: "I could not look" must not read as "the oracle is closed".
const HANDLER_URL = process.env.WAITLIST_HANDLER
  ? pathToFileURL(resolve(process.env.WAITLIST_HANDLER)).href
  : new URL("../functions/api/waitlist.js", import.meta.url).href;
let onRequestPost;
try {
  ({ onRequestPost } = await import(HANDLER_URL));
  if (typeof onRequestPost !== "function") throw new Error("the module has no onRequestPost export");
} catch (error) {
  console.error(`COULD NOT LOAD the handler under test (${HANDLER_URL}): ${error.message}`);
  process.exit(2);
}
console.log(`handler under test: ${HANDLER_URL}`);

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

const NOTIFY_URL = "https://notify.invalid/waitlist-notify";
// The two worlds join_waitlist() answers with. Both are 200; only the (opaque) uuid differs.
const NEW = { status: 200, body: JSON.stringify("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa") };
const KNOWN = { status: 200, body: JSON.stringify("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb") };

// rpc = { status, body } the stubbed join_waitlist answers with; notify = "ok" | "never" (a notify that
// never resolves, to prove the visitor's answer does not wait on it).
function stubContext(rpc, payload, notify = "ok") {
  const realFetch = globalThis.fetch;
  const seen = { rpc: [], notify: [] };
  const waiting = [];
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes("/rest/v1/rpc/join_waitlist")) {
      seen.rpc.push({ url: u, body: JSON.parse(init.body) });
      return new Response(rpc.body, { status: rpc.status, headers: { "content-type": "application/json" } });
    }
    if (u === NOTIFY_URL) {
      seen.notify.push({ headers: init.headers, body: JSON.parse(init.body) });
      if (notify === "never") return new Promise(() => {});
      return new Response("{}", { status: 200 });
    }
    throw new Error(`unexpected fetch to ${u}`);
  };
  return {
    request: { json: async () => payload },
    env: { WAITLIST_NOTIFY_URL: NOTIFY_URL, WAITLIST_NOTIFY_SECRET: "shared-secret" },
    waitUntil: (p) => { waiting.push(p); },
    seen,
    waiting,
    restore: () => { globalThis.fetch = realFetch; },
  };
}

async function runCurrent(rpc, payload, notify = "ok") {
  const ctx = stubContext(rpc, payload, notify);
  try {
    return await observe(await onRequestPost(ctx));
  } finally {
    ctx.restore();
  }
}

// Like runCurrent but also reports what the handler sent out. The handler must answer even if notify hangs,
// so the response is raced against a timeout; a timeout is reported, not thrown.
async function runObserved(rpc, payload, notify = "ok") {
  const ctx = stubContext(rpc, payload, notify);
  try {
    const timeout = new Promise((r) => setTimeout(() => r("TIMEOUT"), 1500));
    const res = await Promise.race([onRequestPost(ctx), timeout]);
    if (res === "TIMEOUT") return { timedOut: true, seen: ctx.seen };
    if (notify === "ok") await Promise.all(ctx.waiting);
    return { timedOut: false, observed: await observe(res), status: res.status, seen: ctx.seen };
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

// --- NEGATIVE CONTROL: a NEW signup and a KNOWN contact are byte-identical -----
for (const [label, payload] of [
  ["email-only", { name: "A", email: "probe@example.com" }],
  ["phone-only", { name: "A", phone: "9876543210" }],
  ["both", { name: "A", email: "probe@example.com", phone: "9876543210" }],
]) {
  const absent = await runCurrent(NEW, payload); // join_waitlist created a row
  const present = await runCurrent(KNOWN, payload); // join_waitlist swallowed a duplicate
  check(
    `NEGATIVE CONTROL — ${label}: known-absent and known-present are byte-identical`,
    absent === present,
    absent === present ? absent : `absent=${absent}\n        present=${present}`,
  );
}

// --- gy-rh2rj step 2: what the handler SENDS ----------------------------------
{
  const r = await runObserved(NEW, { name: "A", email: "probe@example.com", phone: "9876543210", source: "instagram" });
  const call = r.seen.rpc[0];
  check(
    "gy-rh2rj — the RPC is called once at /rest/v1/rpc/join_waitlist with EXACTLY {p_name,p_email,p_phone,p_source}",
    r.seen.rpc.length === 1 && /\/rest\/v1\/rpc\/join_waitlist$/.test(call.url) && JSON.stringify(Object.keys(call.body).sort()) === JSON.stringify(["p_email", "p_name", "p_phone", "p_source"]),
    JSON.stringify(call),
  );
}
{
  const r = await runObserved(NEW, { phone: "9876543210" });
  const b = r.seen.rpc[0]?.body;
  check(
    "empty identity fields are sent as NULL, never '' (would collide on the unique index); p_source is PRESENT as null when unattributed",
    b && b.p_email === null && b.p_name === null && b.p_phone === "9876543210" && "p_source" in b && b.p_source === null,
    JSON.stringify(b),
  );
}
for (const [label, world, receipt] of [["NEW signup", NEW, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"], ["KNOWN contact", KNOWN, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"]]) {
  const r = await runObserved(world, { name: "Asha", email: "probe@example.com", phone: "9876543210" });
  const n = r.seen.notify;
  check(
    `gy-rh2rj — waitlist-notify is fired on a ${label}, with EXACTLY {mode:"signup", receipt} and the secret header (no name, email or phone)`,
    n.length === 1 && JSON.stringify(n[0].body) === JSON.stringify({ mode: "signup", receipt }) && n[0].headers["x-waitlist-secret"] === "shared-secret",
    JSON.stringify(n),
  );
}
// NO TIMING ORACLE (pm condition 1): a notify that never resolves must not delay the answer.
for (const [label, world] of [["NEW signup", NEW], ["KNOWN contact", KNOWN]]) {
  const r = await runObserved(world, { email: "probe@example.com" }, "never");
  check(
    `gy-rh2rj — NO TIMING ORACLE: the answer to a ${label} does not wait on waitlist-notify (notify hung, handler still answered 200)`,
    !r.timedOut && r.status === 200,
    r.timedOut ? "the handler did not respond within 1.5s while notify was pending: it is awaiting notify before answering" : `status ${r.status}`,
  );
}

// --- RPC error mapping ---------------------------------------------------------
{
  const bad = await runObserved({ status: 400, body: JSON.stringify({ code: "22023", message: "invalid waitlist entry" }) }, { email: "probe@example.com" });
  check("gy-rh2rj — join_waitlist's 22023 (invalid input) is a visitor 400", bad.status === 400, JSON.stringify(bad.status));
  for (const [label, rpc] of [
    ["P0001 'waitlist unavailable' (OUR failure, PostgREST also says 400)", { status: 400, body: JSON.stringify({ code: "P0001", message: "waitlist unavailable" }) }],
    ["a 500", { status: 500, body: "{}" }],
    ["a 404", { status: 404, body: "{}" }],
    ["a 400 with no JSON body", { status: 400, body: "not json" }],
  ]) {
    const r = await runObserved(rpc, { email: "probe@example.com" });
    check(`gy-rh2rj — ${label} is a 502, never a visitor error`, r.status === 502, JSON.stringify(r.status));
    check(`gy-rh2rj — ${label} fires NO notify`, r.seen.notify.length === 0, JSON.stringify(r.seen.notify));
  }
}

// --- gy-ds3fn: the funnel must actually accept a phone-only signup -------------
{
  const r = await runCurrent(NEW, { name: "A", phone: "9876543210" });
  check("gy-ds3fn — phone-only signup is ACCEPTED (was 400 'valid email required')", JSON.parse(r).status === 200, r);

  for (const [label, payload, want] of [
    ["neither email nor phone is still REJECTED", { name: "A" }, 400],
    ["a supplied but invalid email is still REJECTED", { email: "nope" }, 400],
    ["a supplied but implausible phone is REJECTED", { phone: "123" }, 400],
  ]) {
    const ran = await runObserved(NEW, payload);
    check(`gy-ds3fn — ${label}, and the database is never called`, ran.status === want && ran.seen.rpc.length === 0, JSON.stringify({ status: ran.status, rpcCalls: ran.seen.rpc.length }));
  }
}

// --- gy-e60uc.2: a malformed email must be REFUSED before the call ----------------
// Row 29 was accepted by an "@"-only check, then Resend 422'd it, so the visitor was told to check an
// inbox we could not send to. The refusal is 400 and is decided BEFORE the database is touched, so it
// cannot depend on whether the address is already on the list (it is not an oracle).
for (const bad of ["a@b", "a@gmail", "a@gmail,com"]) {
  const r = await runCurrent(NEW, { name: "A", email: bad });
  check(`gy-e60uc.2 — malformed email '${bad}' is REFUSED with 400`, JSON.parse(r).status === 400, r);
}
{
  const r = await runCurrent(NEW, { name: "A", email: "trainer@example.com" });
  check("gy-e60uc.2 — a well-formed email is still ACCEPTED (liveness: the refusal is not a blanket 400)", JSON.parse(r).status === 200, r);
}

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
