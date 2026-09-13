# GENERATED — do not edit by hand

`forge.css`, `forge.dark.css` and `forge.hc.css` in this directory are generated
from the Forge producer and must not be edited here.

| | |
|---|---|
| Producer | `material-lab-io/Gymbo-v1` — `design-tokens/dist/` |
| Pinned commit | see `forge.pin.json` |
| Regenerate | `node scripts/sync-forge-tokens.mjs` |
| Verify | `node scripts/sync-forge-tokens.mjs --check` |
| Repin after a producer token change | `node scripts/sync-forge-tokens.mjs --pin <sha>` |

## Why this file used to be a lie (gy-1phkc)

This README previously read, in full:

> GENERATED — Forge SSOT (Gymbo-v1 design-tokens/). Re-sync on token change. GYM-597.

Nothing generated it. There was no sync script, no import, no pin and no gate
comparing this directory to the producer. A file that *claims* to be generated
while actually being hand-kept is strictly worse than an honest hand-kept file,
because the claim is exactly what stops the next person looking.

By 2026-09-11 the copy had drifted 17 tokens behind the producer and declared
`--g-font-size-micro: 10px` against the 11px hard minimum ratified in gy-hhgqi
DS2. It was unconsumed — zero `text-[10px]` in the tree — so nothing rendered
wrong; the hazard was that the first person to size micro text from the token
would have got 10px while believing they were conforming to the design system.

The claim is now true and enforced by CI (`.github/workflows/forge-tokens.yml`):

1. `sync-forge-tokens.mjs --check` — this directory matches the pinned producer commit, byte for byte.
2. `check-forge-pin-fresh.mjs` — the pin itself has not fallen behind the producer's emitted tokens.
3. `check-forge-tokens.mjs` — no literal elsewhere in the tree duplicates a Forge token.

Adding tokens here, or editing a value here, fails (1). Token changes belong in
the producer.
