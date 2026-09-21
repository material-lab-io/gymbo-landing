# Screenshot freshness manifest (gy-a73px.15)

## Why this exists

Kaushik caught the SAME stale screenshots on the live site twice
(2026-08-06, 2026-08-08) — the punch card still showed DOTS instead of
NOTCHES, weeks after the app changed. The only "detector" we had was a
human noticing a rendering detail by eye. That fails open: if nobody
looks, nothing fails.

`public/screens/manifest.json` binds every screenshot the site actually
renders to the build it was captured from. `scripts/check-screenshot-freshness.mjs`
reads that manifest in CI and **fails the deploy** if a screenshot is
unverified or older than `maxAgeDays`. This is a mechanical, fail-closed
gate — it does not require a human to notice anything.

## Scope: which screenshots are gated

Only the master files actually composited into the live site are gated —
today, the eight entries in `SCREENS` in `scripts/screens-map.mjs`. Both
`scripts/optimize-gallery.mjs` (build) and
`scripts/check-screenshot-freshness.mjs` (this gate) import that single
map, so the gated set always matches what actually ships — no separate
list to fall out of sync. The other files under `public/screens/real/`
are not currently rendered anywhere and are not gated (add them to
`screens-map.mjs`'s `SCREENS` map when they go live, and they'll pick up
the gate automatically — as long as a manifest entry exists for them).

The gated set grew on 2026-08-19 (gy-k095b) when the four pillar visuals became
real screenshots in screen-only cards. Founder correction gy-dyu6r.9 later
restored the approved photoreal hero, motion pillars, and framed gallery without
shrinking the conservative freshness scope, so the additional masters
(`hero-02-who-owes-balance.png`, `hero-03-log-payment.png`,
`workouts-04-builder.png`) remain source inputs for approved site media and stay
in scope.

### The gate was fail-open from 2026-08-12 to 2026-08-19 (fixed)

Worth knowing, because it is the exact failure this gate exists to catch,
and it happened *to the gate itself*. Commit `2809c37` (gy-5xmxm, 08-12)
re-shot **all 20** masters in `public/screens/real/` from a newer build —
and did not touch this manifest. The six entries kept asserting the older
08-08 capture (`gymboCommitSha: ba35b647`) for files that had been
replaced on disk. The gate went on passing, because it checks that an
entry is fresh and verified, not that it *describes the file it names*.

Corrected in gy-k095b by transcribing the real provenance out of
`2809c37`'s capture-run record, with each file attested by byte-identity
against the blob that commit introduced. The residual weakness is
unchanged and worth a follow-up: nothing binds an entry to its file's
content, so a recapture that forgets this manifest is still invisible.
A content hash per entry (`sha256`), checked at gate time, would close it.

## Manifest schema

`public/screens/manifest.json`:

```jsonc
{
  "maxAgeDays": 21,          // top-level freshness threshold (days)
  "entries": {
    "<sourceFile.png>": {     // key = filename in public/screens/real/
      "appVersion": "1.4.2",         // Gymbo-v1 app version at capture time
      "buildNumber": "231",          // Gymbo-v1 build number at capture time
      "gymboCommitSha": "abc1234…",  // Gymbo-v1 commit the build was cut from. MUST be reachable from Gymbo-v1 main (see the hard condition below)
      "capturedAt": "2026-08-10T09:00:00+05:30", // ISO-8601 capture timestamp
      "verified": true,              // real capture-run data, not backfilled
      "note": "optional free text"
    }
  }
}
```

An entry fails the gate if:
- it is missing entirely for a gated source file,
- `verified` is not `true`, or
- `capturedAt` is older than `maxAgeDays` from the time CI runs.

## What "current" means — decision (option b), gy-a73px.15

The founder asked for screenshots of "the updated app currently on
TestFlight." Two ways to define "current":

- **(a) latest TestFlight build**, via an App Store Connect API read.
- **(b) `origin/main` HEAD of Gymbo-v1**, as a proxy.

**This gate takes (b).** Reason: (b) is verifiable entirely from data the
capture run already has (`gymboCommitSha`, recorded at capture time by
`scripts/capture-appstore-screenshots.sh` in the Gymbo-v1 repo) and
requires no cross-repo credentials or App Store Connect API wiring in
this repo's CI. (a) is the more literal reading of what he asked for, but
would need an ASC API read added to this pipeline (gy-4o79p has ASC
pipelines in the Gymbo-v1 repo already — a future iteration could use
those and swap the freshness check from wall-clock age to a commit/build
comparison).

**Named failure modes of (b), so they're not a surprise later:**
1. `origin/main` can be *ahead* of what's actually on TestFlight — this
   gate would then fail a screenshot set that is fresher than the build
   real users see, purely on `main` having moved on.
2. A TestFlight build can be cut from a branch other than `main` — this
   gate would then pass a screenshot set that is actually stale relative
   to what's on TestFlight, because `main` hadn't merged the branch yet.

