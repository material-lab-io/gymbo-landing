#!/usr/bin/env bash
# Gymbo — getgymbo.com build-smoke gate + robots.txt regression check (gy-kefk3).
# Two uses:
#   1) PRE-DEPLOY GATE: getgymbo-smoke.sh <preview-or-prod-url>  -> exit 1 fails the deploy
#   2) SCHEDULED REGRESSION: run on cron against prod; wrapper mails marketer on non-zero exit
# Dependency-light (curl only). Console-error check = landing-CI add (playwright); see note.
set -uo pipefail

URL="${1:-https://getgymbo.com}"
FAIL=0
OUT=""
log() { OUT="${OUT}$1"$'\n'; }
fail() { OUT="${OUT}FAIL: $1"$'\n'; FAIL=1; }

# --- 1. Homepage renders (SSG didn't break) ---
HOME_FILE="$(mktemp)"; trap 'rm -f "$HOME_FILE" "$ROBOTS_FILE" 2>/dev/null' EXIT
CODE="$(curl -sL --compressed --max-time 20 -o "$HOME_FILE" -w '%{http_code}' "$URL" 2>/dev/null)"
[ "$CODE" = "200" ] && log "OK   homepage 200" || fail "homepage HTTP $CODE (expected 200)"

# title contains Gymbo
grep -qiE "<title>[^<]*gymbo" "$HOME_FILE" && log "OK   <title> has 'Gymbo'" || fail "<title> missing 'Gymbo' (page may not have rendered)"

# key content strings (assert the real page body is there, not a blank shell)
for s in "trainer" "₹399" "getgymbo|waitlist|join"; do
  grep -qiE "$s" "$HOME_FILE" && log "OK   body has /$s/" || fail "body missing /$s/ (SSG/content regression?)"
done

# OG tags present (share previews)
grep -qiE 'property="og:title"' "$HOME_FILE" && log "OK   og:title present" || fail "og:title missing"

# --- 1b. Light-only theme invariant (PM scope addition, gy-ruxbj, 2026-08-12) ---
# Kaushik was served a dark site with no escape (gy-31moh removed the toggle
# but a runtime theme-flip script was still reading localStorage). Ruling:
# LIGHT ONLY, dark removed entirely (gy-uesmd). This is a STATIC regression
# guard on the served HTML — it cannot see a post-hydration localStorage
# flip (that needs a browser; see console-check.mjs's dark-seed check for
# the assertion that covers gy-31moh's exact failure mode), but it does
# catch the theme ever shipping dark by default again.
grep -qiE 'theme-color["'"'"'][^>]*content="#FAFAF[0-9A-F]"' "$HOME_FILE" \
  && log "OK   theme-color meta is light (#FAFAFx family)" \
  || fail "theme-color meta missing or not light — dark-by-default regression?"
grep -qiE 'data-theme="dark"' "$HOME_FILE" \
  && fail "raw HTML ships data-theme=\"dark\" — light-only invariant (gy-uesmd) broken" \
  || log "OK   no data-theme=\"dark\" baked into served HTML"

# --- 2. robots.txt regression (the CF managed-robots AI-bot block must NOT reappear) ---
ROBOTS_FILE="$(mktemp)"
curl -sL --compressed --max-time 15 -o "$ROBOTS_FILE" "$URL/robots.txt" 2>/dev/null
[ -s "$ROBOTS_FILE" ] && log "OK   robots.txt reachable" || fail "robots.txt empty/unreachable"
# AI crawlers must NOT be Disallowed
for bot in ClaudeBot GPTBot PerplexityBot Google-Extended OAI-SearchBot CCBot; do
  if grep -A3 -iE "User-agent: *$bot" "$ROBOTS_FILE" | grep -qiE "Disallow: */"; then
    fail "robots.txt DISALLOWS $bot (CF managed-robots AI block regressed!)"
  fi
done
if grep -qiE "Disallow: */ *$" "$ROBOTS_FILE" && grep -B2 -iE "Disallow: */ *$" "$ROBOTS_FILE" | grep -qiE "User-agent: *\*"; then
  fail "robots.txt has blanket 'Disallow: /' for *"
else
  log "OK   no blanket Disallow"
fi
grep -qiE "Sitemap:" "$ROBOTS_FILE" && log "OK   sitemap referenced in robots" || log "WARN robots.txt has no Sitemap: line"

# --- 3. privacy/terms still live (compliance regression guard, overlaps gy-gkfx3) ---
for p in privacy terms; do
  c="$(curl -sL -o /dev/null -w '%{http_code}' --max-time 15 "$URL/$p" 2>/dev/null)"
  [ "$c" = "200" ] && log "OK   /$p 200" || fail "/$p HTTP $c"
done

