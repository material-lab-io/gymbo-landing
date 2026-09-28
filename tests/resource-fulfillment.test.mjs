import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fulfillResourceLead,
  isCanonicalGymboUrl,
  isGymboHttpsUrl,
  isResourceBridgeToken,
  REQUEST_ACCESS_PATH,
  RESOURCE_BRIDGE_FRAGMENT_KEY,
  resourceBridgeUrl,
  STARTER_PACK_PATH,
  STARTER_PACK_PREHEADER,
  STARTER_PACK_RESOURCE_ID,
  STARTER_PACK_SUBJECT,
  starterPackEmail,
} from "../supabase/functions/waitlist-notify/resource-fulfillment.mjs";

const LEAD_ID = "11111111-2222-3333-4444-555555555555";
const PACK_URL = "https://getgymbo.com/resources/workout-builder-starter-pack";
const ACCESS_URL = "https://getgymbo.com/request-access";
const BRIDGE_TOKEN = `rb_${"a".repeat(64)}`;
const BRIDGED_PACK_URL = `${PACK_URL}#${RESOURCE_BRIDGE_FRAGMENT_KEY}=${BRIDGE_TOKEN}`;
const BRIDGED_ACCESS_URL = `${ACCESS_URL}#${RESOURCE_BRIDGE_FRAGMENT_KEY}=${BRIDGE_TOKEN}`;

const eligibleClaim = () => ({
  ok: true,
  claimed: true,
  state: "dispatching",
  resource_lead_id: LEAD_ID,
  resource_id: STARTER_PACK_RESOURCE_ID,
  email: "trainer@example.invalid",
  idempotency_key: `resource-fulfillment/${LEAD_ID}`,
  attribution_bridge_token: BRIDGE_TOKEN,
  attempt_count: 1,
});

function harness(overrides = {}) {
  const calls = { claim: [], record: [], send: [] };
  const deps = {
    claim: async (value) => { calls.claim.push(value); return eligibleClaim(); },
    record: async (value) => { calls.record.push(value); return { ok: true, recorded: true, state: value.outcome }; },
    send: async (value) => { calls.send.push(value); return { ok: true, status: 200, id: "resend-1" }; },
    ...overrides,
  };
  return { calls, deps };
}

const input = (overrides = {}) => ({
  resourceLeadId: LEAD_ID,
  resourceId: STARTER_PACK_RESOURCE_ID,
  starterPackUrl: PACK_URL,
  requestAccessUrl: ACCESS_URL,
  ...overrides,
});

test("approved transactional copy has exact subject, preheader, body order, and both durable links", () => {
  const email = starterPackEmail(PACK_URL, ACCESS_URL);
  assert.equal(email.subject, STARTER_PACK_SUBJECT);
  assert.equal(email.preheader, STARTER_PACK_PREHEADER);
  assert.equal(email.text, `Your Workout Builder Starter Pack is ready.

Open the guide to browse 868 exercises with step-by-step instructions and images, ready to build your own client sessions from.

Open the starter pack: ${PACK_URL}

Want to run these with a client roster, payments, and reminders in one place? Gymbo is in private alpha.

Request access: ${ACCESS_URL}

Gymbo
The business app for independent personal trainers.

You’re receiving this one email because you asked Gymbo to send you the Workout Builder Starter Pack.`);
  for (const expected of [
    STARTER_PACK_PREHEADER,
    "Your Workout Builder Starter Pack is ready.",
    "868 exercises with step-by-step instructions and images",
    "Open the starter pack",
    "Gymbo is in private alpha.",
    "Request access",
    "You’re receiving this one email because you asked Gymbo",
    PACK_URL,
    ACCESS_URL,
  ]) assert.equal(email.html.includes(expected), true, `missing ${expected}`);
  assert.equal(email.html.includes("—"), false, "approved copy contains no em dash");
});

