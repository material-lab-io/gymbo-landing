// gy-b0126.1 — the REAL anon-RPC write for /w/'s tick and finish actions.
//
// coach shipped set_shared_workout_block_done(p_token, p_block_id, p_done)
// and finish_shared_workout(p_token) (Gymbo-v1 #1525, gy-b0126.1): the write
// twin of gy-emboo's shared_workout_page, called with the PUBLIC anon key.
// There is NO service-role key anywhere in this write path, same as the
// gy-emboo read swap — this is what finally makes gy-b0126 AC1 ("ticks it
// off, and the trainer sees it") reachable on real Cloudflare Pages
// production, where the founder has ruled the key is never bound.
//
// TWO DIFFERENT OUTCOMES, NOT ONE, even though the RPC itself returns a
// single boolean. The migration's own doc comment says "false = refused, for
// EVERY reason alike" (bad token, wrong workout, deleted row) — that is the
// SAME family as shared_workout_page's uniform zero-rows refusal, and the
// caller maps it to the page's existing refusal() (404, "this link is not
// available"). That is a DIFFERENT thing from "we could not reach the RPC at
// all" (network failure, a non-2xx HTTP status, an unparseable body) — an
// honest transient failure where "please tap again" (notSaved(), 503) is the
// right advice and "this link isn't valid" would be actively wrong. Telling
// them apart here is what keeps a valid client from being told their real
// link is broken just because one request hiccuped.
import { supabaseUrl, anonHeaders } from "../m/_shared.js";

export const TICK_RPC = "set_shared_workout_block_done";
export const FINISH_RPC = "finish_shared_workout";

/**
 * @returns {Promise<{ok: true} | {ok: false, reason: "refused"|"upstream"}>}
 */
async function callBoolRpc(env, name, args) {
  let res;
  try {
    res = await fetch(`${supabaseUrl(env)}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: anonHeaders(),
      body: JSON.stringify(args),
    });
  } catch (e) {
    console.error(`[w] ${name} unreachable:`, String(e));
    return { ok: false, reason: "upstream" };
  }
  if (!res.ok) {
    console.error(`[w] ${name} failed:`, res.status, await res.text().catch(() => ""));
    return { ok: false, reason: "upstream" };
  }
  const body = await res.json().catch(() => undefined);
  if (body === true) return { ok: true };
  if (body === false) return { ok: false, reason: "refused" };
  // Neither true nor false is not a shape this RPC is specced to return —
  // treat it the same as unreachable rather than guess which it meant.
  console.error(`[w] ${name} returned an unexpected body`, body);
  return { ok: false, reason: "upstream" };
}

/** Tick (done=true) or untick (done=false) one block. */
export function setBlockDone(env, token, blockId, done) {
  return callBoolRpc(env, TICK_RPC, { p_token: token, p_block_id: blockId, p_done: done });
}

/** Mark the shared workout finished. */
export function finishWorkout(env, token) {
  return callBoolRpc(env, FINISH_RPC, { p_token: token });
}
