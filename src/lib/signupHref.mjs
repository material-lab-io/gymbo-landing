// gy-ufxgo.11 — the Start free link forwards the visitor's RESOLVED source to the app's /signup.
//
// Registry v6 'The app sign-up hop' (Gymbo-v1 docs/marketing/attribution/acquisition-source-registry.md, #3851):
// append the resolved tuple, never the raw inputs. src=landing stays (entry surface); a NULL key is omitted;
// unknown is forwarded as utm_source=unknown; a referral goes as utm_source=referral&utm_medium=referral with
// NO campaign until the opaque ref_<32hex> token ships (gy-ufxgo.9).
//
// 🔴 WHY A LIST HERE AND NOT resolveSource()'s OUTPUT AS IS. sourceSlug() bounds utm_source by SHAPE (gy-0v33y),
// so ?utm_source=damini-rathi or ?utm_source=9876543210 resolve to those literal slugs. Forwarding that into the
// app URL would carry a name or a phone number across the hop (registry AC3: a slug-shaped value is still a raw
// value). So only a registry source is forwarded by name; any other resolved value goes as unknown, which is
// exactly how reporting reads an off-registry value. When gy-ufxgo.8's allowlist replaces the shape rule this list
// should be read from it instead of repeated here.
//
// Landing resolves the SOURCE only: there is no medium/campaign resolver on landing yet, so medium and campaign
// are NULL and therefore omitted, except the referral medium the registry states outright.

export const FORWARDED_SOURCES = new Set([
  "instagram",
  "google",
  "bing",
  "duckduckgo",
  "yahoo",
  "yandex",
  "referral",
  "directory",
  "unknown",
]);

/**
 * The sign-up URL for this visitor. `base` is the app sign-up URL with src=landing; `source` is the stored
 * resolved source, or null when this visit was never classified (storage blocked, capture not run).
 * Null forwards nothing: an unmeasured visit is not the same answer as unknown.
 */
export function signupHref(base, source) {
  const url = new URL(base);
  if (source === null || source === undefined) return url.toString();
  const s = FORWARDED_SOURCES.has(source) ? source : "unknown";
  url.searchParams.set("utm_source", s);
  if (s === "referral") url.searchParams.set("utm_medium", "referral");
  return url.toString();
}
