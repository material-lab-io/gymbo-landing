# Claim-truth copy spec — pass 1

**Bead:** gm-mva (child of gm-t0e) · **Author:** content · **Date:** 2026-08-31
**Input:** gy-gim46 (closed, product rig) — ranked recommendation-action list ranks 1 and 3,
plus the first four rows of the legal/claim risk register. Item 5 (status-language flag) added
by pm 2026-08-31 off a re-read of gy-2f2ak.4's close reason. Item 2's hero string folds in
marketer's rank-8 category-framing addition per pm's routing.
**Verified against:** `origin/main` of `gymbo-landing` (git-show, commit `2b0bdd8`, matching
the live `build-sha.txt` reported in gy-u29nr 2026-08-30) — the actual deployed state, not a
local ahead-of-live checkout.

This is a **copy spec**, not code. Landing (gm-muo) lands these strings. No design token,
colour, spacing, or component change is proposed. All verdicts state the evidence and the axis
(truth) they were cleared or changed on, per pm's standing note on gm-111.

---

## Part A — land this pass (AC1–AC3)

### 1. Brand strip vs reality (audit rank 1, risk HIGH)

Location: `src/App.tsx`, `MARQUEE_CHIPS` array (~line 620) and the "Your brand, everywhere"
marquee it feeds. Five labels, five verdicts (AC2):

| Chip label | Verdict | Evidence |
|---|---|---|
| `Brand theming` | **KEEP as-is** | Shipped: trainer-configurable accent colour (`ProfileSettingsView.swift`, "Accent color" control) and custom brand logo (`CoachCardSheetData.brandLogoUrl`, gy-lrffu/GYM-644) render on the public profile card and exported statements. |
| `Your own URL` | **KEEP as-is** | Shipped: personalised public-profile slug, `/t/slug` (`CoachCardSheetData.swift` — "gy-jx67w: public-profile slug — drives the QR (/t/slug)"), live route `app/(public)/t/[slug]/page.tsx`. |
| `Booking link` | **DEFERRED — pending product shipped-status, pm chasing** | pm's 2026-08-31 ruling: Kaushik's verbatim quote in `gy-mdqxp` item 4 names "shareable booking link" as a touchpoint to keep, so this is founder-endorsed, not a REMOVE candidate. What's still unsettled is not whether to talk about it, but *which group* it belongs in — `gy-mdqxp` item 3 rules the strip groups by shipped-readiness (shipped items in the top row(s), not-yet-shipped below, no "coming soon" badges). That's a shipped-status question that lives in the product repo; I could not establish it from code (see my original search below), and per pm's ruling I'm not the one chasing it — pm is taking it to the product rig directly. Chip stays unchanged in pass 1. |
| `Fitness reports` | **DEFERRED — pending product shipped-status, pm chasing** | Same ruling and same reason as `Booking link` — Kaushik's `gy-mdqxp` item 4 quote also names "fitness reports" explicitly, so this is founder-endorsed content, not a REMOVE. Grouping (shipped vs. not-yet-shipped row) is the open question, owned by pm. Chip stays unchanged in pass 1. |
| `Branded client app` | **RE-WORD → "Custom-branded client content"** | pm's 2026-08-31 ruling, reading `gy-mdqxp` item 4 directly: Kaushik's verbatim quote is *"...shareable booking link, fitness reports, and custom branded client **content**. Brand themes are fine."* — content, not app. The "Branded client app" phrasing on the live chip is a downstream paraphrase that drifted one word from the founder's own text; it was never a ruling that clients get an app. My original REMOVE verdict was right in substance (no client-facing app exists, and the phrase as-shipped does contradict "clients download nothing") but pm's re-word is the better fix: it restores Kaushik's own phrase instead of deleting a touchpoint he explicitly asked to be talked about. When a bead's prose summary and its quoted founder text disagree, the quote wins. |

**Exact change**, `MARQUEE_CHIPS` array (`src/App.tsx` ~line 620) — only the `Branded client app`
entry is renamed; `Booking link` and `Fitness reports` are untouched (deferred, not decided
here), matching the array's current order:

