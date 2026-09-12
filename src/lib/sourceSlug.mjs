// gy-0v33y — THE ONE PLACE THAT DECIDES WHAT A LEAD SOURCE MAY LOOK LIKE.
//
// Imported by BOTH the browser (src/lib/attribution.ts) and the Pages Function
// (functions/api/waitlist.js) on purpose. The client cannot be trusted, so the
// server re-applies this to whatever arrives; but the RULE must not exist twice.
// A second, well-meant copy of a policy is how gy-ncqaj happened on the app side,
// and gy-0v33y AC4 says in as many words: do not invent a second contract.
//
// WHY A SHAPE AND NOT AN ALLOWLIST (stated deviation, gy-0v33y AC4):
// gy-hqvr4's ratified contract requires "bounded UTM/source/creative only" but
// never enumerates the permitted VALUES. The bead that would — gy-ufxgo's
// acquisition-source registry — is BLOCKED ON gy-0v33y, so an allowlist here is a
// deadlock. It is also a fail-silent: the only emitters that exist today are
// public/_redirects' /ig (utm_source=instagram) and /r/:token (=referral), so an
// allowlist built from them would store NULL for every channel marketing adds
// later, and the absence would look exactly like "nobody came from there".
// Bounding by SHAPE keeps the DPDP guarantee that matters (no free text, no query
// strings, no PII, no unbounded length) while a new channel starts recording the
// day someone tags a link. gy-ufxgo can then normalise a POPULATED column.

export const SOURCE_MAX_LENGTH = 32;

// AC7: an attribution column that silently records a guess is worse than an empty
// one. These are the strings that MEAN "we did not measure anything" and must
// never be stored as though they were a channel.
// 🔴 DO NOT ADD "unknown" TO THIS SET. It reads like it belongs — it is the most
// natural thing in the world to tidy it in beside "none" and "n/a" — and doing so
// would silently NULL every honestly-unattributed visit, which is exactly the
// value gy-ufxgo v2 exists to preserve. The difference: these strings are what a
// BROKEN CALLER emits when it meant to send nothing ("undefined" is a stringified
// JS value, not a channel). "unknown" is what OUR OWN resolver deliberately emits
// after looking and finding nothing. A test pins this.
const NOT_A_MEASUREMENT = new Set(["undefined", "null", "none", "nil", "-", "n/a", "na"]);

/**
 * Normalise a raw utm_source into a stored lead source, or null.
 * Total: every input returns either a slug matching /^[a-z0-9_-]{1,32}$/ or null.
 */
export function sourceSlug(raw) {
  if (raw === null || raw === undefined) return null;
  const lowered = String(raw).trim().toLowerCase();
  if (!lowered) return null;
  if (NOT_A_MEASUREMENT.has(lowered)) return null;

  const slug = lowered
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^[-_]+/, "")
    .slice(0, SOURCE_MAX_LENGTH)
    // Re-trim AFTER the cut: slicing can leave a dangling separator, and
    // "instagram-" and "instagram" must not become two different channels.
    .replace(/[-_]+$/, "");

  if (!slug) return null;
  // A value that survived the filters but is still meaningless (e.g. "----").
  if (NOT_A_MEASUREMENT.has(slug)) return null;
  return slug;
}

// ---------------------------------------------------------------------------
// gy-0v33y / gy-ufxgo — ORGANIC SEARCH: match the HOSTNAME, store the ENGINE.
//
// marketer 2026-09-12 caught this against the shape rule above: an earlier
// proposal stored the matched hostname itself, and "google.co.in" contains a dot,
// so sourceSlug would have turned every organic hit into "google-co-in" (and a
// pre-slug version would have NULLed them). The hostname is the KEY; the engine
// slug is the VALUE. One engine must not become five channels because a visitor
// used a regional domain.
//
// Allowlist, not a heuristic: anything off-list stays NULL. A referrer we do not
// recognise is "we do not know", and AC7 is explicit that a guess is worse than
// an empty column.
// 🔴 THE "www." AND REGIONAL-DOMAIN HOLE, FOUND 2026-09-12 BY EXERCISING THIS
// FUNCTION INSTEAD OF READING IT. The hand-written map below listed
// "www.google.com" but NOT "www.google.co.in", so the single most likely organic
// referrer in our ONLY market returned null and was recorded as unmeasured. The
// map was internally inconsistent (www for .com, bare for .co.in) in a way that
// reads as fine and is not. Every regional Google — .co.uk, .com.au, .de — was
// null too.
//
// Fixed at the two places the inconsistency lived rather than by adding rows:
//   1. a leading "www." is stripped before lookup, so each engine needs ONE row
//   2. any host that is ENTIRELY google.<tld> resolves to "google"
// The google rule is ANCHORED at both ends (see the regex): "google.co.in"
// matches, "google.com.attacker.test" and "notgoogle.com" do not. That anchoring
// is the whole safety argument for a pattern here, and it is why this is a
// pattern only for the engine with dozens of ccTLDs, while everything else stays
// an explicit row.
const SEARCH_ENGINE_BY_HOST = new Map([
  ["google.com", "google"],
  ["google.co.in", "google"],
  ["bing.com", "bing"],
  ["duckduckgo.com", "duckduckgo"],
  ["yahoo.com", "yahoo"],
  ["search.yahoo.com", "yahoo"],
  ["yandex.com", "yandex"],
]);

