#!/usr/bin/env bash
# Gate self-test fixture builder (gy-ruxbj / G3).
#
# Builds a tiny static site under <outdir> that is otherwise a CORRECT
# getgymbo.com stand-in (title, pricing copy, robots.txt, sitemap, /privacy,
# /terms all present and passing) except for exactly ONE deliberate
# violation, selected by <mode>. Serve it with `python3 -m http.server` and
# point scripts/getgymbo-smoke.sh / scripts/console-check.mjs at it — the
# gate must fail on every mode below, and pass on `good`.
#
# Usage: build-fixture-site.sh <outdir> <mode>
# Modes: good | no-title | missing-pricing | robots-disallow-claudebot |
#        js-error | dark-theme-leak | db-unconfigured | db-rejected
set -euo pipefail

OUT="${1:?usage: build-fixture-site.sh <outdir> <mode>}"
MODE="${2:?usage: build-fixture-site.sh <outdir> <mode>}"
mkdir -p "$OUT"

TITLE_TAG='<title>Gymbo — the app for independent trainers</title>'
[ "$MODE" = "no-title" ] && TITLE_TAG='<!-- no title on purpose -->'

PRICING_LINE='<p>Built for trainers. Just ₹399/mo or ₹2,999/yr (save 37%).</p>'
[ "$MODE" = "missing-pricing" ] && PRICING_LINE='<p>Built for trainers.</p>'

# A dark-mode theme-flip script — reintroduced only for the dark-theme-leak
# fixture, to prove the light-only invariant gate (PM scope addition,
# 2026-08-12) would catch a regression of gy-uesmd/gy-31moh.
THEME_SCRIPT=""
if [ "$MODE" = "dark-theme-leak" ]; then
  THEME_SCRIPT='<script>if(localStorage.getItem("theme")==="dark"){document.documentElement.setAttribute("data-theme","dark");document.body.style.background="#0b0b0d";}</script>'
fi

ERROR_SCRIPT=""
[ "$MODE" = "js-error" ] && ERROR_SCRIPT='<script>window.__nonExistentGymboApi.boom();</script>'

# /api/health — the gy-gcr22 DB reachability probe.
#
# The good fixture MUST serve it: without it the baseline 404s, check 9 reports
# "the probe is not deployed" and the whole negative-control suite below becomes
# untrustworthy. That is exactly what happened on the first attempt at this
# change, and the sanity step caught it.
#
# Serving it here also means the fixture exercises the check's PASS path, so
# "good" is a real positive control rather than an absence of failure.
#
# python3 -m http.server always answers 200, so the db-unconfigured mode below
# differs by BODY, not status. That is fine and deliberate: check 9 branches on
# the body precisely so it can tell "unconfigured" from "rejected" from "not
# deployed" rather than collapsing them into one status code.
mkdir -p "$OUT/api"
if [ "$MODE" = "db-rejected" ]; then
  # gy-gcr22 allowance anti-masking fixture. A key that EXISTS and is wrong,
  # rotated or revoked is a DIFFERENT failure from an absent binding, and it is
  # the one most likely to hide behind "the health check is known red".
  printf '%s' '{"db":"rejected","detail":"fixture: PostgREST refused the key"}' > "$OUT/api/health"
elif [ "$MODE" = "db-unconfigured" ]; then
  printf '%s' '{"db":"unconfigured","detail":"fixture: binding absent"}' > "$OUT/api/health"
else
  printf '%s' '{"db":"ok"}' > "$OUT/api/health"
fi

cat > "$OUT/index.html" <<HTML
<!doctype html>
<html>
<head>
$TITLE_TAG
<meta property="og:title" content="Gymbo">
<meta name="theme-color" content="#FAFAF7">
<style>body{background:#FAFAF7;}</style>
</head>
<body>
$PRICING_LINE
<p>trainer dashboard, getgymbo waitlist</p>
$THEME_SCRIPT
$ERROR_SCRIPT
</body>
</html>
HTML

# /privacy and /terms as extensionless flat files — python http.server serves
# them fine on GET, content-type doesn't matter to a curl/grep-based check.
cp "$OUT/index.html" "$OUT/privacy"
cp "$OUT/index.html" "$OUT/terms"

cat > "$OUT/robots.txt" <<ROBOTS
User-agent: *
Allow: /

User-agent: ClaudeBot
ROBOTS
if [ "$MODE" = "robots-disallow-claudebot" ]; then
  echo "Disallow: /" >> "$OUT/robots.txt"
else
  echo "Allow: /" >> "$OUT/robots.txt"
fi
echo "" >> "$OUT/robots.txt"
echo "Sitemap: https://getgymbo.com/sitemap.xml" >> "$OUT/robots.txt"

cat > "$OUT/sitemap.xml" <<'SITEMAP'
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://getgymbo.com/</loc></url>
</urlset>
SITEMAP

echo "Fixture '$MODE' built at $OUT"
