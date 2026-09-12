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

# --- 9. THE SERVER-RENDERED SURFACES CAN ACTUALLY REACH THE DATABASE (gy-gcr22) ---
#
# 🔴 READ THIS BEFORE "SIMPLIFYING" IT TO A CHECK ON /w/ OR /m/.
#
# /w/<token> and /m/<id> were 100% dead in production from the day they shipped
# and nothing here noticed, because the Pages production environment had no
# SUPABASE_SERVICE_ROLE_KEY: every read 401'd and both handlers fell through to
# their UNIFORM REFUSAL. That refusal is a deliberate privacy property -- an
# expired-vs-unknown distinction is an oracle for a token guesser -- but it also
# makes a total outage byte-for-byte identical to a correct refusal.
#
# Measured 2026-09-11: a VALID prod-minted token and the string "not-a-token"
# both returned HTTP 404 at exactly 3884 bytes. Every check we had was a refusal
# check, and every one of them passed. A control that cannot fail is not a
# control, so the probe asks the question those routes cannot answer.
#
# 🔴 WHEN THIS IS *REQUIRED*, AND WHY IT IS NOT ALWAYS.
# The first version of this check failed the PRE-DEPLOY gate and the gate
# self-test fixtures, because both target things that legitimately have no
# database: deploy.yml runs against a local Pages EMULATOR with no bindings, and
# the self-test fixtures are a static python http.server. As written it would
# have BLOCKED EVERY DEPLOY of getgymbo.com until the production binding landed
# -- turning a prod misconfiguration into a total shipping freeze. A monitoring
# probe had been wired in as a release gate.
#
# So it is required exactly where a database is genuinely expected:
#   * ALWAYS for production, keyed off the URL itself -- NOT off an env var.
#     A flag that must be remembered is a flag that gets dropped, and dropping
#     it here would silently restore the exact blindness this check exists to
#     end. There is deliberately no way to switch it off for getgymbo.com.
#   * Otherwise opt-in via SMOKE_EXPECT_DB=1, which the gate self-test sets so
#     it can prove BOTH directions of this check on fixtures.
# When it is not required the probe STILL RUNS and STILL REPORTS. It is never
# silently skipped: an unreported check and a passing one must not look alike.
DB_REQUIRED=0
case "$URL" in
  https://getgymbo.com|https://getgymbo.com/|https://www.getgymbo.com*) DB_REQUIRED=1 ;;
esac
[ "${SMOKE_EXPECT_DB:-}" = "1" ] && DB_REQUIRED=1

ENDPOINT="$URL/api/health"
HEALTH_FILE="$(mktemp)"
HCODE="$(curl -sL --compressed --max-time 20 -o "$HEALTH_FILE" -w '%{http_code}' "$ENDPOINT" 2>/dev/null)"
HBODY="$(tr -d '\n' < "$HEALTH_FILE")"

db_verdict() {
  if [ "$HCODE" = "200" ] && printf '%s' "$HBODY" | grep -q '"db":"ok"'; then
    echo "OK|server-side database read succeeds"
  elif printf '%s' "$HBODY" | grep -q '"db":"unconfigured"'; then
    echo "FAIL|SUPABASE_SERVICE_ROLE_KEY is NOT BOUND in this environment. /w/ and /m/ are refusing EVERY request, including valid ones, and the uniform refusal hides it. This is gy-gcr22; it needs the binding added, not a code change."
  elif printf '%s' "$HBODY" | grep -q '"db":"rejected"'; then
    echo "FAIL|PostgREST REJECTED the service_role key (wrong, rotated or revoked). /w/ and /m/ are dead. Not the same as an absent binding."
  elif [ "$HCODE" = "404" ]; then
    # "The check is not there" must never read as "the check passed".
    echo "FAIL|/api/health returned 404 — the probe itself is not deployed, so DB reachability is UNKNOWN, not OK."
  else
    echo "FAIL|/api/health HTTP $HCODE body=$(printf '%s' "$HBODY" | head -c 200)"
  fi
}
DB_RESULT="$(db_verdict)"
DB_STATE="${DB_RESULT%%|*}"
DB_MSG="${DB_RESULT#*|}"

