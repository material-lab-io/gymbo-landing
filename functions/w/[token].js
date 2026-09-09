// gy-t9mm8 — GET/POST /w/<token>: the no-login client workout page.
//
// FOUNDER ASK, verbatim: "the trainer shares the workout itself on WhatsApp... a
// web app where the client can just use it, no login required, they check it,
// then reply to the trainer that it's done."
//
// THIS PAGE IS THE PRODUCT, NOT A SIDE SURFACE. A PDF cannot show an animated
// image -- the format has no animation support and its embedded-video mechanism
// is Flash-era and ignored by iOS Quick Look, Preview, Gmail and every browser.
// So the PDF is a static fallback and the movement lives here.
//
// 🔴 IT COLLECTS NOTHING ABOUT THE PERSON. No name, no email, no phone, no free
// text, no analytics identity. The token identifies THE WORKOUT, not the client.
// That is a founder-confirmed constraint and it is what keeps this page out of
// being a new consent surface -- so do not add a "who are you?" field, a
// comments box, or a feedback prompt without compliance ruling on it first.
//
// 🔴 AND IT SHOWS NOTHING ABOUT THE PERSON EITHER. The client's name is
// deliberately absent even though we could join to it: this is an
// unauthenticated URL that will be forwarded in group chats, and a name on it
// would leak a real person's training relationship to whoever the link reaches.
// The workout is not private in the same way a name is.
//
// NO JAVASCRIPT IS REQUIRED. Ticking an exercise is a form POST followed by a
// redirect (Post/Redirect/Get, so a refresh never re-submits). The client may be
// on an old phone, a locked-down browser, or a bad connection, and a
// tap-to-complete that silently depends on a JS bundle is the kind of thing that
// works on our machines and nowhere else.
import { esc } from "../m/_shared.js";
import { supabaseUrl, svcHeaders } from "../m/_shared.js";
import { resolveToken, loadWorkout, prescription, mediaFor, attributionHtml, TOKEN_RE,
         blockBelongsToLink } from "./_workout.js";

const CSS = `
:root{--bg:#fafaf7;--card:#eaeae5;--fg:#1a1a1a;--muted:#555555;--brand:#92400e;
  --line:#dcdcd9;--cta:#f59e0b;--cta-ink:#0a0a0a;--done:#15803d}
@media (prefers-color-scheme:dark){:root{--bg:#0a0a0a;--card:#141414;--fg:#f0f0eb;
  --muted:#b8b8b8;--brand:#fbbf24;--line:#2c2c2e;--cta:#fbbf24;--cta-ink:#0a0a0a;--done:#4ade80}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);
  font-family:'Open Sans',system-ui,sans-serif;font-size:14px;line-height:1.55}
.wrap{max-width:560px;margin:0 auto;padding:20px 16px 56px}
h1{font-family:Merriweather,Georgia,serif;font-size:20px;margin:0 0 4px}
.sub{color:var(--muted);font-size:12px;margin:0 0 16px}
.ex{background:var(--card);border-radius:20px;padding:14px;margin:0 0 14px}
.ex h2{font-size:16px;margin:0 0 2px;font-weight:700}
.rx{color:var(--muted);font-size:12px;margin:0 0 10px}
video,img.asset{width:100%;border-radius:12px;display:block;background:#000}
/* AC2's defined empty state. It has a border and a label so it can never be
   mistaken for a video that failed to load, which is the whole point. */
.nomedia{border:1px dashed var(--line);border-radius:12px;padding:20px;
  text-align:center;color:var(--muted);font-size:12px}
/* 11px is the smallest legitimate stop (no 13px token, no 600 weight in the
   SSOT). De-emphasis is the muted FOREGROUND token, never opacity. */
.attr{font-size:11px;color:var(--muted);margin-top:10px}
.attr a{color:var(--muted)}
button{width:100%;min-height:48px;margin-top:12px;border:0;border-radius:9999px;
  background:var(--cta);color:var(--cta-ink);font:inherit;font-weight:700;font-size:15px}
button.tick{background:transparent;color:var(--fg);border:1px solid var(--line)}
button.tick[data-done="1"]{color:var(--done);border-color:var(--done);font-weight:700}
.finish{margin-top:24px}
.done-banner{background:var(--card);border-radius:20px;padding:16px;text-align:center;
  color:var(--done);font-weight:700}
.state{background:var(--card);border-radius:20px;padding:24px;text-align:center}
.foot{margin-top:28px;font-size:11px;color:var(--muted);text-align:center}
/* The DPDP notice. Deliberately NOT 11px muted like .foot: this is a required
   disclosure that must be read before the first tap, and styling it like
   small print is how a notice becomes decoration. Card background, normal
   foreground, full contrast, above the first exercise. */
.notice{background:var(--card);border-radius:12px;padding:12px 14px;margin:0 0 16px;font-size:12px}
`;

