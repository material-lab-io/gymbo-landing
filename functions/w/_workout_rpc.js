// gy-t9mm8 / gy-emboo — the future anon-RPC contract for /w/, stubbed until
// coach ships the real RPC.
//
// WHY THIS FILE EXISTS SEPARATELY FROM _workout.js. gy-emboo (coach, not yet
// built — pm 09-17: "post-video-today", after gy-t8dzj and #1264) specifies an
// anon-callable SECURITY DEFINER RPC, twin of media_page (gy-a2xps.9), that
// replaces the service-role REST reads _workout.js does today. The founder has
// ruled SUPABASE_SERVICE_ROLE_KEY is NEVER bound on Cloudflare Pages production
// (gy-b0126, 09-14) — so the CURRENT _workout.js cannot ever run in production
// as written, regardless of gy-gcr22's env-var fix.
//
// pm's instruction (2026-09-28): start the /w/ page against this future
// contract now, on a STUB, so the rendering work and coach's RPC work run in
// parallel instead of serially blocking. The stub below reuses _workout.js's
// existing (already-correct) query logic, reshaped into the RPC's OUTPUT
// SHAPE, so that swapping the stub for a real `rpc/${WORKOUT_RPC}` POST is a
// change to ONE function body, not to any caller or to the page markup.
//
// 🔴 THE STUB'S OWN FAIL-CLOSED PROPERTY, AND IT MUST NOT BE WEAKENED: the
// stub activates ONLY when env.SUPABASE_SERVICE_ROLE_KEY is present. On real
// Cloudflare Pages production that binding will never exist (founder ruling),
// so production keeps today's exact behaviour — refuse — until this file's
// stub branch is deleted and replaced with the real RPC call. This file must
// never be the thing that puts a service-role key in front of a production
// request; it only reaches code that already required the key to run at all.
import { supabaseUrl, svcHeaders, publicObjectUrl, esc } from "../m/_shared.js";

// One constant so coach's final RPC name is a one-line change here, matching
// the MEDIA_PAGE_RPC pattern in ../m/_shared.js.
export const WORKOUT_RPC = "shared_workout_page";

const q = (env, path) =>
  fetch(`${supabaseUrl(env)}/rest/v1/${path}`, { headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY) })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);

/**
 * Resolve a share token to the workout it points at, through the shape
 * gy-emboo's RPC is specced to return.
 *
 * Returns one of:
 *   { ok: false, reason: "no_rpc" }                  — stub inactive (prod today)
 *   { ok: false, reason: "malformed"|"notfound"|"revoked"|"expired"|"upstream" }
 *   { ok: true, link: {...}, workout: {...} }
 *
 * The caller collapses every `ok:false` into ONE visitor-facing refusal
 * (functions/w/[token].js's refusal()) — the distinct reasons exist for logs
 * only, per the existing /w/ threat model (see resolveToken in _workout.js).
 */
