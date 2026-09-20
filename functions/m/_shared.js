// gy-a2xps.9 — shared server-side helpers for the public media surface.
//
// WHY THIS RUNS SERVER-SIDE AT ALL. exercise_media grants SELECT to
// `authenticated` only; anon has no access whatsoever, and that is deliberate
// (gy-a2xps.5, and we have just spent gy-422pv narrowing exactly this surface).
// But AC4 requires the PDF tap-through target to work WITHOUT app
// authentication, and a trainee opening a link from a PDF is anon by
// definition. Ratified by pm: read with the service_role key HERE, in the
// Pages Function, and return only whitelisted fields.
//
// 🔴 SUPERSEDED FOR /m/[id] (gy-gcr22, founder decision 2026-09-14): the media
// page now reads through the anon RPC below and holds NO service-role key.
// svcHeaders/signObject remain ONLY for /w/ and /m/takedown, which move to their
// own anon RPCs next (gy-s8z4z AC-I2 / AC-I5). Do not add a new caller.
//
// 🔴 THE SERVICE_ROLE KEY MUST NEVER REACH THE BROWSER. It is a full-database
// credential; a leak is rotate-everything, not fix-forward. It is read from the
// environment binding and used only in fetches originating in this Worker. No
// value derived from it is ever interpolated into the HTML.
export const SUPABASE_DEFAULT_URL = "https://kpvhnbemumjmgpmmgfjp.supabase.co";

// Overridable ONLY so the end-to-end journey can point at a local stand-in and
// still exercise the real Worker, the real HTML and a real browser. Without this
// the e2e would have to stub out the very code it exists to prove, which is the
// anti-goal: a test that passes without the feature working. Production sets no
// SUPABASE_URL and gets the constant above.
export const supabaseUrl = (env) => (env && env.SUPABASE_URL) || SUPABASE_DEFAULT_URL;

// ============================================================================
// gy-gcr22 / gy-s8z4z — THE /m/ READ PATH WITHOUT A SERVICE-ROLE KEY.
//
// Founder decision 2026-09-14: no full-database credential on Cloudflare Pages,
// now or as a stopgap. /m/ reads through ONE anon-callable SECURITY DEFINER RPC
// that selects FROM exercise_media_for_app (the app's view), so the page and the
// app share one definition of "available and attribution-complete".
//
// NO SIGNING. Available objects live in the PUBLIC exercise-media bucket and are
// served by their public URL everywhere; a takedown MOVES the objects to a
// private quarantine bucket (gy-h8a7o.1). Suppression is therefore enforced at
// the object layer, not by a short-lived URL.
//
// The anon key below is PUBLIC by design (the same key the app ships and
// functions/api/waitlist.js inlines). It grants only what anon's grants allow:
// EXECUTE on the narrow RPCs, nothing on the tables.
// ============================================================================
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwdmhuYmVtdW1qbWdwbW1nZmpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDMwNjUsImV4cCI6MjA4ODkxOTA2NX0.eQukPgVNv28Anq_hbe_SswQYfAuBdC_qb0bEpJrfskw";

// The RPC name is ONE constant so coach's final name is a one-line change.
export const MEDIA_PAGE_RPC = "media_page";

export const anonHeaders = () => ({
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
});

export const mediaBucket = (env) => (env && env.MEDIA_BUCKET) || "exercise-media";

// Public object URL for a stored path. Each segment is encoded so a path can
// never break out of the bucket prefix or smuggle a query string.
export const publicObjectUrl = (env, objectPath) =>
  `${supabaseUrl(env)}/storage/v1/object/public/${mediaBucket(env)}/` +
  String(objectPath).split("/").map(encodeURIComponent).join("/");

/**
 * Resolve one media id through the anon RPC.
 * Returns { kind: "ok", m } | { kind: "not_found" } | { kind: "withdrawn" }
 *       | { kind: "unavailable" } | { kind: "error" }.
 *
 * 🔴 "error" is NEVER collapsed into "not_found". A page that cannot reach the
 * database says "cannot be shown right now", not "that link does not point to a
 * video we have" -- the second is a false statement to a trainer holding a link.
 */