# --- THE gy-gcr22 ALLOWANCE: a NAMED, SIGNATURE-PINNED, DATED non-red ---------
#
# 🔴 WHY THIS EXISTS AT ALL. gy-gcr22 is real, known, and NOT OURS TO FIX: the
# Cloudflare Pages production environment has no SUPABASE_SERVICE_ROLE_KEY, so
# /w/ and /m/ are dead. Binding it is a prod-credential action behind the
# Kaushik gate, and pm has ruled the no-login web surface a NAMED NON-GOAL of
# this cut — it ships next. So the condition will persist for a while by
# decision, not by neglect.
#
# The harm in the meantime is WALLPAPER. This script is also prod-watch.yml's
# hourly regression and every deploy's post-deploy verification, so a permanent
# red trained everyone to stop reading both: 29 consecutive red Prod Watch runs
# over ~28 hours by 2026-09-12, and a deploy step that says FAIL while the
# deploy in fact succeeded. pm dismissed five pages as known-red in one week and
# found the MASKED COUNT BEHIND THEM HAD MOVED FROM 1 TO 6. A check nobody reads
# is worse than no check, because it still claims to be watching.
#
# 🔴 WHAT MAKES THIS AN ALLOWANCE AND NOT A SUPPRESSION — all four, on purpose:
#   PINNED TO ONE SIGNATURE. Only "db":"unconfigured" is allowed. "rejected" (a
#     wrong/rotated/revoked key), a 404 (probe not deployed), and any other HTTP
#     or body still FAIL. Those are the states that would otherwise hide behind
#     this one, and they are exactly the failure modes a reader would assume
#     "the health check is known red" already covers.
#   STILL LOUD. It prints KNOWN, not OK, and names the bead. Nothing is skipped
#     in silence and the line cannot be mistaken for a pass.
#   DATED, SO IT CANNOT OUTLIVE THE DECISION. After the date below it goes RED
#     again on its own and forces a fresh ruling. An undated allowance is a
#     permanent one that nobody chose.
#   SELF-RETIRING. If the key is ever bound, the OK branch says so and tells the
#     next reader to delete this block, so it does not linger as dead code that
#     still looks like policy.
#
# The date is MY choice, not a ruling, and it is one line to change: pm said the
# surface "ships next", so this is set to roughly a month out.
GCR22_ALLOWANCE_UNTIL="2026-10-15"
# SMOKE_FAKE_TODAY exists so the EXPIRY can itself be a negative control — an
# allowance whose expiry has never been seen to fire is an allowance nobody has
# checked is temporary. Setting it is no easier to hide than editing the
# constant above, and setting it to a PAST date only makes this gate stricter.
GCR22_TODAY="${SMOKE_FAKE_TODAY:-$(date -u +%Y-%m-%d)}"

if [ "$DB_STATE" = "OK" ]; then
  log "OK   /api/health: $DB_MSG"
  # Positive control on the allowance itself: the moment this passes, the block
  # above is dead code that still reads as policy. Say so, here, where whoever
  # is looking at a green run will see it.
  if [ "$GCR22_TODAY" \< "$GCR22_ALLOWANCE_UNTIL" ]; then
    log "INFO the gy-gcr22 allowance in this script is now UNNECESSARY (the key is bound) — delete it."
  fi
elif [ "$DB_REQUIRED" = "1" ] \
     && printf '%s' "$HBODY" | grep -q '"db":"unconfigured"' \
     && [ "$GCR22_TODAY" \< "$GCR22_ALLOWANCE_UNTIL" ]; then
  # The known, ruled-on, non-goal condition. Reported in full, attributed, and
  # deliberately NOT counted as a failure of THIS deploy or THIS hour.
  log "KNOWN /api/health: SUPABASE_SERVICE_ROLE_KEY is NOT BOUND (gy-gcr22). /w/ and /m/ refuse every request."
  log "KNOWN   ruled a non-goal of this cut by pm; binding it is a prod-credential action behind the Kaushik gate."
  log "KNOWN   NOT counted as a failure until $GCR22_ALLOWANCE_UNTIL, after which this goes RED again by design."
  log "KNOWN   every OTHER database state (rejected / 404 / any other body) still FAILS — this is pinned to one signature."
elif [ "$DB_REQUIRED" = "1" ]; then
  fail "/api/health: $DB_MSG"
else
  # Reported, attributable, and explicitly not counted -- not skipped in silence.
  log "INFO /api/health not required for this target (no database expected here; production always requires it). Observed: $DB_MSG"
fi
rm -f "$HEALTH_FILE"

echo "=== getgymbo smoke ($URL) ==="
echo "$OUT"
if [ "$FAIL" = "1" ]; then echo "RESULT: FAIL (gate would block deploy)"; exit 1; else echo "RESULT: PASS"; exit 0; fi

# NOTE: "fail on console errors" needs a headless browser. That's a landing-CI add:
# in landing's deploy workflow, run playwright against the preview build and fail on
# page.on('console', msg => msg.type()==='error'). This curl gate covers SSG/content +
# robots + privacy regressions without a browser dependency.
