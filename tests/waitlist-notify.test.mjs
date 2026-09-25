// gy-e60uc.2 AC2 — waitlist-notify validates the address BEFORE calling Resend and reports a NAMED
// 'invalid-email' outcome, never a bare 502. Runs the real edge function with the network stubbed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const FN = join(ROOT, "supabase/functions/waitlist-notify/index.ts");
const HARNESS = join(ROOT, "tests/helpers/notify-harness.mjs");
const scratch = mkdtempSync(join(tmpdir(), "gymbo-notify-"));
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));

function run(body, fn = FN) {
  const r = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", HARNESS, fn, JSON.stringify({ body })], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return JSON.parse(r.stdout);
}
const confirmations = (out) => out.resend.filter((m) => m.subject === "your gymbo access request");
const teamAlerts = (out) => out.resend.filter((m) => m.subject.startsWith("gymbo waitlist:"));

test("LIVENESS: a valid address gets the confirmation, and the team alert goes out (200)", () => {
  const out = run({ name: "A", email: "trainer@example.com" });
  assert.equal(out.status, 200, JSON.stringify(out));
  assert.equal(confirmations(out).length, 1);
  assert.deepEqual(confirmations(out)[0].to, ["trainer@example.com"]);
  assert.equal(teamAlerts(out).length, 1);
  assert.equal(out.body.outcome, undefined);
});

for (const bad of ["a@b", "a@gmail", "a@gmail,com", "a@b..com"]) {
  test(`NEGATIVE CONTROL: '${bad}' is NOT sent to Resend and is reported as invalid-email (422, not a bare 502)`, () => {
    const out = run({ name: "A", email: bad, phone: "9876543210" });
    assert.equal(confirmations(out).length, 0, "Resend must not be called for the confirmation: " + JSON.stringify(out.resend));
    assert.equal(out.status, 422, JSON.stringify(out));
    assert.equal(out.body.outcome, "invalid-email");
    assert.equal(out.body.ok, false, "ok must track what happened: the confirmation was not sent");
    assert.equal(out.body.confirmation.sent, false);
    assert.ok(out.logs.some((l) => l.includes("outcome=invalid-email")), "the outcome must be named in the log: " + out.logs.join(" | "));
    // The lead is not lost: the team alert still goes out, so Damini sees it and can reach the phone.
    assert.equal(teamAlerts(out).length, 1, "the team alert must still be sent");
    assert.equal(out.patches, 1, "the row is still marked alerted");
    // PII: the address is never written to the log.
    assert.ok(!out.logs.some((l) => l.includes(bad)), "the address must not be logged");
  });
}

test("a phone-only signup is unchanged: no confirmation, no invalid-email outcome", () => {
  const out = run({ name: "A", phone: "9876543210" });
  assert.equal(out.status, 200, JSON.stringify(out));
  assert.equal(confirmations(out).length, 0);
  assert.equal(out.body.outcome, undefined);
});

// FORCED RED: the assertions above must be able to fail. Remove the validation from a COPY and require them to.
test("FORCED RED: with the validation removed, a malformed address DOES reach Resend (so the controls above are not blind)", () => {
  const src = readFileSync(FN, "utf8");
  const anchor = 'const emailInvalid = email !== "" && !looksLikeEmail(email)';
  assert.ok(src.includes(anchor), "mutation anchor not found in the function");
  const copy = join(scratch, "index-mutant.ts");
  writeFileSync(copy, src.replace(anchor, "const emailInvalid = false"));
  const out = run({ name: "A", email: "a@b", phone: "9876543210" }, copy);
  assert.equal(confirmations(out).length, 1, "the mutant should have sent to Resend; if not, the harness cannot see the difference");
});
