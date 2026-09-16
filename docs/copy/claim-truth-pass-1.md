# getgymbo.com claim-truth pass 1

gm-mva. Child of gm-t0e (competitor-audit claim-truth epic). Copy spec only — no
App.tsx edits; the landing seat (gm-muo) applies this mechanically.

Live-verified against https://getgymbo.com/ on 2026-09-16 (fresh fetch, positive
control "private alpha" = 2 occurrences confirming the page is server-rendered
and a zero count means genuinely absent, not client-render lag). Source strings
below are also cross-checked against `src/App.tsx` on `origin/main` so the exact
strings are copy-pasteable, not paraphrased from rendered HTML.

pm's 2026-09-16 06:51 re-verification (gm-mva comment) already established that
2 of the original 4 audit claims had moved since the 2026-08-31 audit
("Branded client app" removed, "Run your entire fitness business" removed).
This pass covers what's still live.

## AC1 — the four claims

| # | Location | EXACT current string | EXACT replacement string | Reason | Audit ref |
|---|---|---|---|---|---|
| 1 | Hero, `src/App.tsx:299` | `Track revenue, stay organized, look professional, train smarter` | `Track payments and balances, stay organized, look professional, train smarter` | "Revenue" implies accounting-grade income tracking; the product only logs cash/UPI payments a trainer records themselves and shows a running balance (Terms.tsx: "track payments and balances... it does not process those payments or handle your money"). No documented accounting-grade revenue scope exists. Matches the capability language already ratified in gy-wymhs's FAQ copy ("Gymbo keeps the running balance. It doesn't touch your money."). | audit rank 3, risk HIGH |
| 2 | Annual plan pricing card, `src/App.tsx:129`, `features` array 3rd item | `Lowest price, locked in` | `Our lowest price per month` | "Locked in" reads as a renewal/lifetime price guarantee. Terms.tsx is explicit: "Prices may change, with notice." No grandfather clause exists for current subscribers (confirmed by reading Terms.tsx directly — the only grandfathering bead in flight, gy-bk99c.1, is about pre-launch legacy trainers getting comped Pro at monetization go-live, unrelated to a price-change guarantee). Replacement keeps the true comparative fact (₹250/mo effective vs ₹399/mo monthly) without promising permanence. | risk HIGH |
| 3 | Below the testimonial/gallery figure, `src/App.tsx:466` | `More trainers across India are coming on board.` | *(remove the line entirely — `<p>` and its content deleted, no replacement text)* | Unsubstantiated adoption claim; no public/consented evidence backs it (per instruction, not inventing a number or a replacement claim). Deleting rather than rewording since there is nothing true and specific to say here without real trainer-count data. | risk MEDIUM-HIGH |
| 4 | Brand-touchpoints marquee, `src/App.tsx:643` `MARQUEE_CHIPS` | `{ name: "Booking link", icon: CalendarCheck },` | *(remove this array entry)* | NOT BUILT. Verified independently today: zero hits for "book"/"booking" anywhere in the Next.js client-facing app (`app/`) — the only booking-adjacent code is the trainer-side scheduling wizard (`OpenSlotService`), which has no client-facing self-book route. This confirms marketer's 2026-08-13 finding on gy-mdqxp verbatim, 34 days later, same conclusion. See "readiness grouping" note below for why REMOVE (not MARK-coming) is the only AC3-compliant verdict. | audit rank 1 (brand-strip family), risk HIGH |
| 5 | Brand-touchpoints marquee, `src/App.tsx:644` `MARQUEE_CHIPS` | `{ name: "Fitness reports", icon: BarChart3 },` | *(remove this array entry)* | NOT BUILT. Verified independently today: no fitness/workout-progress report feature exists anywhere in the codebase. The only export/report-adjacent feature is a per-client billing/attendance PDF statement (`app/api/clients/[id]/export-data`, `ClientPDFData` type) — a payments/attendance statement, not a fitness progress report. Confirms marketer's 2026-08-13 finding on gy-mdqxp verbatim. | audit rank 1 (brand-strip family), risk HIGH |

Rows 4 and 5 are numbered separately from rows 1-3 because they're two of the
five brand-strip labels this bead also owes verdicts for (AC2) — see below.

## AC2 — brand-strip label verdicts (all five, with evidence)

