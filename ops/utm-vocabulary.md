# UTM vocabulary v1

Source: gm-xar, marketer final 2026-09-19 06:50Z (AC2 confirmed by analyst 2026-09-19 04:38Z, pm rulings 06:5xZ). Pinned by `tests/utm-vocabulary.test.mjs`: a value emitted by `/ig` or `/r/` that is not in the tables below fails CI.

**MEASUREMENT RULE (binding on every successor bead).** Read UTM traffic ONLY from Umami's UTM report (POST /api/reports/utm, website 36b8e820-a50a-44b3-a57b-5ee37f719916) or the raw query list (/metrics?type=query). NEVER with utmSource / utmMedium / utmCampaign / utm_source filters on /metrics or /stats: they are silently ignored and return the SITE TOTAL with HTTP 200, so an AC built on them reads green on broken. Any AC that quotes a per-channel number must name the report it came from and pair it with the unfiltered total.

Format: all values lowercase, a-z 0-9 and hyphen only (chatgpt.com is the one external value with a dot, see below; the opaque referral campaign ref_<32hex> is the one emitted value allowed an underscore), no spaces, no free text. Umami stores values exactly as typed, so one spelling per value or a channel splits across rows. Only utm_source, utm_medium, utm_campaign are used; no utm_term, no utm_content until a bead needs them (analyst: utm_term is empty today).

## LIVE VALUES - FROZEN, cannot change without a store resubmit or splitting history

| utm_source | utm_medium | utm_campaign | Emitted by | Live evidence |
|---|---|---|---|---|
| instagram | social | bio | /ig redirect (public/_redirects) | 20 views since 08-01 |
| referral | referral | the OPAQUE REFERRAL TOKEN, shape ^ref_[0-9a-f]{32}$ (HMAC of the public code, gy-ufxgo.9); an invalid code is entirely untagged, no utm at all | /r/ function (functions/r/[token].js) | non-prod proof only; not yet deployed. Whether any raw-token /r/ link was ever distributed is unconfirmed (the pre-gy-3jb0t rule emitted the literal ":token"), so history-split risk is not asserted nil |
| appstore | listing | marketing-url | ASC Marketing URL | live per gymbo pm 18:44Z, ASC read-back OK |
| appstore | listing | support-url | ASC Support URL | 2 views (analyst) |

## RESERVED VALUES - defined, not yet emitted (each needs its child bead before it ships)

| utm_source | utm_medium | utm_campaign | Surface |
|---|---|---|---|
| media-page | product | m-footer | /m/ footer backlink (landing) |
| pdf | product | receipt-footer | receipt PDF footer link (product, post-launch ask) |
| email | email | the SEND SLUG, lowercase with hyphens | any getgymbo.com link in a gm-d5d send |
| linkedin, x, youtube | social | bio | only when a Gymbo profile exists; none does today |
| any | any | THEME-YYMM, for example launch-2609 | time-boxed pushes |

Emitted since gm-vt0: media-page / product / m-footer (the "Gymbo" backlink in the /m/ footer, functions/m/[id].js). It stays in this table; `tests/utm-vocabulary.test.mjs` pins it on the rendered page.

utm_medium is a closed set of 5: social, email, referral, listing, product. A new medium needs marketer sign-off.

## KNOWN EXTERNAL SOURCE - EXTERNAL, NOT OURS

utm_source=chatgpt.com. ChatGPT appends it to links it shows; we do not emit it and never must. 27 views since 08-01 (analyst), the largest tagged source. The report must NOT treat it as junk. Read it as "arrived from a ChatGPT answer", an organic-discovery signal, and keep it out of any "channels we control" total. It is the one value allowed a dot.

## Ownership

One owner of the vocabulary; any new value goes through marketer; a value not in this table does not ship. Ceiling stays as in finding 3 of the 09-18 gm-xar comment: forwarded and typed URLs land as direct, so tagging raises the 14.6% baseline but cannot take 85% to 0.

## Placeholder rule (lesson from the 09-11 to 09-13 junk campaign values)

Any generated link must be checked for leftover placeholder syntax before it ships: a colon-prefixed word, angle brackets, curly braces, and their percent-encoded versions. `/r/` refuses such a code (301 to the plain site with NO utm at all); `tests/utm-vocabulary.test.mjs` pins it.
