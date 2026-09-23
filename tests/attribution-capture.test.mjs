import { test } from "node:test";
import assert from "node:assert/strict";
import {
  captureAttribution,
  getAttribution,
  getAttributionSource,
} from "../src/lib/attribution.ts";
import { onRequestPost as postWaitlist } from "../functions/api/waitlist.js";

const storage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    clear: () => values.clear(),
  };
};

test("first touch captures the complete v5 tuple and secure IDs, then wins", () => {
  const realWindow = globalThis.window;
  const realDocument = globalThis.document;
  const sessionStorage = storage();
  const localStorage = storage();
  const ids = [
    "c4d8e2a1-79b5-4f03-8c6d-2a9e7b1f5034",
    "7b9c3e1a-52d4-4f86-a7c8-91e2d5f0ab34",
  ];
  const location = {
    search: "?utm_source=instagram&utm_medium=organic_social&utm_campaign=bio",
    hostname: "getgymbo.com",
  };

  globalThis.window = {
    sessionStorage,
    localStorage,
    location,
    crypto: { randomUUID: () => ids.shift() },
  };
  globalThis.document = { referrer: "https://www.google.co.in/search?q=gymbo" };

  try {
    captureAttribution();
    assert.deepEqual(getAttribution(), {
      source: "instagram",
      medium: "organic_social",
      campaign: "bio",
      funnel_visit_id: "c4d8e2a1-79b5-4f03-8c6d-2a9e7b1f5034",
      anonymous_visitor_id: "7b9c3e1a-52d4-4f86-a7c8-91e2d5f0ab34",
      schema_version: 5,
    });
    assert.equal(getAttributionSource(), "instagram");

    location.search = "?utm_source=google&utm_medium=organic";
    globalThis.document.referrer = "https://www.bing.com/search?q=gymbo";
    captureAttribution();
    assert.equal(getAttribution().source, "instagram", "later navigation must not overwrite first touch");
    assert.equal(ids.length, 0, "an existing capture must not mint replacement IDs");
  } finally {
    globalThis.window = realWindow;
    globalThis.document = realDocument;
  }
});

// gy-ufxgo.8: four lawful stored shapes, schema_version is the discriminator.
//   matched tuple | no signal at all = unknown | signal that matches nothing (STATE 3)
//   = schema 5, source/medium/campaign NULL, BOTH visit ids kept | never judged = all NULL.
// State 3 is never `unknown` and never the raw value, and it is distinguishable from an
// unmeasured lead because it keeps schema_version 5 and the visit ids.
const ID_A = "2e8c4a1f-60d3-4b97-9a52-c7e1f5b083d6";
const ID_B = "9f1a6c3e-72b5-4d08-b4e9-0c7a2f6d1853";
const COLUMNS = ["source", "medium", "campaign", "funnel_visit_id", "anonymous_visitor_id", "schema_version"];

// Drive the real capture, then the real waitlist handler, and return the row it
// would send to PostgREST plus what the browser held.
async function leadFrom({ search, referrer, hostname = "getgymbo.com", later }) {
  const realWindow = globalThis.window;
  const realDocument = globalThis.document;
  const realFetch = globalThis.fetch;
  const ids = [ID_A, ID_B];
  const sessionStorage = storage();
  const location = { search, hostname };
  globalThis.window = { sessionStorage, localStorage: storage(), location, crypto: { randomUUID: () => ids.shift() } };
  globalThis.document = { referrer };
  try {
    captureAttribution();
    if (later) {
      Object.assign(location, later.location ?? {});
      if ("referrer" in later) globalThis.document.referrer = later.referrer;
      captureAttribution();
    }
    const attribution = getAttribution();
    let row = null;
    globalThis.fetch = async (_url, init) => {
      row = JSON.parse(init.body);
      return new Response(null, { status: 409 });
    };
    const response = await postWaitlist({
      request: { json: async () => ({ name: "A Trainer", email: "trainer@example.invalid", ...(attribution ?? {}) }) },
      env: {},
      waitUntil: () => {},
    });
    assert.equal(response.status, 200);
    return { attribution, stored: Object.fromEntries(COLUMNS.map((column) => [column, row[column]])) };
  } finally {
    globalThis.window = realWindow;
    globalThis.document = realDocument;
    globalThis.fetch = realFetch;
  }
}

const ALL_NULL = Object.fromEntries(COLUMNS.map((column) => [column, null]));
// STATE 3 as stored: an empty tuple, the ids, and the registry version.
const STATE3 = {
  source: null,
  medium: null,
  campaign: null,
  funnel_visit_id: ID_A,
  anonymous_visitor_id: ID_B,
  schema_version: 5,
};

