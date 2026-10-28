// gy-45fv7: a failed FETCH is not MISSING COPY. getgymbo-smoke.sh used to run `grep` over whatever curl wrote,
// so a connection refused or a 5xx left an empty file and the gate said "/privacy does not disclose ..." and
// "body missing /trainer/": blaming a correct PR with a wrong reason, and sending the reader to the copy.
//
// These tests run the REAL script against a throwaway local HTTP server:
//   - a good site passes (so the fix did not turn the gate red for everything),
//   - a page that loads WITHOUT the required phrase still reports the phrase missing (the missing-phrase control),
//   - a page that cannot be fetched reports "could not fetch" and makes NO claim about its copy.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync, spawn } from "node:child_process";

const ROOT = resolve(import.meta.dirname, "..");
const SCRIPT = resolve(ROOT, "scripts", "getgymbo-smoke.sh");
const contract = JSON.parse(readFileSync(resolve(ROOT, "product-contract.json"), "utf8"));
const jq = spawnSync("jq", ["--version"]).status === 0;

const HOME = `<!doctype html><html><head><title>Gymbo for trainers</title><meta property="og:title" content="Gymbo"/>` +
  `<meta name="theme-color" content="#FAFAF8"/></head><body>trainer app. ₹${contract.pricing.monthly_inr}/month, ₹${contract.pricing.annual_inr_display}/year, save ${contract.pricing.annual_savings_percent}%. Join the waitlist.</body></html>`;
const ROBOTS = "User-agent: *\nAllow: /\nSitemap: https://example.test/sitemap.xml\n";
const PRIVACY_OK = "<html><body>We send today&#x27;s session client names to Anthropic.</body></html>";
const PRIVACY_WITHOUT = "<html><body>We keep data. Nothing else.</body></html>";

// `routes` maps a path to [status, body]. Anything else is 404.
function serve(routes) {
  return new Promise((ok) => {
    const s = http.createServer((req, res) => {
      const r = routes[req.url.split("?")[0]] ?? [404, "nope"];
      res.writeHead(r[0], { "content-type": "text/html" }); res.end(r[1]);
    });
    s.listen(0, "127.0.0.1", () => ok({ s, url: `http://127.0.0.1:${s.address().port}` }));
  });
}
const good = (over = {}) => ({ "/": [200, HOME], "/robots.txt": [200, ROBOTS], "/privacy": [200, PRIVACY_OK], "/terms": [200, "<html>t</html>"], ...over });

function smoke(url) {
  return new Promise((ok) => {
    const p = spawn("bash", [SCRIPT, url], { cwd: ROOT, env: { ...process.env, SMOKE_EXPECT_DB: "" } });
    let out = ""; p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (out += d));
    p.on("close", (code) => ok({ code, out }));
  });
}
const withServer = async (routes, fn) => { const { s, url } = await serve(routes); try { return await fn(url); } finally { s.close(); } };

test("POSITIVE CONTROL: a good site passes, so the fetch-failure handling did not make the gate red for everything", { skip: !jq && "jq not installed" }, async () => {
  const r = await withServer(good(), smoke);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /RESULT: PASS/);
  assert.match(r.out, /OK\s+contract: Anthropic disclosure/);
});

test("MISSING-PHRASE CONTROL: /privacy loads (200) without the disclosure -> the phrase is still reported missing", { skip: !jq && "jq not installed" }, async () => {
  const r = await withServer(good({ "/privacy": [200, PRIVACY_WITHOUT] }), smoke);
  assert.equal(r.code, 1);
  assert.match(r.out, /FAIL: contract: \/privacy does not disclose/);
  assert.doesNotMatch(r.out, /could not fetch/);
});

test("FETCH FAILURE: /privacy answers 500 -> 'could not fetch', and NO claim that the copy is missing", { skip: !jq && "jq not installed" }, async () => {
  const r = await withServer(good({ "/privacy": [500, "boom"] }), smoke);
  assert.equal(r.code, 1, "still blocks the deploy: an unjudgeable page is not a pass");
  assert.match(r.out, /FAIL: contract: could not fetch .*\/privacy \(HTTP 500\)/);
  assert.doesNotMatch(r.out, /does not disclose/);
});

test("FETCH FAILURE: homepage answers 500 -> one 'not fetched' failure, no 'body missing' / 'og:title missing' claims about copy", async () => {
  const r = await withServer(good({ "/": [500, "boom"] }), smoke);
  assert.equal(r.code, 1);
  assert.match(r.out, /FAIL: homepage HTTP 500/);
  assert.match(r.out, /body checks NOT RUN|NOT RUN/);
  assert.doesNotMatch(r.out, /body missing|og:title missing|missing 'Gymbo'|theme-color meta missing|contract: monthly price .* missing/);
});

test("FETCH FAILURE: nothing listening at all (connection refused) -> fetch failures only, never a claim about copy", async () => {
  const { s, url } = await serve(good()); s.close(); // port is now closed
  await new Promise((ok) => setTimeout(ok, 50));
  const r = await smoke(url);
  assert.equal(r.code, 1);
  assert.match(r.out, /FAIL: homepage HTTP 000/);
  assert.doesNotMatch(r.out, /does not disclose|body missing|og:title missing|missing 'Gymbo'|theme-color meta missing/);
});
