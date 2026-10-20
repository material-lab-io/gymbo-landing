// getgymbo.com — DB reachability probe for the server-rendered public surfaces.
//
// 🔴 WHY THIS EXISTS (gy-gcr22 AC5). /w/<token> and /m/<id> were 100% dead in
// PRODUCTION from the day they shipped, and nothing noticed. The Pages
// production environment had no SUPABASE_SERVICE_ROLE_KEY binding, so every
// database read returned 401, q() returned null, and both handlers fell through
// to their uniform refusal.
//
// THE PART THAT OUTLIVES THE FIX: the uniform refusal is a deliberate PRIVACY
// property — distinguishing "expired" from "unknown" hands a token guesser an
// oracle. But it ALSO makes a total outage byte-for-byte identical to a correct
// refusal. Every live check we had was a refusal check or a key-absence grep,
// and all of them pass perfectly against a site whose database reads are
// failing. A negative control that cannot fail is not a control.
//
// So the probe cannot go through /w/ or /m/: by design those cannot tell you
// why they refused. It has to ask the one question they can't — "can this Worker
// actually reach the database?" — on a route with nothing to protect.
//
// 🔴 WHY NOT PROBE WITH A KNOWN-GOOD SHARE TOKEN INSTEAD. That was the obvious
// alternative and it is worse on two counts: it needs a real row seeded in
// production that must never expire (the current DUMMY expires 2026-09-13, which
// would turn this check red for a benign reason within days and get it muted —
// and a muted check is the state we are trying to leave), and a valid token
// living in a public repo is a share link anyone can open.
//
// WHAT IT DELIBERATELY DOES NOT RETURN: no rows, no counts, no ids, no token
// state, and never any value derived from the service_role key. The only
// information disclosed is whether our own database is reachable. That is a real
// but small disclosure, and it is a deliberate trade: the alternative is the
// outage we just had, invisible for as long as nobody happens to open a share
// link. Stated here rather than left implicit so anyone tightening this later
// knows what it was weighed against.
// 🔴 gy-7a8qs (2026-10-20): THE SERVICE-KEY PROBE IS RETIRED. This file used to
// probe a SUPABASE_SERVICE_ROLE_KEY ("db") because /w/ and /m/takedown needed
// one. They no longer do: /w/ reads through the anon shared_workout_page RPC and
// /m/takedown writes through the anon submit_media_takedown RPC (founder
// decision 2026-09-14: no full-database credential on Pages, ever). Probing an
// absent key therefore reported an outage that did not exist, and Prod Watch
// stayed red for 40 runs once the dated gy-gcr22 allowance lapsed, which taught
// everyone to stop reading it. The probe now asks the same question of the
// credential each surface really uses.
import { supabaseUrl, anonHeaders, MEDIA_PAGE_RPC } from "../m/_shared.js";
import { WORKOUT_RPC } from "../w/_workout_rpc.js";

// ===========================================================================
// ONE CREDENTIAL (anon), ONE PROBE PER RPC THE PUBLIC SURFACES DEPEND ON.
//
//   anon + EXECUTE on shared_workout_page -> /w/<token>   ("w_rpc")
//   anon + EXECUTE on media_page          -> /m/<id>      ("m_rpc")
//
// NOT PROBED: /m/takedown (submit_media_takedown). Calling it records a claim,
// and a write-free probe needs the RPC's SQL, which lives in Gymbo-v1. It stays
// unprobed here until gy-7a8qs AC1 shows it working on prod; do not add a call
// to it without that.
//
// 🔴 THE FAILURE THIS PREVENTS IS THE ONE THIS FILE WAS BUILT FOR (gy-gcr22):
// a surface that is dead for every viewer while every live check passes, because
// /w/ and /m/ refuse uniformly by design. Revoke an anon EXECUTE grant and the
// matching surface dies while the rest of the site looks fine.
// ===========================================================================

// Well-formed so it reaches the grant check (and satisfies /w/'s TOKEN_RE shape),
// and matching no row, so a healthy answer is an empty array. The probes read
// NOBODY's data and cannot go red for the benign reason a real seeded id or a
// token that eventually expires would.
const PROBE_MEDIA_ID = "00000000-0000-0000-0000-000000000000";
const PROBE_TOKEN = "0".repeat(32);

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      // Never let a cache answer a liveness question.
      "Cache-Control": "no-store, max-age=0",
    },
  });

// Verdicts are kept distinct because they need DIFFERENT PEOPLE to fix them: a
// missing grant is one line of SQL, a missing function is a migration, and an
// unreachable host is neither.
async function probeAnonRpc(env, rpc, args, surface) {
  let res;
  try {
    res = await fetch(`${supabaseUrl(env)}/rest/v1/rpc/${rpc}`, {
      method: "POST",
      headers: anonHeaders(),
      body: JSON.stringify(args),
    });
  } catch {
    return { state: "unreachable", detail: `network error reaching PostgREST for the anon ${rpc} RPC` };
  }
  if (res.ok) return { state: "ok" };

  // Read the PostgREST error code rather than guessing from the status: 401 and
  // 404 each cover more than one cause, and the code is the part that names it.
  let code = null;
  try { code = (await res.json())?.code ?? null; } catch { code = null; }

  if (code === "42501") {
    return {
      state: "denied",
      detail: `anon has no EXECUTE on ${rpc} — ${surface} is dead for every viewer. One GRANT fixes it; this is NOT a code change.`,
    };
  }
  if (code === "PGRST202") {
    return {
      state: "missing",
      detail: `${rpc} is not in the schema cache (absent, renamed, or its signature changed) — ${surface} is dead. Needs a migration, not a grant.`,
    };
  }
  return { state: "error", status: res.status, detail: `the anon ${rpc} RPC returned a non-OK status.` };
}

export async function onRequestGet({ env }) {
  // BOTH are probed on every request, and neither short-circuits the other: they
  // are different surfaces and either can be dead while the other serves.
  const [w, m] = await Promise.all([
    probeAnonRpc(env, WORKOUT_RPC, { p_token: PROBE_TOKEN }, "/w/"),
    probeAnonRpc(env, MEDIA_PAGE_RPC, { p_media_id: PROBE_MEDIA_ID }, "/m/"),
  ]);

  const body = { w_rpc: w.state, m_rpc: m.state };
  // Only ever a verdict and a reason — never rows, counts, ids, or tokens.
  if (w.status !== undefined) body.w_rpc_status = w.status;
  if (w.detail) body.w_rpc_detail = w.detail;
  if (m.status !== undefined) body.m_rpc_status = m.status;
  if (m.detail) body.m_rpc_detail = m.detail;

  return json(w.state === "ok" && m.state === "ok" ? 200 : 503, body);
}