test("STATE 3: an unmatched UTM tuple stores schema 5 with an empty tuple and both visit ids (never unknown, never raw)", async () => {
  const { attribution, stored } = await leadFrom({ search: "?utm_source=foo&utm_medium=bar&utm_campaign=baz", referrer: "" });
  assert.deepEqual(attribution, STATE3);
  assert.deepEqual(stored, STATE3);
});

test("STATE 3: a tagged attempt that is invalid does not fall through to a valid referrer", async () => {
  const { attribution, stored } = await leadFrom({
    search: "?utm_source=naveen_maharashi_06&utm_medium=organic&utm_campaign=summer20",
    referrer: "https://www.google.co.in/search?q=gymbo",
  });
  assert.deepEqual(attribution, STATE3, "must not be credited to Google");
  assert.deepEqual(stored, STATE3);
  assert.equal(JSON.stringify(stored).includes("naveen"), false);
});

test("STATE 3: a partial UTM (source only) is state 3", async () => {
  const { attribution, stored } = await leadFrom({ search: "?utm_source=instagram", referrer: "" });
  assert.deepEqual(attribution, STATE3);
  assert.deepEqual(stored, STATE3);
});

test("STATE 3: an off-list referrer (news.example.com) is state 3", async () => {
  const { attribution, stored } = await leadFrom({ search: "", referrer: "https://news.example.com/story" });
  assert.deepEqual(attribution, STATE3);
  assert.deepEqual(stored, STATE3);
});

test("STATE 2: a measured visit with no signal at all stores the unknown tuple at schema 5", async () => {
  const { attribution, stored } = await leadFrom({ search: "", referrer: "" });
  assert.deepEqual(stored, {
    source: "unknown",
    medium: null,
    campaign: null,
    funnel_visit_id: ID_A,
    anonymous_visitor_id: ID_B,
    schema_version: 5,
  });
  assert.deepEqual(attribution.source, "unknown");
});

test("STATE 2: our own page as referrer is internal navigation, not a signal", async () => {
  const { stored } = await leadFrom({ search: "", referrer: "https://www.getgymbo.com/guide/x" });
  assert.equal(stored.source, "unknown");
  assert.equal(stored.schema_version, 5);
});

test("STATE 2 and STATE 3 produce DIFFERENT stored rows (the count must be able to tell them apart)", async () => {
  const noSignal = await leadFrom({ search: "", referrer: "" });
  const unmatched = await leadFrom({ search: "?utm_source=foo&utm_medium=bar&utm_campaign=baz", referrer: "" });
  assert.notDeepEqual(noSignal.stored, unmatched.stored);
  assert.equal(noSignal.stored.source, "unknown");
  assert.equal(unmatched.stored.source, null);
  // Both were JUDGED by v5, so both keep schema 5 and the ids; only the source differs.
  assert.equal(noSignal.stored.schema_version, 5);
  assert.equal(unmatched.stored.schema_version, 5);
  assert.equal(unmatched.stored.funnel_visit_id, ID_A);
});

test("state 3 is DISTINGUISHABLE from an unmeasured lead by schema_version, not by inference", async () => {
  const state3 = await leadFrom({ search: "?utm_source=foo", referrer: "" });
  // A caller that sent no attribution at all (old/non-form) stores ALL_NULL.
  const stored = await (async () => {
    const realFetch = globalThis.fetch;
    let row = null;
    globalThis.fetch = async (_url, init) => { row = JSON.parse(init.body); return new Response(null, { status: 409 }); };
    try {
      await postWaitlist({ request: { json: async () => ({ name: "A", email: "x@example.invalid" }) }, env: {}, waitUntil: () => {} });
    } finally { globalThis.fetch = realFetch; }
    return Object.fromEntries(COLUMNS.map((column) => [column, row[column]]));
  })();
  assert.deepEqual(stored, ALL_NULL);
  assert.notDeepEqual(state3.stored, stored);
  assert.equal(state3.stored.schema_version, 5);
  assert.equal(stored.schema_version, null);
});

test("STATE 3 is first-touch too: a later untagged page view must not flip it to unknown", async () => {
  const { attribution, stored } = await leadFrom({
    search: "?utm_source=foo&utm_medium=bar&utm_campaign=baz",
    referrer: "",
    later: { location: { search: "" }, referrer: "https://www.getgymbo.com/pricing" },
  });
  assert.deepEqual(attribution, STATE3);
  assert.deepEqual(stored, STATE3);
});

test("STATE 1 still wins over a later unmatched signal", async () => {
  const { stored } = await leadFrom({
    search: "?utm_source=instagram&utm_medium=organic_social&utm_campaign=bio",
    referrer: "",
    later: { location: { search: "?utm_source=foo" }, referrer: "https://news.example.com/" },
  });
  assert.equal(stored.source, "instagram");
  assert.equal(stored.schema_version, 5);
});
