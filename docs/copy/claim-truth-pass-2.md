# Claim-truth copy spec — pass 2

**Bead:** gm-t0e.1 (child of gm-t0e) · **Author:** content · **Date:** 2026-09-17
**Verified against:** `origin/main` of `gymbo-landing` (git-show + live `curl` against
`getgymbo.com`, commit `4784736da08c3911ba6fcb777ef99e67fa33ecd5`) — both the repo state and
the actual deployed page, not just one or the other.

This is a **copy spec**, not code. A landing bead lands these strings — same split as gm-mva/
gm-muo and gm-7pd/PR #169. No design token, colour, spacing, or component change is proposed.

---

## ⚠️ Status note: gm-mva's hero code-landing is in flight, not yet merged

While sweeping I checked the hero, since it's the highest-traffic string on the page. At the time
of the original sweep, the hero H1/subhead gm-mva specified in `claim-truth-pass-1.md` were still
live, unreplaced, on `origin/main` and on production `getgymbo.com`.

**Revised on pm review (PR #172, head 9c0be3b):** pm confirmed this was accurate but not a defect —
gm-mva was a spec bead; landing the code was always the separate gm-muo bead, which is up now as
PR #171 (reviewed and approved by pm, not yet merged as of this revision). Updating this section
so it doesn't go stale on merge, rather than leaving the original "still live" framing to be read
as current after #171 lands:

- `src/App.tsx:291`/`:298` (hero H1/subhead) — fixed by gm-muo / PR #171, approved, pending merge.
- This pass's changes (Parts A/B/C below) and gm-7pd's access-honesty strings will land in one
  **combined** PR after #171 merges, per pm's ruling — removing two of the three sequential
  `App.tsx` PRs that would otherwise conflict with each other.

No action needed from this doc beyond stating current status accurately; the combined-landing
sequencing is pm's call, already made.

---

## Sweep method (AC2)

Grepped `src/App.tsx` and every content-data file feeding a routed page (`src/content/blog/
posts.ts`, `src/content/alternatives/pages.ts`, `src/content/guide/pillars.ts`, `src/content/
research/reports.ts`) plus `src/pages/Privacy.tsx` and `src/pages/Terms.tsx`, for the phrase
families named in this bead: `run (your|the) (entire|whole)`, `everything`, `always`, `nothing
slips` (case-insensitive), then read each hit in context to judge whether it's a Gymbo capability
claim (in scope) or generic trainer advice not attributed to the product (out of scope, noted but
not fixed). Verified the home-page hits against the live rendered page with `curl`, not just
source, since gm-mva's own spec notes hero text can be split across JSX nodes — these seven hits
are all plain string/template literals, no split-node risk.

**Page inventory** (from `src/routes.ts`, the single source of truth for routed pages): 6 static
pages (home, compare, privacy, terms, blog index, guide index) + 4 blog posts + 4 alternatives
pages + 12 guide pillars + 3 research reports = **29 routed pages** as of this sweep. (The bead's
"16 secondary pages" figure is gm-pzp's count from 2026-08-31, for a narrower trial/access-copy
sweep, before the guide and research sections existed — not this sweep's own count. Stating the
real number so a "zero" claim here can be trusted against the current site, not the 08-31 one.)

---

## Part A — home page (`src/App.tsx`)

| Location | Exact current string | Exact replacement string | Reason |
|---|---|---|---|
| Footer/final-CTA H2, `App.tsx:559` | `Run your whole business from one app.` | `Payments, schedules, and clients in one app.` | Same overclaim family as gm-mva's hero fix ("run your entire/whole business"). Scoped to the three nouns gm-mva's hero subhead already established as substantiated (payments and balances, schedules; "clients" covers the roster/organize pillar). Keeps the terse, concrete-noun register — no colon-plus-list construction (contrast with the gm-111 H1 finding: this is 3 nouns in one clause, not 4 nouns after a colon). **Revised per pm review (PR #172, head 9c0be3b):** original draft used an em dash, banned in user-visible copy by the voice guide (v6, 2026-08-13). Replaced with "in" and kept the Oxford comma — `App.tsx` uses it consistently on every 3+-item list (`:45` "payment, and balance", `:78` "tagline, and details", `:60` "schedule, and class"), so dropping it here would be the one inconsistent list on the page. |
| Why-section H2, `App.tsx:327` | `Everything your training business needs to run.` | `What your training business runs on.` | Drops the unbounded "everything." Sits directly above the four pillar cards (ledger, organize, brand, train), so "runs on" points at what's immediately below rather than claiming completeness; the reader judges the "everything" claim for themselves from the four cards, we don't assert it. |
| Pillar intro, `App.tsx:45` (id `revenue`, eyebrow "The Gymbo ledger") | `The Gymbo ledger tracks every class, payment, and balance automatically, so you always know where every client stands.` | `The Gymbo ledger tracks every class, payment, and balance you log, so you can see where each client stands.` | Drops "always know... every client stands" (unbounded certainty claim). **Revised per pm review (PR #172, head 9c0be3b):** original draft kept "automatically" alongside the new "updated the moment you log a class," which asserted the ledger is both automatic and manually triggered in the same sentence — the ledger updates from what the trainer logs, not on its own. Dropped "automatically" and scoped the whole sentence to logged activity, per pm's direction; kept the Oxford comma to match the page's existing list convention. |

## Part B — gm-mva's held-back absolutes (now unblocked)

gm-mva's spec (Part B, "flagged, held out of pass 1 to keep it small and landable") already wrote
these three bounded rewrites. Carrying them forward verbatim — no new drafting needed, and reusing
already-reasoned copy is safer than redrafting under a different bead:

| Location | Exact current string | Exact replacement string | Reason |
|---|---|---|---|
| Ledger bullet, `App.tsx:47` | `Every balance, clear: credit and classes left, always current` | `Every balance, clear: credit and classes left, updated the moment you log a class.` | Carried from gm-mva Part B, unchanged. |
| Ledger bullet, `App.tsx:49` | `Cash or UPI logged. Nothing slips.` | `Cash or UPI logged, so you don't lose track.` | Carried from gm-mva Part B, unchanged. |
| FAQ answer, `App.tsx:136` ("Does it work offline?") | `Yes. Log classes and payments without signal; everything syncs when you're back online.` | `Yes. Log classes and payments without signal; they sync when you're back online.` | Carried from gm-mva Part B, unchanged. |

**Count correction:** the bead description cites pm's count of "2" for `everything syncs`
instances; re-counted and confirmed **1** (App.tsx:136 only) — content's original count was
right. No second instance exists anywhere in the repo.

## Part C — secondary pages (guide + alternatives)

Two direct Gymbo-capability claims, same families, on routed secondary pages:

| Location | Exact current string | Exact replacement string | Reason |
|---|---|---|---|
| `src/content/alternatives/pages.ts:178`, "Choose Gymbo if" bullet (`/alternatives/*` comparison pages) | `You want to log a session in one tap and always know who's paid and who owes.` | `You want to log a session in one tap and see who's paid and who owes.` | Direct product claim ("Choose Gymbo if you get X"), same "always" family as the home-page fixes. `see` states the same capability without an unbounded-certainty verb. |
| `src/content/guide/pillars.ts:185`, "where Gymbo fits" section, `get-organized-personal-trainer` guide | `[Gymbo](/) keeps your schedule tied to reality. Each session logs with one tap against the client's package balance, so you always know who's due and who's running low, and nothing double-books in your head.` | `[Gymbo](/) keeps your schedule tied to reality. Each session logs with one tap against the client's package balance, so you can see who's due and who's running low, without double-booking in your head.` | Two absolutes in one sentence, both attributed directly to Gymbo ("always know," "nothing double-books") — same families as Parts A/B, on a page the sweep scope names explicitly. |

**Reviewed, not fixed — generic advice, no Gymbo attribution (out of scope for this family
sweep):** `src/content/guide/pillars.ts` lines 140, 146, 200, 223, 300, 498, 513 all use "always
current" / "always know" / "nothing... slips or double-books," but as general personal-training
business advice ("tie every session to the client's package balance so you always know who's
due") — not a claim about what Gymbo specifically does. These read as the educational voice of an
AEO how-to guide, not a product overclaim; leaving them as-is. Flagging the distinction explicitly
per the standing "name the axis" note, since a mechanical string match would flag all of them and
that would overstate this pass's actual finding.

`src/content/blog/posts.ts:53` ("run their entire business on three free tools") describes the
*pre-Gymbo* status quo the post is arguing against, not a Gymbo claim — reviewed, not a hit.
`src/content/blog/posts.ts:74` ("hold the whole business in your head") is the same rhetorical
pattern. Neither touched.

Privacy, Terms, blog index, guide index, research reports, and all 3 alternatives/compare pages
not listed above: swept, zero hits from any family.

---

## Target metric

After this spec lands (alongside gm-mva's still-outstanding hero/subhead landing and gm-7pd's
still-outstanding access-honesty landing — see the flag above), zero "run your entire/whole
business," unscoped "everything," or unbounded "always"/"nothing slips" claims remain on any of
the 29 routed getgymbo.com pages, checked against rendered output, not just source.
