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
    if (res.status === 201) return Response.json({ ok: true }, { status: 201 });
    if (res.status === 409) return Response.json({ ok: true, already: true }, { status: 200 });
    return Response.json({ error: "failed to join" }, { status: 502 });
  } catch (e) {
    return Response.json({ error: "failed to join" }, { status: 502 });
  }
}
