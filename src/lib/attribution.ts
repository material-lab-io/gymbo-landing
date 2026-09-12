// gy-0v33y — capture the lead source AT ARRIVAL, not at submit.
//
// 🔴 WHY THIS IS NOT JUST `new URLSearchParams(location.search)` IN THE FORM.
// Damini's question is "Instagram or website?", and the whole difficulty she
// named is that IG traffic ARRIVES AS WEBSITE TRAFFIC. The only thing that
// separates them is a token that survives the hop — and the hop is not just the
// redirect. public/_redirects sends /ig to /?utm_source=instagram, the visitor
// then reads the page, maybe opens /guide or /research, and submits the form
// several client-side navigations later with a bare URL. Reading the query
// string at submit time would attribute that visitor to nothing at all, and the
// failure would be INVISIBLE: a NULL source is indistinguishable from an
// untagged visit.
//
// So: capture on first load, persist for the session, read at submit.
//
// FIRST TOUCH WINS. If a visitor arrives via /ig and later clicks a /r/:token
// referral link in another tab of the same session, the acquiring channel is
// still Instagram. Overwriting would credit the last link touched, which is the
// one thing an acquisition-source column must not do.

import { resolveSource } from "./sourceSlug.mjs";

const STORAGE_KEY = "gymbo.attribution.v1";

type Stored = { source: string | null; at: string };

// sessionStorage throws in some privacy modes and is absent during SSR /
// prerender (scripts/prerender.mjs runs this module's importers in Node).
// Attribution is a nice-to-have; it must never be able to break the form.
function readStore(): Stored | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

function writeStore(value: Stored): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* ignore — see above */
  }
}

/**
 * Record the acquisition source for this session, once. Safe to call on every
 * load; only the first call in a session that resolves anything is persisted.
 */
export function captureAttribution(): void {
  if (typeof window === "undefined") return;

  const existing = readStore();
  // A stored entry wins even when its source is null: the visit was already
  // classified as "arrived with nothing", and a later navigation that happens
  // to carry a utm must not retro-brand the original arrival.
  if (existing) return;

  let utmSource: string | null = null;
  try {
    utmSource = new URLSearchParams(window.location.search).get("utm_source");
  } catch {
    utmSource = null;
  }

  writeStore({
    source: resolveSource({
      utmSource,
      referrer: typeof document !== "undefined" ? document.referrer : null,
      selfHost: window.location.hostname,
    }),
    at: new Date().toISOString(),
  });
}

/** The source to submit with a lead, or null when nothing was measured. */
export function getAttributionSource(): string | null {
  if (typeof window === "undefined") return null;
  return readStore()?.source ?? null;
}
