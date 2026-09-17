# Claim-truth copy spec — pass 2

**Bead:** gm-t0e.1 (child of gm-t0e) · **Author:** content · **Date:** 2026-09-17
**Verified against:** `origin/main` of `gymbo-landing` (git-show + live `curl` against
`getgymbo.com`, commit `4784736da08c3911ba6fcb777ef99e67fa33ecd5`) — both the repo state and
the actual deployed page, not just one or the other.

This is a **copy spec**, not code. A landing bead lands these strings — same split as gm-mva/
gm-muo and gm-7pd/PR #169. No design token, colour, spacing, or component change is proposed.

---

## ⚠️ Flag before the table: gm-mva's own fix has not landed in code

While sweeping I checked the hero, since it's the highest-traffic string on the page. **The
hero H1 and subhead gm-mva specified in claim-truth-pass-1.md are still live, unreplaced, on
`origin/main` and on production `getgymbo.com` as of this sweep:**

- `src/App.tsx:291`, hero H1 — still reads `Run your entire fitness business from your phone.`
  (confirmed via `curl https://getgymbo.com/`, exact match).
- `src/App.tsx:298`, hero subhead — still reads `Track revenue, stay organized, look
  professional, train smarter.` (confirmed live, exact match).

gm-mva is closed with reason "Spec landed on origin/main, verified via direct diff" — that's
correct for the *spec document* (`docs/copy/claim-truth-pass-1.md` did land), but the `App.tsx`
code change it specifies has not. This is the same "spec merged as a doc, code not yet landed"
pattern as gm-7pd → PR #169 (also spec-only, merged today, `docs/copy/access-honesty-pass.md`
only — no `src/App.tsx` touched).

**Not fixing this here** — the hero is gm-mva's string, not mine, per this bead's own AC4. Flagging
because it changes what "zero absolute/overclaim strings live" actually means right now: the
single highest-risk item from pass 1 is still on production, and a second landing bead (for pass
1's hero+subhead) plus this pass's changes plus gm-7pd's access-honesty strings are all now
stacked up waiting on the same code-landing step. pm/landing may want one combined PR rather than
three sequential ones through whatever the interim non-refinery merge route is (gm-avl).

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
| Footer/final-CTA H2, `App.tsx:559` | `Run your whole business from one app.` | `Payments, schedules, and clients — one app.` | Same overclaim family as gm-mva's hero fix ("run your entire/whole business"). Scoped to the three nouns gm-mva's hero subhead already established as substantiated (payments and balances, schedules; "clients" covers the roster/organize pillar). Keeps the terse, concrete-noun register — no colon-plus-list construction (contrast with the gm-111 H1 finding: this is 3 nouns in one clause, not 4 nouns after a colon). |
| Why-section H2, `App.tsx:327` | `Everything your training business needs to run.` | `What your training business runs on.` | Drops the unbounded "everything." Sits directly above the four pillar cards (ledger, organize, brand, train), so "runs on" points at what's immediately below rather than claiming completeness; the reader judges the "everything" claim for themselves from the four cards, we don't assert it. |
| Pillar intro, `App.tsx:45` (id `revenue`, eyebrow "The Gymbo ledger") | `The Gymbo ledger tracks every class, payment, and balance automatically, so you always know where every client stands.` | `The Gymbo ledger tracks every class, payment, and balance automatically, updated the moment you log a class.` | Drops "always know... every client stands" (unbounded certainty claim). Replacement reuses the exact event-triggered phrasing gm-mva's Part B already proposed for the adjacent ledger bullet (`App.tsx:46`, below) — same fix, same sentence, keeps the two lines internally consistent instead of solving the same problem two different ways four lines apart. |

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
