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

// gy-1vd9qy.10.4 (Kaushik ruling 22 Nov, option A): Gymbo is on the web, Free + Pro, NO trial, Pro is paid on the web with Razorpay,
// the iPhone app is "coming soon". The trial / App Store billing / iPhone-only / private-alpha facts that lived here are gone on purpose:
// scripts/check-trial-eligibility.mjs and the price gate (gy-76z5i) now fail the build if a trial or App Store billing claim comes back.
export const STATUS_LANGUAGE = "Now on the web";
export const PLATFORM = "iPhone";

export const PRICE_FREE_INR = 0;
export const PRICE_MONTHLY_INR = 399;
export const PRICE_ANNUAL_INR = 2999;
/** Comma-formatted for display (₹2,999 reads correctly; the bare number would render "₹2999"). */
export const PRICE_ANNUAL_INR_DISPLAY = PRICE_ANNUAL_INR.toLocaleString("en-US");
export const PRICE_ANNUAL_MONTHLY_EQUIVALENT_INR = 250;
export const ANNUAL_SAVINGS_PERCENT = 37;

// The success line BRANCHES on what the visitor gave us, because the two follow-ups are different
// things: an email gets the confirmation mail (waitlist-notify), a phone-only lead gets a WhatsApp
// message from the team. Keyed on the email being non-empty, so someone who gives BOTH is told about
// the email. Wording ratified by content; the channel named is the one the founder ruled on.
// Shown under the button when an email was typed but is not name@domain.tld (gy-e60uc.2), whether the
// form or the server caught it. It refuses the submit even if a phone was also given: the success line
// for anyone who typed an email says "check your inbox", so an address we cannot send to must not get
// that line. The second string gives the way out in the same sentence. Wording ratified by content.
export const EMAIL_SHAPE_ERROR = "That email doesn't look right. Check for typos, then try again.";
export const EMAIL_SHAPE_ERROR_WITH_PHONE = "That email doesn't look right. Fix it, or clear it and we'll use your WhatsApp number.";
// gy-sl9amm: shown only when the number is the visitor's sole contact and has fewer than 7 digits.
export const PHONE_SHAPE_ERROR = "That number looks too short. Check it, or add an email instead.";
export const ACCESS_SUCCESS_MESSAGE_EMAIL = "Request received. Check your inbox for a confirmation.";
export const ACCESS_SUCCESS_MESSAGE_PHONE_ONLY = "Request received. We'll WhatsApp you on the number you gave us.";

// Landing copy v1 (marketer gy-1vd9qy.10.2, claim-truth read owed there): each claim is ONE constant, so dropping one is a one-line change.
export const NO_PAYMENT_LINE = "No payment needed to start.";
export const RUNS_IN_BROWSER_LINE = "Runs in your browser on your phone or laptop.";
export const HERO_SMALL_PRINT = `Free to start. ${RUNS_IN_BROWSER_LINE} iPhone app coming soon.`;
export const FINAL_CTA_SUB = `Start free in your browser. ${NO_PAYMENT_LINE}`;
export const PRICING_HEADING = "Start free. Upgrade when you are ready.";
export const PRICING_FREE_LINE = "Sign up, view and export your clients' records.";
/** gy-aqayff (Kaushik 22 Nov: every Gymbo price is GST-inclusive; compliance's words, gy-2ymb5y). The ONE helper: every landing price phrase ends with this, and
 *  tests/gst-inclusive.test.mjs fails the build on a bare Gymbo price in any built non-blog page. */
export const GST_SUFFIX = ", incl. GST";
export const inclGst = (priceText: string): string => `${priceText}${GST_SUFFIX}`;
export const PRICING_PRO_ANNUAL_LINE = `Or ₹${PRICE_ANNUAL_INR_DISPLAY} a year (₹${PRICE_ANNUAL_MONTHLY_EQUIVALENT_INR} a month, save ${ANNUAL_SAVINGS_PERCENT}%). Both prices include GST.`;
export const PRICING_PAYMENT_LINE = "Pro is paid on the web with Razorpay.";
export const START_FREE_LABEL = "Start free";
export const LOG_IN_LABEL = "Log in";
// Sign-up keeps ?src into the trainer row (gy-1vd9qy.10, E3.1 first-touch). One place for both app URLs.
export const APP_SIGNUP_URL = "https://app.getgymbo.com/signup?src=landing";
export const APP_LOGIN_URL = "https://app.getgymbo.com/login";

/** Gymbo's own cell in the comparison tables' trial row (src/content/alternatives/pages.ts, blog, compare page). */
export const GYMBO_FREE_ROW = "Free plan, no trial needed";
