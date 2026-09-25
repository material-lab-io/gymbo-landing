// Cloudflare Pages Function — POST /api/waitlist → Supabase RPC public.join_waitlist (gy-uh9os, gy-rh2rj).
//
// Calls the join_waitlist() function through PostgREST with the PUBLIC anon key (the same
// NEXT_PUBLIC_SUPABASE_ANON_KEY the app ships in its client bundle — safe to inline / commit; it is not a
// secret). The function inserts, or silently skips a duplicate, INSIDE Postgres and returns an opaque uuid
// receipt in BOTH cases, so nothing here can tell a new signup from a duplicate — see THE ORACLE below.
// anon has no SELECT on the table and no grant on the receipt column.
// gy-0v33y — ONE definition of a legal source, shared with the browser. The
// client is not trusted: whatever arrives is re-normalised here, and anything
// that is not a clean slug becomes NULL rather than being stored as a channel.
import { sourceSlug } from "../../src/lib/sourceSlug.mjs";
// gy-e60uc.2 — the same name@domain.tld rule the form applies, re-applied here because the client is not trusted.
import { looksLikeEmail } from "../../src/lib/emailShape.mjs";

const SUPABASE_URL = "https://kpvhnbemumjmgpmmgfjp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwdmhuYmVtdW1qbWdwbW1nZmpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDMwNjUsImV4cCI6MjA4ODkxOTA2NX0.eQukPgVNv28Anq_hbe_SswQYfAuBdC_qb0bEpJrfskw";

// gy-rh2rj — THE ORACLE, and why this constant exists.
//
// The table carries UNIQUE indexes on lower(email) and on phone. Inserting through the REST table surfaced
// a duplicate as 409 (with the index name in the body), so anyone could POST an address and read the
// difference to learn whether that person is on the waitlist. No SELECT is needed and RLS cannot stop it:
// the leak lives in the CONSTRAINT, not in a grant.
//
// Option Z, ruled by pm: the swallow happens in the database. join_waitlist() returns a fresh random uuid
// for a new signup AND for a known contact, and refuses invalid input with one fixed error BEFORE it
// touches the table, so the answer cannot depend on membership. This handler therefore must not branch on
// anything it gets back from a 200: there is nothing left to branch on, and a branch added later is exactly
// how the oracle reopens. The visitor's answer is built ONCE, here, so no call site can drift.
const SUCCESS_BODY = { ok: true };
const successResponse = () => Response.json(SUCCESS_BODY, { status: 200 });

// gy-ds3fn — accept a phone number as an identity, not just an email.
//
// Damini, who does the outreach: most independent trainers have a phone and few
// have email, and on our own roster the two are near-disjoint (gy-jhojx). An
// email-only endpoint therefore rejects the MAJORITY of the people the waitlist
// exists to collect. The `phone` column and the CHECK constraint
// waitlist_phone_or_email_required (phone IS NOT NULL OR email IS NOT NULL)
// are already live on prod — verified by reading information_schema, not by
// trusting the migration's merge. This function was simply stricter than its
// own schema.
//
// Deliberately permissive: a 7-digit floor after stripping non-digits. The
// point of this change is to STOP rejecting real trainers, so a tight format
// rule here would re-create the bug in a new place. India mobiles are 10
// digits, 12 with a country code; 7 accepts every real number and still turns
// away obvious junk that would waste an outreach call.
const digitsOf = (s) => s.replace(/\D/g, "");
const looksLikePhone = (s) => digitsOf(s).length >= 7;

