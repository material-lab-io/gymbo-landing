#!/usr/bin/env bash

# Offline controls for scripts/prod-watch-bootstrap.sh. These commands use only
# a temporary fixture directory; they do not access npm, a runner service, or
# production.

set -u

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
bootstrap="$script_dir/prod-watch-bootstrap.sh"
workflow="$script_dir/../.github/workflows/prod-watch.yml"
fixture=$(mktemp -d)
trap 'rm -rf -- "$fixture"' EXIT

runner_temp="$fixture/runner temp"
run_id=123456
run_attempt=2
job=watch
expected_cache="$runner_temp/gymbo-prod-watch/npm/$run_id/$run_attempt/$job"

# Integration control: pin the workflow to the same run-owned path and prove a
# successful bootstrap is ordered before every production-facing step. This is
# intentionally static/offline; natural scheduled runs own the later live gate.
if ! grep -Fqx '          npm_config_cache: ${{ runner.temp }}/gymbo-prod-watch/npm/${{ github.run_id }}/${{ github.run_attempt }}/${{ github.job }}' "$workflow"; then
  echo 'FAIL: Prod Watch does not declare the exact run-owned npm cache.'
  exit 1
fi
if ! grep -Fqx '        run: bash scripts/prod-watch-bootstrap.sh npm ci' "$workflow"; then
  echo 'FAIL: Prod Watch does not execute npm ci through the classified bootstrap boundary.'
  exit 1
fi

workflow_line() {
  local pattern="$1"
  local match
  match=$(grep -Fnm1 "$pattern" "$workflow") || return 1
  printf '%s\n' "${match%%:*}"
}

if ! bootstrap_line=$(workflow_line 'name: Bootstrap dependencies') ||
   ! chromium_line=$(workflow_line 'name: Install Chromium (console check)') ||
   ! regression_line=$(workflow_line 'name: Run prod regression') ||
   ! deploy_line=$(workflow_line 'name: Verify live deploy matches main HEAD'); then
  echo 'FAIL: Prod Watch is missing the bootstrap or one of its three production-facing steps.'
  exit 1
fi
if ! [ "$bootstrap_line" -lt "$chromium_line" ] ||
   ! [ "$chromium_line" -lt "$regression_line" ] ||
   ! [ "$regression_line" -lt "$deploy_line" ]; then
  echo 'FAIL: Prod Watch production-facing steps are not ordered after dependency bootstrap.'
  exit 1
fi

# Positive control: the bootstrap command sees the exact run-owned path and a
# successful command crosses the boundary that permits production assertions.
positive_log="$fixture/positive.log"
positive_summary="$fixture/positive-summary.md"
positive_env="$fixture/positive-env"
positive_status=0
RUNNER_TEMP="$runner_temp" \
GITHUB_RUN_ID="$run_id" \
GITHUB_RUN_ATTEMPT="$run_attempt" \
GITHUB_JOB="$job" \
GITHUB_ENV="$positive_env" \
GITHUB_STEP_SUMMARY="$positive_summary" \
npm_config_cache="$expected_cache" \
EXPECTED_CACHE="$expected_cache" \
  bash "$bootstrap" bash -c 'test "$npm_config_cache" = "$EXPECTED_CACHE"' \
  > "$positive_log" 2>&1 || positive_status=$?

if [ "$positive_status" -ne 0 ]; then
  echo "FAIL: positive bootstrap control exited $positive_status."
  sed -n '1,120p' "$positive_log"
  exit 1
fi
if ! grep -Fqx "Prod Watch dependency cache: $expected_cache" "$positive_log"; then
  echo "FAIL: positive control did not report the exact run-owned cache."
  exit 1
fi
if ! grep -Fqx 'OK: dependency bootstrap completed; production assertions may run.' "$positive_log"; then
  echo "FAIL: positive control did not cross the bootstrap boundary."
  exit 1
fi
if ! grep -Fqx "npm_config_cache=$expected_cache" "$positive_env"; then
  echo 'FAIL: successful bootstrap did not persist the isolated cache for later npm/npx steps.'
  exit 1
fi

# Negative control: a valid command that exits 42 must preserve that status and
# classify the monitor as unevaluated in both the log and job summary. Capture
# the bootstrap's status directly; piping it would test the last command instead.
negative_log="$fixture/negative.log"
negative_summary="$fixture/negative-summary.md"
negative_env="$fixture/negative-env"
negative_status=0
RUNNER_TEMP="$runner_temp" \
GITHUB_RUN_ID="$run_id" \
GITHUB_RUN_ATTEMPT="$run_attempt" \
GITHUB_JOB="$job" \
GITHUB_ENV="$negative_env" \
GITHUB_STEP_SUMMARY="$negative_summary" \
npm_config_cache="$expected_cache" \
  bash "$bootstrap" bash -c 'exit 42' \
  > "$negative_log" 2>&1 || negative_status=$?

if [ "$negative_status" -ne 42 ]; then
  echo "FAIL: negative bootstrap control returned $negative_status instead of 42."
  sed -n '1,120p' "$negative_log"
  exit 1
fi
if ! grep -Fq '::error::COULD-NOT-EVALUATE: dependency bootstrap failed' "$negative_log"; then
  echo 'FAIL: bootstrap failure was not classified in the log.'
  exit 1
fi
if ! grep -Fq '**COULD-NOT-EVALUATE: dependency bootstrap failed**' "$negative_summary"; then
  echo 'FAIL: bootstrap failure was not classified in the job summary.'
  exit 1
fi
if ! grep -Fq 'production assertions did not run.' "$negative_log"; then
  echo 'FAIL: bootstrap failure did not state that production was unevaluated.'
  exit 1
fi
if [ -s "$negative_env" ]; then
  echo 'FAIL: failed bootstrap exported an npm cache to later steps.'
  exit 1
fi

echo 'OK: Prod Watch bootstrap positive and offline negative controls passed.'