The brand-touchpoints marquee (`MARQUEE_CHIPS`, `src/App.tsx:637-646`) is a
single flat scrolling list with **no visual distinction** between shipped and
unshipped items — it is not the "shipped grid / forthcoming grid, no badge"
two-block layout speced and built in gy-mdqxp's round-6 pass (design comment
2026-08-13 07:38). That grouping component apparently did not carry forward
into this marquee redesign. This matters for the verdict: because there is no
copy-only way to signal "coming later" without either a label (Kaushik
explicitly banned re-introducing one — gy-slagn) or a layout change (AC3 bars
component/token changes here), **MARK-as-coming-later is not an available
verdict under this bead's constraints** for anything not built. That leaves
KEEP or REMOVE only.

| Label | Verdict | Evidence |
|---|---|---|
| "Branded client app" | Already resolved, no action | Removed in PR #103 (2026-08-31), reworded to "Custom branded client content" per Kaushik's verbatim phrase (gy-mdqxp item 4). Confirmed live today: zero occurrences of the old string, "Custom branded client content" present at `MARQUEE_CHIPS[7]`. |
| "Your own URL" | KEEP | SHIPPED. `app/(public)/t/[slug]/page.tsx` is a real public trainer profile page; `trainer.slug` is a live, validated field (`app/api/trainers/route.ts:84-86`, auto-provisioned on activation). Confirms gy-mdqxp's 2026-08-13 designer verification (QR profile card resolves to `/t/{slug}`). |
| "Booking link" | REMOVE | NOT BUILT — see row 4 above. |
| "Fitness reports" | REMOVE | NOT BUILT — see row 5 above. |
| "Brand theming" | KEEP | SHIPPED. `accent_color`, `theme`, `app_icon`, `brand_name`/`brand_address`/`brand_phone`/`brand_email` are real, settable fields (`app/api/trainers/route.ts:65`, `app/(main)/settings/profile/page.tsx`) with a live Settings surface. Confirms gy-mdqxp's 2026-08-13 designer verification. |

## Flag-only absolutes (list with bounded rewrite, DO NOT FIX this pass)

Per the bead's own scope instruction, these stay out of pass 1 so it lands
small. Listed here so pass 2 doesn't have to re-derive them.

| Location | EXACT current string | Suggested bounded rewrite | Why it's flagged |
|---|---|---|---|
| `src/App.tsx:47` | `Every balance, clear: credit and classes left, always current` | `Every balance, clear: credit and classes left, kept up to date as you go` | "Always current" is an uptime/reliability absolute against the Terms' "as is / as available" disclaimer. |
| `src/App.tsx:49` | `Cash or UPI logged. Nothing slips.` | `Cash or UPI logged, so nothing gets missed.` | "Nothing slips" is an absolute guarantee claim. |
| `src/App.tsx:136` (+ JSON-LD twin, `index.html` FAQPage schema — see note below) | `Yes. Log classes and payments without signal; everything syncs when you're back online.` | `Yes. Log classes and payments without signal; it syncs once you're back online.` | "Everything syncs" is an absolute; bounding it to "it syncs" (the sync mechanism, not a completeness guarantee) is enough without changing the claim's substance. |

**Dependency note for whoever picks up the FAQ rewrite:** `index.html` carries a
hand-authored FAQPage JSON-LD block that duplicates this exact FAQ answer for
SEO rich results (already the subject of gy-ivyxb, fixed today in PR #164 for a
different divergence). If this bounded rewrite ships, the JSON-LD twin needs
the same edit in the same PR, or it will drift again — same failure class,
now flagged in advance instead of found after the fact.

## Found, not fixed (same claim family, outside this bead's 4 named rows)

`src/App.tsx:44-45`, the "Gymbo ledger" pillar section (`id: "revenue"`):
- `title: "Track your revenue"` — same overclaim pattern as the hero's "Track
  revenue" (row 1 above), but a different literal string, so it wasn't part
  of the original audit's 4 rows or pm's re-verification count.
- `intro: "...so you always know where every client stands."` — another
  absolute ("always know").

Not fixing here — this bead names 4 specific claims plus the 5 brand-strip
labels, and silently expanding scope makes a spec harder to review and land.
Filing as a follow-on for whoever owns pass 2 or the flag-only absolutes list.

## AC3 confirmation

No proposed replacement reintroduces "no credit card," adds a pricing tier, or
touches any design token, color, spacing, or component. Two rows are deletions
(array entries / a `<p>` tag), not rewords — that's copy scope, not layout.

## AC4 confirmation

No UNKNOWN rows in this pass — all four claims plus five brand-strip labels
have a verdict backed by either a direct code read (this pass) or a prior
source-verified finding (gy-mdqxp, marketer, 2026-08-13) that I independently
re-confirmed rather than took on trust.