Current:
```
const MARQUEE_CHIPS: { name: string; icon: LucideIcon }[] = [
  { name: "QR profile", icon: QrCode },
  { name: "Share links", icon: Share2 },
  { name: "PDF invoices", icon: FileText },
  { name: "Brand theming", icon: Palette },
  { name: "Your own URL", icon: Link },
  { name: "Booking link", icon: CalendarCheck },
  { name: "Fitness reports", icon: BarChart3 },
  { name: "Branded client app", icon: Smartphone },
];
```

Replacement:
```
const MARQUEE_CHIPS: { name: string; icon: LucideIcon }[] = [
  { name: "QR profile", icon: QrCode },
  { name: "Share links", icon: Share2 },
  { name: "PDF invoices", icon: FileText },
  { name: "Brand theming", icon: Palette },
  { name: "Your own URL", icon: Link },
  { name: "Booking link", icon: CalendarCheck },
  { name: "Fitness reports", icon: BarChart3 },
  { name: "Custom-branded client content", icon: Smartphone },
];
```

The `Smartphone` icon is left as-is — swapping it is a component/design call (icon-to-label
fit), not a copy call; flagging for landing/designer that "Smartphone" may now read oddly next
to "content" rather than "app," but not proposing an icon change myself (AC3 scope).

### 2. Hero overclaim (audit rank 3, risk HIGH)

Location: `src/App.tsx`, hero H1 (~line 289) and hero subhead (~line 298).

| Location | Exact current string | Exact replacement string | Reason |
|---|---|---|---|
| Hero H1 | `Run your entire fitness business from your phone.` (rendered across three JSX text nodes, with "fitness business" in a highlighted `<span>`) | `The business app for independent personal trainers: payments, balances, schedules and classes from your phone.` | Two fixes folded into one string, per pm/marketer's 2026-08-31 note on this bead (see below): the truth fix (this bead, gy-gim46 rank 3 — narrows the promise to the concrete core job, no "revenue"/"entire" overclaim) and a category-framing fix (marketer, gy-gim46 rank 8, folded in from gm-kkl at pm's direction so it lands in one string, not two competing edits to the same line). Marketer's proposed string used an em dash ("...trainers — payments..."); replaced with a colon per voice guide §5 ("no em dashes in shipped copy... a colon where one clause introduces or explains another") — a mechanical fix, not a wording judgment call. Which words (if any) land in the highlighted span is a component/design decision for landing, not fixed by this spec — AC3 keeps this copy-only. |
| Hero subhead | `Track revenue, stay organized, look professional, train smarter.` (the rest of the sentence, "Built for independent trainers like you in India.", is unchanged) | `Track payments and balances, stay organized, look professional, train smarter.` | Audit: use "payments and balances," not "revenue," unless accounting-grade revenue scope is documented — it is not; Gymbo records cash/UPI and does not process money. |

**Note — pm's gm-111 hero clearance, cross-referenced:** marketer's 2026-08-31 spot-check cleared
the *current* hero string on voice ("calm, precise, no fear register"). That clearance stands on
the voice axis and is not contradicted here — this is a truth-axis fix to a different problem
(overclaim vs. our own terms/privacy). Per pm's ruling, gm-111 audits the *new* hero for voice,
not this one.

**Note — marketer's category-framing evidence class:** the "business app for independent personal
trainers" framing is marketer's fold-in (gy-gim46 rank 8). Evidence class is INFERRED —
comprehension/discoverability only, not measured; the analyst search/entry-page data request is
still open. Per pm's explicit instruction, do not write "SEO" as a justification anywhere this
lands, on this bead or in the PR. Noting it here so the record is honest about what kind of
evidence this half of the string rests on, separate from the truth-fix half which is fully
substantiated (terms/privacy).

