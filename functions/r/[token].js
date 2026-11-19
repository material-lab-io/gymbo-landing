// gy-ufxgo.9 — GET /r/<code>: the referral short-link, with an opaque campaign.
//
// The public referral code (7 chars, the app's own grammar) is translated HERE,
// server-side, into ref_<32 hex> = first 16 bytes of
//   HMAC-SHA-256(key_v1, "gymbo/referral-attribution/v1:" + CANONICAL_CODE).
// The raw code never reaches Location, the client, analytics or a lead row; it
// stays only in the inbound /r/<code> URL (infrastructure access logs are a
// separately authorised retention matter). No reverse map, no raw-code storage.
//
// Supersedes the gy-3jb0t raw lowercase passthrough (which forwarded the
// code as utm_campaign). The registry-v5 resolver (gy-ufxgo.8) only accepts the
// opaque tuple.
//
// Fail-closed key rules: REFERRAL_HMAC_KEY_V1 must be exactly 64 hex chars
// (32 bytes). A valid code with a missing or malformed key answers 503 and
// NEVER redirects with a raw, partial or guessed campaign. Rotation = a new
// named version (V2) and a split in attribution continuity; V1 is immutable.
// Invalid codes need no key: they land on the plain, untagged site.
export const CODE_SHAPE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{7}$/;
export const DOMAIN = "gymbo/referral-attribution/v1:";
const KEY_SHAPE = /^[0-9a-fA-F]{64}$/;

const SITE = "https://getgymbo.com/";

// Trim + uppercase, then exact grammar. Percent-encoding, slashes, Unicode and
// anything off-alphabet fail the shape test; null means "not a referral code".
export function canonicalCode(raw) {
  if (raw == null) return null;
  const code = String(raw).trim().toUpperCase();
  return CODE_SHAPE.test(code) ? code : null;
}

const hexToBytes = (hex) => Uint8Array.from(hex.match(/../g), (h) => parseInt(h, 16));
const bytesToHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

export async function opaqueCampaign(code, keyHex) {
  const key = await crypto.subtle.importKey(
    "raw", hexToBytes(keyHex), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(DOMAIN + code)));
  return "ref_" + bytesToHex(mac.slice(0, 16));
}

export async function referralLocation(rawToken, env) {
  const code = canonicalCode(rawToken);
  if (code === null) return { location: SITE };
  const keyHex = env && env.REFERRAL_HMAC_KEY_V1;
  if (typeof keyHex !== "string" || !KEY_SHAPE.test(keyHex)) return { error: "referral key unavailable" };
  const url = new URL(SITE);
  url.searchParams.set("utm_source", "referral");
  url.searchParams.set("utm_medium", "referral");
  url.searchParams.set("utm_campaign", await opaqueCampaign(code, keyHex));
  return { location: url.toString() };
}

export async function onRequestGet({ request, params, env }) {
  // params.token may already be percent-decoded; a '%' in the raw path segment
  // means the code was not typed as plain characters, so it is invalid.
  const rawSegment = request ? new URL(request.url).pathname.replace(/^\/r\//, "") : params.token;
  const token = rawSegment.includes("%") ? null : params.token;
  const out = await referralLocation(token, env);
  if (out.error) return new Response("Referral link temporarily unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  return new Response(null, {
    status: 301,
    headers: { Location: out.location, "Cache-Control": "public, max-age=3600" },
  });
}