test("only HTTPS getgymbo.com links are accepted", () => {
  assert.equal(isGymboHttpsUrl(PACK_URL), true);
  assert.equal(isGymboHttpsUrl("https://www.getgymbo.com/request-access"), true);
  for (const bad of [
    "",
    "http://getgymbo.com/x",
    "https://evil.example/x",
    "https://user:password@getgymbo.com/request-access",
    "https://getgymbo.com:444/request-access",
    "not-a-url",
  ]) {
    assert.equal(isGymboHttpsUrl(bad), false);
  }
});

test("each CTA accepts only its exact canonical base path with no query or fragment", () => {
  assert.equal(isCanonicalGymboUrl(PACK_URL, STARTER_PACK_PATH), true);
  assert.equal(isCanonicalGymboUrl(ACCESS_URL, REQUEST_ACCESS_PATH), true);
  assert.equal(isCanonicalGymboUrl(ACCESS_URL, STARTER_PACK_PATH), false);
  assert.equal(isCanonicalGymboUrl(`${PACK_URL}/`, STARTER_PACK_PATH), false);
  assert.equal(isCanonicalGymboUrl(`${PACK_URL}?lead=raw`, STARTER_PACK_PATH), false);
  assert.equal(isCanonicalGymboUrl(`${PACK_URL}#existing-anchor`, STARTER_PACK_PATH), false);
});

test("the per-lead bridge is a distinct bounded token carried only in the URL fragment", () => {
  assert.equal(isResourceBridgeToken(BRIDGE_TOKEN), true);
  for (const bad of [
    "",
    LEAD_ID,
    `rb_${"a".repeat(63)}`,
    `rb_${"g".repeat(64)}`,
    `rb_${"a".repeat(64)}@trainer.example`,
  ]) assert.equal(isResourceBridgeToken(bad), false);

  assert.equal(resourceBridgeUrl(PACK_URL, BRIDGE_TOKEN, STARTER_PACK_PATH), BRIDGED_PACK_URL);
  const url = new URL(BRIDGED_PACK_URL);
  assert.equal(url.search, "", "the raw bridge must never enter the query string");
  assert.equal(url.pathname, "/resources/workout-builder-starter-pack");
  assert.equal(url.hash, `#${RESOURCE_BRIDGE_FRAGMENT_KEY}=${BRIDGE_TOKEN}`);
  assert.equal(resourceBridgeUrl(`${PACK_URL}#existing-anchor`, BRIDGE_TOKEN, STARTER_PACK_PATH), null,
    "an existing fragment needs an explicit landing contract, not silent overwrite");
  assert.equal(resourceBridgeUrl(ACCESS_URL, BRIDGE_TOKEN, STARTER_PACK_PATH), null,
    "the request-access URL cannot substitute for the starter-pack URL");
});

test("happy path sends exactly once with text+HTML and the database-owned idempotency key", async () => {
  const { calls, deps } = harness();
  const outcome = await fulfillResourceLead(input(), deps);
  assert.equal(outcome.status, 200);
  assert.deepEqual(outcome.body, { ok: true, sent: true, resource_lead_id: LEAD_ID });
  assert.equal(calls.claim.length, 1);
  assert.equal(calls.send.length, 1);
  assert.deepEqual(calls.send[0].to, ["trainer@example.invalid"]);
  assert.equal(calls.send[0].subject, STARTER_PACK_SUBJECT);
  assert.equal(calls.send[0].idempotencyKey, `resource-fulfillment/${LEAD_ID}`);
  assert.equal(calls.send[0].text.includes(BRIDGED_PACK_URL), true);
  assert.equal(calls.send[0].html.includes(BRIDGED_PACK_URL), true);
  assert.equal(calls.send[0].text.includes(BRIDGED_ACCESS_URL), true);
  assert.equal(calls.send[0].html.includes(BRIDGED_ACCESS_URL), true);
  assert.equal(calls.send[0].text.includes(LEAD_ID), false,
    "the raw resource_lead_id is not the email bridge");
  assert.deepEqual(calls.record, [{
    resourceLeadId: LEAD_ID,
    outcome: "sent",
    providerStatus: 200,
    providerMessageId: "resend-1",
    errorCode: null,
  }]);
});