# --- 4. product-contract.json consistency (gy-csrt8.1, gy-wwr2e.31) ---
# Deterministic string/JSON match only, against the VENDORED contract file (no
# live-fetch here — that's assert-contract-fresh.sh's job, run as a separate CI
# step). Contract drift between gymbo-landing and Gymbo-v1 fails loudly there.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACT="${CONTRACT:-$SCRIPT_DIR/../product-contract.json}"
if [ -f "$CONTRACT" ] && command -v jq >/dev/null 2>&1; then
  MONTHLY="$(jq -r '.pricing.monthly_inr' "$CONTRACT")"
  ANNUAL_DISPLAY="$(jq -r '.pricing.annual_inr_display' "$CONTRACT")"
  SAVINGS="$(jq -r '.pricing.annual_savings_percent' "$CONTRACT")"

  grep -qF "$MONTHLY" "$HOME_FILE" && log "OK   contract: monthly price ($MONTHLY) present" || fail "contract: monthly price ($MONTHLY) missing from rendered site"
  grep -qF "$ANNUAL_DISPLAY" "$HOME_FILE" && log "OK   contract: annual price display ($ANNUAL_DISPLAY) present" || fail "contract: annual price display ($ANNUAL_DISPLAY) missing from rendered site"
  grep -qF "${SAVINGS}%" "$HOME_FILE" && log "OK   contract: annual savings (${SAVINGS}%) present" || fail "contract: annual savings (${SAVINGS}%) missing from rendered site"

  # Every currently canonical sub-processor must be named on the rendered
  # privacy notice and use the contract's processing-region fact.  Keep this
  # deterministic: product-contract.json intentionally uses plain strings and
  # lists, rather than a schema library.  The provider extension will add the
  # richer retention/contract-state checks; do not infer those absent fields.
  PRIVACY_FILE="$(mktemp)"
  curl -sL --compressed --max-time 15 -o "$PRIVACY_FILE" "$URL/privacy" 2>/dev/null
  if [ ! -s "$PRIVACY_FILE" ]; then
    fail "contract: could not fetch /privacy for disclosure comparison"
  else
    while IFS=$'\t' read -r NAME REGION; do
      [ -n "$NAME" ] || continue
      grep -qiF "$NAME" "$PRIVACY_FILE" \
        && log "OK   contract: /privacy names $NAME" \
        || fail "contract: /privacy omits provider $NAME"

      # FAIL CLOSED, deliberately and narrowly: Gymbo-v1's legacy Anthropic
      # region=US field cannot represent compliance's approved multi-region
      # processing plus US storage fact.  Coach owns the canonical split-field
      # extension on gy-wwr2e.31.  Do not remove this red: it is the visible
      # accountability signal until location.processing_locations and
      # location.storage_location replace the legacy field.
      if [ "$NAME" = "Anthropic" ] && [ "$REGION" = "US" ]; then
        fail "contract: Anthropic legacy region=US is unapproved; compliance approves multi-region processing with US storage, and Coach must supply canonical split location fields on gy-wwr2e.31"
        continue
      fi

      case "$REGION" in
        US) RENDERED_REGION="United States" ;;
        EU) RENDERED_REGION="European Union" ;;
        *) RENDERED_REGION="$REGION" ;;
      esac
      # A page-level region search is vacuous: Anthropic and Groq both currently
      # mention the United States.  Bind the region to the provider's own
      # rendered disclosure block instead.  2,000 characters accommodates the
      # prose/list markup without permitting a match in the next provider block.
      if PROVIDER_NAME="$NAME" PROVIDER_REGION="$RENDERED_REGION" \
        perl -0ne 'exit(index(lc($_), lc($ENV{PROVIDER_NAME})) >= 0 && /\Q$ENV{PROVIDER_NAME}\E.{0,2000}\Q$ENV{PROVIDER_REGION}\E/is ? 0 : 1)' "$PRIVACY_FILE"; then
        log "OK   contract: /privacy names $NAME processing region ($RENDERED_REGION)"
      else
        fail "contract: /privacy omits $NAME processing region ($RENDERED_REGION)"
      fi
    done < <(jq -r '.sub_processors[] | [.name, .region] | @tsv' "$CONTRACT")
  fi

  # Anthropic's data-category assertion — hard gate (gy-lucuj / gy-ps60p AC2).
  # gy-lucuj's copy fix landed 2026-08-12 (PR #70); this now fails deploys instead
  # of just warning.
  ANTHROPIC_ITEM="$(jq -r '.sub_processors[] | select(.name=="Anthropic") | .data_sent[] | select(. == "today'"'"'s session client names")' "$CONTRACT")"
  if [ -n "$ANTHROPIC_ITEM" ]; then
    if grep -qiE "today(&#x27;|&#39;|'|’)s session client names" "$PRIVACY_FILE"; then
      log "OK   contract: Anthropic disclosure includes 'today's session client names'"
    else
      fail "contract: /privacy does not disclose 'today's session client names' (gy-lucuj)"
    fi
  fi
  rm -f "$PRIVACY_FILE"
else
  fail "product-contract.json or jq unavailable — refusing to skip contract assertions"
fi

# Current Analytics.swift does not initialise PostHog or make a PostHog request
# unless analytics consent is on.  The old notice claimed the opposite (a launch
# configuration call while off), which turns an absence of collection into a
# specific false disclosure.  Keep this separate from the manifest until coach
# adds collection-condition fields to the canonical contract.
PRIVACY_FILE="$(mktemp)"
curl -sL --compressed --max-time 15 -o "$PRIVACY_FILE" "$URL/privacy" 2>/dev/null
if [ ! -s "$PRIVACY_FILE" ]; then
  fail "privacy: could not fetch /privacy for PostHog consent assertion"
elif grep -qiE 'contact PostHog.{0,240}at launch' "$PRIVACY_FILE"; then
  fail "privacy: says PostHog is contacted at launch while analytics is off"
else
  log "OK   privacy: no PostHog launch contact while analytics is off"
fi
rm -f "$PRIVACY_FILE"

echo "=== getgymbo smoke ($URL) ==="
echo "$OUT"
if [ "$FAIL" = "1" ]; then echo "RESULT: FAIL (gate would block deploy)"; exit 1; else echo "RESULT: PASS"; exit 0; fi

# NOTE: "fail on console errors" needs a headless browser. That's a landing-CI add:
# in landing's deploy workflow, run playwright against the preview build and fail on
# page.on('console', msg => msg.type()==='error'). This curl gate covers SSG/content +
# robots + privacy regressions without a browser dependency.
