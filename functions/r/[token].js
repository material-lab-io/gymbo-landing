// gy-3jb0t — GET /r/<token>: the referral short-link.
//
// This replaces the public/_redirects rule
//   /r/:token https://getgymbo.com/?...&utm_campaign=:token 301
// which Cloudflare Pages served with the LITERAL text ":token" in the query
// string (placeholders are not substituted there). Every referral therefore
// arrived as the same campaign and WHO referred was lost at the first hop.
// Found by the gy-ufxgo AC4 readback, 2026-09-18.
//
// 🔴 THE TOKEN IS FORWARDED ONLY IF IT ALREADY HAS A SLUG'S SHAPE. It is never
// reshaped. sourceSlug() is the one shape rule on this site (gy-0v33y, "do not
// invent a second contract"), but it NORMALISES, and for a token normalising is
// wrong: "Ab.1" and "ab-1" would become one referrer. So a token must equal its
// own slug to pass, and anything else is dropped. A dropped token still lands as
// source=referral, since the visit really came through a referral link; it just
// cannot say whose.
import { sourceSlug } from "../../src/lib/sourceSlug.mjs";

const SITE = "https://getgymbo.com/";

export function referralLocation(rawToken) {
  const url = new URL(SITE);
  url.searchParams.set("utm_source", "referral");
  url.searchParams.set("utm_medium", "referral");
  const token = rawToken == null ? "" : String(rawToken);
  if (token && sourceSlug(token) === token) url.searchParams.set("utm_campaign", token);
  return url.toString();
}

export function onRequestGet({ params }) {
  return new Response(null, {
    status: 301,
    headers: { Location: referralLocation(params.token), "Cache-Control": "public, max-age=3600" },
  });
}
