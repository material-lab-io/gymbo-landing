export type AttributionTuple = {
  source: string;
  medium: string | null;
  campaign: string | null;
};

export type AttributionPayload = AttributionTuple & {
  funnel_visit_id: string | null;
  anonymous_visitor_id: string | null;
  schema_version: number;
};

export declare const SOURCE_MAX_LENGTH: number;
export declare const ATTRIBUTION_SCHEMA_VERSION: number;
export declare const SOURCE_UNKNOWN: string;
export declare const ATTRIBUTION_SOURCES: readonly string[];
export declare function sourceSlug(raw: unknown): string | null;
export declare function normalizeAttributionTuple(input?: {
  source?: unknown;
  medium?: unknown;
  campaign?: unknown;
}): AttributionTuple | null;
export declare function visitId(raw: unknown): string | null;
export declare function normalizeAttributionPayload(input?: {
  source?: unknown;
  medium?: unknown;
  campaign?: unknown;
  funnel_visit_id?: unknown;
  anonymous_visitor_id?: unknown;
}): AttributionPayload | null;
export declare function sourceFromReferrer(
  referrer: string | null | undefined,
  selfHost?: string | null,
): string | null;
export declare function resolveSource(input?: {
  utmSource?: string | null;
  referrer?: string | null;
  selfHost?: string | null;
}): string;
export declare function resolveAttribution(input?: {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  referrer?: string | null;
  selfHost?: string | null;
}): AttributionTuple;
