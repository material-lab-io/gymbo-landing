// gy-t3aoyv.7.2.2 — the no-login invoice page /i/<token>. Supabase is stubbed: each test fixes the exact row shape of invoice_public_page's closed 16-column result.
// What is proved here is the page's own contract with compliance (gy-t3aoyv.7.2, 12 conditions): uniform refusal, headers on every response, view-only, no token in logs
// or HTML, "Invoice" not "Tax invoice", the privacy line, the per-IP throttle, and (pm 22 Nov, binding) that the RPC is called as ANON even when the visitor is signed in.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { _resetRateLimitStateForTests } from "../functions/i/_ratelimit.js";
import { SUPABASE_ANON_KEY } from "../functions/m/_shared.js";
import { money, day, HEADERS } from "../functions/i/[token].js";

const MOD = "../functions/i/[token].js";
const ENV = { SUPABASE_URL: "https://stub.invalid" };
const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz012345"; // 32 chars, the RPC's shape
const BASE = {
  trainer_name: "Coach Ravi", client_first_name: "Asha", invoice_number: "INV-0042", status: "issued", issue_date: "2026-11-22", due_date: "2026-12-05", currency: "INR",
  subtotal_minor: 300000, tax_minor: 0, total_minor: 300000, outstanding_minor: 300000,
};
const line = (position, description, quantity, unit) => ({
  ...BASE, line_position: position, line_description: description, line_quantity: quantity, line_unit_price_minor: unit, line_total_minor: quantity * unit,
});
const ROWS = [line(1, "Personal training, November", 10, 25000), line(2, "Diet plan", 1, 50000)];

let calls;
function stub(rows, { status = 200, throws = false } = {}) {
  calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (throws) throw new Error("down");
    return new Response(JSON.stringify(rows), { status });
  };
}
async function get(rows, { token = TOKEN, headers = {}, ...o } = {}) {
  _resetRateLimitStateForTests();
  stub(rows, o);
  const { onRequestGet } = await import(MOD);
  const res = await onRequestGet({ env: ENV, params: { token }, request: new Request("https://getgymbo.com/i/x", { headers }) });
  return { res, status: res.status, html: await res.text() };
}

test("POSITIVE CONTROL: a live link renders the invoice, titled Invoice, with the privacy line", async () => {
  const { status, html } = await get(ROWS);
  assert.equal(status, 200);
  assert.match(html, /<h1>Invoice<\/h1>/);
  assert.match(html, /<title>Invoice<\/title>/);
  assert.match(html, /INV-0042/);
  assert.match(html, /<dt>From<\/dt><dd>Coach Ravi<\/dd>/);
  assert.match(html, /<dt>Bill to<\/dt><dd>Asha<\/dd>/);
  assert.match(html, /22 Nov 2026/);
  assert.match(html, /5 Dec 2026/);
  assert.match(html, /Personal training, November/);
  assert.match(html, /10 × ₹250/);
  assert.match(html, /₹2,500/);
  assert.match(html, /Amount due<\/span><b class="amt">₹3,000/);
  // Q7: one line, the trainer's name, the privacy link.
  assert.match(html, /Sent by Coach Ravi using Gymbo\. How Gymbo handles this: <a href="https:\/\/getgymbo\.com\/privacy"/);
});

test("it is not a GST tax invoice, and carries no payment instruction or trainer contact (Q4, Q6)", async () => {
  const { html } = await get(ROWS);
  assert.doesNotMatch(html, /tax invoice/i);
  assert.doesNotMatch(html, /GSTIN|CGST|SGST|\bUPI\b|IFSC|\bbank\b|account number|pay now/i);
});

test("condition 11, VIEW-ONLY: no form, button, input, script, link tag, image, iframe or inline handler", async () => {
  const { html } = await get(ROWS);
  for (const re of [/<form/i, /<button/i, /<input/i, /<textarea/i, /<script/i, /<link\b/i, /<img/i, /<iframe/i, /<video/i, /\son[a-z]+=/i, /<meta[^>]+refresh/i]) {
    assert.doesNotMatch(html, re, `must not contain ${re}`);
  }
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(hrefs, ["https://getgymbo.com/privacy"], "the privacy link is the ONLY link on the page");
});

