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
| `Booking link` | **UNKNOWN — escalate to pm** | Could not find a booking flow reachable from the shared link. The public profile route (`app/(public)/t/[slug]/page.tsx`) renders trainer name, brand, client/punch counts and contact only — no booking or scheduling surface, no "booking" naming anywhere in that route or its models. Searched the iOS app tree for a client-facing booking feature and found only trainer-side WhatsApp message templates (`ClassMessageComposer.swift`: `bookingConfirmation`, `rebooking`) — the trainer messages the client, the client does not book through a link. Per AC4: an honest UNKNOWN, not a guess. Do not ship a replacement string for this one until pm rules; leave the chip unchanged in this pass. |
| `Fitness reports` | **UNKNOWN — escalate to pm** | No "Report" type, view, or route exists anywhere in the iOS app or the public profile page (grepped both trees, zero hits). Nearest adjacent features are workout-PDF export (`WorkoutPDF.swift`) and a "session recap" WhatsApp template (`BookedSlotDetailSheet.swift`) — neither is a client-facing "report." Per AC4: UNKNOWN, not a guess. Leave the chip unchanged in this pass. |
| `Branded client app` | **REMOVE** | No installable client-facing app exists anywhere in the repo — only the trainer's own Gymbo iOS app. The public profile is a server-rendered web page (`app/(public)/t/[slug]/page.tsx`), not an app clients install. This directly contradicts the page's own live FAQ (`src/App.tsx:134`): *"Do my clients need to download anything? No. Gymbo is for you, the trainer. Your clients just train. You log it."* This is the item pm's brief called "the sharp one." I looked for evidence the trainer-only model was formally reversed and did not find one: `gy-mdqxp` (2026-08-13, founder-directed) used "Custom-branded client app" as one of the touchpoints to keep, but that predates and reads as loose phrasing for "custom branded client content" — exactly the ambiguity this audit is catching, not a ruling that clients now get an app. Flagging the tension here rather than treating it as settled either way; proceeding with REMOVE per the bead's own default, since I found ambiguity, not a reversal. |

**Exact change**, `MARQUEE_CHIPS` array (`src/App.tsx` ~line 620):

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

Replacement (only the `Branded client app` entry removed; the two UNKNOWN entries are
untouched pending pm's ruling, not silently dropped):
```
const MARQUEE_CHIPS: { name: string; icon: LucideIcon }[] = [
  { name: "QR profile", icon: QrCode },
  { name: "Share links", icon: Share2 },
  { name: "PDF invoices", icon: FileText },
  { name: "Brand theming", icon: Palette },
  { name: "Your own URL", icon: Link },
  { name: "Booking link", icon: CalendarCheck },
  { name: "Fitness reports", icon: BarChart3 },
];
```

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

- **Public testimonial/screenshot provenance** (register row 3, risk HIGH — "S Sarfaraz"
  testimonial + gallery screenshots showing a client name and ₹ amount): not one of the four
  claims named in gm-mva's brief and not addressed in this pass. This is a HIGH-severity register
  row; flagging its absence from this pass explicitly rather than silently dropping it, per pm to
  scope as its own bead (consent/release verification is not a copy-only fix).
- **Named-competitor comparison page** (register row, HIGH/founder-owned): explicitly routed to
  gy-u9goi by the audit itself. Not touched.

## Target metric

Zero of the four HIGH-risk items from gy-gim46 named in gm-mva's brief remain live after landing
ships this spec, with two labels (`Booking link`, `Fitness reports`) held at UNKNOWN pending pm's
ruling rather than guessed, and the status-language discrepancy (item 5) left open for a founder
call rather than silently resolved.
