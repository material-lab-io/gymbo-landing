// gy-ufxgo.8 — the shared registry-v5 attribution boundary.
//
// This module is imported by the browser and both Pages form handlers. The
// browser may classify a visit, but it is never trusted: the handlers run the
// same exact tuple validator again before sending anything to PostgREST.
//
// The previous implementation accepted every value matching a bounded slug
// shape. That was a temporary privacy guard while the channel registry was not
// settled. Registry v5 is now settled, so shape alone is unsafe: a phone,
// handle, name, or campaign can also be a perfectly shaped slug.

export const SOURCE_MAX_LENGTH = 32;
export const ATTRIBUTION_SCHEMA_VERSION = 5;
export const SOURCE_UNKNOWN = "unknown";

export const ATTRIBUTION_SOURCES = Object.freeze([
  "instagram",
  SOURCE_UNKNOWN,
  "referral",
  "directory",
  "google",
  "bing",
  "duckduckgo",
  "yahoo",
  "yandex",
]);

const SOURCE_ALLOWLIST = new Set(ATTRIBUTION_SOURCES);
const SEARCH_SOURCES = new Set(["google", "bing", "duckduckgo", "yahoo", "yandex"]);
const DIRECTORY_CAMPAIGNS = new Set([
  "softwaresuggest",
  "capterra",
  "getapp",
  "alternativeto",
  "saashub",
  "g2",
]);
const REFERRAL_CAMPAIGN = /^ref_[0-9a-f]{32}$/;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const clean = (raw) => {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  return value || null;
};

const cleanNullable = (raw) => {
  if (raw === null || raw === undefined || raw === "") return null;
  return clean(raw);
};

/** Return one exact registry-v5 source, or null. Never invent or truncate. */
export function sourceSlug(raw) {
  const source = clean(raw);
  return source && SOURCE_ALLOWLIST.has(source) ? source : null;
}

/**
 * Validate a complete registry-v5 source/medium/campaign tuple.
 *
 * A partial tuple is not promoted to a guess. `unknown` is valid only as the
 * explicit result of a measured event, while null at the server boundary means
 * an old/non-form caller did not classify the visit at all.
 */
export function normalizeAttributionTuple(input = {}) {
  if (!input || typeof input !== "object") return null;

  const source = sourceSlug(input.source);
  const medium = cleanNullable(input.medium);
  const campaign = cleanNullable(input.campaign);
  if (!source) return null;

  if (source === SOURCE_UNKNOWN) {
    return medium === null && campaign === null ? { source, medium: null, campaign: null } : null;
  }

  if (SEARCH_SOURCES.has(source)) {
    return medium === "organic" && campaign === null
      ? { source, medium: "organic", campaign: null }
      : null;
  }

  if (source === "instagram") {
    const isBio = medium === "organic_social" && campaign === "bio";
    const isAndroid = medium === "organic_social" && campaign === "android_referrer";
    const isFounderDm = medium === "direct_message" && campaign === "founder_outreach";
    return isBio || isAndroid || isFounderDm ? { source, medium, campaign } : null;
  }

  if (source === "referral") {
    return medium === "referral" && campaign !== null && REFERRAL_CAMPAIGN.test(campaign)
      ? { source, medium, campaign }
      : null;
  }

  if (source === "directory") {
    return medium === "listing" && campaign !== null && DIRECTORY_CAMPAIGNS.has(campaign)
      ? { source, medium, campaign }
      : null;
  }

  return null;
}

/**
 * Accept only an RFC 4122 UUIDv4 with the correct version and variant bits.
 * The distinct-hex floor mirrors the data boundary and rejects decorative IDs.
 */
export function visitId(raw) {
  const value = clean(raw);
  if (!value || !UUID_V4.test(value)) return null;
  const hex = value.replaceAll("-", "");
  return new Set(hex).size >= 8 ? value : null;
}

/** Revalidate a browser payload and stamp the server-owned schema version. */
export function normalizeAttributionPayload(input = {}) {
  const tuple = normalizeAttributionTuple(input);
  if (!tuple) return null;
  return {
    ...tuple,
    funnel_visit_id: visitId(input.funnel_visit_id),
    anonymous_visitor_id: visitId(input.anonymous_visitor_id),
    schema_version: ATTRIBUTION_SCHEMA_VERSION,
  };
}

const SEARCH_ENGINE_BY_HOST = new Map([
  ["google.com", "google"],
  ["google.co.in", "google"],
  ["bing.com", "bing"],
  ["duckduckgo.com", "duckduckgo"],
  ["yahoo.com", "yahoo"],
  ["search.yahoo.com", "yahoo"],
  ["yandex.com", "yandex"],
]);
const GOOGLE_REGIONAL = /^google\.[a-z]{2,}(\.[a-z]{2,})?$/;
const SOURCE_BY_ANDROID_PACKAGE = new Map([
  ["com.google.android.googlequicksearchbox", "google"],
  ["com.instagram.android", "instagram"],
]);

function parsedReferrer(referrer, selfHost) {
  if (!referrer) return null;
  let parsed;
  try {
    parsed = new URL(String(referrer));
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  const scheme = parsed.protocol.toLowerCase();
  if (!host) return null;

  if (scheme === "android-app:") {
    const source = SOURCE_BY_ANDROID_PACKAGE.get(host) ?? null;
    if (source === "instagram") {
      return { source, medium: "organic_social", campaign: "android_referrer" };
    }
    if (source === "google") return { source, medium: "organic", campaign: null };
    return null;
  }

  const ownHost = clean(selfHost);
  if (ownHost && (host === ownHost || host === `www.${ownHost}`)) return null;

  const bare = host.replace(/^www\./, "");
  if (ownHost && bare === ownHost) return null;
  const source = GOOGLE_REGIONAL.test(bare)
    ? "google"
    : (SEARCH_ENGINE_BY_HOST.get(bare) ?? null);
  return source ? { source, medium: "organic", campaign: null } : null;
}

/** Derive only the allowlisted source from a referrer (source-only compatibility API). */
export function sourceFromReferrer(referrer, selfHost) {
  return parsedReferrer(referrer, selfHost)?.source ?? null;
}

/**
 * Source-only compatibility API. A valid explicit source wins; otherwise an
 * allowlisted referrer wins; otherwise the measured result is `unknown`.
 */
export function resolveSource({ utmSource, referrer, selfHost } = {}) {
  return sourceSlug(utmSource) ?? sourceFromReferrer(referrer, selfHost) ?? SOURCE_UNKNOWN;
}

/** Resolve one complete registry-v5 tuple, preserving valid UTM precedence. */
export function resolveAttribution({
  utmSource,
  utmMedium,
  utmCampaign,
  referrer,
  selfHost,
} = {}) {
  const tagged = normalizeAttributionTuple({
    source: utmSource,
    medium: utmMedium,
    campaign: utmCampaign,
  });
  if (tagged) return tagged;

  return parsedReferrer(referrer, selfHost) ?? {
    source: SOURCE_UNKNOWN,
    medium: null,
    campaign: null,
  };
}
