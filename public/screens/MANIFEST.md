# Screenshot capture provenance

`scripts/check-screenshot-freshness.mjs` gates every master named in
`scripts/screens-map.mjs`. Its authoritative input is:

```
public/screens/real/capture-provenance.json
```

This file is emitted beside the PNGs during the Gymbo-v1 capture run. The
producer contract is
`Gymbo-v1/appstore/metadata/capture-provenance-contract.md` (gy-v9pwo.3).
The landing consumer is deliberately implemented against that document, not
against the producer implementation.

## Freshness rule

The gate passes only when all of the following are true:

- `build_mapping.status` is `matched`;
- `capture_tree_dirty` is `false`;
- every rendered master has a provenance entry with a SHA-256 matching its
  actual PNG bytes.

`unknown` is a visible, non-passing verdict: it means TestFlight freshness
could not be determined. It is neither stale nor fresh. A missing, malformed,
unshipped, dirty, or byte-mismatched provenance record also fails the gate.

## Never hand-edit provenance

`capture-provenance.json` must be written by the capture producer during the
capture run. Do not write, edit, or transcribe it later. The legacy
`manifest.json` is retained only as historical context and is not consumed by
the gate; its hand-transcribed metadata cannot prove which binary produced a
PNG.
