// gy-a2xps.9 — GET/POST /m/takedown: the public removal-request route.
//
// WHO THIS IS FOR, and it is the whole design constraint. A performer who
// appears in a wger clip is NOT a Gymbo user, has no account, and will never
// make one in order to object to their own image being used. The founder
// accepted the unevidenced likeness/model-release risk in these clips and made
// THIS ROUTE the mitigation. So it must be reachable by a stranger who arrived
// from a PDF: no login, no app, no JavaScript.
//
// It is linked from the footer of every media page, including the unavailable
// ones -- that is where someone checking whether their earlier request took
// effect will land.
import { supabaseUrl, svcHeaders, esc } from "./_shared.js";

const CSS = `
:root{--bg:#fafaf7;--card:#eaeae5;--fg:#1a1a1a;--muted:#555555;--brand:#92400e;
  --line:#dcdcd9;--cta:#f59e0b;--cta-ink:#0a0a0a}
@media (prefers-color-scheme:dark){:root{--bg:#0a0a0a;--card:#141414;--fg:#f0f0eb;
  --muted:#b8b8b8;--brand:#fbbf24;--line:#2c2c2e;--cta:#fbbf24;--cta-ink:#0a0a0a}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);
  font-family:'Open Sans',system-ui,sans-serif;font-size:14px;line-height:1.55}
.wrap{max-width:640px;margin:0 auto;padding:24px 16px 48px}
h1{font-family:Merriweather,Georgia,serif;font-size:20px;margin:0 0 8px}
.card{background:var(--card);border-radius:20px;padding:16px;margin:16px 0}
label{display:block;font-size:12px;color:var(--muted);margin:12px 0 4px}
input,select,textarea{width:100%;padding:12px;border-radius:8px;
  border:1px solid var(--line);background:var(--bg);color:var(--fg);
  font:inherit;font-size:14px}
/* Caught on the LIVE page by screenshot, not by any test: the longest option
   ("It shows me and I did not agree to this use") ran underneath the native
   chevron and was clipped mid-word. A takedown form whose REASON field cannot be
   read is a bad place to save 24px. Tests asserted the select existed and every
   one of them passed while it was unreadable. */
select{padding-right:36px}
textarea{min-height:96px}
button{margin-top:20px;width:100%;min-height:48px;border:0;border-radius:9999px;
  background:var(--cta);color:var(--cta-ink);font:inherit;font-weight:700;font-size:16px}
.note{font-size:12px;color:var(--muted)}
.ref{font-family:ui-monospace,monospace;font-size:20px;font-weight:700;color:var(--brand)}
`;

const shell = (title, body, status = 200) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — Gymbo</title><meta name="robots" content="noindex">
<style>${CSS}</style></head><body><div class="wrap">${body}</div></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );

// A HUMAN-QUOTABLE REFERENCE, not the raw uuid.
//
// The requester has to be able to keep this, type it into an email, and read it
// back to us over the phone. Crockford-style alphabet: no I, L, O or U, so it
// cannot be misread as 1/0 and cannot accidentally spell anything.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function caseRef() {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return "GYM-TD-" + [...b].map((n) => ALPHABET[n % 32]).join("");
}

const FORM = (mediaId) => `<h1>Request removal of a video</h1>
<p class="note">If you appear in a video shared through Gymbo, or you hold rights in
one, use this form and we will take it down while we review your request. You do not
need a Gymbo account, and we will not ask you to create one.</p>
<form method="POST" class="card">
${mediaId ? `<input type="hidden" name="media_id" value="${esc(mediaId)}">` : `
<label for="media_id">Link or reference of the video</label>
<input id="media_id" name="media_id" required placeholder="https://getgymbo.com/m/...">`}
<label for="requester_name">Your name</label>
<input id="requester_name" name="requester_name" required autocomplete="name">
<label for="requester_email">Your email — we use this only to reach you about this request</label>
<input id="requester_email" name="requester_email" type="email" required autocomplete="email">
<label for="requester_role">You are</label>
<select id="requester_role" name="requester_role">
<option value="performer">The person shown in the video</option>
<option value="rightsholder">The rights holder</option>
<option value="agent">Acting on someone's behalf</option>
<option value="other">Other</option>
</select>
<label for="claim_kind">Reason</label>
<select id="claim_kind" name="claim_kind">
<option value="likeness">It shows me and I did not agree to this use</option>
<option value="copyright">Copyright</option>
<option value="licence">Licence terms</option>
<option value="privacy">Privacy</option>
<option value="other">Other</option>
</select>
<label for="claim_detail">What is the problem?</label>
<textarea id="claim_detail" name="claim_detail" required></textarea>
<label for="evidence">Anything that helps us check this — optional</label>
<textarea id="evidence" name="evidence"></textarea>
<button type="submit">Send request</button>
</form>`;

