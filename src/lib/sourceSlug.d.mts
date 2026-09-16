export declare const SOURCE_MAX_LENGTH: number;
export declare function sourceSlug(raw: unknown): string | null;
export declare function sourceFromReferrer(
  referrer: string | null | undefined,
  selfHost?: string | null,
): string | null;
export declare function resolveSource(input?: {
  utmSource?: string | null;
  referrer?: string | null;
  selfHost?: string | null;
}): string | null;
