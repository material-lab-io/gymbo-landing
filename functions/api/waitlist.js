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
// A duplicate returns 409, which we treat as success — see THE ORACLE below.
// gy-0v33y — ONE definition of a legal source, shared with the browser. The
// client is not trusted: whatever arrives is re-normalised here, and anything
// that is not a clean slug becomes NULL rather than being stored as a channel.
import { sourceSlug } from "../../src/lib/sourceSlug.mjs";

const SUPABASE_URL = "https://kpvhnbemumjmgpmmgfjp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwdmhuYmVtdW1qbWdwbW1nZmpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDMwNjUsImV4cCI6MjA4ODkxOTA2NX0.eQukPgVNv28Anq_hbe_SswQYfAuBdC_qb0bEpJrfskw";

// gy-rh2rj — THE ORACLE, and why this constant exists.
//
// The table carries UNIQUE indexes on lower(email) and on phone. A unique
// violation surfaces as 409. If the endpoint answers 201 for a new insert and
// anything DIFFERENT for a duplicate, then anyone can POST an address and read
// the difference to learn whether that person is on the waitlist. No SELECT is
// needed and RLS cannot stop it: the leak lives in the CONSTRAINT, not in a
// grant. Before this change the two branches returned different status codes
// (201 vs 200) AND different bodies ({ok:true} vs {ok:true,already:true}) — two
// independent tells.
//
// Option (a), recorded on gy-rh2rj by coach and ruled by pm: return ONE frozen
// response for both outcomes. Dedupe still happens, server-side, in Postgres —
// the visitor simply cannot observe which branch ran. The alternative (b), a
// SECURITY DEFINER function swallowing 23505 at the DB layer, is the named
// escalation if a second caller ever bypasses this endpoint; it is deliberately
// not taken now.
//
// Build it ONCE, here, so the two call sites below cannot drift apart. A future
// edit that adds a field to only one branch reopens the oracle silently, and
// that is exactly the bug this shape is designed to make impossible.
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
    if (email && !email.includes("@")) {
      return Response.json({ error: "valid email required" }, { status: 400 });
    }
    if (phone && !looksLikePhone(phone)) {
      return Response.json({ error: "valid phone required" }, { status: 400 });
    }

    // NULL, NEVER EMPTY STRING — this is load-bearing, not tidiness.
    // Both unique indexes treat NULL as distinct, so any number of rows may
    // omit an email or a phone. An empty string is NOT null: lower('') = '' is
    // a real value, so a SECOND phone-only signup sending email:"" would
    // collide with the first on waitlist_email_idx and be silently deduped into
    // it. That would look like "phone signup works" for exactly one visitor and
    // then swallow everyone after them.
    // gy-0v33y — WRITE THE COLUMN THAT ALREADY EXISTS. public.waitlist.source
    // has carried DEFAULT 'getgymbo.com' since the table was created and has
    // never been written by anything: on prod, all 7 rows read 'getgymbo.com'.
    // Every row therefore claimed to come from the website, including the ones
    // that came from Instagram — which is precisely the question Damini asked.
    //
    // 🔴 `source` IS ALWAYS PRESENT IN THIS OBJECT, INCLUDING AS NULL. That is
    // load-bearing and is AC7: a column DEFAULT only fires when the key is
    // OMITTED, so leaving it out would silently re-stamp 'getgymbo.com' on an
    // unattributed lead — the default masquerading as a measurement, which is
    // the exact defect this bead exists to end. An explicit null stores NULL.
    const row = {
      name: name || null,
      email: email || null,
      phone: phone || null,
      source: sourceSlug(body.source),
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/waitlist`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });

    // 201 = joined; 409 = already on the list. Both answer the visitor
    // IDENTICALLY (see THE ORACLE above); only our own side effects differ.
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
      // asset; the email is best-effort. It also keeps the oracle shut on
      // TIMING: the notify never runs before the response is returned, so a new
      // insert cannot be distinguished from a duplicate by how long it took.
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
              // gy-ds3fn: phone rides along, otherwise a phone-only signup
              // reaches the team as a nameless row with no way to contact it.
              body: JSON.stringify({ mode: "signup", name, email, phone }),
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
      return successResponse();
    }
    if (res.status === 409) return successResponse();
    return Response.json({ error: "failed to join" }, { status: 502 });
  } catch (e) {
    return Response.json({ error: "failed to join" }, { status: 502 });
  }
}
