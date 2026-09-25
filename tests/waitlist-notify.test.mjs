// gy-rh2rj step 2 + gy-e60uc.2 — the waitlist-notify signup path, run against the REAL edge function with the
// network stubbed. Conditions under test (pm 14:26Z on gy-rh2rj): (2) at most one confirmation under a race,
// via an atomic claim; (3) name and email come ONLY from the row, the body is ignored; (4) an unknown receipt
// is a silent no-op that cannot be told apart from any other no-op. Plus AC2 of gy-e60uc.2: a malformed address
// never reaches Resend and is reported as the named 'invalid-email' outcome.
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

const R1 = "11111111-1111-4111-8111-111111111111";
const R2 = "22222222-2222-4222-8222-222222222222";
const UNKNOWN = "99999999-9999-4999-8999-999999999999";
const ROWS = {
  [R1]: { id: 101, name: "Asha", email: "asha@example.com", phone: null },
  [R2]: { id: 102, name: "Ravi", email: null, phone: "9876543210" },
};

function run(requests, { rows = ROWS, fn = FN } = {}) {
  const r = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", HARNESS, fn, JSON.stringify({ rows, requests })], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return JSON.parse(r.stdout);
}
const confirmations = (out) => out.resend.filter((m) => m.subject === "your gymbo access request");
const teamAlerts = (out) => out.resend.filter((m) => m.subject.startsWith("gymbo waitlist:"));

test("LIVENESS: a real, unclaimed receipt sends ONE confirmation to the ROW's email and ONE team alert", () => {
  const out = run([{ receipt: R1 }]);
  assert.equal(out.results[0].status, 200, out.results[0].text);
  assert.equal(confirmations(out).length, 1);
  assert.deepEqual(confirmations(out)[0].to, ["asha@example.com"]);
  assert.equal(teamAlerts(out).length, 1);
  assert.equal(out.marks, 1, "the team alert is marked after it is sent");
});

test("THE CLAIM IS ATOMIC AND DEDICATED: one PATCH, filtered on the receipt AND confirmation_claimed_at IS NULL, returning the row", () => {
  const out = run([{ receipt: R1 }]);
  assert.equal(out.claims.length, 1);
  const c = out.claims[0];
  assert.equal(c.method, "PATCH");
  assert.match(c.url, /signup_receipt=eq\.11111111-1111-4111-8111-111111111111/);
  assert.match(c.url, /confirmation_claimed_at=is\.null/, "without this guard two calls could both claim the row");
  assert.equal(c.prefer, "return=representation");
  assert.deepEqual(Object.keys(c.body), ["confirmation_claimed_at"], "the claim writes ONLY the dedicated marker, not team_alerted_at");
});

test("AT MOST ONCE UNDER A RACE: two calls with the SAME receipt send exactly one confirmation and one team alert", () => {
  const out = run([{ receipt: R1 }, { receipt: R1 }]);
  assert.equal(confirmations(out).length, 1, JSON.stringify(out.resend));
  assert.equal(teamAlerts(out).length, 1);
  assert.equal(out.results[1].status, 200, "the loser of the race is a quiet 200, not an error");
});

test("THE BODY IS IGNORED: a name/email/phone in the request never becomes the recipient", () => {
  const out = run([{ receipt: R1, name: "Mallory", email: "attacker@example.com", phone: "1112223334" }]);
  assert.deepEqual(confirmations(out).map((m) => m.to), [["asha@example.com"]]);
  assert.ok(!JSON.stringify(out.resend).includes("attacker@example.com"), "the body's email must appear nowhere");
});

test("NO-OPS ARE SILENT AND INDISTINGUISHABLE: unknown, malformed, duplicate-of-a-claimed, and the LEGACY body all answer the same 200 and mail nobody", () => {
  const cases = [
    ["unknown receipt", { receipt: UNKNOWN }],
    ["malformed receipt", { receipt: "not-a-uuid" }],
    ["empty receipt", { receipt: "" }],
    ["no receipt (LEGACY body {name,email,phone})", { name: "A", email: "legacy@example.com", phone: "9876543210" }],
    ["injection-shaped receipt", { receipt: `${R1}&select=*` }],
  ];
  const answers = cases.map(([label, body]) => {
    const out = run([body]);
    assert.equal(out.resend.length, 0, `${label}: nothing may be mailed: ${JSON.stringify(out.resend)}`);
    assert.equal(out.results[0].status, 200, `${label}: ${out.results[0].text}`);
    return out.results[0].text;
  });
  assert.equal(new Set(answers).size, 1, "every no-op must return the identical body: " + JSON.stringify(answers));
  // A receipt that is already claimed is the same answer again.
  const claimedAgain = run([{ receipt: R1 }, { receipt: R1 }]).results[1].text;
  assert.equal(claimedAgain, answers[0], "an already-claimed receipt must look like any other no-op");
});

