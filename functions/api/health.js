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
import { supabaseUrl, svcHeaders } from "../m/_shared.js";

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      // Never let a cache answer a liveness question.
      "Cache-Control": "no-store, max-age=0",
    },
  });

export async function onRequestGet({ env }) {
  const key = env && env.SUPABASE_SERVICE_ROLE_KEY;

  // THE gy-gcr22 CASE ITSELF. An absent binding is not "database down" — it is a
  // deployment that was never configured — and the two need different people to
  // fix them, so they must not report the same way.
  if (!key) {
    return json(503, {
      db: "unconfigured",
      detail: "SUPABASE_SERVICE_ROLE_KEY is not bound in this environment; every server-side read will 401 and /w/ and /m/ will refuse everything.",
    });
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
    return json(503, { db: "unreachable", detail: "network error reaching PostgREST" });
  }

  if (!res.ok) {
    // 401 here is the exact signature of a bound-but-wrong/revoked key — a
    // different failure from an absent one, and worth separating for whoever is
    // paged at 3am.
    return json(503, {
      db: res.status === 401 ? "rejected" : "error",
      status: res.status,
      detail: res.status === 401
        ? "PostgREST rejected the service_role key (wrong, rotated or revoked)."
        : "PostgREST returned a non-OK status for a trivial read.",
    });
  }

  return json(200, { db: "ok" });
}
