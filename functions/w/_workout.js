import { esc } from "../m/_shared.js";

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

// gy-d012n: the link card WhatsApp and iMessage draw from this page's Open Graph tags. Without them a share shows a bare URL.
// The workout NAME is public here already (it is the h1); the trainer's and the client's names are NOT on this page, so they are NOT in the card
// either (an unauthenticated URL forwarded in group chats). The image is the existing brand card the landing page uses, at its absolute URL
// (crawlers do not resolve relative ones). No og:url: it would copy the secret token into a second place.
const OG_IMAGE = "https://getgymbo.com/og-image.png";
export const ogTags = (name) => {
  const title = name || "Your workout";
  const desc = "A workout from your trainer. Open it, tick each exercise as you go, and tell them when you are done. No sign-in.";
  return `<meta property="og:type" content="website"><meta property="og:site_name" content="Gymbo">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${OG_IMAGE}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${OG_IMAGE}">`;
};
