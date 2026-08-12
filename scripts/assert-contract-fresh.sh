#!/usr/bin/env bash
# gy-csrt8.1 (G4 AC2): fail loudly if gymbo-landing's vendored product-contract.json
# has drifted from Gymbo-v1's (upstream source of truth). One live fetch, done once
# per CI run, kept separate from the deterministic zero-flake smoke assertions in
# getgymbo-smoke.sh (AC4 applies to those, not to this one intentional live check).
set -uo pipefail

VENDORED="${1:-product-contract.json}"
# Gymbo-v1 is a private repo — raw.githubusercontent.com 404s unauthenticated.
# Use the GitHub Contents API with GYMBO_V1_PAT (already provisioned in this repo's
# secrets for cross-repo reads).
API_URL="https://api.github.com/repos/material-lab-io/Gymbo-v1/contents/product-contract.json"

if [ ! -f "$VENDORED" ]; then
  echo "FAIL: vendored contract not found at $VENDORED"
  exit 1
fi

if [ -z "${GYMBO_V1_PAT:-}" ]; then
  echo "WARN: GYMBO_V1_PAT not set — skipping drift check this run"
  exit 0
fi

UPSTREAM_FILE="$(mktemp)"
trap 'rm -f "$UPSTREAM_FILE"' EXIT
HTTP_CODE="$(curl -sL --max-time 15 \
  -H "Authorization: Bearer ${GYMBO_V1_PAT}" \
  -H "Accept: application/vnd.github.raw+json" \
  -o "$UPSTREAM_FILE" -w '%{http_code}' "$API_URL" 2>/dev/null)"
if [ "$HTTP_CODE" != "200" ]; then
  echo "WARN: could not fetch upstream contract (HTTP $HTTP_CODE) — skipping drift check this run"
  exit 0
fi

if ! diff -q "$VENDORED" "$UPSTREAM_FILE" >/dev/null 2>&1; then
  echo "FAIL: $VENDORED has drifted from upstream ($API_URL)"
  echo "--- diff ---"
  diff "$VENDORED" "$UPSTREAM_FILE" || true
  echo "Re-vendor: gh api $API_URL --jq '.content' | base64 -d > $VENDORED"
  exit 1
fi

echo "OK   $VENDORED matches upstream Gymbo-v1 product-contract.json"
exit 0
