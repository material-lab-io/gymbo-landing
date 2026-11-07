#!/usr/bin/env bash
# gy-38qovk: is the landing analytics INGEST path alive? Curl only (prod-watch.yml is curl-only, see check-prod-watch-curl-only.mjs).
#
# Why: on 7 Nov Umami showed no website_event for 27 h and nothing said whether that was no visitors or a broken path. The honest
# answer was only reachable by hand (a browser at 390 on Anton). This is the cheap hourly half of that check.
#
# It follows the visitor's own chain, one link per check, and says WHICH link broke:
#   1 the home page carries the tracker tag (src on the analytics host + data-website-id)      -> TAG_MISSING
#   2 that script.js is served (200, javascript, non-empty)                                      -> SCRIPT_DOWN
#   3 POST <origin>/api/send answers 200 with a bot UA; Umami answers {"beep":"boop"} and WRITES NOTHING, so this probe never
#     adds a pageview to the founder's numbers (a real-browser UA would add 24 a day to a site that gets ~7)  -> INGEST_DOWN
#     A reply carrying "cache" means a row WAS written: the bot filter changed and the probe would now pollute -> INGEST_WROTE_ROW
# WHAT IT CANNOT SEE: whether a real visit lands a database row (the beep path stops before the insert), and whether any real
# visitor came. "No events for N hours" is a separate, passive check that needs the database (gy-38qovk follow-up).
# Outcomes, never two: exit 0 PASS, 1 FAIL (an id above), 2 COULD-NOT-EVALUATE (the home page itself could not be fetched).
#
# usage: check-analytics-ingest.sh [site-url]     env: EXPECT_ANALYTICS_HOST (default analytics.getgymbo.com)
set -uo pipefail
SITE="${1:-https://getgymbo.com}"
EXPECT_HOST="${EXPECT_ANALYTICS_HOST:-analytics.getgymbo.com}"
UA="curl/8 gy-38qovk-ingest-probe (bot UA on purpose: Umami drops it without writing)"
HOME_FILE="$(mktemp)"; SCRIPT_FILE="$(mktemp)"; trap 'rm -f "$HOME_FILE" "$SCRIPT_FILE"' EXIT
fail() { echo "FAIL $1: $2"; exit 1; }

code="$(curl -sL --compressed --max-time 20 -o "$HOME_FILE" -w '%{http_code}' "$SITE" 2>/dev/null)"
if [ "$code" != "200" ] || [ ! -s "$HOME_FILE" ]; then echo "COULD-NOT-EVALUATE: home page not fetched (HTTP ${code:-none}) from $SITE; the tracker tag was never read"; exit 2; fi

# the tag: one <script ...> whose src points at the analytics host
TAG="$(tr '\n' ' ' < "$HOME_FILE" | grep -oiE '<script[^>]*src="[^"]*'"${EXPECT_HOST//./\\.}"'[^"]*"[^>]*>' | head -1)"
[ -n "$TAG" ] || TAG="$(tr '\n' ' ' < "$HOME_FILE" | grep -oiE '<script[^>]*src="[^"]*analytics[^"]*"[^>]*>' | head -1)"
[ -n "$TAG" ] || fail TAG_MISSING "no <script src=...${EXPECT_HOST}...> on $SITE"
SRC="$(printf '%s' "$TAG" | grep -oiE 'src="[^"]+"' | head -1 | sed -E 's/^src="//I; s/"$//')"
WID="$(printf '%s' "$TAG" | grep -oiE 'data-website-id="[^"]+"' | head -1 | sed -E 's/^data-website-id="//I; s/"$//')"
ORIGIN="$(printf '%s' "$SRC" | sed -E 's#^(https?://[^/]+).*#\1#')"
case "$ORIGIN" in "https://${EXPECT_HOST}"|"http://${EXPECT_HOST}") ;; *) fail TAG_MISSING "tracker src host is '$ORIGIN', expected $EXPECT_HOST";; esac
printf '%s' "$WID" | grep -qE '^[0-9a-f-]{36}$' || fail TAG_MISSING "tag has no valid data-website-id (got '${WID}')"
echo "OK   tag: $SRC website-id $WID"

ct="$(curl -s --max-time 20 -o "$SCRIPT_FILE" -w '%{http_code} %{content_type}' "$SRC" 2>/dev/null)"
case "$ct" in "200 "*[Jj]ava[Ss]cript*) ;; *) fail SCRIPT_DOWN "GET $SRC -> '$ct' (want 200 javascript)";; esac
[ -s "$SCRIPT_FILE" ] || fail SCRIPT_DOWN "GET $SRC returned an empty body"
echo "OK   script.js 200 javascript"

HOST="$(printf '%s' "$SITE" | sed -E 's#^https?://([^/:]+).*#\1#')"
BODY_FILE="$(mktemp)"; trap 'rm -f "$HOME_FILE" "$SCRIPT_FILE" "$BODY_FILE"' EXIT
pc="$(curl -s --max-time 20 -o "$BODY_FILE" -w '%{http_code}' -X POST "$ORIGIN/api/send" -H 'content-type: application/json' -H "user-agent: $UA" \
  -d "{\"type\":\"event\",\"payload\":{\"website\":\"$WID\",\"hostname\":\"$HOST\",\"url\":\"/\",\"language\":\"en\"}}" 2>/dev/null)"
body="$(head -c 300 "$BODY_FILE")"
[ "$pc" = "200" ] || fail INGEST_DOWN "POST $ORIGIN/api/send -> HTTP ${pc:-none} ${body}"
case "$body" in
  *'"beep"'*) echo "OK   /api/send 200 (bot filter answered; nothing written)";;
  *'"cache"'*) fail INGEST_WROTE_ROW "the probe's bot UA was recorded as a pageview ($body): Umami's bot filter changed; this check would now add a row an hour";;
  *) fail INGEST_DOWN "POST $ORIGIN/api/send -> 200 but an unrecognised body: $body";;
esac
echo "PASS analytics ingest chain alive (no database write was exercised)"
