// ci-diet (gcf-ykivt): the three cheap PR workflows cancel a superseded PR run (never a main push or a dispatch), and the audit report uploads only on failure.
// refresh-visual-baselines.yml and render-hero-video.yml upload DELIVERABLES (baselines for review, the hero video), so they upload on success by design.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const wf = (n) => readFileSync(new URL(`../.github/workflows/${n}.yml`, import.meta.url), "utf8");

for (const n of ["forge-tokens", "gate-selftest", "repo-hygiene"]) {
  test(`${n}: a superseded PR run is cancelled, a main push or dispatch never is`, () => {
    const s = wf(n);
    assert.match(s, /concurrency:\s*\n(?:\s*#.*\n)*\s*group: [^\n]*github\.event_name == 'pull_request' && format\('pr-\{0\}', github\.event\.pull_request\.number\) \|\| github\.run_id/);
    assert.match(s, /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/);
  });
}

test("web-audit: the report uploads only on failure", () => {
  const s = wf("web-audit");
  const step = s.slice(s.indexOf("- name: Upload report"));
  assert.match(step.split("\n").slice(0, 3).join("\n"), /if: failure\(\)/);
  assert.doesNotMatch(step.split("\n").slice(0, 3).join("\n"), /always\(\)/);
});
