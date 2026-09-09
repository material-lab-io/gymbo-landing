// gy-a2xps.9 — GET /m/<exercise_media.id>: the public media page.
//
// WHAT THIS PAGE IS. When a trainer sends a workout PDF, the exercise video link
// in that PDF points here. Gymbo is TRAINER-FACING -- there is no client login
// and there never will be -- so this page is the ONLY surface on which a trainee
// ever sees anything we made. It must work with no account, no app, and no
// JavaScript beyond what the video element needs.
//
// AND IT IS THE COMPLIANCE SURFACE. CC-BY-SA 4.0 attribution for wger motion is
// a LICENCE OBLIGATION discharged here, and the takedown route below is the
// mitigation the founder accepted in place of model releases. Both are rendered
// from stored provenance, never hand-authored.
//
// 🔴 THE LINK IS PERMANENT AND WE CANNOT RECALL IT. A PDF on a trainee's phone
// cannot be rewritten. Every id served here must therefore be stable forever,
// which is why the importer UPSERTs on the natural key instead of
// delete-then-insert (ratified by pm). Treat this URL shape as an external API.
import { SUPABASE_URL, MEDIA_FIELDS, svcHeaders, esc, attributionIsComplete, signObject } from "./_shared.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Design tokens, values copied from src/forge/forge.css.
//
// This is a SECOND COPY and I am not pretending otherwise -- a Pages Function
// cannot import the app's hashed CSS bundle. Dual source is a real cost, so it
// is a CHECKED copy: tests/forge-token-drift.test.mjs reads forge.css and fails
// if any value here stops matching. Drift becomes a red test rather than a page
// that slowly stops looking like Gymbo.
const CSS = `
:root{
  --bg:#fafaf7; --card:#eaeae5; --fg:#1a1a1a; --muted:#555555; --brand:#92400e;
  --alert:#b80f34; --line:#dcdcd9;
}
@media (prefers-color-scheme:dark){:root{
  --bg:#0a0a0a; --card:#141414; --fg:#f0f0eb; --muted:#b8b8b8; --brand:#fbbf24;
  --alert:#ff6961; --line:#2c2c2e;
}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);
  font-family:'Open Sans',system-ui,sans-serif;font-size:14px;line-height:1.55}
.wrap{max-width:720px;margin:0 auto;padding:24px 16px 48px}
h1{font-family:Merriweather,Georgia,serif;font-size:20px;margin:0 0 4px;font-weight:700}
.card{background:var(--card);border-radius:20px;padding:16px;margin:16px 0}
video,img.asset{width:100%;border-radius:12px;display:block;background:#000}
/* ATTRIBUTION. 11px is the smallest legitimate stop -- there is no 13px token
   and 600 is absent from the SSOT. De-emphasis is the MUTED FOREGROUND token,
   never opacity on the body token: opacity is what produced the 2.05:1 and
   1.58:1 failures on this rig. Measured 6.18:1 light / 9.29:1 dark. */
.attr{font-size:11px;color:var(--muted);margin-top:16px;padding-top:12px;
  border-top:1px solid var(--line)}
.attr a{color:var(--muted)}
.attr .lic{display:inline-block;margin-top:6px;font-weight:500}
.src{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.04em;
  text-transform:uppercase;color:var(--brand);margin-bottom:8px}
.state{border:1px solid var(--line);border-radius:12px;padding:16px;
  color:var(--fg);background:var(--card)}
.state h2{font-size:16px;margin:0 0 8px}
.state .why{color:var(--muted);font-size:12px}
.foot{margin-top:32px;font-size:12px;color:var(--muted)}
.foot a{color:var(--muted)}
`;

const page = (title, body, status = 200) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — Gymbo</title>
<meta name="robots" content="noindex">
<style>${CSS}</style></head><body><div class="wrap">${body}
<p class="foot">Shared from <a href="https://getgymbo.com/">Gymbo</a>. If you appear in
this footage or hold rights in it, you can
<a href="/m/takedown">request its removal</a>.</p>
</div></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );

// The takedown route lives on THIS page, not behind a signup.
//
// The people it exists for -- a performer who found the clip through a PDF -- are
// not Gymbo users and will never create an account to complain about their own
// image. A route reachable only after signing up is not discoverable to them,
// so the link sits in the footer of every media page including the unavailable
// ones. Especially the unavailable ones: that is where someone checking whether
// their earlier request took effect will land.

