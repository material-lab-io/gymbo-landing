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
for s in "trainer" "₹400" "getgymbo|waitlist|join"; do
  grep -qiE "$s" "$HOME_FILE" && log "OK   body has /$s/" || fail "body missing /$s/ (SSG/content regression?)"
done

# OG tags present (share previews)
grep -qiE 'property="og:title"' "$HOME_FILE" && log "OK   og:title present" || fail "og:title missing"

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

echo "=== getgymbo smoke ($URL) ==="
echo "$OUT"
if [ "$FAIL" = "1" ]; then echo "RESULT: FAIL (gate would block deploy)"; exit 1; else echo "RESULT: PASS"; exit 0; fi

# NOTE: "fail on console errors" needs a headless browser. That's a landing-CI add:
# in landing's deploy workflow, run playwright against the preview build and fail on
# page.on('console', msg => msg.type()==='error'). This curl gate covers SSG/content +
# robots + privacy regressions without a browser dependency.
