import assert from "node:assert/strict";

import {
  RESEND_EMAILS_ENDPOINT,
  SEED_CONFIRMATION,
  SEED_RECIPIENT,
  SEED_SENDER,
  buildSeedPayload,
  sendSeed,
  validateSendEnvironment,
} from "./send-resend-seed.mjs";

const now = new Date("2026-08-31T10:30:00.000Z");
const payload = await buildSeedPayload(now);

assert.deepEqual(payload.to, [SEED_RECIPIENT]);
assert.equal(payload.reply_to, SEED_RECIPIENT);
assert.equal(payload.from, SEED_SENDER);
assert.equal(payload.subject, "Gymbo: outbound email capability seed — Mon 31 Aug 2026");
assert.match(payload.html, /SPF=pass/);
assert.match(payload.html, /DKIM=pass/);
assert.match(payload.html, /DMARC=pass/);
assert.match(payload.html, /max-width:640px/);
assert.match(payload.text, /not a campaign/i);
assert.doesNotMatch(payload.html, /{{[A-Z_]+}}/);
assert.doesNotMatch(payload.text, /{{[A-Z_]+}}/);

assert.throws(() => validateSendEnvironment({}), /Refusing to send/);
assert.throws(
  () =>
    validateSendEnvironment({
      GYMBO_EMAIL_SEED_CONFIRM: "SEND_TO_WAITLIST",
      RESEND_API_KEY: "re_test",
    }),
  /Refusing to send/,
);

let captured;
const result = await sendSeed({
  env: {
    GYMBO_EMAIL_SEED_CONFIRM: SEED_CONFIRMATION,
    RESEND_API_KEY: "re_test_only",
  },
  now,
  fetchImpl: async (url, init) => {
    captured = { url, init };
    return new Response(JSON.stringify({ id: "email_seed_test" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
});

assert.equal(captured.url, RESEND_EMAILS_ENDPOINT);
assert.equal(captured.init.headers.Authorization, "Bearer re_test_only");
assert.equal(captured.init.headers["Idempotency-Key"], "gymbo-gtm-outbound-capability-seed-v1");
assert.deepEqual(JSON.parse(captured.init.body).to, [SEED_RECIPIENT]);
assert.deepEqual(result, { id: "email_seed_test", recipient: SEED_RECIPIENT });

console.log("resend seed self-test: ok");
