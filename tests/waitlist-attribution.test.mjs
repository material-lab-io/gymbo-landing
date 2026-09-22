import { test } from "node:test";
import assert from "node:assert/strict";
import { onRequestPost } from "../functions/api/waitlist.js";

const CONTACT = { name: "A Trainer", email: "trainer@example.invalid" };
const ATTRIBUTION = {
  source: "instagram",
  medium: "organic_social",
  campaign: "bio",
  funnel_visit_id: "c4d8e2a1-79b5-4f03-8c6d-2a9e7b1f5034",
  anonymous_visitor_id: "7b9c3e1a-52d4-4f86-a7c8-91e2d5f0ab34",
  schema_version: 5,
};
const CANONICAL_TUPLES = [
  { source: "instagram", medium: "organic_social", campaign: "bio" },
  { source: "instagram", medium: "direct_message", campaign: "founder_outreach" },
  { source: "instagram", medium: "organic_social", campaign: "android_referrer" },
  { source: "unknown", medium: null, campaign: null },
  ...["google", "bing", "duckduckgo", "yahoo", "yandex"]
    .map((source) => ({ source, medium: "organic", campaign: null })),
  { source: "referral", medium: "referral", campaign: "ref_0123456789abcdef0123456789abcdef" },
  ...["softwaresuggest", "capterra", "getapp", "alternativeto", "saashub", "g2"]
    .map((campaign) => ({ source: "directory", medium: "listing", campaign })),
];

async function postedRow(payload) {
  const realFetch = globalThis.fetch;
  let row = null;
  globalThis.fetch = async (_url, init) => {
    row = JSON.parse(init.body);
    return new Response(null, { status: 409 });
  };
  try {
    const response = await onRequestPost({
      request: { json: async () => payload },
      env: {},
      waitUntil: () => {},
    });
    assert.equal(response.status, 200);
    return row;
  } finally {
    globalThis.fetch = realFetch;
  }
}

test("waitlist preserves every canonical v5 tuple after server revalidation", async () => {
  for (const tuple of CANONICAL_TUPLES) {
    const expected = { ...ATTRIBUTION, ...tuple };
    const row = await postedRow({ ...CONTACT, ...expected });
    assert.deepEqual(
      {
        source: row.source,
        medium: row.medium,
        campaign: row.campaign,
        funnel_visit_id: row.funnel_visit_id,
        anonymous_visitor_id: row.anonymous_visitor_id,
        schema_version: row.schema_version,
      },
      expected,
    );
  }
});

test("legacy/non-form POST with no source key stays NULL", async () => {
  const row = await postedRow(CONTACT);
  for (const key of [
    "source", "medium", "campaign", "funnel_visit_id",
    "anonymous_visitor_id", "schema_version",
  ]) {
    assert.equal(row[key], null, `${key} must remain NULL`);
  }
});

test("tuple plus both UUIDv4 IDs are atomic at the waitlist handler", async () => {
  const variants = [
    { ...ATTRIBUTION, funnel_visit_id: undefined },
    { ...ATTRIBUTION, funnel_visit_id: "not-a-uuid" },
    { ...ATTRIBUTION, anonymous_visitor_id: undefined },
    { ...ATTRIBUTION, anonymous_visitor_id: "not-a-uuid" },
  ];
  for (const variant of variants) {
    const row = await postedRow({ ...CONTACT, ...variant });
    for (const key of [
      "source", "medium", "campaign", "funnel_visit_id",
      "anonymous_visitor_id", "schema_version",
    ]) {
      assert.equal(row[key], null, `${key} must be NULL when either ID is missing/invalid`);
    }
  }
});

test("off-registry values cannot be emitted or stored by the waitlist boundary", async () => {
  for (const source of ["9876543210", "damini-rathi", "summer20", "naveen_maharashi_06"]) {
    const row = await postedRow({ ...CONTACT, ...ATTRIBUTION, source });
    for (const key of [
      "source", "medium", "campaign", "funnel_visit_id",
      "anonymous_visitor_id", "schema_version",
    ]) {
      assert.equal(row[key], null);
    }
    assert.equal(JSON.stringify(row).includes(source), false);
  }
});