test("a phone-only row gets NO confirmation but DOES get the team alert (unchanged design)", () => {
  const out = run([{ receipt: R2 }]);
  assert.equal(out.results[0].status, 200, out.results[0].text);
  assert.equal(confirmations(out).length, 0);
  assert.equal(teamAlerts(out).length, 1);
});

for (const bad of ["a@b", "a@gmail", "a@gmail,com", "a@b..com"]) {
  test(`gy-e60uc.2: a row whose email is '${bad}' is NOT sent to Resend and is reported as invalid-email (422, named, address not logged)`, () => {
    const rows = { [R1]: { id: 101, name: "A", email: bad, phone: "9876543210" } };
    const out = run([{ receipt: R1 }], { rows });
    assert.equal(confirmations(out).length, 0, JSON.stringify(out.resend));
    assert.equal(out.results[0].status, 422, out.results[0].text);
    assert.equal(JSON.parse(out.results[0].text).outcome, "invalid-email");
    assert.ok(out.logs.some((l) => l.includes("outcome=invalid-email")), out.logs.join(" | "));
    assert.equal(teamAlerts(out).length, 1, "the lead still reaches the team");
    assert.ok(!out.logs.some((l) => l.includes(bad)), "the address must not be logged");
  });
}

// FORCED REDS: each assertion above must be able to fail. Mutate a COPY and require the matching test to notice.
const src = readFileSync(FN, "utf8");
function mutate(anchor, replacement, name) {
  assert.ok(src.includes(anchor), `mutation anchor not found in the function: ${anchor}`);
  const file = join(scratch, name);
  writeFileSync(file, src.replace(anchor, replacement));
  return file;
}

test("FORCED RED (race): with the IS NULL guard dropped from the claim, two calls send TWO confirmations", () => {
  const fn = mutate("&confirmation_claimed_at=is.null", "", "no-guard.ts");
  const out = run([{ receipt: R1 }, { receipt: R1 }], { fn });
  assert.equal(confirmations(out).length, 2, "the mutant must double-send, or the race test above is blind");
});

test("FORCED RED (body ignored): a copy that reads the email from the body mails the attacker", () => {
  const fn = mutate('const email = String(claimed.email ?? "").trim()', 'const email = String((body as { email?: string }).email ?? claimed.email ?? "").trim()', "body-email.ts");
  const out = run([{ receipt: R1, email: "attacker@example.com" }], { fn });
  assert.ok(JSON.stringify(out.resend).includes("attacker@example.com"), "the mutant must mail the body's address, or the body-ignored test is blind");
});

test("FORCED RED (no-op): a copy that answers an unknown receipt with a different body is caught by the indistinguishability test", () => {
  const fn = mutate("if (!claimed) return json({ ok: true, mode: \"signup\" })", "if (!claimed) return json({ ok: true, mode: \"signup\", noop: true })", "noop-body.ts");
  const a = run([{ receipt: UNKNOWN }], { fn }).results[0].text;
  const b = run([{ receipt: UNKNOWN }]).results[0].text;
  assert.notEqual(a, b, "the mutant must change the no-op body, or the indistinguishability test cannot fail");
});

test("FORCED RED (gy-e60uc.2): with the validation removed, a malformed address DOES reach Resend", () => {
  const fn = mutate('const emailInvalid = email !== "" && !looksLikeEmail(email)', "const emailInvalid = false", "no-validation.ts");
  const rows = { [R1]: { id: 101, name: "A", email: "a@b", phone: "9876543210" } };
  const out = run([{ receipt: R1 }], { rows, fn });
  assert.equal(confirmations(out).length, 1);
});
