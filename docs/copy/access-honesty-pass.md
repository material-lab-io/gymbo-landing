# CTA and access-route honesty copy spec

**Bead:** gm-7pd (child of gm-t0e) · **Author:** content · **Date:** 2026-09-16
**Input:** gy-gim46 ranks 2, 4, 6. Scope for piece 1 (CTA label) was narrowed by pm's
2026-09-16 09:5xZ comment — see below.

Copy spec only. No token, colour, component, or layout change. Verified against
`origin/main` of `gymbo-landing` (git-show), and against `functions/api/waitlist.js`
for how access actually works (AC2).

---

## Piece 1 — CTA label: DEFERS TO #163, no competing proposal

Per pm's 09-16 scope note: the CTA label is being settled in the product rig, not
here. PR #163 (open, `content/gy-7vbmn-request-access-unify`) replaces "Get Gymbo"
with "Request access" at `App.tsx:259` (nav) and `App.tsx:508` (pricing cards),
citing the ratified voice guide (gy-3r2dc §7). This spec does not propose "Join the
iPhone beta" or any other label — using "Request access" as canonical, following
whatever #163 lands with.

### AC1 — full CTA inventory, every string on the page, not just the hero one

| # | Location | Component | Current label | Verdict |
|---|---|---|---|---|
| 1 | Nav, `App.tsx:259` | `waitlistScrollCtaProps("nav")` | `Get Gymbo` | Fixed by #163 → `Request access`. No action here. |
| 2 | Hero, `App.tsx:308` | `WaitlistCTA location="hero"` | `Request access` (component default) | Already correct. No action. |
| 3 | Gallery, `App.tsx:433` | `PrimaryCTA location="gallery"` | `Request access` (component default) | Already correct. No action. |
| 4 | Pricing card 1, `App.tsx:507-508` | `waitlistScrollCtaProps("pricing")` | `Get Gymbo` | Fixed by #163 → `Request access`. No action here. |
| 5 | Pricing card 2, `App.tsx:507-508` | same button, second `PRICING.map` iteration | `Get Gymbo` | Fixed by #163 → `Request access`. No action here. |
| 6 | Footer, `App.tsx:619` | `PrimaryCTA location="footer"` | `Request access` (component default) | Already correct. No action. |
| 7 | `WaitlistForm.tsx:144` submit button | — | `Request access` | Already correct. No action. |
| 8 | Hero, `App.tsx:307` | `WhatsAppCTA location="hero"` | `Talk to us` | KEEP, different mechanism (opens WhatsApp chat directly, not the waitlist form) — no ambiguity, out of scope for this bead. |
| 9 | Footer, `App.tsx:566` | `WhatsAppButton location="cta-section"` | `Talk to the founder` | KEEP, same reasoning as #8. |