Given those, this iteration enforces freshness by **wall-clock age**
(`capturedAt` vs `maxAgeDays`, default 21 days) rather than by comparing
`gymboCommitSha` to a live `origin/main` lookup — that would need
cross-repo CI access this repo doesn't have configured yet. The
`gymboCommitSha` field is still recorded per entry so a future gate
iteration can add the exact commit comparison without a manifest schema
change. Flagging this explicitly rather than silently shipping a partial
gate: **today's gate catches "screenshots are old," not "screenshots
don't match main."** That's most of what tripped Kaushik twice (weeks-old
captures), but it would not catch a same-day capture from a stale branch.

## Bootstrap state (as of this bead)

The six gated entries in `manifest.json` are backfilled from each
source file's git history, not from a real capture run — every entry has
`verified: false`, so **this gate fails closed immediately on landing**,
because the current committed screenshots are the exact stale ones
Kaushik flagged. That's intentional: the gate should not lie about the
state it finds. Clearing it requires `gy-5xmxm` (recapture) to run and
populate real `appVersion` / `buildNumber` / `gymboCommitSha` /
`capturedAt` / `verified: true` values.

## For the capture crew: populating a real entry

After a capture run (`scripts/capture-appstore-screenshots.sh` in the
Gymbo-v1 repo, or the crew/capture marketing recorder), update the
corresponding `public/screens/real/<file>.png` AND its manifest entry in
the same commit:

```jsonc
"hero-01-dashboard-clean.png": {
  "appVersion": "<from Info.plist / xcodebuild build settings>",
  "buildNumber": "<same>",
  "gymboCommitSha": "<full 40-char sha of a Gymbo-v1 commit that is an ANCESTOR of origin/main; see the hard condition below>",
  "capturedAt": "<capture run's own timestamp, ISO-8601>",
  "verified": true
}
```

The build number, app version, and commit SHA are all knowable at
capture time inside the Gymbo-v1 repo/CI — this manifest schema doesn't
require anything the capture pipeline doesn't already have; it just
needs to stop throwing that information away.

### 🔴 HARD CONDITION: the recorded `gymboCommitSha` MUST be reachable from Gymbo-v1 main

Do not record a sha that only exists on a branch. The 2026-08-12 capture
(gy-5xmxm) was run from the branch `gy-5xmxm-landing-recapture` and recorded
that branch's `86f34ef2`. The branch was never merged and is gone, so **all 8
masters' provenance points at a commit nobody can open.** Nothing can be
re-anchored to a real build, and the asset-drift check has to fall back to an
approximate date anchor for every master.

Before you commit a manifest entry, run this in a **full** Gymbo-v1 clone
(`--depth 1` will not do):

```
git -C <Gymbo-v1 clone> fetch origin main
git -C <Gymbo-v1 clone> merge-base --is-ancestor <the sha you are about to record> origin/main && echo REACHABLE
```

It must print `REACHABLE` (exit 0). If it does not:

- capture from a commit that is on main, **or**
- merge the capture branch first, then record the sha that main now has.

Do not record the branch sha and explain it in `note`. A note does not make a
sha resolvable.

**What enforces this today, stated plainly:** nothing automatic. The freshness
gate cannot verify reachability, because the required `deploy` job has no
checkout of Gymbo-v1, and the gate must not be tightened to reject short shas:
the eight current entries would turn the sole required check red. The
asset-drift check (`scripts/check-master-asset-drift.mjs`) does detect this, by
printing an APPROXIMATE anchor and the reason for every master whose sha is not
an ancestor of main, but it is **unwired** until gy-1je63 lands. So today this
condition is a rule you follow, not a control that catches you. The capture
script that produces the sha (`scripts/capture-appstore-screenshots.sh`, landing
profile, held as gy-rxppn) is the right place to refuse to publish from a
non-main HEAD; that is noted on gy-rxppn.

## Asset drift: "did the screen change" (gy-iit8q) — 🔴 UNWIRED

The freshness gate above asks how OLD a master is. It cannot say whether the
app's SCREEN changed since, and neither can a code diff: on 2026-09-21 an audit
that read every Swift value change returned "no change" for two masters that had
visibly changed, because PR #568 swapped the bottom-bar avatar by adding an
image asset and no `.swift` line said so.

`scripts/check-master-asset-drift.mjs` diffs the app's `ios/Gymbo/Resources`
tree from each master's capture build to the app's main and reports what changed.
Read its header before trusting it. In short:

- **UNWIRED.** Its logic is unit-tested in CI, but nothing runs it against the
  real Gymbo-v1 checkout. Wiring is gy-1je63. Until then it protects nothing.
- **Advisory, never blocking, never in `deploy`.** Its signal is monotonic, so it
  would be a scheduled outage generator exactly like the age gate was (gy-7anl3,
  gy-fs7pe).
- **Three outcomes, three exit codes:** 0 NONE, 3 FOUND, 2 COULD-NOT-LOOK.
  Blindness (shallow clone, missing resources tree, missing manifest entry) is
  never reported as NONE and outranks FOUND.
- **It reports what changed, not what is depicted.** A FOUND means resources
  changed since that master's capture; whether that master shows them needs a
  human or a rendered comparison. It is not a pixel check.
- **Every master is on the approximate date anchor today.** The manifest's
  `gymboCommitSha` (86f34ef2) is the unmerged capture branch and is not in
  Gymbo-v1's history. A recapture that records a reachable sha makes it exact.

```
node scripts/check-master-asset-drift.mjs --app-repo <full Gymbo-v1 clone>
```
