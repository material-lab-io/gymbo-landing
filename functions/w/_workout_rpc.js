// gy-t9mm8 / gy-emboo — the REAL anon-RPC read for /w/, replacing the stub.
//
// gy-emboo shipped `shared_workout_page(p_token)` (Gymbo-v1 #1521, merged
// 358624de1e4d, prod read-back posted 2026-09-28 22:16Z on gy-emboo): an
// anon-callable SECURITY DEFINER function, the /w/ twin of media_page
// (gy-a2xps.9 / gy-s8z4z). This file calls it with the PUBLIC anon key —
// there is NO service-role key anywhere in this read path, and none is ever
// fetched, imported or referenced here. That is what makes /w/ finally able
// to run on real Cloudflare Pages production: the founder's ruling
// (gy-b0126, 09-14) is that SUPABASE_SERVICE_ROLE_KEY is NEVER bound there.
//
// SHAPE OF THE RPC: one row per live workout block, in position order, with
// the workout-level columns (name/notes/completed_at) repeated on every row.
// A link to a workout with ZERO blocks returns exactly one row whose
// block_id is NULL — that is an empty workout, not a refusal, and is handled
// below by filtering block-shaped rows rather than treating "one row" as
// "one block".
//
// gy-16f0e (nondeterministic clip choice) and gy-wx6ja (master vs rendition)
// are BOTH closed by construction here, not by anything this file does: the
// RPC's own media columns come from exercise_media_for_app, which resolves
// "which clip wins" to the ratified is_primary flag (gy-g1ihn) and only ever
// carries a rendition + poster path, never the master (gy-emboo AC7). This
// file cannot regress either — there is no query, no ORDER BY and no object
// path here to get wrong.
//
// gy-pgxiv (an unlinked block, exercise_id NULL): the RPC LEFT JOINs media
// on b.exercise_id, so an unlinked block's media columns (asset_kind etc.)
// are simply NULL on that row. shapeMedia() below returns null for exactly
// that case, which the page already renders as a plain named exercise with
// no player and no error (AC2's defined empty state) — see
// tests/client-workout.test.mjs's dedicated fixture for this.
import { supabaseUrl, anonHeaders, publicObjectUrl, esc } from "../m/_shared.js";

// One constant so a future RPC rename is a one-line change, matching the
// MEDIA_PAGE_RPC / TAKEDOWN_RPC pattern already used by /m/.
export const WORKOUT_RPC = "shared_workout_page";

/**
 * Resolve a share token through the REAL gy-emboo RPC.
 *
 * Returns one of:
 *   { ok: false, reason: "malformed" }   — failed the client-side shape check,
 *                                          never reached the database
 *   { ok: false, reason: "upstream" }    — the RPC could not be reached or
 *                                          answered something we cannot parse
 *   { ok: false, reason: "notfound" }    — zero rows: unknown, revoked,
 *                                          expired or orphaned (the RPC
 *                                          collapses all four, by design)
 *   { ok: true, workout: {...} }
 *
 * The caller collapses every ok:false into ONE visitor-facing refusal
 * (functions/w/[token].js's refusal()) — the distinct reasons exist for logs
 * only, per this page's existing threat model (see resolveToken in
 * _workout.js, kept for the write path).
 */
export async function fetchSharedWorkout(env, token, { TOKEN_RE } = {}) {
  if (TOKEN_RE && !TOKEN_RE.test(token)) return { ok: false, reason: "malformed" };

  let res;
  try {
    res = await fetch(`${supabaseUrl(env)}/rest/v1/rpc/${WORKOUT_RPC}`, {
      method: "POST",
      headers: anonHeaders(),
      body: JSON.stringify({ p_token: token }),
    });
  } catch (e) {
    console.error("[w] rpc unreachable:", String(e));
    return { ok: false, reason: "upstream" };
  }
  if (!res.ok) {
    console.error("[w] rpc failed:", res.status, await res.text().catch(() => ""));
    return { ok: false, reason: "upstream" };
  }
  const rows = await res.json().catch(() => null);
  if (!Array.isArray(rows)) return { ok: false, reason: "upstream" };
  if (rows.length === 0) return { ok: false, reason: "notfound" };

  const [first] = rows;
  const blocks = rows
    // A workout with no blocks returns ONE row with block_id NULL — that row
    // describes the workout, not a block, and must not become a fake "Exercise".
    .filter((r) => r.block_id)
    .map((r) => ({
      id: r.block_id,
      exercise_name: r.exercise_name,
      sets: r.sets,
      reps: r.reps,
      load: r.load,
      duration_seconds: r.duration_seconds,
      rest_seconds: r.rest_seconds,
      done: !!r.block_done,
      media: shapeMedia(env, r),
    }));

  return {
    ok: true,
    workout: {
      name: first.workout_name,
      notes: first.workout_notes,
      completedAt: first.completed_at,
      blocks,
    },
  };
}

// gy-emboo AC1/AC7/AC8: video_object_path + poster_object_path are the
// RENDITION + POSTER, PUBLIC URLs (no signing — gy-h8a7o.1's public-bucket-
// plus-quarantine model), and a poster path for every playable exercise so
// /w/ can honour the no-autoplay ruling (AC2 amendment, AC8).
//
// No attributionIsComplete() check here: exercise_media_for_app's own WHERE
// clause already refuses an incomplete, non-primary or unavailable row
// (gy-5ksjw/gy-g1ihn), so a row whose asset_kind is non-null has already
// passed that gate at the query layer. asset_kind NULL is the one shape that
// means "nothing to show" — an unlinked block (gy-pgxiv) and "no qualifying
// media" (AC2/AC3) are the SAME case at this layer, by design: the page
// cannot show what the view will not name.
function shapeMedia(env, r) {
  if (!r.asset_kind) return null;
  const isStill = r.asset_kind === "still";
  return {
    assetKind: r.asset_kind,
    videoObjectPath: isStill ? null : r.video_object_path,
    videoUrl: isStill ? null : publicObjectUrl(env, r.video_object_path),
    posterObjectPath: r.poster_object_path || null,
    posterUrl: r.poster_object_path ? publicObjectUrl(env, r.poster_object_path) : null,
    stillUrl: isStill ? publicObjectUrl(env, r.video_object_path) : null,
    credit: {
      source: r.source, author: r.author, authorUrl: r.author_url, workTitle: r.work_title,
      sourceUrl: r.source_url, licenceName: r.licence_name, licenceUrl: r.licence_url,
      isDerivative: r.is_derivative, modificationNote: r.modification_note,
    },
  };
}

// Same rendering rule as /m/'s attributionHtml (_workout.js): two sources,
// two treatments, no added-restriction copy anywhere near CC-BY-SA media.
// Takes the reshaped `credit` object shapeMedia() produces, not a raw row.
export function creditHtml(credit) {
  if (credit.source === "wger") {
    return `<div class="attr">Video by ${esc(credit.author)}, via ` +
      `<a href="${esc(credit.sourceUrl)}" rel="noopener nofollow">wger</a> · ` +
      `<a href="${esc(credit.licenceUrl)}" rel="noopener nofollow">${esc(credit.licenceName)}</a>` +
      (credit.isDerivative ? ` · Modified by Gymbo: ${esc(credit.modificationNote)}` : "") +
      `</div>`;
  }
  return `<div class="attr">Public domain · ${esc(credit.licenceName)}</div>`;
}
