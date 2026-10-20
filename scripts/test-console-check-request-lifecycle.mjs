import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { isRunnerNetworkError } from "./runner-network-errors.mjs";

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
    "net-sub-always": '<script src="/net-fault.js"></script>',
    "net-sub-once": '<script src="/net-once.js"></script>',
    "net-sub-twice": '<script src="/net-twice.js"></script>',
    "net-dark-once": '<script src="/net-dark-once.js"></script>',
    "net-sub-plus-404": '<script src="/net-fault.js"></script><script src="/broken.js"></script>',
    "first-party-500": '<script src="/server-error.js"></script>',
    "isolated-third-party": '<script src="https://analytics.getgymbo.com/stall.js"></script>',
  };

  return `<!doctype html>
<html>
  <head><title>Gymbo fixture</title></head>
  <body style="background:#FAFAF7">${scripts[mode]}</body>
</html>`;
};

const runFixture = async (mode, env = {}) => {
  const sockets = new Set();
  let pageLoads = 0;
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

    if (request.url === "/net-fault.js") {
      request.socket.destroy();
      return;
    }

    if (request.url === "/net-once.js") {
      // Chromium silently retries one reset on a reused socket, so key the
      // fault on the page load, not the request count: load 1 = dark-seed
      // check, load 2 = first route attempt (faulted), load 3 = the retry.
      if (pageLoads === 2) {
        request.socket.destroy();
        return;
      }
      response.writeHead(200, { "content-type": "text/javascript" });
      response.end("// ok on retry");
      return;
    }

    if (request.url === "/net-twice.js") {
      // Churn that outlasts one retry: loads 2 and 3 fault, load 4 is clean.
      if (pageLoads === 2 || pageLoads === 3) {
        request.socket.destroy();
        return;
      }
      response.writeHead(200, { "content-type": "text/javascript" });
      response.end("// ok after settling");
      return;
    }

    if (request.url === "/net-dark-once.js") {
      // The dark-seed check is load 1; it must be retried like a route.
      if (pageLoads === 1) {
        request.socket.destroy();
        return;
      }
      response.writeHead(200, { "content-type": "text/javascript" });
      response.end("// ok after settling");
      return;
    }

    if (request.url === "/server-error.js") {
      response.writeHead(500, { "content-type": "text/javascript" });
      response.end("// deliberate 500");
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

    pageLoads += 1;
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
      ...env,
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

// gy-18qle.1: runner-network faults are COULD-NOT-EVALUATE, never a product FAIL.
// No HTTP server can emit ERR_NETWORK_CHANGED, so the seam aliases the two
// errors a destroyed socket produces onto the runner-network list.
const netAlias = {
  CONSOLE_CHECK_TEST_NETWORK_ERRORS: "net::ERR_EMPTY_RESPONSE,net::ERR_CONNECTION_RESET",
  CONSOLE_CHECK_TEST_SETTLE_MS: "200",
};

assert.equal(isRunnerNetworkError("net::ERR_NETWORK_CHANGED"), true);
assert.equal(isRunnerNetworkError("net::ERR_CONNECTION_REFUSED"), false);
assert.equal(isRunnerNetworkError("first-party response HTTP 500"), false);

const netSub = await runFixture("net-sub-always", netAlias);
assert.equal(netSub.code, 2, `seeded subresource network fault:\n${netSub.output}`);
assert.match(netSub.output, /RETRY \/: runner-network fault/);
assert.match(netSub.output, /COULD-NOT-EVALUATE: runner-network fault route=\//);
assert.match(netSub.output, /host=127\.0\.0\.1:\d+ url=http:\/\/127\.0\.0\.1:\d+\/net-fault\.js/);
assert.match(netSub.output, /product verdict incomplete/);
assert.doesNotMatch(netSub.output, /gate FAIL|^FAIL /m);

const netOnce = await runFixture("net-sub-once", netAlias);
assert.equal(netOnce.code, 0, `one-shot network fault should pass on retry:\n${netOnce.output}`);
assert.match(netOnce.output, /RETRY \/: runner-network fault on attempt 1/);
assert.match(netOnce.output, /net-once\.js/);
assert.match(netOnce.output, /all 1 pages clean/);

// gy-g58mk: churn that outlasts one retry passes once it settles (3 tries) ...
const netTwice = await runFixture("net-sub-twice", netAlias);
assert.equal(netTwice.code, 0, `two-shot network fault should pass on try 3:\n${netTwice.output}`);
assert.match(netTwice.output, /RETRY \/: runner-network fault on attempt 2/);
assert.match(netTwice.output, /settling 200 ms before attempt 3\/3/);
assert.match(netTwice.output, /all 1 pages clean/);

// ... the dark-seed check is retried too ...
const netDark = await runFixture("net-dark-once", netAlias);
assert.equal(netDark.code, 0, `dark-seed network fault should pass on retry:\n${netDark.output}`);
assert.match(netDark.output, /RETRY \/ \(dark-seeded\): runner-network fault on attempt 1/);
assert.match(netDark.output, /all 1 pages clean/);

// ... and a fault that never clears is still COULD-NOT-EVALUATE after all 3
// tries (the outage control): the settle delay must not turn a red green.
assert.match(netSub.output, /settling 200 ms before attempt 3\/3/);

const netNavigation = await runFixture("navigation-failure", netAlias);
assert.equal(netNavigation.code, 2, "seeded navigation network fault had the wrong classification");
assert.match(netNavigation.output, /RETRY \/network-reset/);
assert.match(netNavigation.output, /COULD-NOT-EVALUATE: browser navigation failed/);
assert.doesNotMatch(netNavigation.output, /gate FAIL/);

const netPlus404 = await runFixture("net-sub-plus-404", netAlias);
assert.equal(netPlus404.code, 1, "a real 404 beside a network fault must still FAIL");
assert.match(netPlus404.output, /first-party response HTTP 404/);
assert.doesNotMatch(netPlus404.output, /RETRY/, "a page with a product failure must not be retried");

const serverError = await runFixture("first-party-500", netAlias);
assert.equal(serverError.code, 1, "first-party 500 must FAIL");
assert.match(serverError.output, /first-party response HTTP 500/);
assert.doesNotMatch(serverError.output, /RETRY|COULD-NOT-EVALUATE/);

// Without the alias the same destroyed socket is a plain first-party failure.
const noAlias = await runFixture("net-sub-always");
assert.equal(noAlias.code, 1, "unlisted error must remain a product FAIL");

console.log("console-check request lifecycle controls: 15/15 PASS");
