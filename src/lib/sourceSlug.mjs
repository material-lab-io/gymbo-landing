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

/**
 * Revalidate one atomic v5 payload and stamp the server-owned schema version.
 *
 * Registry v5 has four lawful stored shapes, and schema_version is the
 * discriminator (gy-ufxgo.8):
 *   1. unmeasured                  null  (returned here as null)
 *   2. measured, no signal         schema 5, source `unknown`, both visit IDs
 *   3. matched                     schema 5, one canonical tuple, both visit IDs
 *   4. signal present, no match    schema 5, source/medium/campaign NULL, both visit IDs
 * Shape 4 is a tuple that is ENTIRELY absent plus both trustworthy visit IDs. A
 * tuple that is present but invalid, or half present, is never promoted to shape
 * 4: it returns null (shape 1) and the raw value is never stored. Only the
 * browser classifies "signal present, matched nothing".
 * A missing or malformed visit ID is not a v5 judgement of any shape, so both
 * handlers null every attribution field together instead of creating a partial
 * row that falsely claims schema_version=5.
 */
export function normalizeAttributionPayload(input = {}) {
  const funnelVisitId = visitId(input.funnel_visit_id);
  const anonymousVisitorId = visitId(input.anonymous_visitor_id);
  if (!funnelVisitId || !anonymousVisitorId) return null;

  const tupleAbsent = [input.source, input.medium, input.campaign]
    .every((value) => cleanNullable(value) === null);
  const tuple = tupleAbsent
    ? { source: null, medium: null, campaign: null }
    : normalizeAttributionTuple(input);
  if (!tuple) return null;

  return {
    ...tuple,
    funnel_visit_id: funnelVisitId,
    anonymous_visitor_id: anonymousVisitorId,
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

// Classify a referrer as one of four outcomes (gy-ufxgo.8, marketer ruling
// 2026-09-23). The distinction between the last two is the whole point:
//   none      no referrer at all
//   self      one of our own pages (internal navigation, not a channel signal)
//   match     an allowlisted channel
//   unmatched a referrer that IS a signal but matches no registry entry
function classifyReferrer(referrer, selfHost) {
  if (!referrer) return { kind: "none" };
  let parsed;
  try {
    parsed = new URL(String(referrer));
  } catch {
    return { kind: "unmatched" };
  }

  const host = parsed.hostname.toLowerCase();
  const scheme = parsed.protocol.toLowerCase();
  if (!host) return { kind: "unmatched" };

  if (scheme === "android-app:") {
    const source = SOURCE_BY_ANDROID_PACKAGE.get(host) ?? null;
    if (source === "instagram") {
      return { kind: "match", tuple: { source, medium: "organic_social", campaign: "android_referrer" } };
    }
    if (source === "google") return { kind: "match", tuple: { source, medium: "organic", campaign: null } };
    return { kind: "unmatched" };
  }

  const ownHost = clean(selfHost);
  if (ownHost && (host === ownHost || host === `www.${ownHost}`)) return { kind: "self" };

  const bare = host.replace(/^www\./, "");
  if (ownHost && bare === ownHost) return { kind: "self" };
  const source = GOOGLE_REGIONAL.test(bare)
    ? "google"
    : (SEARCH_ENGINE_BY_HOST.get(bare) ?? null);
  return source
    ? { kind: "match", tuple: { source, medium: "organic", campaign: null } }
    : { kind: "unmatched" };
}

function parsedReferrer(referrer, selfHost) {
  const result = classifyReferrer(referrer, selfHost);
  return result.kind === "match" ? result.tuple : null;
}

/** Derive only the allowlisted source from a referrer (source-only compatibility API). */
export function sourceFromReferrer(referrer, selfHost) {
  return parsedReferrer(referrer, selfHost)?.source ?? null;
}

/**
 * Source-only compatibility API. A valid explicit source wins; otherwise an
 * allowlisted referrer wins; otherwise the measured result is `unknown`.
 * NOT used by the capture path: it cannot tell "no signal" from "signal that
 * matched nothing" (see resolveAttribution).
 */
export function resolveSource({ utmSource, referrer, selfHost } = {}) {
  return sourceSlug(utmSource) ?? sourceFromReferrer(referrer, selfHost) ?? SOURCE_UNKNOWN;
}

/**
 * Resolve one complete registry-v5 tuple, or null.
 *
 * Three mutually exclusive outcomes (marketer ruling 2026-09-23, gy-ufxgo.8):
 *   1. a registry tuple                       -> that tuple
 *   2. a measured visit with NO signal at all -> the explicit `unknown` tuple
 *   3. a signal that matches no registry entry -> null (send NO attribution)
 * Coercing 3 to `unknown` was the defect: it made unmatched-signal leads look
 * like untagged visits. The server stores null exactly as it stores a caller
 * that sent nothing, so state 3 is counted by the v5 deploy-time cutoff.
 *
 * A UTM field counts as a signal only when it has a non-blank value. Referrer
 * inference is permitted only when no UTM field was attempted: once a tagged
 * attempt exists, an invalid tuple is state 3; falling through would silently
 * credit a different channel for a broken/private tag. Our own pages as
 * referrer are internal navigation, not a signal.
 */
export function resolveAttribution({
  utmSource,
  utmMedium,
  utmCampaign,
  referrer,
  selfHost,
} = {}) {
  const hasTaggedAttempt = [utmSource, utmMedium, utmCampaign].some((value) => clean(value) !== null);
  if (hasTaggedAttempt) {
    return normalizeAttributionTuple({
      source: utmSource,
      medium: utmMedium,
      campaign: utmCampaign,
    });
  }

  const ref = classifyReferrer(referrer, selfHost);
  if (ref.kind === "match") return ref.tuple;
  if (ref.kind === "unmatched") return null;
  return { source: SOURCE_UNKNOWN, medium: null, campaign: null };
}
