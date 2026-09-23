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

// gy-ufxgo.8, marketer ruling 2026-09-23: three mutually exclusive lead states.
//   1 matched tuple | 2 no signal at all = unknown | 3 signal that matches
//   nothing = NO attribution (all columns NULL), never unknown, never raw.
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

test("STATE 3: an unmatched UTM tuple sends no attribution and stores all-NULL (never unknown, never raw)", async () => {
  const { attribution, stored } = await leadFrom({ search: "?utm_source=foo&utm_medium=bar&utm_campaign=baz", referrer: "" });
  assert.equal(attribution, null);
  assert.deepEqual(stored, ALL_NULL);
});

test("STATE 3: a tagged attempt that is invalid does not fall through to a valid referrer", async () => {
  const { attribution, stored } = await leadFrom({
    search: "?utm_source=naveen_maharashi_06&utm_medium=organic&utm_campaign=summer20",
    referrer: "https://www.google.co.in/search?q=gymbo",
  });
  assert.equal(attribution, null, "must not be credited to Google");
  assert.deepEqual(stored, ALL_NULL);
  assert.equal(JSON.stringify(stored).includes("naveen"), false);
});

test("STATE 3: a partial UTM (source only) sends no attribution", async () => {
  const { attribution, stored } = await leadFrom({ search: "?utm_source=instagram", referrer: "" });
  assert.equal(attribution, null);
  assert.deepEqual(stored, ALL_NULL);
});

test("STATE 3: an off-list referrer (news.example.com) sends no attribution", async () => {
  const { attribution, stored } = await leadFrom({ search: "", referrer: "https://news.example.com/story" });
  assert.equal(attribution, null);
  assert.deepEqual(stored, ALL_NULL);
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
  // Liveness: both rows came from the real handler, not from an empty stub.
  assert.equal(noSignal.stored.schema_version, 5);
});

test("STATE 3 is first-touch too: a later untagged page view must not flip it to unknown", async () => {
  const { attribution, stored } = await leadFrom({
    search: "?utm_source=foo&utm_medium=bar&utm_campaign=baz",
    referrer: "",
    later: { location: { search: "" }, referrer: "https://www.getgymbo.com/pricing" },
  });
  assert.equal(attribution, null);
  assert.deepEqual(stored, ALL_NULL);
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
