import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

const consoleCheckPath = fileURLToPath(new URL("./console-check.mjs", import.meta.url));
const fixtureTimeoutMs = "600";
const consoleCheckSource = await readFile(consoleCheckPath, "utf8");

assert.match(
  consoleCheckSource,
  /defaultNavigationTimeoutMs = 30_000/,
  "production navigation timeout must remain exactly 30 seconds",
);
assert.match(
  consoleCheckSource,
  /CONSOLE_CHECK_TEST_TIMEOUT_MS is restricted to loopback fixtures/,
  "short fixture timeout must remain restricted to loopback URLs",
);

const htmlFor = (mode) => {
  const scripts = {
    healthy: "",
    "first-party-stall": '<script src="/stall.js"></script>',
    "first-party-404": '<script src="/broken.js"></script>',
    "first-party-js-error":
      '<script>throw new Error("seeded first-party JS error: __missingGymboFixture")</script>',
    "isolated-third-party": '<script src="https://analytics.getgymbo.com/stall.js"></script>',
  };

  return `<!doctype html>
<html>
  <head><title>Gymbo fixture</title></head>
  <body style="background:#FAFAF7">${scripts[mode]}</body>
</html>`;
};

const runFixture = async (mode) => {
  const sockets = new Set();
  const server = createServer((request, response) => {
    if (request.url === "/sitemap.xml") {
      if (mode === "sitemap-network-failure") {
        request.socket.destroy();
        return;
      }
      if (mode === "sitemap-failure") {
        response.writeHead(503, { "content-type": "text/plain" });
        response.end("deliberate sitemap bootstrap failure");
        return;
      }
      response.writeHead(200, { "content-type": "application/xml" });
      const route = mode === "navigation-failure" ? "/network-reset" : "/";
      response.end(
        `<?xml version="1.0"?><urlset><url><loc>https://getgymbo.com${route}</loc></url></urlset>`,
      );
      return;
    }

    if (request.url === "/network-reset") {
      request.socket.destroy();
      return;
    }

    if (request.url === "/stall.js") {
      response.writeHead(200, { "content-type": "text/javascript" });
      response.write("// deliberately left pending");
      return;
    }

    if (request.url === "/broken.js") {
      response.writeHead(404, { "content-type": "text/javascript" });
      response.end("// deliberately missing");
      return;
    }

    response.writeHead(200, { "content-type": "text/html" });
    response.end(htmlFor(mode));
  });

  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  const child = spawn(process.execPath, [consoleCheckPath, base], {
    env: {
      ...process.env,
      CONSOLE_CHECK_TEST_TIMEOUT_MS: fixtureTimeoutMs,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const killTimer = setTimeout(() => child.kill("SIGKILL"), 35_000);
  const [code, signal] = await once(child, "exit");
  clearTimeout(killTimer);

  for (const socket of sockets) socket.destroy();
  await new Promise((resolve) => server.close(resolve));

  assert.notEqual(signal, "SIGKILL", `${mode}: console-check exceeded the fixture deadline`);
  return { code, output: `${stdout}\n${stderr}` };
};

const healthy = await runFixture("healthy");
assert.equal(healthy.code, 0, `healthy fixture failed:\n${healthy.output}`);
assert.match(healthy.output, /all 1 pages clean/);

const sitemapFailure = await runFixture("sitemap-failure");
assert.equal(sitemapFailure.code, 2, "sitemap bootstrap failure had the wrong classification");
assert.match(sitemapFailure.output, /COULD-NOT-EVALUATE: phase=sitemap-fetch/);
assert.match(sitemapFailure.output, /url=http:\/\/127\.0\.0\.1:\d+\/sitemap\.xml/);
assert.match(sitemapFailure.output, /message="HTTP 503"/);
assert.doesNotMatch(sitemapFailure.output, /page\(s\) have first-party or console error/);

const sitemapNetworkFailure = await runFixture("sitemap-network-failure");
assert.equal(
  sitemapNetworkFailure.code,
  2,
  "sitemap network failure had the wrong classification",
);
assert.match(sitemapNetworkFailure.output, /COULD-NOT-EVALUATE: phase=sitemap-fetch/);
assert.match(sitemapNetworkFailure.output, /code=UND_ERR_SOCKET/);
assert.match(sitemapNetworkFailure.output, /attempted_address=127\.0\.0\.1/);
assert.match(sitemapNetworkFailure.output, /address_family=IPv4/);

const navigationFailure = await runFixture("navigation-failure");
assert.equal(navigationFailure.code, 2, "navigation failure had the wrong classification");
assert.match(navigationFailure.output, /COULD-NOT-EVALUATE: browser navigation failed/);
assert.match(navigationFailure.output, /route=\/network-reset/);
assert.match(navigationFailure.output, /ERR_(?:EMPTY_RESPONSE|CONNECTION_RESET)/);
assert.doesNotMatch(
  navigationFailure.output,
  /page\(s\) have first-party or console error/,
);

const stalled = await runFixture("first-party-stall");
assert.notEqual(stalled.code, 0, "stalled first-party request unexpectedly passed");
assert.match(stalled.output, /COULD-NOT-EVALUATE: browser load did not complete/);
assert.match(stalled.output, /lifecycle=pending/);
assert.match(stalled.output, /host=127\.0\.0\.1/);
assert.match(stalled.output, /url=http:\/\/127\.0\.0\.1:\d+\/stall\.js/);
assert.match(stalled.output, /load_event=not-fired/);
assert.doesNotMatch(stalled.output, /page\(s\) have console errors/);

const broken = await runFixture("first-party-404");
assert.notEqual(broken.code, 0, "broken first-party request unexpectedly passed");
assert.match(broken.output, /first-party response HTTP 404/);
assert.match(broken.output, /\/broken\.js/);
assert.doesNotMatch(broken.output, /COULD-NOT-EVALUATE/);

const jsError = await runFixture("first-party-js-error");
assert.notEqual(jsError.code, 0, "seeded first-party JS error unexpectedly passed");
assert.match(jsError.output, /pageerror:/);
assert.match(jsError.output, /__missingGymboFixture/);

const isolated = await runFixture("isolated-third-party");
assert.equal(isolated.code, 0, `isolated third-party fixture failed:\n${isolated.output}`);
assert.match(
  isolated.output,
  /isolated non-gating third-party host\(s\): analytics\.getgymbo\.com/,
);

console.log("console-check request lifecycle controls: 8/8 PASS");
