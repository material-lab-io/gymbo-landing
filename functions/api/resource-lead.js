// Cloudflare Pages Function — POST /api/resource-lead → public.resource_lead_submit()
// (gy-p3ebo AC3/AC5; the store itself is AC1/AC2/AC4/AC7, live on prod since #1068).
//
// WHY AN RPC AND NOT A TABLE INSERT, which is what /api/waitlist does.
// public.resource_leads is REVOKE ALL + RLS-with-zero-policies, so the anon key this
// function carries cannot read OR write it directly. That is deliberate: the capture
// surface was previously insert-only by design and therefore structurally incapable of
// reading a consent record back, which is exactly what made "resource_access_granted
// fires only after confirming CURRENT delivery consent" unreachable (gy-p3ebo, measured
// by landing 2026-09-07). The single SECURITY DEFINER entry point resolves that: it
// stores the record and evaluates consent inside one statement, and hands back only an
// opaque id plus the gate.
//
// 🔴 THE GATE IS THE SERVER'S ANSWER, NEVER THE REQUEST'S. access_granted comes out of
// the RPC's return value. It is never read from the request body and never inferred from
// "the call did not throw". A payload claiming delivery_consent:true does not grant
// anything — the RPC raises when consent is absent, and that raise must surface as a
// refusal here, not as a success with a grant attached.
//
// 🔴 WHAT MAY LEAVE THIS FUNCTION. The response body is a FROZEN ALLOWLIST built in one
// place (responseFor below). Analytics downstream receives only resource_lead_id, and
// that is enforced structurally rather than by convention: the raw contact record is
// never in a variable this function returns, and the RPC's own jsonb is destructured
// field-by-field rather than spread. A future edit that spreads the RPC result would
// reopen the leak silently, which is why the shape is built once. See the companion
// assertion in tests/resource-lead.test.mjs, which fails on ANY unexpected key.
//
// NOT WIRED HERE, ON PURPOSE: the delivery email. push ruled 2026-09-21 that the single
// Starter Pack message is transactional fulfilment and may reuse the waitlist
// confirmation transport, but that same ruling authorises no test send and no campaign.
// Sending is a separate change with its own proof; this function stops at the durable
// record and the gate. withdrawal_token is likewise NOT returned to the browser — it
// belongs in the delivery email's unsubscribe link, and handing a capability to the page
// that the page has no use for is gratuitous exposure.

import { normalizeAttributionPayload } from "../../src/lib/sourceSlug.mjs";

const PROD_SUPABASE_URL = "https://kpvhnbemumjmgpmmgfjp.supabase.co";
// The public anon key — the same one /api/waitlist and the client bundle already ship.
// Not a secret. It is powerless against resource_leads except through the RPC above.
const PROD_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwdmhuYmVtdW1qbWdwbW1nZmpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDMwNjUsImV4cCI6MjA4ODkxOTA2NX0.eQukPgVNv28Anq_hbe_SswQYfAuBdC_qb0bEpJrfskw";

// Overridable so the AC6 proof can point the REAL handler at a non-prod mirror instead of
// writing lead rows to production. Absent env = production, matching /api/waitlist.
const urlFor = (env) => (env && env.SUPABASE_URL) || PROD_SUPABASE_URL;
const keyFor = (env) => (env && env.SUPABASE_ANON_KEY) || PROD_SUPABASE_ANON_KEY;

// The ONLY shape that may leave this function on success. Built field-by-field.
const responseFor = (rpc) =>
  Response.json(
    {
      ok: true,
      resource_lead_id: rpc.resource_lead_id,
      access_granted: rpc.access_granted === true,
    },
    { status: 200 },
  );

// One refusal shape. Consent-absent and malformed-input both land here so the endpoint
// cannot be used to distinguish them, and neither echoes the database's own error text.
const refusal = (message, status) => Response.json({ ok: false, error: message }, { status });

