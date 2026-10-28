// gy-ellyl: deploy.yml's concurrency must (a) collapse every push to one PR into ONE group and
// cancel the superseded run, and (b) NEVER cancel or share a group with a main deploy.
// The two real expressions are read out of the workflow and evaluated for concrete events;
// each check also runs against a mutated copy that must go red (a check that cannot fail is not a test).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SRC = readFileSync(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");

function block(src) {
  const m = src.match(/^concurrency:\n  group: (.+)\n  cancel-in-progress: (.+)\n/m);
  assert.ok(m, "deploy.yml has no top-level concurrency block");
  return { group: m[1].trim(), cancel: m[2].trim() };
}

// Evaluates only the exact grammar the workflow uses; anything else throws, so a rewrite that
// escapes this evaluator fails loudly instead of being silently unchecked.
function evalExpr(expr, ctx) {
  const t = expr.match(/^(.*?)\$\{\{\s*(.*?)\s*\}\}(.*)$/);
  if (!t) return expr.trim(); // literal, e.g. "false" / "true"
  if (t[1] || t[3]) return t[1] + String(evalExpr("${{ " + t[2] + " }}", ctx)) + t[3];
  const inner = t[2];
  const fetch = (path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), ctx);
  const term = (t) => {
    t = t.trim();
    let m;
    if ((m = t.match(/^github\.event_name == '([a-z_]+)'$/))) return ctx.github.event_name === m[1];
    if ((m = t.match(/^format\('([^']*)',\s*(.+)\)$/))) return m[1].replace("{0}", String(fetch(m[2].trim())));
    if (/^github\.[a-z_.]+$/.test(t)) return fetch(t);
    throw new Error(`unsupported expression term: ${t}`);
  };
  const orParts = inner.split(" || ");
  for (const part of orParts) {
    const and = part.split(" && ");
    let v = true;
    for (let i = 0; i < and.length; i++) {
      v = term(and[i]);
      if (!v) break;
    }
    if (v) return v;
  }
  return orParts.length > 1 ? term(orParts[orParts.length - 1]) : false;
}

const pr = (n, sha) => ({ github: { event_name: "pull_request", ref: `refs/pull/${n}/merge`, event: { pull_request: { number: n, head: { sha } } } } });
const mainPush = (sha) => ({ github: { event_name: "push", ref: "refs/heads/main", sha, event: {} } });
const dispatchMain = () => ({ github: { event_name: "workflow_dispatch", ref: "refs/heads/main", event: {} } });

function check(src) {
  const { group, cancel } = block(src);
  const g = (c) => String(evalExpr(group, c));
  const c = (cx) => { const v = evalExpr(cancel, cx); return v === "true" ? true : v === "false" ? false : v; };
  // (a) every push to one PR shares a group, different PRs do not, and a newer push cancels.
  assert.equal(g(pr(7, "aaa")), g(pr(7, "bbb")), "two shas of ONE PR must share a group");
  assert.notEqual(g(pr(7, "aaa")), g(pr(8, "aaa")), "different PRs must not share a group");
  assert.equal(c(pr(7, "bbb")), true, "a PR run must cancel-in-progress");
  // (b) main is serialized against itself and never cancelled, and never shares a PR group.
  assert.equal(g(mainPush("1")), g(mainPush("2")), "main pushes serialize in one group");
  assert.equal(c(mainPush("2")), false, "a main push must NEVER cancel an in-flight deploy");
  assert.equal(c(dispatchMain()), false, "a manual dispatch on main must not cancel");
  assert.notEqual(g(mainPush("1")), g(pr(7, "aaa")), "main must not share a group with a PR");
}

test("deploy.yml: PR pushes collapse into one cancelling group; main is serialized and never cancelled", () => {
  check(SRC);
});

test("CONTROL 1: cancel-in-progress true for everything (would cancel a main deploy) turns the check red", () => {
  const bad = SRC.replace(/cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/, "cancel-in-progress: true");
  assert.notEqual(bad, SRC);
  assert.throws(() => check(bad), /NEVER cancel/);
});
test("CONTROL 2: the old per-head-sha key (stale shas never collapse) turns the check red", () => {
  const bad = SRC.replace(/group: gymbo-landing-deploy-.*/, "group: gymbo-landing-deploy-${{ github.event.pull_request.head.sha || github.ref }}");
  assert.notEqual(bad, SRC);
  assert.throws(() => check(bad), /ONE PR must share a group/);
});
test("CONTROL 3: cancel-in-progress false (the status quo) turns the check red", () => {
  const bad = SRC.replace(/cancel-in-progress: .*/, "cancel-in-progress: false");
  assert.notEqual(bad, SRC);
  assert.throws(() => check(bad), /must cancel-in-progress/);
});
test("CONTROL 4: a per-ref group (PR merge ref constant, main pushes ok) still fails to separate main from PRs only if keyed wrongly", () => {
  const bad = SRC.replace(/group: gymbo-landing-deploy-.*/, "group: gymbo-landing-deploy-const");
  assert.notEqual(bad, SRC);
  assert.throws(() => check(bad));
});
