#!/usr/bin/env bash
# gy-3hyzh — run `npx playwright test "$@"` on a port picked IMMEDIATELY before
# the run, and re-pick if another process took it before Playwright bound it.
#
# WHY THIS EXISTS. gy-cjdtw replaced the fixed :4173 with a per-job free port,
# and that was necessary but not sufficient. freeport() proves a port is free,
# then RELEASES it. deploy.yml picked PW_PORT at the top of the smoke step and
# Playwright only bound it ~30s later, after the Pages emulator and the route
# smoke. On the shared gt2 host something else took the port in that window,
# and because PW_PORT was exported once, every later Playwright run in the step
# inherited the same dead number: #180's run 35304624218 failed
# "http://localhost:37241 is already used" four times in six seconds.
#
# 🔴 WHAT IS RETRIED, AND WHAT IS NOT. Only a run that never started a test:
# Playwright's webServer refusing the port, AND no test summary in the output.
# A real test failure is never retried here — that would turn a red gate into a
# coin toss. Playwright's own `retries` still governs flaky tests as before.
#
# Every chosen port is printed, so the next collision can be attributed. Before
# this, the logs did not name the port a job had picked.
#
# Usage: scripts/pw-test.sh <playwright test args...>
set -uo pipefail

MAX_ATTEMPTS="${PW_PORT_ATTEMPTS:-3}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  PW_PORT="$(node "$here/freeport.mjs")" || exit 1
  export PW_PORT
  echo "pw-test: attempt $attempt/$MAX_ATTEMPTS PW_PORT=$PW_PORT :: playwright test $*"

  log="$(mktemp)"
  npx playwright test "$@" 2>&1 | tee "$log"
  rc=${PIPESTATUS[0]}

  if [ "$rc" -ne 0 ] \
     && grep -q "is already used, make sure that nothing is running on the port" "$log" \
     && ! grep -qE '^[[:space:]]*[0-9]+ (passed|failed|flaky|skipped|interrupted)' "$log"; then
    rm -f "$log"
    echo "::warning::pw-test: PW_PORT=$PW_PORT was taken before Playwright bound it (gy-3hyzh) — re-picking"
    continue
  fi
  rm -f "$log"
  exit "$rc"
done

echo "::error::pw-test: every one of $MAX_ATTEMPTS picked ports was taken before Playwright could bind it (gy-3hyzh)"
exit 1
