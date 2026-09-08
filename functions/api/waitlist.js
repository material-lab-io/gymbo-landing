// Cloudflare Pages Function — POST /api/waitlist → Supabase `waitlist` table (gy-uh9os).
//
// Inserts via Supabase REST using the PUBLIC anon key (the same
// NEXT_PUBLIC_SUPABASE_ANON_KEY the app ships in its client bundle — safe to
// inline / commit; it is not a secret). The table's RLS allows anon INSERT but
// returns 401 on anon SELECT by design, so no email can ever be read back.
//
// SECURITY-CRITICAL (per coach): a PLAIN insert with Prefer: return=minimal.
// Do NOT add `Prefer: resolution=ignore-duplicates` or `return=representation` —
// both require SELECT (401 by design) and representation would leak emails.
// A duplicate email returns 409, which we treat as success.
const SUPABASE_URL = "https://kpvhnbemumjmgpmmgfjp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwdmhuYmVtdW1qbWdwbW1nZmpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDMwNjUsImV4cCI6MjA4ODkxOTA2NX0.eQukPgVNv28Anq_hbe_SswQYfAuBdC_qb0bEpJrfskw";

export async function onRequestPost(context) {
  try {
    const body = await context.request.json().catch(() => ({}));
    const email = String(body.email || "").trim();
    const name = String(body.name || "").trim();
    if (!email || !email.includes("@")) {
      return Response.json({ error: "valid email required" }, { status: 400 });
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/waitlist`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ name, email }),
    });

    // 201 = joined; 409 = already on the list — both are success for the visitor.
    if (res.status === 201) {
      // gy-if6mq: the row is now committed, and ONLY NOW do we notify. Everything
      // below is best-effort and can never change what the visitor sees.
      //
      // WHY THE 201 BRANCH AND NOTHING ELSE (AC4): a 409 means Postgres inserted
      // NOTHING, so a duplicate cannot produce a second confirmation. That is
      // structural — there is no de-dup flag to get wrong.
      //
      // WHY waitUntil (AC5): the response is already decided. waitUntil lets the
      // send finish after the visitor has been answered, so a Resend outage or a
      // slow provider cannot delay, fail, or roll back a signup. The row is the
      // asset; the email is best-effort.
      //
      // WHY AN EDGE FUNCTION AND NOT A DIRECT RESEND CALL FROM HERE: this runtime
      // holds only the PUBLIC anon key, and anon SELECT on waitlist is 401/42501 by
      // design — measured, with a nonexistent table returning 404/PGRST205 through
      // the same key as the control. No SELECT means no rolling count, no
      // exactly-once marker and no digest. The secret below is a purpose-scoped
      // gate, NOT a copy of any production credential.
      context.waitUntil(
        (async () => {
          const url = context.env?.WAITLIST_NOTIFY_URL;
          const secret = context.env?.WAITLIST_NOTIFY_SECRET;
          if (!url || !secret) {
            console.error("[waitlist] notify not configured — signup KEPT, nobody told");
            return;
          }
          try {
            const n = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-waitlist-secret": secret },
              body: JSON.stringify({ mode: "signup", name, email }),
            });
            // AC6: a non-2xx is LOGGED with the status, never swallowed. The daily
            // sweep re-sends anything still unmarked, so this is visible AND recoverable.
            if (!n.ok) {
              console.error("[waitlist] notify failed", n.status, await n.text().catch(() => ""));
            }
          } catch (err) {
            console.error("[waitlist] notify threw", err);
          }
        })(),
      );
      return Response.json({ ok: true }, { status: 201 });
    }
    if (res.status === 409) return Response.json({ ok: true, already: true }, { status: 200 });
    return Response.json({ error: "failed to join" }, { status: 502 });
  } catch (e) {
    return Response.json({ error: "failed to join" }, { status: 502 });
  }
}
