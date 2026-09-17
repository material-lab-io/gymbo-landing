// gm-pzp — single source of truth for Gymbo's trial, pricing, access-route and
// status-language FACTS. Every surface that states one of these facts imports
// it from here instead of hand-writing the number/word again.
//
// WHY THIS EXISTS: the trial length and "no card" claim drifted independently
// on three surfaces (src/pages/ArticlePage.tsx, src/content/alternatives/
// pages.ts, src/App.tsx) after gy-3fmqt ruled "no credit card" false and the
// trial changed to 7 days — nobody was careless, there was simply no single
// place to change it. See gm-s7u / gm-gpk.
//
// SCOPE: commercial and access facts only (trial length, card requirement,
// price, billing channel, platform, access route, status language). This is
// NOT the design-token system — no colour, spacing or component value lives
// here, and it must never grow into one; that stays product-owned brand SSOT.
//
// A surface is free to word its own sentence around these facts (see
// TRIAL_LINE vs the FAQ "Is it free?" answer below, which say the same thing
// two different ways) — it just may not hand-write the number or channel name
// again. index.html's JSON-LD/meta cannot import this module (static HTML),
// so tests/copy-facts.spec.ts cross-checks it against these constants instead.

export const TRIAL_DAYS = 7;
export const CARD_REQUIRED = true;
export const BILLING_CHANNEL = "the App Store";
export const PLATFORM = "iPhone";
export const PLATFORM_ONLY_CLAUSE = "iPhone only";
export const STATUS_LANGUAGE = "Private alpha";

export const PRICE_MONTHLY_INR = 399;
export const PRICE_ANNUAL_INR = 2999;
/** Comma-formatted for display (₹2,999 reads correctly; the bare number would render "₹2999"). */
export const PRICE_ANNUAL_INR_DISPLAY = PRICE_ANNUAL_INR.toLocaleString("en-US");
export const PRICE_ANNUAL_MONTHLY_EQUIVALENT_INR = 250;
export const ANNUAL_SAVINGS_PERCENT = 37;

export const ACCESS_CTA_LABEL = "Request access";
export const ACCESS_SUCCESS_MESSAGE = "Request received. We'll be in touch with your access.";

/** Gymbo's own comparison-table trial row (src/content/alternatives/pages.ts). */
export const GYMBO_TRIAL_ROW = `${TRIAL_DAYS} days, card required`;

/**
 * The house trial/access-timing line, verbatim wherever it appears above the
 * fold (src/pages/ArticlePage.tsx and src/App.tsx's hero). Do not reword per
 * surface — this one IS meant to be byte-identical, unlike the FAQ answer
 * below which restates the same facts in a different register.
 */
export const TRIAL_LINE = `Gymbo is in ${STATUS_LANGUAGE.toLowerCase()}. Your ${TRIAL_DAYS}-day free trial starts once you are in. Billed via ${BILLING_CHANNEL}.`;

/** The 3-step access route (src/App.tsx, "what happens next"). */
export const ACCESS_ROUTE_STEPS = [
  `${ACCESS_CTA_LABEL}. Leave your email or phone number.`,
  "We reach out with your access.",
  "Install, import your clients, and log your first class.",
];
