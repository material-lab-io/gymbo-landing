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
