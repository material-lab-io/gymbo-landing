// gy-t9mm8 — small shared pieces of the no-login client workout page that
// have nothing to do with a data-access path (so they didn't move when the
// read and write paths did): the token shape and the prescription line.
//
// 🔴 EVERYTHING ELSE THAT USED TO LIVE HERE IS GONE (gy-b0126.1). This file
// used to hold the service-role REST reads AND writes for /w/. The read half
// moved to _workout_rpc.js (gy-emboo's shared_workout_page anon RPC); the
// write half (resolveToken, blockBelongsToLink, loadWorkout) moved to
// _workout_write_rpc.js (gy-b0126.1's set_shared_workout_block_done /
// finish_shared_workout anon RPCs) and mostly stopped being needed at all —
// the RPCs do their own token resolution and scope checking server-side now.
// mediaFor/attributionHtml were the OLD signed-URL rendering path
// (functions/m/_shared.js's signObject); the RPC swap replaced them with
// _workout_rpc.js's shapeMedia/creditHtml, which read PUBLIC object URLs
// from exercise_media_for_app instead. Nothing in this repo calls the old
// functions any more; they were deleted rather than left as dead code.
export const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

// Mirrors BuilderBlock.summary in the shipped iOS app (Workout.swift:229-238).
// The workout codec stores a non-uniform timed ladder in reps (for example
// "45-60-45") while duration_seconds remains the duration discriminator.
export function prescription(b) {
  const bits = [];
  if (b.duration_seconds) {
    const perSetSeconds = String(b.reps || "").split("-");
    const hasCompletePerSetSeconds =
      perSetSeconds.length === Number(b.sets) && perSetSeconds.every((seconds) => /^\d+$/.test(seconds));
    return hasCompletePerSetSeconds
      ? perSetSeconds.map((seconds) => `${seconds}s`).join("-")
      : `${b.sets} × ${b.duration_seconds}s`;
  }
  if (b.sets && b.reps) bits.push(`${b.sets}×${b.reps}`);
  else if (b.sets) bits.push(`${b.sets} sets`);
  else if (b.reps) bits.push(`${b.reps} reps`);
  if (b.load) bits.push(`@ ${b.load}`);
  if (b.rest_seconds) bits.push(`· ${b.rest_seconds}s rest`);
  return bits.join(" ");
}