const shell = (title, body, status = 200) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="robots" content="noindex,nofollow">
<style>${CSS}</style></head><body><div class="wrap">${body}</div></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );

// ONE refusal for every reason a token does not resolve.
//
// Deliberately identical for malformed, unknown, revoked and expired. Saying
// "this link has expired" tells a stranger who guessed a token that a real link
// once lived there; saying "no such link" to everyone tells them nothing. The
// distinction is kept in the logs, where it is useful, and out of the response,
// where it is an oracle.
const refusal = () =>
  shell("Link not available", `<div class="state">
<h1>This link is not available</h1>
<p class="sub">It may have expired or been replaced. Ask your trainer to send you a new one.</p>
</div>`, 404);

// A write we could not confirm must not be answered with the same cheerful
// redirect as one that worked. The client taps, the page reloads, the tick is
// not there, and the only honest thing we can say is that it did not save.
// Silence here is the shape of gy-t9mm8's own anti-goal: a no-op that looks
// like a success.
const notSaved = () =>
  shell("Not saved", `<div class="state">
<h1>That did not save</h1>
<p class="sub">Nothing was recorded. Please tap again — and if it keeps happening, tell your trainer.</p>
</div>`, 503);

export async function onRequestGet({ env, params }) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[w] SUPABASE_SERVICE_ROLE_KEY missing — refusing to serve");
    return refusal();
  }
  const r = await resolveToken(env, String(params.token || ""));
  if (!r.ok) {
    console.error("[w] token refused:", r.reason);
    return refusal();
  }
  const wo = await loadWorkout(env, r.link);
  if (!wo) return refusal();

  const parts = [];
  for (const b of wo.blocks) {
    const m = await mediaFor(env, b);
    const name = esc(b.exercise_name || "Exercise");
    const rx = prescription(b);

    // autoplay + muted + loop + playsinline is what makes a short MP4 behave the
    // way the founder pictured a GIF behaving — at roughly a tenth the bytes.
    // playsinline is load-bearing on iOS: without it Safari takes the video
    // fullscreen the moment it plays.
    const asset =
      m.kind === "video"
        ? `<video src="${esc(m.url)}" autoplay muted loop playsinline preload="metadata"></video>`
        : m.kind === "still"
          ? `<img class="asset" alt="" src="${esc(m.url)}">`
          : `<div class="nomedia">${esc(m.why)}</div>`;

    parts.push(`<section class="ex">
<h2>${name}</h2>
${rx ? `<p class="rx">${esc(rx)}</p>` : ""}
${asset}
${m.media ? attributionHtml(m.media) : ""}
<form method="POST">
<input type="hidden" name="block" value="${esc(b.id)}">
<button class="tick" type="submit" data-done="${b.done ? 1 : 0}">
${b.done ? "✓ Done" : "Mark done"}</button>
</form>
</section>`);
  }

  const finish = wo.completedAt
    ? `<div class="done-banner">Workout complete — your trainer can see it. 🎉</div>`
    : `<form method="POST" class="finish"><input type="hidden" name="finish" value="1">
<button type="submit">I finished this workout</button></form>`;

  // 🔴 REQUIRED BEFORE THE FIRST TAP — compliance's REVISED ruling, gy-rt68e.
  //
  // Their first ruling said no notice was needed; it rested on the completion
  // being unattributable to a person, which is FALSE — a completion is
  // attributable via workout_assignments.client_id, and it has to be, because
  // the trainer seeing who finished is the feature. This is the first time a
  // client is the DIRECT SOURCE of a write to us, and that moment is exactly
  // what DPDP's "notice at or before collection" is aimed at, independent of
  // how little the write contains.
  //
  // The copy is VERBATIM as ruled and the wording is load-bearing: it says what
  // the tap records and why, and it deliberately avoids the word "anonymous",
  // which would be false. It renders ABOVE the first exercise — a notice after
  // the control it describes is not a notice.
  const notice = `<p class="notice">Tapping records that you finished each exercise so your trainer can see your progress. We don't collect your name, email, or phone number on this page.</p>`;

  return shell(wo.name || "Your workout", `<h1>${esc(wo.name || "Your workout")}</h1>
<p class="sub">Shared by your trainer. Nothing to sign in to.</p>
${wo.notes ? `<p class="sub">${esc(wo.notes)}</p>` : ""}
${notice}
${parts.join("")}
${finish}
<p class="foot">Powered by Gymbo</p>`);
}