// An honest unavailable state, never a blank frame and never a bare 404.
//
// The bead is explicit that a 404 alone is not proof of disposition. A trainee
// hitting a suppressed clip must be told the asset is unavailable, so the
// trainer who sent the PDF does not conclude the app is broken -- and so a
// rightsholder can see their request took effect.
const unavailable = (why) =>
  page("Video unavailable", `<div class="state"><h2>This video is not available</h2>
<p class="why">${esc(why)}</p></div>`, 404);

export async function onRequestGet(context) {
  const { env, params } = context;
  const id = String(params.id || "");

  // Reject anything that is not a uuid before it reaches PostgREST, so a
  // malformed id is a cheap 404 rather than a filter we hand upstream.
  if (!UUID_RE.test(id)) return unavailable("That link does not point to a video we have.");

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    // Fail CLOSED on misconfiguration. A page that renders media without being
    // able to check suppression is worse than a page that is down.
    console.error("[media] SUPABASE_SERVICE_ROLE_KEY missing — refusing to serve");
    return unavailable("This video cannot be shown right now.");
  }

  let m;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/exercise_media?id=eq.${id}&select=${MEDIA_FIELDS}`,
      { headers: svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY) },
    );
    if (!res.ok) return unavailable("This video cannot be shown right now.");
    m = (await res.json())[0];
  } catch {
    return unavailable("This video cannot be shown right now.");
  }

  if (!m) return unavailable("That link does not point to a video we have.");

  // SUPPRESSION IS CHECKED ON EVERY REQUEST, and it is the same column the app
  // reads, so one flip takes the asset down on both surfaces at once. A takedown
  // that only suppressed in-app while this page kept serving would not be a
  // takedown at all.
  if (m.availability !== "available") {
    return unavailable(
      m.availability === "withdrawn"
        ? "This video has been withdrawn following a removal request."
        : "This video is not currently available.",
    );
  }

  // FAIL-CLOSED ON PROVENANCE. Missing attribution means the MEDIA does not
  // render -- not the media with the credit quietly dropped.
  if (!attributionIsComplete(m)) {
    console.error("[media] incomplete provenance, refusing to publish", m.id);
    return unavailable("This video is not currently available.");
  }

  const signed = m.object_path ? await signObject(env, m.object_path) : null;
  if (!signed) return unavailable("This video cannot be shown right now.");

  const isVideo = m.asset_kind === "video" || m.asset_kind === "animation";
  const asset = isVideo
    ? `<video controls playsinline preload="metadata" src="${esc(signed)}"></video>`
    : `<img class="asset" alt="Exercise demonstration" src="${esc(signed)}">`;

  // TWO SOURCES, TWO TREATMENTS, VISIBLY DISTINCT (AC2). A public-domain FEDB
  // still and a CC-BY-SA wger clip must never imply one licence covers both, so
  // the licence block is built from this row's own fields and the source is
  // named on the face of it.
  //
  // NO ADDED RESTRICTIONS ANYWHERE ON THIS PAGE. CC-BY-SA forbids imposing
  // further reuse terms, so there is deliberately no "do not share" or "for
  // personal use" copy near this media -- that would be a licence breach
  // authored in the design layer.
  let attribution;
  if (m.source === "wger") {
    const author = esc(m.author);
    // author_url is deliberately NOT in MEDIA_FIELDS: the column does not exist
    // yet, and asking PostgREST for a missing column is an error, not an empty
    // value. Measured against the live wger API on 2026-09-09, license_author_url
    // is empty on 78 of 78 videos, so today every credit is plain text and this
    // branch is dormant. It is written now so that the day the column lands and
    // wger starts supplying the URI, crediting it is a select-list change and not
    // a re-harvest.
    const authorHtml = m.author_url
      ? `<a href="${esc(m.author_url)}" rel="noopener nofollow">${author}</a>`
      : author;
    attribution = `<div class="attr">
<span class="src">Creative Commons</span><br>
Video by ${authorHtml}, via
<a href="${esc(m.source_url)}" rel="noopener nofollow">wger</a>.
<span class="lic">Licensed under
<a href="${esc(m.licence_url)}" rel="noopener nofollow">${esc(m.licence_name)}</a>.</span>
${m.is_derivative ? `<br>Modified by Gymbo: ${esc(m.modification_note)}` : ""}
</div>`;
  } else {
    attribution = `<div class="attr">
<span class="src">Public domain</span><br>
Still image from the Free Exercise Database, released under
<a href="https://unlicense.org/" rel="noopener nofollow">${esc(m.licence_name)}</a>.
No attribution is required.
</div>`;
  }

  return page("Exercise video", `<h1>Exercise demonstration</h1>
<div class="card">${asset}${attribution}</div>`);
}