**Note — this string is also the recorded canonical tagline:** the current live H1 is verbatim the
voice guide's own §7 "Longer tagline" entry ("Run your entire fitness business from your phone.").
Landing this change means §7 goes stale the moment it ships. I'll update the guide's tagline entry
to the new string in the same pass this lands, per §8.2 (voice ruling folds back at the next
version bump) — flagging here so it isn't lost as a follow-up nobody owns.

**Adjacent finding, not in scope for this bead — flagging only:** a second "revenue" instance
exists elsewhere on the page, outside the hero: `src/App.tsx:43`, feature-card title `"Track your
revenue"` (eyebrow "The Gymbo ledger"). Same overclaim pattern, different location, not named in
the audit's rank-3 finding and not covered by pm's brief for this bead. Not touched here — worth
a follow-up bead if pm wants it swept in the same pass.

### 3. "Lowest price, locked in" (risk HIGH)

Location: `src/App.tsx`, `PRICING` array, Annual plan `features` (~line 128).

| Location | Exact current string | Exact replacement string | Reason |
|---|---|---|---|
| Annual pricing card, 3rd feature bullet | `Lowest price, locked in` | `₹2,999 billed annually` | Audit's own suggested fix — states the fixed, current-term price instead of implying a renewal/lifetime guarantee our terms don't make (terms: prices may change with notice). This duplicates the adjacent `note` field ("Billed yearly at ₹2,999 via the App Store. Save 37%.") in substance; that redundancy is accepted here in favour of a zero-judgment-call replacement per the audit's literal wording, rather than my inventing a lock-duration claim we can't substantiate. |

### 4. "More trainers across India are coming on board" (risk MEDIUM-HIGH)

Location: `src/App.tsx` ~line 457, directly under the testimonial figure.

| Location | Exact current string | Exact replacement string | Reason |
|---|---|---|---|
| Below testimonial | `<p className="mt-4 text-center text-[14px]" style={{ color: F.inkLabel, fontFamily: SANS }}>More trainers across India are coming on board.</p>` | Delete this line entirely — no replacement paragraph. | Unsubstantiated adoption claim, no public evidence. AC forbids inventing a number; no consented/evidenced replacement exists to substitute in this pass. |

### 5. Status-language discrepancy — FLAG ONLY, no verdict (pm addition, 2026-08-31)

This row is deliberately a flag, not a fix. Kaushik ruled the ground truth on gy-2f2ak.4
(closed 2026-08-23): public status language is **"private alpha."** He did not rule on which
exact phrase appears where — that close reason explicitly says so, and explicitly declines to
resolve a drift the product rig caught the same day. This bead does not resolve it either; the
phrase choice is founder-level and pm is carrying it up.

**Full inventory of stage-language strings on the page** (grepped `src/App.tsx` for
beta/alpha, plus `index.html`'s meta/OG/Twitter descriptions and JSON-LD):

| Location | Exact string |
|---|---|
| Hero eyebrow, `src/App.tsx:287` | `In beta` |
| Footer CTA eyebrow, `src/App.tsx:548` | `In beta` |
| `index.html` meta description, OG description, Twitter description, JSON-LD description | No stage/status language at all — all four describe the product functionally only (features, price), no "beta," "alpha," "waitlist," or availability claim. |

**Internal consistency: YES.** Both live occurrences say the same thing, "In beta" — this is not
an internal contradiction on the page itself.

**Agreement with the founder ruling: NO.** "In beta" and "private alpha" are different words for
what the ruling calls the same status. Two readings, both plausible, not mine to pick between:

- **Reading A — deliberate distinction.** "In beta" could be intentionally softer/more familiar
  consumer language for a public-facing landing page, while "private alpha" is the internal/
  formal term used for the branding package and other founder-facing material. Under this
  reading, no drift exists — different audiences, different register, both accurate.
- **Reading B — drift.** "In beta" is simply the pre-ruling wording that was never updated after
  Kaushik's 2026-08-23 decision, and the site should say "private alpha" (or some ruled variant
  of it) to match. Under this reading, the live site has been stating stale/wrong status language
  for 8 days.