export async function onRequestPost(context) {
  const { env, request, params } = context;
  const token = String(params.token || "");
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return refusal();

  const r = await resolveToken(env, token);
  // A write against an expired or revoked link is refused exactly like a read.
  // Otherwise the link stops SHOWING the workout but keeps ACCEPTING data, which
  // is the worst of both.
  if (!r.ok) return refusal();

  const form = await request.formData().catch(() => null);
  if (!form) return refusal();

  if (form.get("finish")) {
    const res = await fetch(`${supabaseUrl(env)}/rest/v1/workout_share_links?id=eq.${r.link.id}`, {
      method: "PATCH",
      headers: { ...svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY), Prefer: "return=minimal" },
      body: JSON.stringify({ completed_at: new Date().toISOString() }),
    }).catch(() => null);
    if (!res || !res.ok) {
      console.error("[w] finish write failed:", res ? res.status : "network");
      return notSaved();
    }
  } else {
    const block = String(form.get("block") || "");
    if (!/^[0-9a-f-]{36}$/i.test(block)) return refusal();

    // 🔴 gy-nm6ii AC3. A token is scoped to ONE workout, so a block that is not
    // in that workout is refused here and, authoritatively, by the database.
    if (!(await blockBelongsToLink(env, r.link, block))) {
      console.error("[w] block outside this link's workout, refused:", block);
      return refusal();
    }

    const res = await fetch(`${supabaseUrl(env)}/rest/v1/workout_share_block_completions`, {
      method: "POST",
      headers: { ...svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY), Prefer: "return=minimal" },
      body: JSON.stringify({ share_link_id: r.link.id, block_id: block }),
    }).catch(() => null);

    // A repeat tap is the same event, not a second one — the unique index says
    // so and a 409 here is success. The client is on a phone; double-taps are
    // guaranteed, and an error toast for one would be our bug, not theirs.
    // Anything else IS a failure and is no longer swallowed: the old
    // `.catch(() => {})` redirected to a page where the tick had not happened
    // and nothing anywhere said so.
    if (!res || (!res.ok && res.status !== 409)) {
      console.error("[w] tick write failed:", res ? res.status : "network");
      return notSaved();
    }
  }

  // Post/Redirect/Get: a refresh after ticking must not re-submit.
  return new Response(null, { status: 303, headers: { Location: `/w/${encodeURIComponent(token)}` } });
}
