#!/usr/bin/env bash
# Gymbo — getgymbo.com build-smoke gate + robots.txt regression check (gy-kefk3).
# Two uses:
#   1) PRE-DEPLOY GATE: getgymbo-smoke.sh <preview-or-prod-url>  -> exit 1 fails the deploy
#   2) SCHEDULED REGRESSION: .github/workflows/prod-watch.yml runs this hourly
#      (cron "0 * * * *") against https://getgymbo.com.
#
# WHO IS TOLD WHEN THIS EXITS NON-ZERO (gy-p7edn). Read this before adding a
# notify step, and do not restate it as a capability this file has:
#   * NOTHING IN THIS REPO NOTIFIES ANYONE. Not this script, not prod-watch.yml.
#     A previous version of this header claimed "wrapper mails marketer on
#     non-zero exit". That was false for the whole life of the file and it was
#     load-bearing: everyone downstream read it as proof getgymbo.com was
#     watched. Corrected here rather than implemented here -- see below for why.
#   * The alert path is EXTERNAL to this workflow, by design. It is the Gas City
#     `async-watchdog` cron order (custom-packs/gymbo-crew/, checks 6 and 7),
#     which reads this workflow's run CONCLUSIONS from outside and sends durable
#     `gc mail` to the gymbo/gymbo-crew.watchdog SEAT.
#   * It MUST be external. Run 32181463828 (2026-08-18T20:17:51Z, event=schedule)
#     died inside "Set up job" before any step ran. An `if: failure()` step in
#     this job could not have fired -- the job never started. A watcher that
#     lives inside the thing it watches cannot report the thing failing to start.
#   * check7 additionally alarms on the ABSENCE of an expected scheduled run,
#     because a run that was never SCHEDULED produces no run object at all, and
#     "no red" is then indistinguishable from "no run".
#   * workflow_dispatch runs are deliberately EXCLUDED from check6, so a manual
#     negative control against a broken verify_url does not page anyone. That
#     also means a manual dispatch is NOT a test of the alert path.
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

# --- 5. THE PROD DATA PATH (gy-gcr22) -------------------------------------
# WHY THIS EXISTS, and it is not a nice-to-have: /w/<token> and /m/<id> are
# server-rendered from the database with the service_role key. On 2026-09-11 that
# key was found to be ABSENT from the Cloudflare Pages PRODUCTION environment, so
# every read 401'd and BOTH surfaces had been returning their refusal page to
# every visitor since the day they shipped. Nothing went red. Nothing could:
#
#   the refusal is DELIBERATELY uniform (malformed, unknown, revoked and expired
#   all return the same bytes, so a token-guesser learns nothing) -- and that same
#   property makes a TOTAL OUTAGE indistinguishable from a correct refusal.
#
# Every check we had was a refusal check or a key-absence grep, and all of them
# pass perfectly on a page that cannot reach the database at all. A control that
# cannot fail is not a control. This section is the one that can fail.
#
# It works by opening a PERMANENT canary link on production and requiring a real
# row to come back through the whole chain: Pages Function -> env binding ->
# PostgREST -> rendered HTML. The canary is dummy data owned by the dummy QA
# trainer (share link 321c7425, workout e98c5182); the token is published here on
# purpose, because a check whose input is a secret is a check that goes quiet when
# the secret goes missing.
CANARY_TOKEN="gymbo-prod-canary-DO-NOT-DELETE"
# CANARY_ORIGIN exists so this section can be proven to go GREEN as well as red.
# A gate that has only ever been seen to fail is half a gate, and the section
# cannot be exercised against production until the binding is restored -- so
# gate-selftest.yml points it at a local fixture instead. Production is the
# default and nothing in CI overrides it except the self-test.
CANARY_ORIGIN="${CANARY_ORIGIN:-https://getgymbo.com}"
case "$URL" in
  "$CANARY_ORIGIN"|"$CANARY_ORIGIN"/|https://www.getgymbo.com|https://www.getgymbo.com/)
    CANARY_FILE="$(mktemp)"; REFUSAL_FILE="$(mktemp)"
    CCODE="$(curl -sL --compressed --max-time 20 -o "$CANARY_FILE" -w '%{http_code}' "$URL/w/$CANARY_TOKEN" 2>/dev/null)"
    RCODE="$(curl -sL --compressed --max-time 20 -o "$REFUSAL_FILE" -w '%{http_code}' "$URL/w/not-a-token" 2>/dev/null)"

    if [ "$CCODE" = "200" ] && grep -q "CANARY" "$CANARY_FILE"; then
      log "OK   data path: canary link renders from the database (200)"
    else
      fail "DATA PATH DEAD: /w/$CANARY_TOKEN returned HTTP $CCODE and no canary row. Either SUPABASE_SERVICE_ROLE_KEY is missing from the Pages PRODUCTION env (gy-gcr22 -- every DB read 401s and /m/ is dead too), or the canary rows were deleted. Check the binding FIRST; deleting the rows is the rarer cause."
    fi

    # The attribution block is rendered from exercise_media FIELDS, so this string
    # proves the media join survived too -- not just that some HTML came back.
    if grep -q "wger.de" "$CANARY_FILE"; then
      log "OK   data path: CC-BY-SA attribution rendered from exercise_media"
    else
      fail "data path: canary page has no wger attribution -- the media join or the fail-closed attribution gate is refusing"
    fi

    # 🔴 THE CONTROL THAT WAS IMPOSSIBLE TO FAIL BEFORE THIS SECTION EXISTED.
    # A valid token and a malformed one must NOT produce the same bytes. When the
    # binding was missing they were byte-identical, and that is exactly what no
    # other check in this repo could see.
    if [ "$RCODE" = "404" ]; then
      log "OK   control: a malformed token is still refused (404)"
    else
      fail "control: /w/not-a-token returned HTTP $RCODE, expected 404 -- the refusal path itself is wrong"
    fi
    if cmp -s "$CANARY_FILE" "$REFUSAL_FILE"; then
      fail "🔴 a VALID token and a MALFORMED one returned BYTE-IDENTICAL responses -- this is the gy-gcr22 signature: the page is serving its refusal to everyone"
    else
      log "OK   control: valid and malformed tokens differ"
    fi
    rm -f "$CANARY_FILE" "$REFUSAL_FILE"
    ;;
  *)
    # ATTRIBUTABLE SKIP, not a silent one. Preview deployments carry no production
    # env vars by design, so running the canary there would fail every deploy for
    # the wrong reason. prod-watch.yml runs this file against https://getgymbo.com
    # hourly, which is where the check is meant to bite.
    log "SKIP data path canary: $URL is not the production origin (runs hourly via prod-watch)"
    ;;
esac

echo "=== getgymbo smoke ($URL) ==="
echo "$OUT"
if [ "$FAIL" = "1" ]; then echo "RESULT: FAIL (gate would block deploy)"; exit 1; else echo "RESULT: PASS"; exit 0; fi

# NOTE: "fail on console errors" needs a headless browser. That's a landing-CI add:
# in landing's deploy workflow, run playwright against the preview build and fail on
# page.on('console', msg => msg.type()==='error'). This curl gate covers SSG/content +
# robots + privacy regressions without a browser dependency.
