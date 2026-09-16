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
import { supabaseUrl, svcHeaders, anonHeaders, MEDIA_PAGE_RPC } from "../m/_shared.js";

// ===========================================================================
// gy-gcr22 AC5 — TWO CREDENTIALS, TWO PROBES.
//
// /m/ no longer holds a service_role key: it reads through the anon media_page
// RPC (founder decision 2026-09-14). So the surface this file speaks for is now
// split, and ONE probe can no longer answer for both:
//
//   service_role                  -> /w/<token>, /m/takedown   ("db")
//   anon + EXECUTE on media_page  -> /m/<id>                   ("m_rpc")
//
// 🔴 THE FAILURE THIS PREVENTS IS THE ONE THIS FILE WAS BUILT FOR. The original
// outage was invisible because the only live checks asked a question the broken
// path did not answer. Putting /m/ back on a NEW credential while still probing
// only the OLD one rebuilds that blind spot exactly: revoke the anon EXECUTE
// grant and /m/ is dead for every viewer while this endpoint reports db:ok.
// The grant is deliberately narrow, which is precisely what a later tightening
// removes without knowing /m/ depends on it.
// ===========================================================================

// Well-formed so it reaches the grant check, and matching no row so a healthy
// answer is an empty array. The probe therefore reads NOBODY's data, and cannot
// go red for the benign reason a real seeded id eventually would.
const PROBE_MEDIA_ID = "00000000-0000-0000-0000-000000000000";

// Verdicts are kept distinct because they need DIFFERENT PEOPLE to fix them: a
// missing grant is one line of SQL, a missing function is a migration, and an
// unreachable host is neither.
async function probeMediaRpc(env) {
  let res;
  try {
    res = await fetch(`${supabaseUrl(env)}/rest/v1/rpc/${MEDIA_PAGE_RPC}`, {
      method: "POST",
      headers: anonHeaders(),
      body: JSON.stringify({ p_media_id: PROBE_MEDIA_ID }),
    });
  } catch {
    return { state: "unreachable", detail: "network error reaching PostgREST for the anon media_page RPC" };
  }
  if (res.ok) return { state: "ok" };

  // Read the PostgREST error code rather than guessing from the status: 401 and
  // 404 each cover more than one cause, and the code is the part that names it.
  let code = null;
  try { code = (await res.json())?.code ?? null; } catch { code = null; }

  if (code === "42501") {
    return {
      state: "denied",
      detail: "anon has no EXECUTE on media_page — /m/ is dead for every viewer. One GRANT fixes it; this is NOT a code change.",
    };
  }
  if (code === "PGRST202") {
    return {
      state: "missing",
      detail: "media_page is not in the schema cache (absent, renamed, or its signature changed) — /m/ is dead. Needs a migration, not a grant.",
    };
  }
  return { state: "error", status: res.status, detail: "the anon media_page RPC returned a non-OK status." };
}

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      // Never let a cache answer a liveness question.
      "Cache-Control": "no-store, max-age=0",
    },
  });

// The service_role half: /w/<token> and /m/takedown.
async function probeServiceRead(env) {
  const key = env && env.SUPABASE_SERVICE_ROLE_KEY;

  // THE gy-gcr22 CASE ITSELF. An absent binding is not "database down" — it is a
  // deployment that was never configured — and the two need different people to
  // fix them, so they must not report the same way.
  //
  // 🔴 THE WORDING NARROWED ON PURPOSE. This used to say "/w/ and /m/ will refuse
  // everything". Since gy-gcr22, /m/ does not use this key at all, so naming it
  // here would be a false statement about a surface that is in fact serving.
  if (!key) {
    return {
      state: "unconfigured",
      detail: "SUPABASE_SERVICE_ROLE_KEY is not bound in this environment; every server-side read will 401 and /w/ and /m/takedown will refuse everything. /m/ itself is unaffected — it reads through the anon RPC reported as m_rpc.",
    };
  }

  // The cheapest possible REAL read against the table /w/ depends on. limit=0
  // returns no rows at all, so this proves the credential is accepted without
  // reading anyone's data.
  let res;
  try {
    res = await fetch(`${supabaseUrl(env)}/rest/v1/workout_share_links?select=id&limit=0`, {
      headers: svcHeaders(key),
    });
  } catch (e) {
    return { state: "unreachable", detail: "network error reaching PostgREST" };
  }

  if (!res.ok) {
    // 401 here is the exact signature of a bound-but-wrong/revoked key — a
    // different failure from an absent one, and worth separating for whoever is
    // paged at 3am.
    return {
      state: res.status === 401 ? "rejected" : "error",
      status: res.status,
      detail: res.status === 401
        ? "PostgREST rejected the service_role key (wrong, rotated or revoked)."
        : "PostgREST returned a non-OK status for a trivial read.",
    };
  }

  return { state: "ok" };
}

export async function onRequestGet({ env }) {
  // BOTH are probed on every request, and neither short-circuits the other. An
  // unbound service key must not stop us reporting on /m/: those are different
  // surfaces with different owners, and the smoke script's gy-gcr22 allowance is
  // pinned to the service-key signature alone.
  const [svc, mrpc] = await Promise.all([probeServiceRead(env), probeMediaRpc(env)]);

  const body = { db: svc.state, m_rpc: mrpc.state };
  // Only ever a verdict and a reason — never rows, counts, ids, or any value
  // derived from a key.
  if (svc.status !== undefined) body.status = svc.status;
  if (svc.detail) body.detail = svc.detail;
  if (mrpc.status !== undefined) body.m_rpc_status = mrpc.status;
  if (mrpc.detail) body.m_rpc_detail = mrpc.detail;

  const healthy = svc.state === "ok" && mrpc.state === "ok";
  return json(healthy ? 200 : 503, body);
}
