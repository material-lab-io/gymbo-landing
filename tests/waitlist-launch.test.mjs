// gy-f3limw.1 -- campaign-1 launch mode. SEND-FREE: every network call is stubbed. Conditions under test are
// compliance C1/C3 (gy-f3limw, 2026-10-30) and the bead AC: recipient filter, counts-only dry run, 2-send cap
// enforced by the store (not by operator care), unsubscribe in every mail, nothing sent unless armed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const FN = join(ROOT, "supabase/functions/waitlist-notify/index.ts");
const HARNESS = join(ROOT, "tests/helpers/launch-harness.mjs");
const REC = [
  { id: 1, name: "Asha", email: "asha@example.com" },
  { id: 2, name: "Ravi", email: "ravi@example.com" },
  { id: 3, name: "Meera", email: "meera@example.com" },
];
const ARMED = { LAUNCH_ACTIVATION_ID: "pm-act-1", APP_STORE_URL: "https://apps.apple.com/app/id0", LAUNCH_UNSUB_SECRET: "unsub-secret" };
const SEND = { send_no: 1, dry_run: false, confirm: "SEND" };

function run(requests, over = {}) {
  const r = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", HARNESS, FN,
    JSON.stringify({ recipients: REC, env: ARMED, requests, ...over })], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return JSON.parse(r.stdout);
}

test("DRY RUN IS THE DEFAULT: counts only, no address in the response, nothing sent, nothing claimed", () => {
  const out = run([{ send_no: 1 }]);
  assert.equal(out.results[0].status, 200);
  assert.equal(out.results[0].json.dry_run, true);
  assert.equal(out.results[0].json.recipients, 3);
  assert.doesNotMatch(JSON.stringify(out.results), /@example\.com/, "a dry run must never print an address");
  assert.equal(out.resend.length, 0);
  assert.equal(out.insertAttempts.length, 0);
});

test("NOT ARMED: a real run without the pm activation record, or without confirm=SEND, sends nothing", () => {
  for (const [env, body] of [[{ ...ARMED, LAUNCH_ACTIVATION_ID: "" }, SEND], [ARMED, { send_no: 1, dry_run: false }], [{ ...ARMED, APP_STORE_URL: "" }, SEND]]) {
    const out = run([body], { env });
    assert.equal(out.results[0].status, 403, JSON.stringify(out.results[0]));
    assert.equal(out.resend.length, 0);
    assert.equal(out.insertAttempts.length, 0);
  }
});

test("LIVENESS: armed real run sends one mail per recipient to THAT row, with unsubscribe in body AND List-Unsubscribe header", () => {
  const out = run([SEND]);
  assert.equal(out.results[0].json.sent, 3);
  assert.deepEqual(out.resend.map((m) => m.to[0]).sort(), REC.map((r) => r.email).sort());
  for (const m of out.resend) {
    assert.match(m.html, /unsubscribe/i);
    assert.ok(m.headers && m.headers["List-Unsubscribe"], "one-tap unsubscribe header");
    assert.doesNotMatch(m.html + m.subject, /\b(free|trial|7[- ]day)\b/i, "compliance C1: no trial/free wording");
  }
});

test("CAP, SEND 1: running send 1 twice mails each address ONCE (the store refuses the repeat)", () => {
  const out = run([SEND, SEND]);
  assert.equal(out.resend.length, 3, "second run must send nothing");
  assert.equal(out.results[1].json.sent, 0);
});

test("CAP, EVER: an address that already has send 1 and 2 is never mailed again, and send_no 3 is refused", () => {
  const prior = [{ waitlist_id: 1, send_no: 1 }, { waitlist_id: 1, send_no: 2 }];
  const out = run([{ ...SEND, send_no: 2 }], { priorSends: prior });
  assert.ok(!out.resend.some((m) => m.to[0] === "asha@example.com"));
  const bad = run([{ ...SEND, send_no: 3 }]);
  assert.equal(bad.results[0].status, 400);
  assert.equal(bad.resend.length, 0);
});

test("CLAIM BEFORE SEND, NO AUTO-RETRY: a failed send is recorded as claimed and is not retried by a second run", () => {
  const out = run([SEND, SEND], { resendFailFor: ["ravi@example.com"] });
  assert.equal(out.results[0].json.failed, 1);
  assert.equal(out.resend.filter((m) => m.to[0] === "ravi@example.com").length, 0);
  assert.equal(out.results[1].json.sent, 0, "no retry of the failed address");
});

test("CAP HOLDS UNDER A RACE: a STALE recipient list (RPC says yes, store already has the send) mails nobody twice", () => {
  const prior = [{ waitlist_id: 1, send_no: 1 }];
  const out = run([SEND], { priorSends: prior, staleRpc: true });
  assert.ok(!out.resend.some((m) => m.to[0] === "asha@example.com"), "claim refused (409) must stop the mail");
  assert.equal(out.results[0].json.sent, 2);
  assert.equal(out.results[0].json.skipped, 1);
});
