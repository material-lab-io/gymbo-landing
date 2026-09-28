export const STARTER_PACK_RESOURCE_ID = "workout-builder-starter-pack";
export const STARTER_PACK_SUBJECT = "Your Workout Builder Starter Pack";
export const STARTER_PACK_PREHEADER =
  "Open the guide with 868 exercises, step-by-step instructions, and images.";
export const RESOURCE_BRIDGE_FRAGMENT_KEY = "resource_bridge";
export const STARTER_PACK_PATH = "/resources/workout-builder-starter-pack";
export const REQUEST_ACCESS_PATH = "/request-access";

const RESOURCE_BRIDGE_TOKEN = /^rb_[0-9a-f]{64}$/;

const esc = (value) => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

export function isGymboHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && (url.hostname === "getgymbo.com" || url.hostname === "www.getgymbo.com")
      && url.username === ""
      && url.password === ""
      && url.port === "";
  } catch {
    return false;
  }
}

export function isCanonicalGymboUrl(value, expectedPath) {
  if (!isGymboHttpsUrl(value)) return false;

  const url = new URL(value);
  return url.pathname === expectedPath && url.search === "" && url.hash === "";
}

export function isResourceBridgeToken(value) {
  return RESOURCE_BRIDGE_TOKEN.test(String(value || ""));
}

// The attribution bearer is deliberately distinct from resource_lead_id. It is
// carried in the fragment so browsers do not send it in the HTTP request or a
// Referrer header. The guide owns consuming and removing it before generic
// analytics initializes (gy-35awp.2 AC9); the email owns never falling back to
// a static-only CTA (gy-35awp.1 AC9).
export function resourceBridgeUrl(baseUrl, bridgeToken, expectedPath) {
  if (!isCanonicalGymboUrl(baseUrl, expectedPath) || !isResourceBridgeToken(bridgeToken)) return null;

  const url = new URL(baseUrl);
  url.hash = new URLSearchParams({ [RESOURCE_BRIDGE_FRAGMENT_KEY]: bridgeToken }).toString();
  return url.toString();
}