test("unconsented/not-eligible and already-sent claims never call the provider", async () => {
  for (const claim of [
    { ok: false, claimed: false, state: "not_eligible" },
    { ok: true, claimed: false, state: "sent" },
    { ok: true, claimed: false, state: "dispatching" },
  ]) {
    const { calls, deps } = harness({ claim: async () => claim });
    const outcome = await fulfillResourceLead(input(), deps);
    assert.equal(calls.send.length, 0);
    assert.equal(calls.record.length, 0);
    assert.equal(outcome.body.sent, claim.ok ? false : undefined);
  }
});

test("broken URL/provider configuration records a retryable failure and never reports success", async () => {
  for (const badUrls of [
    { starterPackUrl: "" },
    { starterPackUrl: `${PACK_URL}?lead=raw` },
    { starterPackUrl: ACCESS_URL },
    { requestAccessUrl: `${ACCESS_URL}#existing-anchor` },
  ]) {
    const { calls, deps } = harness();
    const outcome = await fulfillResourceLead(input(badUrls), deps);
    assert.equal(outcome.status, 503);
    assert.deepEqual(outcome.body, { ok: false, error: "delivery_not_configured" });
    assert.equal(calls.send.length, 0);
    assert.equal(calls.record[0].outcome, "retryable");
    assert.equal(calls.record[0].errorCode, "delivery_url_not_configured");
  }
});

test("a missing or malformed attribution bridge fails closed before provider send", async () => {
  for (const attributionBridgeToken of [undefined, LEAD_ID, "rb_not_hex"]) {
    const { calls, deps } = harness({
      claim: async () => ({
        ...eligibleClaim(),
        attribution_bridge_token: attributionBridgeToken,
      }),
    });
    const outcome = await fulfillResourceLead(input(), deps);
    assert.equal(outcome.status, 503);
    assert.deepEqual(outcome.body, { ok: false, error: "delivery_bridge_not_configured" });
    assert.equal(calls.send.length, 0);
    assert.equal(calls.record.length, 1);
    assert.equal(calls.record[0].outcome, "retryable");
    assert.equal(calls.record[0].errorCode, "attribution_bridge_not_available");
  }
});

test("a malformed internal claim cannot send to an invented address", async () => {
  const { calls, deps } = harness({
    claim: async () => ({ ...eligibleClaim(), email: "" }),
  });
  const outcome = await fulfillResourceLead(input(), deps);
  assert.equal(outcome.status, 500);
  assert.deepEqual(outcome.body, { ok: false, error: "delivery_address_missing" });
  assert.equal(calls.send.length, 0);
  assert.equal(calls.record[0].errorCode, "delivery_address_missing");
});

test("definite provider rejection is visible+retryable; unknown outcome blocks automatic retry", async () => {
  {
    const { calls, deps } = harness({ send: async () => ({ ok: false, status: 401, error: "send_failed" }) });
    const outcome = await fulfillResourceLead(input(), deps);
    assert.equal(outcome.status, 502);
    assert.equal(outcome.body.ok, false);
    assert.equal(calls.record[0].outcome, "retryable");
    assert.equal(calls.record[0].providerStatus, 401);
  }
  {
    const { calls, deps } = harness({ send: async () => { throw new Error("connection_lost"); } });
    const outcome = await fulfillResourceLead(input(), deps);
    assert.equal(outcome.status, 502);
    assert.deepEqual(outcome.body, { ok: false, error: "provider_outcome_unknown" });
    assert.equal(calls.record[0].outcome, "needs_reconciliation");
  }
});

test("a provider acceptance whose database finalization fails cannot be reported as success", async () => {
  const { calls, deps } = harness({
    record: async (value) => { calls.record.push(value); return { ok: false, recorded: false }; },
  });
  const outcome = await fulfillResourceLead(input(), deps);
  assert.equal(calls.send.length, 1);
  assert.equal(outcome.status, 500);
  assert.deepEqual(outcome.body, { ok: false, error: "delivery_result_not_recorded" });
});
