// gy-ufxgo.11 — controls for the Start free hop (src/lib/signupHref.mjs).
// What these catch: the visitor's source dropped at the hop (every landing sign-up stored as src=landing with
// utm_* NULL, so Instagram and website are one row again), and the opposite failure, a raw slug-shaped value
// (a name, a phone number, a referral code) carried into the app URL.

import { test } from "node:test";
import assert from "node:assert/strict";
import { FORWARDED_SOURCES, signupHref } from "../src/lib/signupHref.mjs";
import { resolveSource } from "../src/lib/sourceSlug.mjs";

const BASE = "https://app.getgymbo.com/signup?src=landing";
const params = (href) => Object.fromEntries(new URL(href).searchParams);

test("an Instagram visit forwards utm_source=instagram and keeps src=landing", () => {
  assert.deepEqual(params(signupHref(BASE, "instagram")), { src: "landing", utm_source: "instagram" });
});

test("a no-signal visit forwards utm_source=unknown", () => {
  const source = resolveSource({ utmSource: null, referrer: "", selfHost: "getgymbo.com" });
  assert.equal(source, "unknown");
  assert.deepEqual(params(signupHref(BASE, source)), { src: "landing", utm_source: "unknown" });
});

test("a visit nobody classified forwards nothing beyond src=landing", () => {
  assert.equal(signupHref(BASE, null), BASE);
  assert.equal(signupHref(BASE, undefined), BASE);
});

test("a referral forwards source and medium referral, never the code", () => {
  const href = signupHref(BASE, resolveSource({ utmSource: "referral" }));
  assert.deepEqual(params(href), { src: "landing", utm_source: "referral", utm_medium: "referral" });
  assert.ok(!href.includes("utm_campaign"), href);
});

test("a raw slug-shaped value is never forwarded: it goes as unknown", () => {
  for (const raw of ["damini-rathi", "9876543210", "summer20", "priya-jan", "getgymbo.com"]) {
    const source = resolveSource({ utmSource: raw });
    const href = signupHref(BASE, source);
    assert.equal(params(href).utm_source, "unknown", `${raw} -> ${href}`);
    assert.ok(!href.includes(source), `${raw} survived into ${href}`);
  }
});

test("every registry source is forwarded by name, and organic search engines resolve into the list", () => {
  for (const s of FORWARDED_SOURCES) assert.equal(params(signupHref(BASE, s)).utm_source, s);
  for (const host of ["google.com", "google.co.in", "bing.com", "duckduckgo.com", "search.yahoo.com", "yandex.com"]) {
    const s = resolveSource({ referrer: `https://${host}/`, selfHost: "getgymbo.com" });
    assert.ok(FORWARDED_SOURCES.has(s), `${host} resolves to ${s}, which the hop would forward as unknown`);
  }
  const ig = resolveSource({ referrer: "android-app://com.instagram.android/", selfHost: "getgymbo.com" });
  assert.equal(params(signupHref(BASE, ig)).utm_source, "instagram");
});