export async function onRequestPost(context) {
  try {
    const env = context && context.env;
    const body = await context.request.json().catch(() => ({}));

    const resourceId = String(body.resource_id || "").trim();
    const email = String(body.email || "").trim();
    const name = String(body.name || "").trim();
    const deliveryConsent = body.delivery_consent === true;
    const deliveryNotice = String(body.delivery_consent_notice_version || "").trim();
    // DEFAULTS FALSE, and only an explicit boolean true counts. A missing key, "false",
    // "on", 1 or null must never become consent — marketing is a separate purpose and
    // gy-p3ebo AC7 requires it default false.
    const marketingConsent = body.marketing_consent === true;
    const marketingNotice = String(body.marketing_consent_notice_version || "").trim();
    const attribution = normalizeAttributionPayload(body);

    if (!resourceId) return refusal("resource_id required", 400);
    if (!email || !email.includes("@")) return refusal("valid email required", 400);

    // Checked here AS WELL as in the RPC. Not redundancy for its own sake: it keeps the
    // unconsented case from ever becoming a database round trip, and it makes the refusal
    // identical whether the guard or the RPC catches it. The RPC remains the authority —
    // removing this check must not change the outcome, only where it is decided.
    if (!deliveryConsent || !deliveryNotice) {
      return refusal("delivery consent required", 400);
    }
    // A marketing grant without its notice version is not a recordable consent.
    if (marketingConsent && !marketingNotice) {
      return refusal("marketing consent notice version required", 400);
    }

    const res = await fetch(`${urlFor(env)}/rest/v1/rpc/resource_lead_submit`, {
      method: "POST",
      headers: {
        apikey: keyFor(env),
        Authorization: `Bearer ${keyFor(env)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_resource_id: resourceId,
        p_email: email,
        p_name: name || null,
        p_delivery_consent: true,
        p_delivery_consent_notice_version: deliveryNotice,
        p_marketing_consent: marketingConsent,
        p_marketing_consent_notice_version: marketingConsent ? marketingNotice : null,
        // Never restore the old forbidden "landing" guess. Missing/invalid
        // client attribution is forwarded as NULL so the RPC owns its documented
        // unknown fallback; valid values have passed the shared v5 contract.
        p_source: attribution?.source ?? null,
        p_medium: attribution?.medium ?? null,
        p_campaign: attribution?.campaign ?? null,
        p_funnel_visit_id: attribution?.funnel_visit_id ?? null,
        p_anonymous_visitor_id: attribution?.anonymous_visitor_id ?? null,
      }),
    });

    if (!res.ok) {
      // 🔴 MAP BY SQLSTATE, NOT BY HTTP STATUS. Measured against a real stack 2026-09-22:
      // the RPC's consent raise (ERRCODE insufficient_privilege) reaches the caller as
      // HTTP 401, not 403 — PostgREST maps 42501 that way. Two consequences, both of
      // which a status-based branch gets wrong:
      //   - treating 401 as "our fault" reports a CORRECTLY refused submission as a 502;
      //   - treating 401 as "their fault" makes a misconfigured/expired anon key
      //     indistinguishable from a visitor who did not tick the consent box, which is
      //     the more dangerous confusion — the site would look like it was rejecting
      //     users when it was actually unable to authenticate at all.
      // So branch on the SQLSTATE the function itself raises. Anything else is ours.
      const err = await res.json().catch(() => null);
      const code = err && typeof err === "object" ? err.code : null;
      const CALLER_FAULT = new Set([
        "42501", // insufficient_privilege — delivery consent absent (the AC2 refusal)
        "22023", // invalid_parameter_value — resource_id/email missing
        "23514", // check_violation — the marketing-consent shape constraint
      ]);
      return refusal("submission refused", CALLER_FAULT.has(code) ? 400 : 502);
    }

    const rpc = await res.json().catch(() => null);

    // 🔴 A 2xx IS NOT A GRANT. If the body is missing, malformed, or the gate is anything
    // other than boolean true, refuse. "The call succeeded" is precisely the inference
    // AC3 forbids, and a decorative grant is the failure mode this bead was filed about.
    if (!rpc || typeof rpc !== "object" || !rpc.resource_lead_id || rpc.access_granted !== true) {
      return refusal("submission refused", 502);
    }

    return responseFor(rpc);
  } catch {
    return refusal("submission failed", 500);
  }
}