test("condition 10: the same header set on EVERY response, refusal, upstream failure and POST included", async () => {
  const want = { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer" };
  const { onRequestPost } = await import(MOD);
  _resetRateLimitStateForTests();
  const responses = [
    (await get(ROWS)).res,
    (await get([])).res,
    (await get(ROWS, { token: "short" })).res,
    (await get(ROWS, { status: 500 })).res,
    (await get(ROWS, { throws: true })).res,
    await onRequestPost({ request: new Request("https://getgymbo.com/i/x", { method: "POST" }) }),
  ];
  assert.deepEqual(responses.map((r) => r.status), [200, 404, 404, 503, 503, 405]);
  for (const r of responses) {
    for (const [k, v] of Object.entries(want)) assert.equal(r.headers.get(k), v, `${r.status} ${k}`);
    const csp = r.headers.get("content-security-policy");
    assert.match(csp, /default-src 'none'/);
    assert.doesNotMatch(csp, /script-src|https?:/, "no script source and no third-party origin, ever");
  }
  assert.equal(HEADERS["cache-control"], "private, no-store");
});

test("the 429 carries the same headers", async () => {
  _resetRateLimitStateForTests();
  stub(ROWS);
  const { onRequestGet } = await import(MOD);
  let last;
  for (let i = 0; i < 21; i++) last = await onRequestGet({ env: ENV, params: { token: TOKEN }, request: new Request("https://getgymbo.com/i/x", { headers: { "CF-Connecting-IP": "8.8.8.8" } }) });
  assert.equal(last.status, 429);
  assert.equal(last.headers.get("cache-control"), "private, no-store");
  assert.equal(last.headers.get("referrer-policy"), "no-referrer");
  assert.equal(last.headers.get("x-robots-tag"), "noindex, nofollow");
});

test("condition 6: zero rows is ONE 404 with no invoice content; a malformed token gets the byte-identical page and never reaches the database", async () => {
  const { status, html } = await get([]);
  assert.equal(status, 404);
  assert.match(html, /not available/i);
  assert.doesNotMatch(html, /Coach Ravi|INV-|Asha/, "no invoice content on a refusal");
  const malformed = await get(ROWS, { token: "not-a-token" });
  assert.equal(malformed.status, 404);
  assert.equal(malformed.html, html);
  assert.equal(calls.length, 0, "a malformed token never reaches the database");
});

test("an upstream failure is an honest 503, never the refusal (no false 'not available' on a real link)", async () => {
  const a = await get(ROWS, { status: 500 });
  const b = await get(ROWS, { throws: true });
  assert.equal(a.status, 503);
  assert.equal(b.status, 503);
  assert.match(a.html, /try again/i);
});

test("PM BINDING: a visitor SIGNED IN as a trainer still reaches the RPC as ANON, and the page renders", async () => {
  const USER_JWT = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYXV0aGVudGljYXRlZCIsInN1YiI6InRyYWluZXItMSJ9.sig";
  const { status, html } = await get(ROWS, {
    headers: {
      authorization: `Bearer ${USER_JWT}`,
      cookie: `sb-access-token=${USER_JWT}; sb-refresh-token=r; gymbo_session=1`,
      apikey: USER_JWT,
      "x-client-info": "gymbo-web",
    },
  });
  assert.equal(status, 200);
  assert.match(html, /INV-0042/);
  assert.equal(calls.length, 1);
  const h = new Headers(calls[0].init.headers);
  assert.ok(calls[0].url.endsWith("/rest/v1/rpc/invoice_public_page"));
  assert.equal(h.get("authorization"), `Bearer ${SUPABASE_ANON_KEY}`, "the bearer is the public anon key, never the session");
  assert.equal(h.get("apikey"), SUPABASE_ANON_KEY);
  assert.equal(h.get("cookie"), null);
  assert.equal(h.get("x-client-info"), null);
  assert.ok(![...h.values()].some((v) => v.includes(USER_JWT)), "no value of the visitor's session is on the outgoing call");
  assert.deepEqual(JSON.parse(calls[0].init.body), { p_token: TOKEN });
});

test("PM BINDING CONTROL: the assertion above can fail (a wrapper that forwards the visitor's bearer violates it)", async () => {
  const USER_JWT = "user-session-jwt";
  const forwarding = async (request) => {
    const h = { apikey: SUPABASE_ANON_KEY, Authorization: request.headers.get("authorization") };
    await fetch("https://stub.invalid/rest/v1/rpc/invoice_public_page", { method: "POST", headers: h, body: "{}" });
  };
  stub(ROWS);
  await forwarding(new Request("https://getgymbo.com/i/x", { headers: { authorization: `Bearer ${USER_JWT}` } }));
  const h = new Headers(calls[0].init.headers);
  assert.notEqual(h.get("authorization"), `Bearer ${SUPABASE_ANON_KEY}`);
  assert.ok([...h.values()].some((v) => v.includes(USER_JWT)));
});

test("source pin: the page reads the request for CF-Connecting-IP only, and the RPC wrapper never reads a request at all", () => {
  const page = readFileSync(new URL("../functions/i/[token].js", import.meta.url), "utf8");
  const rpc = readFileSync(new URL("../functions/i/_invoice_rpc.js", import.meta.url), "utf8");
  const reads = [...page.matchAll(/request\??\.headers\??\.get\??\.\(\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(reads.length >= 2, "the control: the pattern sees the throttle's header reads");
  assert.deepEqual([...new Set(reads)], ["CF-Connecting-IP"]);
  assert.doesNotMatch(rpc.replace(/\/\/.*$/gm, ""), /request|cookie|authorization|headers\.get/i);
  assert.match(rpc, /headers: anonHeaders\(\)/);
});

test("condition 9: the token is never logged and never echoed into the page", async () => {
  const logged = [];
  const orig = console.error;
  console.error = (...a) => logged.push(a.join(" "));
  try {
    await get([]);
    await get(ROWS, { status: 500 });
    await get(ROWS, { throws: true });
    const ok = await get(ROWS);
    assert.ok(!ok.html.includes(TOKEN), "the token is not in the HTML (no canonical, og:url or self link)");
    _resetRateLimitStateForTests();
    stub(ROWS);
    const { onRequestGet } = await import(MOD);
    for (let i = 0; i < 22; i++) await onRequestGet({ env: ENV, params: { token: TOKEN }, request: new Request("https://getgymbo.com/i/x", { headers: { "CF-Connecting-IP": "9.9.9.9" } }) });
  } finally {
    console.error = orig;
  }
  assert.ok(logged.length >= 4, "the control: the failure paths did log something");
  assert.ok(logged.every((l) => !l.includes(TOKEN) && !l.includes("/i/")), "a log line carried the token or the path");
});

test("no Open Graph or Twitter card (pm: OG off for invoices)", async () => {
  const { html } = await get(ROWS);
  assert.doesNotMatch(html, /og:|twitter:|rel="canonical"/i);
});

test("a paid invoice says Paid in full and no amount due; zero tax prints no Tax row; a null first name prints no Bill to", async () => {
  const paid = ROWS.map((r) => ({ ...r, status: "paid", outstanding_minor: 0, client_first_name: null }));
  const { html } = await get(paid);
  assert.match(html, /Paid in full/);
  assert.doesNotMatch(html, /Amount due/);
  assert.doesNotMatch(html, /<dt>Tax<\/dt>/);
  assert.doesNotMatch(html, /Bill to/);
  const taxed = ROWS.map((r) => ({ ...r, tax_minor: 54000, total_minor: 354000, outstanding_minor: 354000 }));
  assert.match((await get(taxed)).html, /<dt>Tax<\/dt><dd class="amt">₹540/);
});

test("partly paid shows what is still outstanding, not the total", async () => {
  const part = ROWS.map((r) => ({ ...r, status: "partially_paid", outstanding_minor: 120050 }));
  const { html } = await get(part);
  assert.match(html, /Partly paid/);
  assert.match(html, /Amount due<\/span><b class="amt">₹1,200\.50/);
});

test("a line description is escaped (a trainer types it)", async () => {
  const { html } = await get([line(1, `<img src=x onerror=alert(1)>`, 1, 100)]);
  assert.doesNotMatch(html, /<img/i);
  assert.match(html, /&lt;img/);
});

test("money and day: Indian grouping, paise only when present, a date never moves with the timezone", () => {
  assert.equal(money(12345600), "₹1,23,456");
  assert.equal(money(50), "₹0.50");
  assert.equal(money(100050), "₹1,000.50");
  assert.equal(money(500, "USD"), "USD 5");
  assert.equal(day("2026-11-22"), "22 Nov 2026");
  assert.equal(day("2026-01-05"), "5 Jan 2026");
  assert.equal(day(null), "");
});

test("gy-emboo parity: the 21st request from one IP in the window is 429, a fresh IP is not, no IP fails open", async () => {
  _resetRateLimitStateForTests();
  stub(ROWS);
  const { onRequestGet } = await import(MOD);
  const req = (ip) => new Request("https://getgymbo.com/i/x", { headers: ip ? { "CF-Connecting-IP": ip } : {} });
  const codes = [];
  for (let i = 0; i < 21; i++) codes.push((await onRequestGet({ env: ENV, params: { token: TOKEN }, request: req("1.1.1.1") })).status);
  assert.equal(codes.slice(0, 20).every((c) => c === 200), true);
  assert.equal(codes[20], 429);
  assert.equal((await onRequestGet({ env: ENV, params: { token: TOKEN }, request: req("2.2.2.2") })).status, 200, "positive control: a fresh IP is not limited");
  for (let i = 0; i < 30; i++) assert.equal((await onRequestGet({ env: ENV, params: { token: TOKEN }, request: req(null) })).status, 200, "no key fails open");
});

test("POST is view-only 405 (Allow: GET) and is throttled on its own counter", async () => {
  _resetRateLimitStateForTests();
  const { onRequestPost } = await import(MOD);
  const post = (ip) => onRequestPost({ request: new Request("https://getgymbo.com/i/x", { method: "POST", headers: { "CF-Connecting-IP": ip } }) });
  const first = await post("3.3.3.3");
  assert.equal(first.status, 405);
  assert.equal(first.headers.get("allow"), "GET");
  let last;
  for (let i = 0; i < 20; i++) last = await post("3.3.3.3");
  assert.equal(last.status, 429);
});