export async function fetchSharedWorkout(env, token, { TOKEN_RE, blockBelongsToLink } = {}) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    // This is the honest "the real RPC does not exist yet, and this Pages
    // environment correctly has no service-role key" state. It is NOT an
    // error: it is what every real production request will read until
    // gy-emboo lands and this branch is deleted.
    return { ok: false, reason: "no_rpc" };
  }
  if (!TOKEN_RE.test(token)) return { ok: false, reason: "malformed" };

  const rows = await q(env, `workout_share_links?token=eq.${encodeURIComponent(token)}` +
    `&select=id,assignment_id,expires_at,revoked_at,completed_at`);
  if (!rows) return { ok: false, reason: "upstream" };
  const link = rows[0];
  if (!link) return { ok: false, reason: "notfound" };
  if (link.revoked_at) return { ok: false, reason: "revoked" };
  if (new Date(link.expires_at).getTime() <= Date.now()) return { ok: false, reason: "expired" };

  const asg = await q(env, `workout_assignments?id=eq.${link.assignment_id}&select=workout_id`);
  const workoutId = asg?.[0]?.workout_id;
  if (!workoutId) return { ok: false, reason: "upstream" };

  const [wo, blocks, done] = await Promise.all([
    q(env, `workouts?id=eq.${workoutId}&select=name,notes`),
    q(env, `workout_blocks?workout_id=eq.${workoutId}&is_deleted=eq.false&order=position.asc` +
           `&select=id,position,exercise_id,exercise_name,sets,reps,load,rest_seconds,notes`),
    q(env, `workout_share_block_completions?share_link_id=eq.${link.id}&select=block_id`),
  ]);
  if (!wo?.[0] || !blocks) return { ok: false, reason: "upstream" };

  // gy-emboo AC1 reads FROM exercise_media_for_app — NOT a hand-rolled
  // tie-break. That view already resolves "which clip wins" to the ratified
  // is_primary flag (gy-g1ihn superseded the old byte_size-ascending
  // provisional rule this stub used to duplicate) and already enforces
  // complete CC-BY-SA attribution in its WHERE clause (gy-5ksjw). Querying
  // the view directly means the stub and the eventual real RPC read the same
  // rows by construction — media_page's own RPC body (gy-s8z4z) does the
  // identical view-then-join-back-for-source shape this mirrors.
  const exIds = [...new Set(blocks.map((b) => b.exercise_id).filter(Boolean))];
  let viewRows = [];
  if (exIds.length) {
    viewRows = await q(env, `exercise_media_for_app?exercise_id=in.(${exIds.join(",")})` +
      `&select=exercise_id,media_id,video_object_path,poster_object_path,` +
      `author,author_url,work_title,source_url,licence_id,licence_name,licence_url,` +
      `modification_note`) || [];
  }
  // source + asset_kind are not on the view (see gy-s8z4z's media_page RPC,
  // which joins back to exercise_media for exactly these two columns).
  const mediaIds = viewRows.map((v) => v.media_id);
  let sourceRows = [];
  if (mediaIds.length) {
    sourceRows = await q(env, `exercise_media?id=in.(${mediaIds.join(",")})` +
      `&select=id,source,asset_kind,is_derivative`) || [];
  }
  const sourceById = new Map(sourceRows.map((s) => [s.id, s]));
  const byExercise = new Map(viewRows.map((v) => [v.exercise_id, { ...v, ...sourceById.get(v.media_id) }]));

  const workout = {
    name: wo[0].name,
    notes: wo[0].notes,
    completedAt: link.completed_at,
    blocks: blocks.map((b) => {
      const m = byExercise.get(b.exercise_id) || null;
      return { ...b, done: (done || []).some((d) => d.block_id === b.id), media: shapeMedia(env, m) };
    }),
  };
  return { ok: true, link, workout };
}

// gy-emboo AC1/AC7/AC8: the RPC returns video_object_path + poster_object_path
// + credit fields, PUBLIC URLs (no signing — the bucket is public with
// takedown-by-quarantine, gy-h8a7o.1), and a poster path for every playable
// exercise so /w/ can honour the no-autoplay ruling (AC2 amendment, AC8).
// No attributionIsComplete() check here: exercise_media_for_app's own WHERE
// clause already refuses an incomplete row (gy-5ksjw), so a row reaching this
// function has already passed that gate at the query layer, same as the real
// RPC will. A missing row for an exercise (block.media === null) is AC2's
// defined empty state, rendered by the caller.
function shapeMedia(env, m) {
  if (!m) return null;
  const isStill = m.asset_kind === "still";
  return {
    assetKind: m.asset_kind,
    videoObjectPath: isStill ? null : m.video_object_path,
    videoUrl: isStill ? null : publicObjectUrl(env, m.video_object_path),
    posterObjectPath: m.poster_object_path || null,
    posterUrl: m.poster_object_path ? publicObjectUrl(env, m.poster_object_path) : null,
    stillUrl: isStill ? publicObjectUrl(env, m.video_object_path) : null,
    credit: {
      source: m.source, author: m.author, authorUrl: m.author_url, workTitle: m.work_title,
      sourceUrl: m.source_url, licenceName: m.licence_name, licenceUrl: m.licence_url,
      isDerivative: m.is_derivative, modificationNote: m.modification_note,
    },
  };
}

// Same rendering rule as /m/'s attributionHtml (_workout.js): two sources, two
// treatments, no added-restriction copy anywhere near CC-BY-SA media. Takes
// the reshaped `credit` object shapeMedia() produces, not a raw DB row.
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
