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

/**
 * gy-xmzqr.7 — the website cannot see a visitor's Apple account, so the trial is
 * never promised unconditionally. One introductory offer is redeemable per
 * person per subscription group. Do not narrow this to "new subscribers only":
 * some lapsed subscribers are eligible.
 */
export const TRIAL_PRIMARY = `Eligible subscribers can try Gymbo free for ${TRIAL_DAYS} days.`;
export const TRIAL_ELIGIBILITY_DETAIL = "Apple determines introductory-offer eligibility; one introductory offer is available per subscription group.";

/** Gymbo's own comparison-table trial row (src/content/alternatives/pages.ts). */
export const GYMBO_TRIAL_ROW = `${TRIAL_DAYS} days for eligible subscribers, card required`;

/**
 * The house trial/access-timing line, verbatim wherever it appears above the
 * fold (src/pages/ArticlePage.tsx and src/App.tsx's hero). Do not reword per
 * surface — this one IS meant to be byte-identical, unlike the FAQ answer
 * below which restates the same facts in a different register.
 */
export const TRIAL_LINE = `Gymbo is in ${STATUS_LANGUAGE.toLowerCase()}. Eligible subscribers can start with a ${TRIAL_DAYS}-day free trial once access is granted. Billed via ${BILLING_CHANNEL}.`;

/** The 3-step access route (src/App.tsx, "what happens next"). */
export const ACCESS_ROUTE_STEPS = [
  `${ACCESS_CTA_LABEL}. Leave your email or phone number.`,
  "We reach out with your access.",
  "Install, add your clients, and punch your first class.",
];

/**
 * gm-t0e.3 — purchase-stage renew/cancel/data-exit facts (gm-s7u gap rank 4).
 * Previously split across /terms/ and /privacy/ with nothing at the point of
 * purchase; see the FAQ entry in src/App.tsx that consumes these.
 */
export const CANCEL_ROUTE = "through the App Store";
export const DATA_EXPORT_ROUTE = "from the app";
export const DATA_DELETION_ROUTE = "in the app or by contacting us";
export const PURCHASE_ANSWER_RENEW_CANCEL_DATA_EXIT = `If you are eligible for the introductory offer, your ${TRIAL_DAYS}-day trial is free. After that, billing starts automatically through ${BILLING_CHANNEL} at ₹${PRICE_MONTHLY_INR}/month or ₹${PRICE_ANNUAL_INR_DISPLAY}/year, whichever you picked. It renews each period until you cancel. Cancel anytime ${CANCEL_ROUTE}; your access continues until the end of the period you've already paid for. You can export your data ${DATA_EXPORT_ROUTE} whenever you like and ask us to delete your account ${DATA_DELETION_ROUTE}. We remove or anonymise it within a reasonable period, except where we're required to keep some records by law.`;

/** gm-t0e.3 — pricing-legibility line (gm-kkl item 2), shown once above the pricing cards. */
export const PRICING_LEGIBILITY_LINE = "One price. No per-client fees.";
