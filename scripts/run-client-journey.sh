#!/usr/bin/env bash
# gy-t9mm8 AC5 — run the client journey against the Cloudflare Pages emulator.
#
# PER-RUN FREE PORTS, never fixed ones: the gt2 host runs concurrent jobs and a
# fixed port is the gy-cjdtw collision ("localhost:4173 already used", "Pages
# emulator never became ready"). Same discipline as deploy.yml's smoke gate.
set -euo pipefail
cd "$(dirname "$0")/.."

free_port() { python3 -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));print(s.getsockname()[1]);s.close()'; }

MOCK_PORT=$(free_port)
PAGES_PORT=$(free_port)
export MOCK_TOKEN="abcdefghijklmnopqrstuvwxyz01"
export SUPABASE_SERVICE_ROLE_KEY="journey-fake-service-key"

cleanup() { kill "${MOCK_PID:-}" "${PAGES_PID:-}" 2>/dev/null || true; }
trap cleanup EXIT

MOCK_PORT=$MOCK_PORT node scripts/mock-supabase.mjs > /tmp/mock-supabase.log 2>&1 &
MOCK_PID=$!
for _ in $(seq 1 40); do grep -q MOCK_SUPABASE_PORT /tmp/mock-supabase.log && break; sleep 0.25; done
grep -q MOCK_SUPABASE_PORT /tmp/mock-supabase.log || { echo "::error::mock supabase never started"; cat /tmp/mock-supabase.log; exit 1; }
export MOCK_URL="http://127.0.0.1:${MOCK_PORT}"

# The emulator needs a built dist to serve alongside functions/.
[ -d dist ] || npm run build

npx wrangler pages dev dist \
  --port "$PAGES_PORT" --ip 127.0.0.1 \
  --binding SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  --binding SUPABASE_URL="$MOCK_URL" \
  --binding MEDIA_BUCKET="exercise-media" \
  > /tmp/pagesdev-journey.log 2>&1 &
PAGES_PID=$!

export PAGES_URL="http://127.0.0.1:${PAGES_PORT}"
for _ in $(seq 1 80); do
  curl -fsS "$PAGES_URL/" >/dev/null 2>&1 && break
  sleep 0.5
done
curl -fsS "$PAGES_URL/" >/dev/null 2>&1 || { echo "::error::Pages emulator never became ready on $PAGES_URL"; cat /tmp/pagesdev-journey.log; exit 1; }

npx playwright test --config playwright.journey.config.ts
