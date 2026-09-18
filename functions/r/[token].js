// gy-3jb0t — GET /r/<token>: the referral short-link.
//
// This replaces the public/_redirects rule
//   /r/:token https://getgymbo.com/?...&utm_campaign=:token 301
// which Cloudflare Pages served with the LITERAL text ":token" in the query
// string (placeholders are not substituted there). Every referral therefore
// arrived as the same campaign and WHO referred was lost at the first hop.
// Found by the gy-ufxgo AC4 readback, 2026-09-18.
//
// 🔴 TOKEN CONTRACT (pm ruling on gy-3jb0t, 2026-09-18 05:1xZ; marketer's rule):
//   t = lowercase(path token); forward utm_campaign=t only if t matches
//   ^[a-z0-9-]{3,32}$. Otherwise the 301 still happens, as source=referral with
//   NO campaign. Never truncate or reshape beyond lowercasing.
// Lowercasing first means a hand-typed "Priya-Jan" attributes as "priya-jan"
// instead of silently dropping. The 3-char floor exists because a token's job
// is to tell trainers apart, and 1-2 chars invite collisions.
// This is deliberately NOT sourceSlug(): that rule governs utm_source, a
// different field with a different collision cost, and it normalises, which
// for a token would merge distinct referrers ("Ab.1" and "ab-1").
// A refused token still lands as source=referral, because the visit really
// came through a referral link; it just cannot say whose.
export const TOKEN_SHAPE = /^[a-z0-9-]{3,32}$/;

const SITE = "https://getgymbo.com/";

export function referralLocation(rawToken) {
  const url = new URL(SITE);
  url.searchParams.set("utm_source", "referral");
  url.searchParams.set("utm_medium", "referral");
  const token = rawToken == null ? "" : String(rawToken).toLowerCase();
  if (TOKEN_SHAPE.test(token)) url.searchParams.set("utm_campaign", token);
  return url.toString();
}

export function onRequestGet({ params }) {
  return new Response(null, {
    status: 301,
    headers: { Location: referralLocation(params.token), "Cache-Control": "public, max-age=3600" },
  });
}
