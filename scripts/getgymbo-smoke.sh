#!/usr/bin/env bash
# Gymbo — getgymbo.com build-smoke gate + robots.txt regression check (gy-kefk3).
# Two uses:
#   1) PRE-DEPLOY GATE: getgymbo-smoke.sh <preview-or-prod-url>  -> exit 1 fails the deploy
#   2) SCHEDULED REGRESSION: prod-watch.yml runs this hourly against prod.
#      THIS SCRIPT NOTIFIES NOBODY, and as of 2026-09-06 NOTHING ELSE DOES
#      EITHER. It exits non-zero and stops there; no step in prod-watch.yml
#      mails, nudges or pages on that exit. The header used to claim "wrapper
#      mails marketer on non-zero exit" — never true, and it bought a belief:
#      downstream readers took "getgymbo.com is watched" off this comment when
#      only the looking worked and never the telling (gy-p7edn AC4). Do not
#      restore it, and do not replace it with a claim that async-watchdog
#      "owns" delivery until that is measured — see below.
#      Delivery is EXTERNAL BY DESIGN, not by oversight: an in-job notify step
#      cannot fire when the job dies in "Set up job" before any step runs
#      (observed: run 32181463828, 2026-08-18T20:17:51Z, event=schedule,
#      conclusion=FAILURE). The intended watcher is async-watchdog in the
#      gascity-pilot gymbo-crew pack, mailing the gymbo/gymbo-crew.watchdog
#      seat. It is MERGED (gascity-pilot#26) and NOT RUNNING: the live pack
#      loads from a working copy parked on another branch, whose order still
#      reads GYMBO_REPO=material-lab-io/Gymbo-v1 with no surfaces list, so this
#      repo is watched by nothing. Verified 2026-09-06.
#      Until gy-p7edn quotes an alert actually RECEIVED, assume a red here
#      reaches nobody. Present is not fired, and fired is not received.
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

# --- 4. product-contract.json consistency (gy-csrt8.1, G4 AC2) ---
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

  # Anthropic sub-processor disclosure (gy-lucuj) — hard gate (gy-ps60p AC2).
  # gy-lucuj's copy fix landed 2026-08-12 (PR #70); this now fails deploys instead
  # of just warning.
  ANTHROPIC_ITEM="$(jq -r '.sub_processors[] | select(.name=="Anthropic") | .data_sent[] | select(. == "today'"'"'s session client names")' "$CONTRACT")"
  if [ -n "$ANTHROPIC_ITEM" ]; then
    PRIVACY_FILE="$(mktemp)"
    curl -sL --compressed --max-time 15 -o "$PRIVACY_FILE" "$URL/privacy" 2>/dev/null
    if grep -qiE "today(&#x27;|&#39;|'|’)s session client names" "$PRIVACY_FILE"; then
      log "OK   contract: Anthropic disclosure includes 'today's session client names'"
    else
      fail "contract: /privacy does not disclose 'today's session client names' (gy-lucuj)"
    fi
    rm -f "$PRIVACY_FILE"
  fi
else
  log "WARN product-contract.json or jq unavailable — skipping contract assertions"
fi

echo "=== getgymbo smoke ($URL) ==="
echo "$OUT"
if [ "$FAIL" = "1" ]; then echo "RESULT: FAIL (gate would block deploy)"; exit 1; else echo "RESULT: PASS"; exit 0; fi

# NOTE: "fail on console errors" needs a headless browser. That's a landing-CI add:
# in landing's deploy workflow, run playwright against the preview build and fail on
# page.on('console', msg => msg.type()==='error'). This curl gate covers SSG/content +
# robots + privacy regressions without a browser dependency.