Of the 6 buttons instrumented `data-cta="waitlist"` (nav, hero, gallery, pricing×2,
footer — pm's count on gm-mva, confirmed by this inventory), 4 already say "Request
access" today; 2 (nav, pricing) will once #163 merges. Nothing left unlabeled or
ambiguous after #163 lands.

### Analytics note (pm's standing instruction, do not act on this — flag only)

`data-cta="waitlist"` is unchanged by this spec on every one of the 6 buttons above.
Not proposing a rename. pm is carrying the cross-pod request to analyst separately;
this spec does not touch instrumentation.

---

## Piece 2 — above-fold qualifier (rank 4)

**Location:** `App.tsx`, hero section, inside the `InlineWaitlist` block that wraps
the CTA buttons (`~line 305-309`) — add a new line directly below the button pair,
above the mobile hero device art.

| Location | Exact current string | Exact new string | Reason |
|---|---|---|---|
| Below hero CTA buttons, new line | *(does not exist today)* | `For independent trainers in India. iPhone only. Your clients download nothing.` | Our strongest differentiator (trainer-only, no client app) is currently buried in the FAQ. All three facts are already established live copy: "for independent trainers... in India" (hero subhead), iPhone-only (FAQ: "iPhone, for now"), clients download nothing (FAQ: "No. Gymbo is for you, the trainer... Your clients just train."). This surfaces them above the fold without inventing anything new. |

---

## Piece 3 — what happens next (rank 6)

**Location:** new block, placed directly after the hero CTA cluster (same area as
piece 2 — landing's call on exact stacking order relative to the qualifier line).

**AC2 verification, access route:** read `functions/api/waitlist.js` directly. The
form POSTs to a Cloudflare Pages Function that inserts a row into a Supabase
`waitlist` table (RLS: anon INSERT allowed, anon SELECT returns 401 by design — no
automated read-back). There is **no automated TestFlight invite** triggered by this
insert — access is a manual outreach step (the code comments reference Damini's
outreach process directly, gy-ds3fn). This means: no wait-time promise can be
stated honestly, because no confirmed turnaround exists. Per AC2's own instruction
("write the step without a time and flag it to me"), step 2 below carries no
timeframe.

| Location | Exact current string | Exact new string | Reason |
|---|---|---|---|
| New 3-step block, below hero CTAs | *(does not exist today)* | `1. Request access — leave your email or WhatsApp number.` `2. We reach out with your access.` `3. Install, import your clients, and log your first class.` | Beta-accurate: verified against the actual insert-only backend, no invented mechanism or timing. **Flagging to pm, per AC2:** if there's a real, confirmed signup-to-invite turnaround (push or analyst may have this — I don't), it's a one-line addition to step 2; I have no evidence for one today and won't invent one. |

---

## Also in scope for this bead — CTA-adjacent strings AC1 already surfaced

### The WaitlistForm success message implies a queue

**Location:** `src/components/WaitlistForm.tsx:62`.

| Location | Exact current string | Exact new string | Reason |
|---|---|---|---|
| Success state | `You're on the list. We'll be in touch when your access is ready.` | `You're in. We'll be in touch with your access.` | "On the list" is literal queue-implying language — the exact thing pm's 2026-08-31 gm-7pd comment banned ("do not write copy implying a queue of people waiting... at n=3 that is a fabricated-demand claim"). This is part of the same CTA experience AC1 asks to be inventoried, and the fix is a direct application of an instruction already on this bead, not a new judgment call. |

### Above-fold access-route line (house trial phrasing, pm's AC4)

**Location:** same hero cluster area as pieces 2/3.

Re-read at `origin/main`, `src/pages/ArticlePage.tsx:92`, per pm's explicit
instruction: `Gymbo is in private alpha. Your 7-day free trial starts once you are
in. Billed via the App Store.` Proposing this verbatim, unchanged, as the
access-route/trial-timing line pm asked for — not re-wording the house phrasing.

### Correction to pm's 09-16 09:5xZ comment: hero status language is already "Private alpha," not "In beta"

pm's scope-change comment states "The live hero says 'In beta'." I re-checked this
directly against `origin/main` and the live site (both agree): the hero eyebrow at
`App.tsx` reads `<Eyebrow>Private alpha</Eyebrow>`, and the footer eyebrow reads
`<Eyebrow dark>Private alpha</Eyebrow>`. Both already match the founder ruling
(gy-2f2ak.4). This appears to be stale information carried over from the original
08-31 spec draft (which was written when the hero did say "In beta") rather than a
fresh check. Flagging so nobody spends time "fixing" something already fixed — no
action needed on status language for this bead.

---

## Found, not fixed — two more overclaim-family strings, outside this bead and gm-mva's named scope

- `App.tsx`, "why" section H2 (`~line 323`): `Everything your training business
  needs to run.` — "everything" is an absolute claim, same family as gm-mva's flag-only
  absolutes list.
- `App.tsx`, footer H2 (`~line 559`): `Run your whole business from one app.` —
  same overclaim pattern as gm-mva's hero-H1 fix ("run your entire/whole
  business"), different location, not named in either bead. Worth a follow-up if pm
  wants a pass-2 sweep that catches this family everywhere it appears, not just the
  hero.

---

## AC3 confirmation

No token, colour, component, or layout change proposed. Two additions are new plain
text lines (piece 2, piece 3); the rest are string-only edits to existing elements.

## AC4 confirmation

Checked against gm-mva's spec (both versions, including today's status
re-verification): no contradiction. Different claims (CTA/access clarity vs.
factual overclaims), same hero area, no overlapping strings.
