// gy-t9mm8 — data access + rendering for the no-login client workout page.
//
// Split out of the route handler so the rules that matter (fail-closed
// attribution, the defined empty state, what is and is not shown about a person)
// can be tested directly without standing up a Worker.
import { supabaseUrl, svcHeaders, esc, attributionIsComplete, signObject } from "../m/_shared.js";

export const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

const q = (env, path) =>
  fetch(`${supabaseUrl(env)}/rest/v1/${path}`, { headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY) })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);

// Resolve a token to a usable link, or say WHY not.
//
// The three refusal reasons are kept distinct internally because they are
// operationally different -- but they are deliberately COLLAPSED into one
// message for the visitor (see refusalCopy). Telling a stranger "this link
// expired" rather than "no such link" confirms that a link once existed, which
// is a small oracle on a URL anyone can guess at.
export async function resolveToken(env, token) {
  if (!TOKEN_RE.test(token)) return { ok: false, reason: "malformed" };
  const rows = await q(env, `workout_share_links?token=eq.${encodeURIComponent(token)}` +
    `&select=id,assignment_id,expires_at,revoked_at,completed_at`);
  if (!rows) return { ok: false, reason: "upstream" };
  const link = rows[0];
  if (!link) return { ok: false, reason: "notfound" };
  if (link.revoked_at) return { ok: false, reason: "revoked" };
  if (new Date(link.expires_at).getTime() <= Date.now()) return { ok: false, reason: "expired" };
  return { ok: true, link };
}

export async function loadWorkout(env, link) {
  const asg = await q(env, `workout_assignments?id=eq.${link.assignment_id}&select=workout_id`);
  const workoutId = asg?.[0]?.workout_id;
  if (!workoutId) return null;

  const [wo, blocks, done] = await Promise.all([
    q(env, `workouts?id=eq.${workoutId}&select=name,notes`),
    q(env, `workout_blocks?workout_id=eq.${workoutId}&is_deleted=eq.false&order=position.asc` +
           `&select=id,position,exercise_id,exercise_name,sets,reps,load,rest_seconds,notes`),
    q(env, `workout_share_block_completions?share_link_id=eq.${link.id}&select=block_id`),
  ]);
  if (!wo?.[0] || !blocks) return null;

  // One media row per exercise, only where we can actually serve bytes.
  const ids = [...new Set(blocks.map((b) => b.exercise_id).filter(Boolean))];
  let media = [];
  if (ids.length) {
    media = await q(env, `exercise_media?exercise_id=in.(${ids.join(",")})` +
      `&availability=eq.available&select=id,exercise_id,source,asset_kind,availability,author,` +
      `source_url,licence_id,licence_name,licence_url,object_path,is_derivative,modification_note`) || [];
  }
  const byExercise = new Map();
  for (const m of media) {
    // Prefer motion over a still: the whole reason this page exists is that a
    // PDF cannot show movement.
    const cur = byExercise.get(m.exercise_id);
    if (!cur || (cur.asset_kind === "still" && m.asset_kind !== "still")) byExercise.set(m.exercise_id, m);
  }

  return {
    name: wo[0].name,
    notes: wo[0].notes,
    completedAt: link.completed_at,
    blocks: blocks.map((b) => ({
      ...b,
      media: byExercise.get(b.exercise_id) || null,
      done: (done || []).some((d) => d.block_id === b.id),
    })),
  };
}

// The prescription line, built only from fields that are actually present.
// "3 × 10 @ 40kg" reads naturally; "3 × null" does not, and a client seeing
// "null" concludes the app is broken.
export function prescription(b) {
  const bits = [];
  if (b.sets && b.reps) bits.push(`${b.sets} × ${b.reps}`);
  else if (b.sets) bits.push(`${b.sets} sets`);
  else if (b.reps) bits.push(`${b.reps} reps`);
  if (b.load) bits.push(`@ ${b.load}`);
  if (b.rest_seconds) bits.push(`· ${b.rest_seconds}s rest`);
  return bits.join(" ");
}

// AC2 + AC3 in one place, because they produce the SAME visible outcome and
// differ only in cause.
//
// AC2: no media row, or bytes we cannot sign -> a DEFINED empty state. Never a
// broken <video> element and never a silent blank rectangle: the client must be
// able to tell "there is no video for this one" from "the page is broken".
//
// AC3: media exists but its provenance is incomplete -> WE REFUSE TO SHOW IT.
// That is the licence gate. Showing a CC-BY-SA clip without its credit is a
// licence breach, and "it is only a client link" is not a defence. Fail-closed
// is the easy path here by construction: every route that is not a complete,
// signed, attributable asset lands on the same empty state.
export async function mediaFor(env, block) {
  const m = block.media;
  if (!m) return { kind: "none", why: "No video for this exercise." };
  if (!attributionIsComplete(m)) {
    console.error("[w] incomplete provenance, refusing to publish", m.id);
    return { kind: "none", why: "No video for this exercise." };
  }
  const url = m.object_path ? await signObject(env, m.object_path) : null;
  if (!url) return { kind: "none", why: "No video for this exercise." };
  return { kind: m.asset_kind === "still" ? "still" : "video", url, media: m };
}

// Attribution markup, rendered FROM FIELDS. Identical rules to the /m/ page:
// two sources, two treatments, and no added-restriction copy anywhere near
// CC-BY-SA media.
export function attributionHtml(m) {
  if (m.source === "wger") {
    return `<div class="attr">Video by ${esc(m.author)}, via ` +
      `<a href="${esc(m.source_url)}" rel="noopener nofollow">wger</a> · ` +
      `<a href="${esc(m.licence_url)}" rel="noopener nofollow">${esc(m.licence_name)}</a>` +
      (m.is_derivative ? ` · Modified by Gymbo: ${esc(m.modification_note)}` : "") +
      `</div>`;
  }
  return `<div class="attr">Public domain · ${esc(m.licence_name)}</div>`;
}