export async function fetchMediaPage(env, id) {
  let res;
  try {
    res = await fetch(`${supabaseUrl(env)}/rest/v1/rpc/${MEDIA_PAGE_RPC}`, {
      method: "POST",
      headers: anonHeaders(),
      body: JSON.stringify({ p_media_id: id }),
    });
  } catch {
    return { kind: "error" };
  }
  if (!res.ok) return { kind: "error" };
  const rows = await res.json().catch(() => null);
  if (!Array.isArray(rows)) return { kind: "error" };
  if (rows.length === 0) return { kind: "not_found" };
  const m = rows[0];
  if (m.state === "ok") return { kind: "ok", m };
  if (m.state === "withdrawn") return { kind: "withdrawn" };
  // Any other or unknown state is treated as unavailable: an RPC that grows a
  // new state must not accidentally render media on this page.
  return { kind: "unavailable" };
}

// Only these columns ever leave the database for the public page. A whitelist
// rather than `select=*` so that a column added later -- an operator note, an
// internal cost field -- is not silently published by a page nobody re-reviewed.
export const MEDIA_FIELDS = [
  "id", "source", "asset_kind", "availability",
  "author", "source_url", "licence_id", "licence_name", "licence_url",
  "object_path", "is_derivative", "modification_note",
].join(",");

export const svcHeaders = (key) => ({
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
});

// HTML-escape EVERYTHING that came from outside.
//
// This is not boilerplate here. Attribution is rendered from fields we harvested
// from a third party -- author names, licence names, modification notes are
// wger's strings, not ours. "Render attribution directly from stored provenance"
// means we are, by design, putting someone else's text into our page. An author
// field containing markup would otherwise be script execution on our own domain.
export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// FAIL-CLOSED, AND IT IS A RENDERING RULE, NOT ONLY A DATA RULE.
//
// The bead: "missing provenance means the asset is not published". Designer made
// the consequence explicit -- if a required attribution field is absent the MEDIA
// does not render. Not the media with attribution omitted, and not attribution
// with a placeholder.
//
// The database already refuses an unattributable wger row (CHECK constraints on
// author/licence_url/source_url), so in practice this should never fire. It is
// here anyway because "should never happen" is not a rendering strategy, and
// because the DB cannot speak for a row reached through some future path. If the
// two disagree, the page must be the stricter one.
export function attributionIsComplete(m) {
  if (m.source === "wger") {
    const required = [m.author, m.source_url, m.licence_name, m.licence_url];
    if (required.some((v) => !v || !String(v).trim())) return false;
    // "Indicate modifications" is a CC-BY-SA duty, so a derivative with nothing
    // to say about what changed is not publishable either.
    if (m.is_derivative && !String(m.modification_note ?? "").trim()) return false;
    return true;
  }
  // FEDB stills are Unlicense/public domain: no attribution duty, nothing to be
  // missing. They are never given wger attribution (AC2).
  return m.source === "fedb";
}

// A short TTL is a deliberate trade, not a default.
//
// The signed URL is the one artefact that outlives our suppression check: once
// issued, it serves bytes until it expires no matter what the database says. So
// the TTL IS the worst-case suppression lag for an already-loaded page, and it
// is why this is 120s rather than an hour.
//
// We hand out a signed URL rather than proxying the bytes through this Worker on
// purpose: proxying would put every megabyte of video through Cloudflare as well
// as Supabase, doubling egress on a lane whose cost question (gy-a2xps.12) is
// still open and unanswered.
export const SIGNED_URL_TTL_SECONDS = 120;

export async function signObject(env, objectPath) {
  const bucket = env.MEDIA_BUCKET || "exercise-media";
  const base = supabaseUrl(env);
  const res = await fetch(
    `${base}/storage/v1/object/sign/${bucket}/${objectPath}`,
    {
      method: "POST",
      headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY),
      body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS }),
    },
  );
  if (!res.ok) return null;
  const body = await res.json().catch(() => null);
  return body?.signedURL ? `${base}/storage/v1${body.signedURL}` : null;
}