**Not proposing a replacement string for either reading.** Do not read the absence of a fix here
as an oversight — per pm's instruction, this is the one row in this spec where an unresolved FLAG
is the correct and expected output. Also not introducing "waitlist" anywhere in this row or
elsewhere in this spec, per pm's separate note that "waitlist" risks a fabricated-demand claim
(see gm-7pd for the funnel evidence behind that instruction).

### 6. Synthetic-data disclosure (register row 3, sourced to gm-zag)

Location: `src/App.tsx`, "See Gymbo in action" gallery section (~line 383), directly under the
`<h2>` and before the gallery controls (~line 386).

**Background:** register row 3 (public testimonial/screenshot provenance, HIGH) was out of my
scope in the first version of this spec, flagged in Part C as needing its own bead. `gm-zag`
(researcher, closed 2026-08-31 while I was working) answered the screenshot half outright:
**SYNTHETIC, high confidence.** The six gallery images show the real Gymbo app UI, but the
trainer identity, client names, balances, and history come from a deterministic capture fixture
(`scripts/seed-priya.sh`'s "Priya Sharma" roster), not a live account — full commit and script
evidence on `gm-zag`. The live gallery carries no demo-data disclosure today; the four separate
animated pillar images elsewhere on the page do already say "— demo" in their accessible labels,
so this is a real, narrow gap, not a page-wide pattern.

This is a HIGH register row with a settled, cheap, honest fix — pm's ruling is that it ships in
pass 1 rather than waiting for its own bead. The testimonial half (the attributed "S Sarfaraz"
quote) is explicitly NOT part of this row or this spec — pm is carrying that to the founder
directly; not investigated, not drafted, not filed here.

| Location | Exact current string | Exact new string | Reason |
|---|---|---|---|
| New line, gallery section, under the `<h2>` | *(does not exist today)* | `Screens show synthetic demo data.` | `gm-zag`'s proposed disclosure string, high-confidence sourced to the capture pipeline (`scripts/capture-appstore-screenshots.sh` + `scripts/seed-priya.sh`, both cited on that bead). Ships as-is per pm's ruling — substance is settled; wording is mine to gut-check on the voice pass this feeds into `gm-111`, which flagged this exact string as "honest and necessary, but a flat systems phrase on a marketing page" worth a second look on tone, not substance. |

---

## Part B — flagged, held out of this pass (audit MEDIUM, register row 4)

Per gm-mva's instruction: list, do not fix, so the first pass stays small and landable.

| Location | Exact current string | Suggested bounded rewrite (not authorized yet) |
|---|---|---|
| `src/App.tsx:46`, ledger feature bullet | `Every balance, clear: credit and classes left, always current` | `Every balance, clear: credit and classes left, updated the moment you log a class.` |
| `src/App.tsx:48`, ledger feature bullet | `Cash or UPI logged. Nothing slips.` | `Cash or UPI logged, so you don't lose track.` |
| `src/App.tsx:135`, FAQ answer ("Does it work offline?") | `Yes. Log classes and payments without signal; everything syncs when you're back online.` | `Yes. Log classes and payments without signal; they sync when you're back online.` |

---

## Part C — out of scope, not decided here

- **Public testimonial provenance** (the attributed "S Sarfaraz" quote specifically — the
  screenshot half of register row 3 is now resolved, see item 6 above): not mine, not a bead,
  not to be investigated or drafted by content. pm is carrying it to the founder as a single
  sentence. Recorded here only so the record shows this half of register row 3 was seen and
  deliberately left alone, not missed.
- **Named-competitor comparison page** (register row, HIGH/founder-owned): explicitly routed to
  gy-u9goi by the audit itself. Not touched.

## Target metric

Zero of the four original HIGH-risk items from gy-gim46 named in gm-mva's brief remain live after
landing ships this spec. `Booking link` and `Fitness reports` are DEFERRED pending product
shipped-status (pm chasing, not a gap in this spec). The status-language discrepancy (item 5) is
left open for a founder call rather than silently resolved. The synthetic-data disclosure (item
6, register row 3's screenshot half) ships in this pass.
