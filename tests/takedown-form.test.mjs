// gy-9ggf3 — the takedown form's choice controls.
//
// 🔴 THE DEFECT THESE EXIST FOR: the Reason <select> clipped its longest option,
// "It shows me and I did not agree to this use" — the one an actual rightsholder
// picks — while every DOM assertion passed. The option WAS in the markup and the
// select DID exist; neither fact says a human can read it. A native select
// reports scrollWidth === clientWidth even while clipping, so the browser itself
// will not tell you.
//
// The control is now radios, which wrap, so no option can be cut at any width.
// The width proof is scripts/check-option-text-fits.mjs against the SERVED page —
// it cannot be done here, because layout does not exist in a string. What IS
// provable here is the contract: the same names and values the backend reads.
import { test } from "node:test";
import assert from "node:assert/strict";

const MOD = "../functions/m/takedown.js";
const ENV = { SUPABASE_SERVICE_ROLE_KEY: "k", SUPABASE_URL: "https://stub.invalid" };

const html = async () => {
  globalThis.fetch = async () => new Response("[]", { status: 200 });
  const { onRequestGet } = await import(MOD);
  const res = await onRequestGet({ env: ENV, request: new Request("https://x/m/takedown"), params: {} });
  return res.text();
};

test("gy-9ggf3: the choice controls are RADIOS — a select cannot be proven readable", async () => {
  const h = await html();
  // Assert on the tags a real control would carry, not the string "<select>":
  // the CSS comment explaining WHY this is not a select is itself served, and an
  // assertion that its own documentation trips is a test nobody keeps.
  assert.doesNotMatch(h, /<option\b/i, "an <option> means a select survived the swap");
  assert.doesNotMatch(h, /<\/select>/i, "a closing </select> means a select survived the swap");
  assert.match(h, /type="radio"[^>]*name="requester_role"/);
  assert.match(h, /type="radio"[^>]*name="claim_kind"/);
});

test("gy-9ggf3: every value the backend reads still exists, unchanged", async () => {
  // The handler does form.get("requester_role") / form.get("claim_kind"). If a
  // value were renamed in the swap the form would submit something the backend
  // silently maps to "other" — a data defect with no error anywhere.
  const h = await html();
  for (const v of ["performer", "rightsholder", "agent", "other"])
    assert.match(h, new RegExp(`name="requester_role" value="${v}"`), `requester_role/${v} missing`);
  for (const v of ["likeness", "copyright", "licence", "privacy", "other"])
    assert.match(h, new RegExp(`name="claim_kind" value="${v}"`), `claim_kind/${v} missing`);
});

test("gy-9ggf3: one option in each group is pre-selected, as the select was", async () => {
  // A select always submits something. Radios with nothing checked submit
  // NOTHING, and the handler would default silently to "other" — quietly
  // mislabelling every request from someone who did not touch the control.
  const h = await html();
  const checked = [...h.matchAll(/<input type="radio" name="(\w+)" value="(\w+)" checked>/g)];
  const groups = checked.map((m) => m[1]);
  assert.ok(groups.includes("requester_role"), "no default for requester_role");
  assert.ok(groups.includes("claim_kind"), "no default for claim_kind");
  assert.equal(checked.length, 2, "exactly one default per group, or the browser picks the last");
});

test("gy-9ggf3: the longest option text is still present in full", async () => {
  // Presence is NOT the property that failed — readability was. This asserts we
  // did not "fix" the clipping by shortening the claimant's own words.
  const h = await html();
  assert.match(h, /It shows me and I did not agree to this use/);
});

// gy-s8z4z AC-I5 / AC-I6 — the form records a claim through ONE anon RPC.
// The stub plays the database: it returns what submit_media_takedown returns
// (a case reference, "already_open", "rate_limited") or an HTTP failure.
const REF = "GYM-TD-7K2M9QXA";
let calls = [];
const post = async ({ rpc = { status: 200, body: REF }, headers = {}, throws = false, env = ENV } = {}) => {
  calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (throws) throw new Error("network down");
    return new Response(JSON.stringify(rpc.body), { status: rpc.status });
  };
  const { onRequestPost } = await import(MOD);
  const body = new URLSearchParams({
    media_id: "11111111-2222-3333-4444-555555555555", requester_name: "Test Reporter",
    requester_email: "reporter@example.invalid", requester_role: "other", claim_kind: "other",
    claim_detail: "control",
  });
  const request = new Request("https://x/m/takedown", {
    method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
  });
  const res = await onRequestPost({ env, request, params: {} });
  return { status: res.status, h: await res.text() };
};

test("AC-I5: one call to the anon RPC, the anon key, the service key NEVER sent even when bound", async () => {
  await post({ headers: { "CF-Connecting-IP": "203.0.113.7" } });
  assert.equal(calls.length, 1);
  const { url, init } = calls[0];
  assert.match(url, /\/rest\/v1\/rpc\/submit_media_takedown$/);
  assert.equal(init.method, "POST");
  assert.doesNotMatch(JSON.stringify(init.headers), /"k"|Bearer k\b/, "the bound service key must not be used");
  assert.match(init.headers.apikey, /^eyJ/);
  const sent = JSON.parse(init.body);
  assert.deepEqual(Object.keys(sent).sort(), ["p_claim_detail", "p_claim_kind", "p_client_ip", "p_evidence",
    "p_media_id", "p_requester_email", "p_requester_name", "p_requester_role"]);
  assert.equal(sent.p_media_id, "11111111-2222-3333-4444-555555555555");
});

