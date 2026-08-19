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
today, the nine entries in `SCREENS` in `scripts/screens-map.mjs`. Both
`scripts/optimize-gallery.mjs` (build) and
`scripts/check-screenshot-freshness.mjs` (this gate) import that single
map, so the gated set always matches what actually ships — no separate
list to fall out of sync. The other files under `public/screens/real/`
are not currently rendered anywhere and are not gated (add them to
`screens-map.mjs`'s `SCREENS` map when they go live, and they'll pick up
the gate automatically — as long as a manifest entry exists for them).

The gated set grew from six to nine on 2026-08-19 (gy-k095b). Under the
founder's no-bezel rule (gy-r4nzh) the hero and the four pillar visuals
stopped being composed device art and pre-composed demo clips and became
real screenshots in bezel-less cards — so three more masters
(`hero-02-who-owes-balance.png`, `hero-03-log-payment.png`,
`workouts-04-builder.png`) now render on the live site and are in scope.

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
      "gymboCommitSha": "abc1234…",  // Gymbo-v1 commit the build was cut from
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
  "gymboCommitSha": "<git rev-parse HEAD in Gymbo-v1 at capture time>",
  "capturedAt": "<capture run's own timestamp, ISO-8601>",
  "verified": true
}
```

The build number, app version, and commit SHA are all knowable at
capture time inside the Gymbo-v1 repo/CI — this manifest schema doesn't
require anything the capture pipeline doesn't already have; it just
needs to stop throwing that information away.