// gy-rh2rj step 2 — tell waitlist-notify a signup happened, by RECEIPT ONLY.
//
// The body is {mode:"signup", receipt} and nothing else: no name, no email, no phone. waitlist-notify
// resolves the receipt to a row with service_role and reads the contact from THE ROW, so a caller who
// holds only the shared secret still cannot make it mail an address of their choosing. Everything here
// is best-effort and can never change what the visitor sees; the row is the asset, the email is not.
async function notifyReceipt(context, receipt) {
  const url = context.env?.WAITLIST_NOTIFY_URL;
  const secret = context.env?.WAITLIST_NOTIFY_SECRET;
  if (!url || !secret) {
    console.error("[waitlist] notify not configured — signup KEPT, nobody told");
    return;
  }
  if (typeof receipt !== "string" || !receipt) {
    console.error("[waitlist] join_waitlist returned no receipt — signup KEPT, nobody told");
    return;
  }
  try {
    const n = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-waitlist-secret": secret },
      body: JSON.stringify({ mode: "signup", receipt }),
    });
    // A non-2xx is LOGGED with the status, never swallowed. The daily sweep still team-alerts any row
    // that is unmarked, so a failed notify is visible AND recoverable.
    if (!n.ok) {
      console.error("[waitlist] notify failed", n.status, await n.text().catch(() => ""));
    }
  } catch (err) {
    console.error("[waitlist] notify threw", err);
  }
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json().catch(() => ({}));
    const email = String(body.email || "").trim();
    const phone = String(body.phone || "").trim();
    const name = String(body.name || "").trim();

    // At least one identity, never neither — this mirrors the DB CHECK rather
    // than being stricter than it. Whichever is supplied must be plausible.
    if (!email && !phone) {
      return Response.json({ error: "email or phone required" }, { status: 400 });
    }
    if (email && !looksLikeEmail(email)) {
      return Response.json({ error: "valid email required" }, { status: 400 });
    }
    if (phone && !looksLikePhone(phone)) {
      return Response.json({ error: "valid phone required" }, { status: 400 });
    }

    // gy-0v33y — WRITE THE COLUMN THAT ALREADY EXISTS, and NEVER LET IT DEFAULT.
    // public.waitlist.source carries DEFAULT 'getgymbo.com', so a lead with no measured source would
    // silently be stamped as coming from the website: the default masquerading as a measurement.
    // 🔴 p_source IS ALWAYS PRESENT IN THE CALL, INCLUDING AS null (AC7). An explicit null stores NULL;
    // join_waitlist() re-normalises whatever arrives with waitlist_source_slug(), the SQL port of
    // sourceSlug.mjs. An ABSENT key stays null on purpose and is NOT promoted to "unknown" (gy-ufxgo v2):
    // the client sends "unknown" when it looked and found nothing, so a missing source means the visit
    // was never classified, a different fact about the lead.
    //
    // NULL, NEVER EMPTY STRING: the function trims and NULLIFs, but we send null so the empty-string
    // trap (lower('') is a real value under the unique email index) is closed at both ends.
    const args = {
      p_name: name || null,
      p_email: email || null,
      p_phone: phone || null,
      p_source: sourceSlug(body.source),
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/join_waitlist`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });

    // 200 = the call was accepted, and the answer is a uuid for a NEW signup AND for a KNOWN contact.
    // There is nothing to branch on, and this handler must not invent something: see THE ORACLE above.
    // The notify fires on EVERY 200 with the receipt only, via waitUntil, so a new signup (a Resend
    // call) and a duplicate (a no-op) return in the same time and shape. Whether the receipt names a
    // real, unclaimed row is decided in waitlist-notify with service_role, never here.
    if (res.status === 200) {
      const receipt = await res.json().catch(() => null);
      context.waitUntil(notifyReceipt(context, receipt));
      return successResponse();
    }

    // 400 with SQLSTATE 22023 is join_waitlist() refusing the input BEFORE it touches the table, so it
    // cannot depend on membership. ONLY that code is a visitor error: PostgREST also answers a 400 for
    // the function's fixed 'waitlist unavailable' (P0001), which is OUR failure and must stay a 502.
    if (res.status === 400) {
      const err = await res.json().catch(() => null);
      if (err && err.code === "22023") {
        return Response.json({ error: "invalid waitlist entry" }, { status: 400 });
      }
    }
    return Response.json({ error: "failed to join" }, { status: 502 });
  } catch (e) {
    return Response.json({ error: "failed to join" }, { status: 502 });
  }
}