export async function onRequestGet(context) {
  // Deep-linked from a media page so the reporter never has to copy an id.
  const from = new URL(context.request.url).searchParams.get("media") || "";
  return shell("Request removal", FORM(from));
}

// Accept a uuid, or the full public URL we ourselves put in the PDF. Someone
// reporting a clip will paste the link they were given; refusing it and
// demanding they extract an id would fail the people this route exists for.
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export async function onRequestPost(context) {
  const { env, request } = context;
  const form = await request.formData().catch(() => null);
  if (!form) return shell("Request removal", FORM("") , 400);

  const raw = String(form.get("media_id") || "");
  const match = raw.match(UUID_RE);
  const fields = {
    media_id: match ? match[0] : null,
    requester_name: String(form.get("requester_name") || "").trim(),
    requester_email: String(form.get("requester_email") || "").trim(),
    requester_role: String(form.get("requester_role") || "other"),
    claim_kind: String(form.get("claim_kind") || "other"),
    claim_detail: String(form.get("claim_detail") || "").trim(),
    evidence: String(form.get("evidence") || "").trim() || null,
  };

  if (!fields.media_id || !fields.requester_name || !fields.claim_detail ||
      !fields.requester_email.includes("@")) {
    return shell("Request removal",
      `<p class="note">Please fill in your name, a contact email, the video link and
what the problem is.</p>` + FORM(match ? match[0] : ""), 400);
  }

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    // NEVER silently drop a rights claim. If we cannot record it, say so and
    // give the person a route that does not depend on this form working.
    console.error("[takedown] SUPABASE_SERVICE_ROLE_KEY missing — claim NOT recorded");
    return shell("Request removal", `<h1>We could not record your request</h1>
<p class="note">Something is wrong on our side. Please email
<a href="mailto:privacy@getgymbo.com">privacy@getgymbo.com</a> and we will act on it.</p>`, 503);
  }

  const ref = caseRef();
  const res = await fetch(`${supabaseUrl(env)}/rest/v1/media_takedown_cases`, {
    method: "POST",
    headers: { ...svcHeaders(env.SUPABASE_SERVICE_ROLE_KEY), Prefer: "return=minimal" },
    body: JSON.stringify({ case_ref: ref, ...fields }),
  });

  // 409 means a case is ALREADY OPEN on this asset -- the unique partial index
  // permits only one. That is a success from the reporter's point of view: the
  // clip is already suppressed and a human is already looking. Telling them
  // "duplicate" would read as a refusal.
  if (res.status === 201 || res.status === 409) {
    const suppressed = res.status === 409;
    return shell("Request received", `<h1>Request received</h1>
<div class="card">
<p>Your reference is</p><p class="ref">${esc(suppressed ? "already open" : ref)}</p>
<p class="note">${suppressed
  ? `A removal request for this video is already open and the video is already hidden while it is reviewed. Email <a href="mailto:privacy@getgymbo.com">privacy@getgymbo.com</a> if you want your details added to it.`
  : `Keep this reference. The video is hidden from the Gymbo app and from its public
link from now, while we review your request. We will email you at
${esc(fields.requester_email)} when it is decided.`}</p>
</div>`);
  }

  console.error("[takedown] insert failed", res.status, await res.text().catch(() => ""));
  return shell("Request removal", `<h1>We could not record your request</h1>
<p class="note">Something is wrong on our side. Please email
<a href="mailto:privacy@getgymbo.com">privacy@getgymbo.com</a> and we will act on it.</p>`, 502);
}