test("AC-I6: the client IP comes ONLY from CF-Connecting-IP, in the body, never the URL", async () => {
  await post({ headers: { "CF-Connecting-IP": "203.0.113.7", "X-Forwarded-For": "198.51.100.9" } });
  assert.equal(JSON.parse(calls[0].init.body).p_client_ip, "203.0.113.7");
  assert.doesNotMatch(calls[0].url, /203\.0\.113\.7/, "the IP must not travel in the URL (request logs)");
});

test("AC-I6 NEG: a client-supplied X-Forwarded-For is IGNORED; with no CF header the IP is null, never invented", async () => {
  await post({ headers: { "X-Forwarded-For": "198.51.100.9" } });
  assert.equal(JSON.parse(calls[0].init.body).p_client_ip, null);
});

test("AC-I6: rate_limited -> neutral 'try again later' (429), still offering the grievance address, no count or window disclosed", async () => {
  const { status, h } = await post({ rpc: { status: 200, body: "rate_limited" } });
  assert.equal(status, 429);
  assert.match(h, /try again later/i);
  assert.match(h, /mailto:grievance@getgymbo\.com/);
  assert.doesNotMatch(h, /Request received/i);
  assert.doesNotMatch(h, /\b\d+\s*(minute|minutes|hour|hours|request|requests|submissions)\b/i, "do not teach a script the limit");
});

test("a recorded claim shows the DATABASE-minted reference, the notice, and no fallback", async () => {
  const { status, h } = await post();
  assert.equal(status, 200);
  assert.match(h, /GYM-TD-7K2M9QXA/);
  assert.match(h, /Request received/);
});

test("NEG: an unrecognised RPC answer is NEVER shown as received (a reference must match the shape)", async () => {
  for (const body of ["ok", "GYM-TD-short", null, { case_ref: REF }, "<script>x</script>"]) {
    const { status, h } = await post({ rpc: { status: 200, body } });
    assert.equal(status, 502, JSON.stringify(body));
    assert.doesNotMatch(h, /Request received/, JSON.stringify(body));
    assert.doesNotMatch(h, /<script>x<\/script>/);
  }
});

// gy-s8z4z compliance ruling 2026-09-14 (3): every fallback points at the address
// VERIFIED to deliver (grievance@, gy-vhxsd), never privacy@.
test("gy-s8z4z: every fallback points at the VERIFIED grievance address, never privacy@", async () => {
  const cases = [
    ["rpc http failure", { rpc: { status: 500, body: { message: "x" } } }, 502],
    ["network failure", { throws: true }, 502],
    ["case already open", { rpc: { status: 200, body: "already_open" } }, 200],
    ["rate limited", { rpc: { status: 200, body: "rate_limited" } }, 429],
  ];
  for (const [label, opts, expected] of cases) {
    const { status, h } = await post(opts);
    assert.equal(status, expected, label);
    assert.match(h, /mailto:grievance@getgymbo\.com/, `${label}: must offer the verified grievance address`);
    assert.doesNotMatch(h, /privacy@getgymbo\.com/, `${label}: must not offer the unverified privacy@ address`);
  }
});

// gy-wwr2e.8.1 AC4 — the approved retention notice, verbatim, in the right places.
const APPROVED = "Your name and email are deleted 90 days after your case is resolved. A record that this clip was reported, and how it was resolved, is kept without your personal details.";

test("gy-wwr2e.8.1 AC4: the form shows the APPROVED retention notice, verbatim, BEFORE the submit button", async () => {
  const h = await html();
  const at = h.indexOf(APPROVED);
  assert.ok(at > -1, "the approved wording must appear exactly, not paraphrased");
  assert.ok(at < h.indexOf('type="submit"'), "consent needs the notice before collection, so it sits above submit");
});

test("gy-wwr2e.8.1 AC4: a recorded claim's confirmation repeats it; already-open and rate-limited (nothing stored) do NOT", async () => {
  assert.ok((await post()).h.includes(APPROVED));
  assert.ok(!(await post({ rpc: { status: 200, body: "already_open" } })).h.includes(APPROVED));
  assert.ok(!(await post({ rpc: { status: 200, body: "rate_limited" } })).h.includes(APPROVED));
});

test("gy-wwr2e.8.1 AC4 NEG: no OTHER retention period is stated anywhere on the takedown surface", async () => {
  const pages = [await html(), (await post()).h, (await post({ rpc: { status: 200, body: "already_open" } })).h,
    (await post({ rpc: { status: 500, body: {} } })).h, (await post({ rpc: { status: 200, body: "rate_limited" } })).h];
  for (const h of pages) {
    const periods = h.match(/\b\d+\s*(day|days|month|months|year|years|week|weeks)\b/gi) || [];
    assert.deepEqual(periods.filter((p) => !/^90\s*days$/i.test(p)), [], "only the approved 90 days may be stated");
  }
});
