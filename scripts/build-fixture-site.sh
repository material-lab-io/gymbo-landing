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
#        js-error | dark-theme-leak | missing-privacy-provider |
#        privacy-posthog-off-contact
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

cat >> "$OUT/privacy" <<'HTML'
<section>
  <p>Anthropic processes data in the United States. Today's session client names may be included.</p>
  <p>Groq processes voice input in the United States.</p>
  <p>PostHog processes consented product analytics in the European Union.</p>
</section>
HTML
if [ "$MODE" = "missing-privacy-provider" ]; then
  sed -i '/Groq processes/d' "$OUT/privacy"
fi
if [ "$MODE" = "privacy-posthog-off-contact" ]; then
  cat >> "$OUT/privacy" <<'HTML'
<p>When analytics is off, the app does still briefly contact PostHog at launch.</p>
HTML
fi

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