// Anchored: the ENTIRE hostname must be google.<tld...>, nothing before, nothing
// after. Guards against notgoogle.com and google.com.attacker.test alike.
const GOOGLE_REGIONAL = /^google\.[a-z]{2,}(\.[a-z]{2,})?$/;

// gy-ufxgo registry v2 (marketer, 2026-09-12) — ANDROID APP REFERRERS.
//
// On Android a search started in the Google app arrives with referrer
// "android-app://com.google.android.googlequicksearchbox/". That is organic
// search on the platform most of our market uses, and it was resolving to NULL —
// i.e. recorded as never measured — so we were undercounting search on our
// biggest surface. marketer ruled it in as its own organic line item.
//
// The scheme is android-app:, not https:, and URL() puts the PACKAGE NAME in
// .hostname. That is why this is a separate map rather than more rows above: the
// keys are package names, they are matched EXACTLY, and no www-stripping or
// pattern is involved. An unlisted package stays NULL.
const SOURCE_BY_ANDROID_PACKAGE = new Map([
  ["com.google.android.googlequicksearchbox", "google"],
]);

/**
 * Derive a lead source from document.referrer, or null.
 * NEVER stores the referrer itself: a referrer can carry a query string with
 * anything in it (AC5), so only the hostname is ever inspected and only a
 * fixed engine slug is ever returned.
 */
export function sourceFromReferrer(referrer, selfHost) {
  if (!referrer) return null;
  let host, scheme;
  try {
    const parsed = new URL(String(referrer));
    host = parsed.hostname.toLowerCase();
    scheme = parsed.protocol.toLowerCase();
  } catch {
    return null;
  }
  // Android app referrers carry the PACKAGE as the host and never a www form, so
  // they are resolved before the web-host logic and never fall through it.
  if (scheme === "android-app:") {
    return SOURCE_BY_ANDROID_PACKAGE.get(host) ?? null;
  }
  if (!host) return null;
  // Our own pages are not a referral to ourselves. Checked BEFORE the www strip
  // so both getgymbo.com and www.getgymbo.com are excluded either way.
  if (selfHost && (host === String(selfHost).toLowerCase() ||
      host === `www.${String(selfHost).toLowerCase()}`)) return null;
  // One engine must not become two channels because a visitor's browser sent the
  // www form. Strip it once, then match.
  const bare = host.replace(/^www\./, "");
  if (selfHost && bare === String(selfHost).toLowerCase()) return null;
  if (GOOGLE_REGIONAL.test(bare)) return "google";
  return SEARCH_ENGINE_BY_HOST.get(bare) ?? null;
}

// gy-ufxgo registry v2 (marketer, 2026-09-12) — THE VALUE FOR "MEASURED, AND
// THERE WAS NO SIGNAL".
//
// The registry originally specified "direct" here. I pushed back and marketer
// ruled for "unknown", agreeing the semantics were identical and the SPELLING
// was not: Instagram's in-app browser sends NO referrer, so untagged IG traffic
// is byte-identical to genuine direct traffic at the moment we classify it.
// "direct" is a positive claim that the visitor typed the URL in, and it would
// be FALSE most often for the exact channel Damini is asking about. "unknown"
// records the absence without inventing the cause.
export const SOURCE_UNKNOWN = "unknown";

/**
 * THE RESOLUTION ORDER, in one place: an explicit tag beats an inferred one,
 * and an unattributable visit is recorded as SOURCE_UNKNOWN rather than skipped.
 *
 * 🔴 "unknown" AND null ARE DIFFERENT ANSWERS AND THE DIFFERENCE IS LOAD-BEARING.
 * This function never returns null: reaching the end MEANS we looked and found
 * nothing, which is a measurement and is countable as one — that was marketer's
 * whole point in calling it a value rather than a gap.
 * A NULL in public.waitlist.source therefore means something else entirely:
 * nobody classified this visit at all. After this ships that is a row written by
 * a client older than this change, or a POST that carried no source key. Keeping
 * the two spellings apart is what lets "we could not attribute 40% of leads" be
 * told apart from "40% of leads came in before we could attribute anything", and
 * collapsing them would make the column's own history unreadable.
 * So: the SERVER must NOT substitute "unknown" for a missing key — see
 * functions/api/waitlist.js, where an absent body.source stays null on purpose.
 */
export function resolveSource({ utmSource, referrer, selfHost } = {}) {
  return sourceSlug(utmSource) ?? sourceFromReferrer(referrer, selfHost) ?? SOURCE_UNKNOWN;
}