export function starterPackEmail(starterPackUrl, requestAccessUrl) {
  const pack = esc(starterPackUrl);
  const access = esc(requestAccessUrl);
  const text = `Your Workout Builder Starter Pack is ready.

Open the guide to browse 868 exercises with step-by-step instructions and images, ready to build your own client sessions from.

Open the starter pack: ${starterPackUrl}

Want to run these with a client roster, payments, and reminders in one place? Gymbo is in private alpha.

Request access: ${requestAccessUrl}

Gymbo
The business app for independent personal trainers.

You’re receiving this one email because you asked Gymbo to send you the Workout Builder Starter Pack.`;

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${STARTER_PACK_SUBJECT}</title></head>
<body style="margin:0;padding:0;background:#2d2d2d;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${STARTER_PACK_PREHEADER}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#2d2d2d;"><tr><td align="center" style="padding:40px 20px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#353535;border-radius:16px;"><tr><td style="padding:36px;">
<div style="font-family:'Space Mono','Courier New',monospace;font-size:14px;font-weight:bold;color:#f8623a;letter-spacing:2px;margin-bottom:24px;">GYMBO</div>
<h1 style="font-family:system-ui,sans-serif;font-size:26px;line-height:1.25;color:#ebebe6;margin:0 0 20px;">Your Workout Builder Starter Pack is ready.</h1>
<p style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.6;color:#ebebe6;margin:0 0 24px;">Open the guide to browse 868 exercises with step-by-step instructions and images, ready to build your own client sessions from.</p>
<p style="margin:0 0 30px;"><a href="${pack}" style="display:inline-block;background:#f8623a;color:#2d2d2d;font-family:system-ui,sans-serif;font-weight:700;text-decoration:none;padding:14px 20px;border-radius:10px;">Open the starter pack</a></p>
<p style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;color:#ebebe6;margin:0 0 10px;">Want to run these with a client roster, payments, and reminders in one place? Gymbo is in private alpha.</p>
<p style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;margin:0 0 30px;"><a href="${access}" style="color:#f8623a;">Request access</a></p>
<p style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;color:#ebebe6;margin:0;">Gymbo<br/>The business app for independent personal trainers.</p>
<p style="font-family:system-ui,sans-serif;font-size:12px;line-height:1.5;color:#aaa;border-top:1px solid rgba(235,235,230,.14);padding-top:20px;margin:28px 0 0;">You’re receiving this one email because you asked Gymbo to send you the Workout Builder Starter Pack.</p>
</td></tr></table></td></tr></table></body></html>`;

  return {
    subject: STARTER_PACK_SUBJECT,
    preheader: STARTER_PACK_PREHEADER,
    text,
    html,
  };
}

const result = (status, body) => ({ status, body });

// Pure orchestration so the failure modes can be exercised without Deno, a real
// database, or a real provider. claim()/record() are the durable database boundary;
// send() is the existing Resend transport.
export async function fulfillResourceLead(input, deps) {
  const leadId = String(input.resourceLeadId || "").trim();
  const resourceId = String(input.resourceId || "").trim();

  if (!leadId || resourceId !== STARTER_PACK_RESOURCE_ID) {
    return result(400, { ok: false, error: "invalid_resource_fulfillment" });
  }

  const claim = await deps.claim({ resourceLeadId: leadId, resourceId });
  if (!claim || claim.ok !== true) {
    return result(409, { ok: false, error: "resource_not_eligible" });
  }

  if (claim.claimed !== true) {
    if (claim.state === "sent" || claim.state === "dispatching") {
      return result(200, {
        ok: true,
        sent: false,
        reason: claim.state === "sent" ? "already_sent" : "already_dispatching",
      });
    }
    return result(409, { ok: false, error: "fulfillment_requires_reconciliation" });
  }

  const deliveryEmail = String(claim.email || "").trim();
  if (!deliveryEmail || !deliveryEmail.includes("@")) {
    await deps.record({
      resourceLeadId: leadId,
      outcome: "retryable",
      providerStatus: null,
      providerMessageId: null,
      errorCode: "delivery_address_missing",
    });
    return result(500, { ok: false, error: "delivery_address_missing" });
  }

  const starterPackUrl = String(input.starterPackUrl || "").trim();
  const requestAccessUrl = String(input.requestAccessUrl || "").trim();
  if (!isCanonicalGymboUrl(starterPackUrl, STARTER_PACK_PATH)
      || !isCanonicalGymboUrl(requestAccessUrl, REQUEST_ACCESS_PATH)) {
    await deps.record({
      resourceLeadId: leadId,
      outcome: "retryable",
      providerStatus: null,
      providerMessageId: null,
      errorCode: "delivery_url_not_configured",
    });
    return result(503, { ok: false, error: "delivery_not_configured" });
  }

  const bridgeToken = String(claim.attribution_bridge_token || "").trim();
  const individualizedStarterPackUrl = resourceBridgeUrl(starterPackUrl, bridgeToken, STARTER_PACK_PATH);
  const individualizedRequestAccessUrl = resourceBridgeUrl(requestAccessUrl, bridgeToken, REQUEST_ACCESS_PATH);
  if (!individualizedStarterPackUrl || !individualizedRequestAccessUrl) {
    await deps.record({
      resourceLeadId: leadId,
      outcome: "retryable",
      providerStatus: null,
      providerMessageId: null,
      errorCode: "attribution_bridge_not_available",
    });
    return result(503, { ok: false, error: "delivery_bridge_not_configured" });
  }

  const email = starterPackEmail(individualizedStarterPackUrl, individualizedRequestAccessUrl);
  let sent;
  try {
    sent = await deps.send({
      to: [deliveryEmail],
      subject: email.subject,
      html: email.html,
      text: email.text,
      idempotencyKey: claim.idempotency_key,
    });
  } catch {
    await deps.record({
      resourceLeadId: leadId,
      outcome: "needs_reconciliation",
      providerStatus: null,
      providerMessageId: null,
      errorCode: "provider_outcome_unknown",
    });
    return result(502, { ok: false, error: "provider_outcome_unknown" });
  }

  if (!sent || sent.ok !== true) {
    await deps.record({
      resourceLeadId: leadId,
      outcome: "retryable",
      providerStatus: Number.isInteger(sent?.status) ? sent.status : null,
      providerMessageId: null,
      errorCode: "provider_rejected",
    });
    return result(502, { ok: false, error: "provider_rejected" });
  }

  const recorded = await deps.record({
    resourceLeadId: leadId,
    outcome: "sent",
    providerStatus: sent.status,
    providerMessageId: sent.id ?? null,
    errorCode: null,
  });
  if (!recorded || recorded.recorded !== true) {
    // The provider accepted the email but the ledger could not be finalized.
    // Its state remains dispatching, which blocks every automatic resend.
    return result(500, { ok: false, error: "delivery_result_not_recorded" });
  }

  return result(200, { ok: true, sent: true, resource_lead_id: leadId });
}
