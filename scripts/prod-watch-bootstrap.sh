#!/usr/bin/env bash

# Prod Watch must distinguish a failed dependency bootstrap from a production
# regression. The caller supplies the bootstrap command so the same boundary
# can be exercised offline without touching npm, a runner service, or prod.

set -u

classification="COULD-NOT-EVALUATE: dependency bootstrap failed"

emit_could_not_evaluate() {
  local detail="$1"

  echo "::error::$classification — $detail"
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    {
      printf '## Prod Watch\n\n'
      printf '**%s**\n\n' "$classification"
      printf '%s\n' "$detail"
    } >> "$GITHUB_STEP_SUMMARY"
  fi
}

required=(RUNNER_TEMP GITHUB_RUN_ID GITHUB_RUN_ATTEMPT GITHUB_JOB GITHUB_ENV npm_config_cache)
for name in "${required[@]}"; do
  if [ -z "${!name:-}" ]; then
    emit_could_not_evaluate "required cache identity $name is missing."
    exit 1
  fi
done

expected_cache="$RUNNER_TEMP/gymbo-prod-watch/npm/$GITHUB_RUN_ID/$GITHUB_RUN_ATTEMPT/$GITHUB_JOB"
if [ "$npm_config_cache" != "$expected_cache" ]; then
  emit_could_not_evaluate "npm cache is not run-owned (expected $expected_cache, got $npm_config_cache)."
  exit 1
fi

if [ "$#" -eq 0 ]; then
  set -- npm ci
fi

echo "Prod Watch dependency cache: $npm_config_cache"
bootstrap_status=0
"$@" || bootstrap_status=$?

if [ "$bootstrap_status" -ne 0 ]; then
  emit_could_not_evaluate "bootstrap command exited $bootstrap_status; production assertions did not run."
  exit "$bootstrap_status"
fi

printf 'npm_config_cache=%s\n' "$npm_config_cache" >> "$GITHUB_ENV"
echo "OK: dependency bootstrap completed; production assertions may run."
