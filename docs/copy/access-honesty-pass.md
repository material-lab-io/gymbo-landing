# CTA and access-route honesty copy spec

**Bead:** gm-7pd (child of gm-t0e), raised P2 → **P1** 2026-08-31 · **Author:** content
**Date:** 2026-08-31, revised same day after pm's funnel-data addition
**Input:** gy-gim46 (closed, product rig) — ranked recommendation-action list ranks 2, 4, 6.
Item 4 (pricing legibility, rank 7) folded in by pm's routing from gm-kkl (marketer). Rank 2 is
sequenced first below — pm's 2026-08-31 addition confirmed via a live Supabase read that the
current CTA/access ambiguity has a measured outcome (3 signups in 10 weeks), not just an
inferred one, so it's the highest-value item in this spec, not a tidiness pass.
**Verified against:** `origin/main` of `gymbo-landing` (commit `2b0bdd8`, matches live
`build-sha.txt`), traced through `src/App.tsx`, `src/forge-ui.tsx`,
`src/components/WaitlistForm.tsx`, and `functions/api/waitlist.js`.

Copy only. No token, colour, component, or layout change proposed — only string edits and one
new line of plain text under the hero (audit rank 4's own ask).

---

## AC2 — access route, verified against actual behaviour

**Verdict: the mechanism ("waitlist" as a form) is accurate. The word "waitlist" as user-facing
copy is a separate, real risk — see below. Not UNKNOWN either way; both are now decided with
evidence.**

Traced every CTA on the page to what it actually does:

- `PrimaryCTA` (`src/forge-ui.tsx:174`) is a `<button onClick={() => scrollToId("cta")}>` —
  every "primary" CTA on the page (hero, mid-page, footer, mobile sticky) scrolls to the
  `id="cta"` footer section. None of them link out or start access directly.
- That footer section (`src/App.tsx:557-558`) renders `<WaitlistForm />` — a real form
  (`src/components/WaitlistForm.tsx`) that `POST`s name + email to `/api/waitlist`
  (`functions/api/waitlist.js`), which inserts into a Supabase `waitlist` table.
- Distribution channel after that: confirmed as TestFlight (product-rig beads gy-hgfkl,
  gy-3h80k, gy-ifg87.2 — active TestFlight cut/QA work). I could not find evidence of what
  triggers a TestFlight invite after a signup (manual vs. automated) — that operational detail
  is out of my visibility and not needed to write an honest "what happens next" (below), which
  deliberately doesn't promise a mechanism I can't confirm.

**Measured, not just verified — pm's 2026-08-31 addition, from push's gm-d5d discovery:** push
read `public.waitlist` on the live product Supabase (project `kpvhnbemumjmgpmmgfjp`, SELECT-only,
no PII exposed) and found **3 signups in 10 weeks** (first 2026-06-22, latest 2026-08-21). This
changes the weight of this whole item, not just its comprehension case: whatever the page is
currently asking people to do, almost nobody is doing it. Rank 2 is sequenced first in this spec
for that reason — it's the highest-value row, not a tidiness item.

**It also changes the copy itself, not just the priority.** With n=3, any copy implying a queue
of people waiting is a fabricated-demand claim the voice guide's own honest-claim guardrails
forbid. That's why this revision removes "waitlist" as a *word* from every user-facing string
(the unified CTA label already avoided it; this revision also fixes the strings I originally
left unchanged — see "Exact changes" below) and removes "when it's your turn" / "your turn"
phrasing throughout, since "turn" implies an ordered queue that doesn't meaningfully exist at
n=3. The underlying mechanism (a real form, a real database row) is unchanged and still
accurately described — the fix is entirely about not implying scale that isn't there.

**Separate, still-open question — not resolved by this verification:** whether the *site's
overall status framing* ("In beta" vs. the founder-ruled "private alpha", gy-2f2ak.4 closed
2026-08-23) is internally consistent. That is a founder-level phrase choice pm is carrying (see
gm-mva item 5) — distinct from "does clicking this button do what it says," which is what this
section verifies. This spec does not pick a status word; it only fixes CTA/access mechanics.

---

## 1. One honest CTA (audit rank 2)

### CTA inventory (AC1 — every CTA string on the page)

| # | Location | Current string | Behaviour (verified) | Verdict |
|---|---|---|---|---|
| 1 | Nav button, `src/App.tsx:258` | `Get Gymbo` | `scrollToId("cta")` → waitlist form | **CHANGE** — mismatches behaviour |
| 2 | Hero `PrimaryCTA`, `src/App.tsx:301` | `Join the waitlist` (component default) | same | **CHANGE** (via component default, see below) |
| 3 | Hero `SecondaryButton`, `src/App.tsx:302` | `Talk to us` | opens WhatsApp (`wa.me` link) | **KEEP** — accurate |
| 4 | Mid-page `PrimaryCTA`, `src/App.tsx:425` | `Join the waitlist` (component default) | same as #2 | **CHANGE** (via component default) |
| 5 | Pricing card button, `src/App.tsx:499` | `Get Gymbo` | `scrollToId("cta")` → waitlist form | **CHANGE** — mismatches behaviour |
| 6 | Footer nav, `src/App.tsx:579` | `Support` | `scrollToId("cta")` → waitlist form | **FLAG, not fixed here** — a visitor looking for support lands on a signup form, not help. Not a truth/claim defect (the button doesn't lie about a feature), but a UX mismatch. Recommend a follow-up bead pointing "Support" at the actual support channel (`mailto:damini@materiallab.io`, already in the footer one line down) instead of the CTA section. |
| 7 | Footer CTA form submit, `src/components/WaitlistForm.tsx:88` | `Join the waitlist` | real submit → Supabase `waitlist` table | **CHANGE** to match unified label |
| 8 | Footer CTA, WhatsApp link, `src/App.tsx:559-564` | `Talk to the founder` | opens WhatsApp | **KEEP** — accurate |
| 9 | Mobile sticky `PrimaryCTA`, `src/App.tsx:602` | `Join the waitlist` (component default) | same as #2 | **CHANGE** (via component default) |

**Unified label chosen:** `Join the iPhone beta` — per the audit's own suggested wording. It
names the platform restriction inline (partially doing rank 4's job too) and is more specific
than the generic "Join the waitlist," while remaining exactly as accurate: it still leads to the
same real waitlist form. "Get Gymbo" is retired everywhere until a CTA directly starts access.

### Exact changes

| Location | Exact current string | Exact replacement string |
|---|---|---|
| `src/forge-ui.tsx:174`, `PrimaryCTA` default prop | `children = "Join the waitlist"` | `children = "Join the iPhone beta"` |
| `src/App.tsx:258`, nav button | `Get Gymbo` | `Join the iPhone beta` |
| `src/App.tsx:499`, pricing card button | `Get Gymbo` | `Join the iPhone beta` |
| `src/App.tsx:545`, footer `<section>` `aria-label` | `aria-label="Join the waitlist"` | `aria-label="Join the iPhone beta"` |
| `src/App.tsx:553`, footer CTA intro line | `Join the waitlist and we'll tell you the moment it's your turn.` | `Join the iPhone beta and we'll email you a TestFlight invite.` |
| `src/components/WaitlistForm.tsx:88`, form submit button | `Join the waitlist` | `Join the iPhone beta` |
| `src/components/WaitlistForm.tsx:40`, success message | `You're on the list — we'll email you when it's your turn.` | `Request received. We'll email you a TestFlight invite.` |

**Revised from the first version of this spec** (which left the success message unchanged):
`"You're on the list — we'll email you when it's your turn."` has two problems, not one. "On the
list" / "your turn" implies an ordered queue — at n=3 that's a fabricated-demand claim (see AC2
above). It also contains an em dash, which voice guide §5 bans in shipped copy; the replacement
uses two sentences instead. The loading state `"Joining…"` (`WaitlistForm.tsx:88`, ternary) is
unchanged — it's a transient state label, not a claim about demand.

### Above-fold access line (part of rank 2's "add one line stating the real access route")

Location: hero, `src/App.tsx`, directly after the subhead paragraph (~line 299) and before the
CTA row (~line 300).

New line (insert, doesn't replace anything):
```
iPhone beta: request access and we'll email you a TestFlight invite.
```

Revised from the first version of this spec, which read "...when it's your turn" — dropped for
the same reason as the `WaitlistForm` success message above (queue implication at n=3), and the
em dash swapped for a colon per voice guide §5.

I did not state a wait time — I have no evidence of typical turnaround (see AC2 verification
above: I could not confirm what triggers an invite after signup). If pm can confirm a real
number ("usually within N days"), that's a one-word-swap addition to this line; I'm not
inventing one.

---

## 2. Above-fold qualifier (audit rank 4, XS effort, HIGH impact)

Location: hero, `src/App.tsx`, directly under the H1 or subhead (~line 299), same general area
as the access line above — landing decides exact stacking order, this spec fixes the words only.

| Location | Exact current string | Exact new string | Reason |
|---|---|---|---|
| New line, hero | *(does not exist today — currently buried in FAQ only, `src/App.tsx:137`: "Which phones does it support? iPhone, for now. That's where we're focused.")* | `For independent trainers in India · iPhone · no client app required.` | Surfaces Gymbo's strongest structural differentiator (trainer-only, clients download nothing) and the platform constraint (iPhone) above the fold instead of only in the FAQ, per audit rank 4. Wording taken directly from the audit's own suggested phrasing. Keeps the trainer-not-client model as-is — does not propose adding client-engagement surface. |

FAQ entry at `src/App.tsx:137` is unchanged — this doesn't remove the FAQ answer, it stops that
being the *only* place a visitor learns it.

---

## 3. What happens next (audit rank 6)

Location: new block, `src/App.tsx`, suggested placement: footer CTA section
(`id="cta"`, ~line 545-566), near the `WaitlistForm`, since that's where a visitor commits to
the access route the block explains.

Three steps (AC: state a wait time only if it can be met — none confirmed, see AC2 above, so
none stated):

```
1. Join the iPhone beta with your name and email.
2. Get your TestFlight invite by email.
3. Import your first clients and log your first class.
```

(Step 1 revised from the first version of this spec, which read "Request access — join the
iPhone beta..." — the em dash violated voice guide §5; rewritten as one clause instead of two
rather than swapped for a colon, since "request access" was redundant with "join.")

This is new content (no "current string" to replace) — a plain three-item list is enough,
matching the section's existing typographic scale; no new component. Exact copy above is what I
propose landing implements; if pm or push has an operational wait-time to add to step 2 ("within
N days"), that's an amendment to this file, not a blocker to landing the rest.

---

## 4. Pricing legibility (marketer fold-in, gy-gim46 rank 7, routed here by pm off gm-kkl)

Location: `src/App.tsx`, `PRICING` array / pricing card render, adjacent to the price headline
(near the `/month` number and the "Billed yearly at ₹2,999 via the App Store. Save 37%." note).

| Location | Current | New | Reason |
|---|---|---|---|
| Near price headline, both plan cards | *(no per-client-pricing contrast exists near the price today; "Unlimited clients" is a separate feature bullet elsewhere on the card)* | `One price. No per-client fees.` | Marketer's addition, evidence class MEASURED — gy-gim46 rank 7's first-party fetch of three competitor pricing pages (My PT Hub, ABC Trainerize, Everfit; all fetched 2026-08-30) confirms all three price by seat/tier/add-on; the gap on our own page (stating unlimited clients without contrasting it against per-client pricing at the point of decision) is directly observable. |

**Constraint, carried from marketer's note — do not touch:** this is legibility only. One plan,
two billing periods stays exactly as-is; this does not add a tier, change plan/billing
structure, or reverse the audit's rank-7 DELIBERATE-CHOICE-KEEP verdict on single-plan pricing.
No target metric attached — marketer's own framing, legibility not conversion.

---

## AC4 — contradiction check against gm-mva

No contradiction found. gm-mva's hero rewrite (`The business app for independent personal
trainers: payments, balances, schedules and classes from your phone.`, updated 2026-08-31 to
fold in marketer's category framing) and this spec's above-fold qualifier and access line sit in
the same hero block but don't overlap in wording or claim — gm-mva narrows the *scope and
category* claim, this spec adds *who it's for* (redundant framing check: gm-mva's H1 now also
says "independent personal trainers," and this spec's qualifier adds "in India · iPhone · no
client app required" — overlapping subject, non-contradicting content, both can ship) and *what
clicking does*. Sequencing (gm-mva lands first per pm's ruling on gm-111) doesn't change any
string in this file.

## Target metric

A first-time visitor can answer, above the fold and without scrolling to the FAQ: what this is
(qualifier line), who it's for (qualifier line), and what happens if they click (access line +
unified CTA label).
