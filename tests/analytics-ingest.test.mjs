// gy-38qovk: the hourly analytics ingest-chain check. Runs the REAL script against a throwaway local server that plays the
// site AND the analytics host. Each broken link must fail by its OWN id (never a bare non-zero), and the good chain must pass,
// so a script that always fails (or always passes) cannot satisfy both halves.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const SCRIPT = resolve(import.meta.dirname, "..", "scripts", "check-analytics-ingest.sh");
const WID = "36b8e820-a50a-44b3-a57b-5ee37f719916";
const BOT_REPLY = '{"beep":"boop"}';

// one server is both the site (/) and the analytics host (/script.js, /api/send)
function start({ tag, script = [200, "application/javascript", "(function(){})()"], send = [200, "application/json", BOT_REPLY], home = 200 }) {
  return new Promise((ok) => {
    const s = http.createServer((req, res) => {
      const host = req.headers.host;
      const t = typeof tag === "function" ? tag(host) : tag ?? `<script async src="http://${host}/script.js" data-website-id="${WID}"></script>`;
      if (req.url === "/") { res.writeHead(home, { "content-type": "text/html" }); res.end(`<html><head>${t}</head><body>hi</body></html>`); }
      else if (req.url === "/script.js") { res.writeHead(script[0], { "content-type": script[1] }); res.end(script[2]); }
      else if (req.url === "/api/send" && req.method === "POST") { res.writeHead(send[0], { "content-type": send[1] }); res.end(send[2]); }
      else { res.writeHead(404); res.end("nope"); }
    });
    s.listen(0, "127.0.0.1", () => ok({ s, host: `127.0.0.1:${s.address().port}` }));
  });
}
function run(url, host) {
  return new Promise((ok) => {
    const p = spawn("bash", [SCRIPT, url], { env: { ...process.env, EXPECT_ANALYTICS_HOST: host } });
    let out = ""; p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (out += d));
    p.on("close", (code) => ok({ code, out }));
  });
}
async function check(opts, want) {
  const { s, host } = await start(opts);
  try {
    const r = await run(`http://${host}/`, host);
    if (want === "PASS") { assert.equal(r.code, 0, r.out); assert.match(r.out, /PASS analytics ingest chain alive/); }
    else if (want === "COULD-NOT-EVALUATE") { assert.equal(r.code, 2, r.out); assert.match(r.out, /COULD-NOT-EVALUATE/); }
    else { assert.equal(r.code, 1, r.out); assert.match(r.out, new RegExp(`FAIL ${want}:`)); }
  } finally { s.close(); }
}

test("POSITIVE CONTROL: a healthy chain passes", () => check({}, "PASS"));
test("no tracker tag on the page -> TAG_MISSING", () => check({ tag: "<!-- no tracker -->" }, "TAG_MISSING"));
test("tag without a website id -> TAG_MISSING", () => check({ tag: (h) => `<script async src="http://${h}/script.js"></script>` }, "TAG_MISSING"));
test("tag pointing at another host -> TAG_MISSING", () => check({ tag: `<script async src="https://evil.example/script.js" data-website-id="${WID}"></script>` }, "TAG_MISSING"));
test("script.js 404 -> SCRIPT_DOWN", () => check({ script: [404, "text/html", "nope"] }, "SCRIPT_DOWN"));
test("script.js served as html -> SCRIPT_DOWN", () => check({ script: [200, "text/html", "<html>"] }, "SCRIPT_DOWN"));
test("/api/send 502 -> INGEST_DOWN", () => check({ send: [502, "text/plain", "bad gateway"] }, "INGEST_DOWN"));
test("/api/send 502 that still carries the bot reply body -> INGEST_DOWN (the status, not the body, decides)", () => check({ send: [502, "application/json", BOT_REPLY] }, "INGEST_DOWN"));
test("/api/send 200 with an unknown body -> INGEST_DOWN", () => check({ send: [200, "text/html", "<html>login</html>"] }, "INGEST_DOWN"));
test("/api/send recorded the probe (cache token) -> INGEST_WROTE_ROW", () => check({ send: [200, "application/json", '{"cache":"abc","sessionId":"s"}'] }, "INGEST_WROTE_ROW"));
test("home page unreachable -> COULD-NOT-EVALUATE, not a pass and not a tag verdict", () => check({ home: 503 }, "COULD-NOT-EVALUATE"));
