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

test("invalid tagged input with a valid referrer reaches the handler only as atomic unknown", async () => {
  const realWindow = globalThis.window;
  const realDocument = globalThis.document;
  const realFetch = globalThis.fetch;
  const sessionStorage = storage();
  const localStorage = storage();
  const ids = [
    "2e8c4a1f-60d3-4b97-9a52-c7e1f5b083d6",
    "9f1a6c3e-72b5-4d08-b4e9-0c7a2f6d1853",
  ];

  globalThis.window = {
    sessionStorage,
    localStorage,
    location: {
      search: "?utm_source=naveen_maharashi_06&utm_medium=organic&utm_campaign=summer20",
      hostname: "getgymbo.com",
    },
    crypto: { randomUUID: () => ids.shift() },
  };
  globalThis.document = { referrer: "https://www.google.co.in/search?q=gymbo" };

  try {
    captureAttribution();
    const attribution = getAttribution();
    assert.deepEqual(
      {
        source: attribution.source,
        medium: attribution.medium,
        campaign: attribution.campaign,
      },
      { source: "unknown", medium: null, campaign: null },
    );
    assert.equal(JSON.stringify(attribution).includes("naveen_maharashi_06"), false);
    assert.equal(JSON.stringify(attribution).includes("summer20"), false);

    let row = null;
    globalThis.fetch = async (_url, init) => {
      row = JSON.parse(init.body);
      return new Response(null, { status: 409 });
    };
    const response = await postWaitlist({
      request: {
        json: async () => ({
          name: "A Trainer",
          email: "trainer@example.invalid",
          ...attribution,
        }),
      },
      env: {},
      waitUntil: () => {},
    });
    assert.equal(response.status, 200);
    assert.deepEqual(
      {
        source: row.source,
        medium: row.medium,
        campaign: row.campaign,
        funnel_visit_id: row.funnel_visit_id,
        anonymous_visitor_id: row.anonymous_visitor_id,
        schema_version: row.schema_version,
      },
      attribution,
      "the actual waitlist handler must receive a complete unknown tuple, never Google",
    );
  } finally {
    globalThis.window = realWindow;
    globalThis.document = realDocument;
    globalThis.fetch = realFetch;
  }
});
