// Console-error gate (gy-kefk3 #1): load every route in a headless browser and
// fail on OUR JS errors (uncaught exceptions + React/hydration console errors).
// Routes are discovered from the generated sitemap, so new pages are covered
// automatically. Third-party resource-load noise (fonts/analytics/CDN, favicon)
// is filtered out so a CDN hiccup can't flake the deploy gate.
// Usage: node scripts/console-check.mjs <base-url>
import { isIP } from "node:net";
import { chromium } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:8788";
const baseUrl = new URL(base);
const baseOrigin = baseUrl.origin;
const defaultNavigationTimeoutMs = 30_000;
const testTimeout = process.env.CONSOLE_CHECK_TEST_TIMEOUT_MS;
let navigationTimeoutMs = defaultNavigationTimeoutMs;

if (testTimeout !== undefined) {
  const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
  const parsed = Number(testTimeout);
  if (!loopbackHosts.has(baseUrl.hostname)) {
    throw new Error("CONSOLE_CHECK_TEST_TIMEOUT_MS is restricted to loopback fixtures");
  }
  if (!Number.isInteger(parsed) || parsed < 100 || parsed > defaultNavigationTimeoutMs) {
    throw new Error(
      `CONSOLE_CHECK_TEST_TIMEOUT_MS must be an integer from 100 to ${defaultNavigationTimeoutMs}`,
    );
  }
  navigationTimeoutMs = parsed;
}

const formatError = (error) => {
  const parts = [];
  let current = error;
  const seen = new Set();
  while (current && !seen.has(current)) {
    seen.add(current);
    const message = current instanceof Error ? current.message : String(current);
    const facts = [];
    if (current instanceof Error) facts.push(`name=${current.name}`);
    if (typeof current === "object") {
      if (current.code) facts.push(`code=${current.code}`);
      if (current.errno) facts.push(`errno=${current.errno}`);
      if (current.syscall) facts.push(`syscall=${current.syscall}`);
      if (current.port) facts.push(`port=${current.port}`);
    }

    const explicitAddress =
      typeof current === "object" && typeof current.address === "string"
        ? current.address
        : typeof current === "object" && typeof current.socket?.remoteAddress === "string"
          ? current.socket.remoteAddress
          : null;
    const socketPort =
      typeof current === "object" && Number.isInteger(current.socket?.remotePort)
        ? current.socket.remotePort
        : null;
    const messageAddress =
      message.match(/\[([0-9a-f:]+)\](?::\d+)?/i)?.[1] ??
      message.match(/\b((?:\d{1,3}\.){3}\d{1,3})\b/)?.[1] ??
      null;
    const attemptedAddress = explicitAddress ?? messageAddress;
    const addressFamily = attemptedAddress ? isIP(attemptedAddress) : 0;
    if (attemptedAddress) facts.push(`attempted_address=${attemptedAddress}`);
    if (addressFamily) facts.push(`address_family=IPv${addressFamily}`);
    if (socketPort) facts.push(`attempted_port=${socketPort}`);
    facts.push(`message=${JSON.stringify(message)}`);
    parts.push(facts.join(" "));
    current = typeof current === "object" ? current.cause : null;
  }
  return parts.join("; cause: ");
};

const sitemapUrl = `${base}/sitemap.xml`;
let sitemap;
try {
  const response = await fetch(sitemapUrl);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  sitemap = await response.text();
} catch (error) {
  console.error(
    `console-check: COULD-NOT-EVALUATE: phase=sitemap-fetch host=${baseUrl.host} url=${sitemapUrl} detail=${formatError(error)}`,
  );
  process.exit(2);
}
const paths = [...sitemap.matchAll(/<loc>https:\/\/getgymbo\.com(\/[^<]*)<\/loc>/g)].map((m) => m[1]);
if (paths.length === 0) {
  console.error("console-check: COULD-NOT-EVALUATE: no routes found in sitemap — aborting");
  process.exit(2);
}

// Ignore third-party / network noise — we only gate on our own JS errors.
const ignore = (t) =>
  /failed to load resource|net::err|err_|favicon|fonts\.g(oogle|static)apis|analytics\.getgymbo|the server responded with a status/i.test(t);

const browser = await chromium.launch();
const failures = [];
// This gate checks our JS, not the availability of third-party telemetry or
// font CDNs. Merely ignoring their console noise is insufficient: page.goto()
// waits for the `load` event, so a stalled ignored request can still hold the
// navigation open until its 30s deadline after every first-party asset has
// loaded (gy-cbbdo, run 35691032310 attempts 1 and 2).
//
// Keep `waitUntil: "load"` for all first-party resources. Isolate only the
// exact external hosts the gate already declares non-gating, so this does not
// turn into a broader request filter or make our own bundle/assets optional.
const ignoredThirdPartyHosts = new Set([
  "analytics.getgymbo.com",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
]);
const isolatedThirdPartyHosts = new Set();

const newCheckedPage = async () => {
  const page = await browser.newPage();
  const pendingRequests = new Map();
  const firstPartyFailures = new Map();

  const detailsFor = (request) => {
    const requestUrl = new URL(request.url());
    return {
      url: requestUrl.href,
      host: requestUrl.host,
      method: request.method(),
      resourceType: request.resourceType(),
      startedAt: Date.now(),
    };
  };

  page.on("request", (request) => {
    pendingRequests.set(request, detailsFor(request));
  });
  page.on("requestfinished", (request) => {
    pendingRequests.delete(request);
  });
  page.on("requestfailed", (request) => {
    const details = pendingRequests.get(request) ?? detailsFor(request);
    pendingRequests.delete(request);
    const isMainNavigation =
      request.isNavigationRequest() && request.frame() === page.mainFrame();
    if (new URL(details.url).origin === baseOrigin && !isMainNavigation) {
      const reason = request.failure()?.errorText || "unknown network failure";
      firstPartyFailures.set(
        `request:${details.url}`,
        `first-party request failed (${reason}) url=${details.url}`,
      );
    }
  });
  page.on("response", (response) => {
    const requestUrl = new URL(response.url());
    if (requestUrl.origin === baseOrigin && response.status() >= 400) {
      firstPartyFailures.set(
        `response:${requestUrl.href}`,
        `first-party response HTTP ${response.status()} url=${requestUrl.href}`,
      );
    }
  });

  await page.route("**/*", async (route) => {
    const requestUrl = new URL(route.request().url());
    if (
      requestUrl.origin !== baseOrigin &&
      ignoredThirdPartyHosts.has(requestUrl.hostname)
    ) {
      isolatedThirdPartyHosts.add(requestUrl.hostname);
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });
  return {
    page,
    diagnostics: {
      firstPartyFailures: () => [...firstPartyFailures.values()],
      pendingRequests: () =>
        [...pendingRequests.values()]
          .map((request) => ({ ...request, ageMs: Date.now() - request.startedAt }))
          .sort((a, b) => b.ageMs - a.ageMs || a.url.localeCompare(b.url)),
    },
  };
};

const couldNotEvaluate = [];

const navigateToLoad = async ({ page, diagnostics }, url, label) => {
  try {
    const response = await page.goto(url, {
      waitUntil: "load",
      timeout: navigationTimeoutMs,
    });
    return { kind: "loaded", response };
  } catch (error) {
    let readyState = "unavailable";
    try {
      readyState = await page.evaluate(() => document.readyState);
    } catch {
      // Navigation may have failed before a document became inspectable.
    }

    const pending = diagnostics.pendingRequests();
    couldNotEvaluate.push(label);
    if (error?.name === "TimeoutError") {
      console.error(
        `COULD-NOT-EVALUATE: browser load did not complete route=${label} timeout_ms=${navigationTimeoutMs} wait_until=load load_event=not-fired document_ready_state=${readyState}`,
      );
    } else {
      console.error(
        `COULD-NOT-EVALUATE: browser navigation failed route=${label} host=${new URL(url).host} wait_until=load load_event=not-observed document_ready_state=${readyState}`,
      );
    }
    if (pending.length === 0) {
      console.error("     pending-request lifecycle=none-observed");
    } else {
      for (const request of pending) {
        console.error(
          `     pending-request lifecycle=pending age_ms=${request.ageMs} method=${request.method} resource_type=${request.resourceType} host=${request.host} url=${request.url}`,
        );
      }
    }
    console.error(`     navigation-error=${formatError(error)}`);
    return { kind: "could-not-evaluate", error };
  }
};
// gy-pvi8y: tracked separately from `failures`/`paths` on purpose. The
// dark-seed check below is a single extra assertion, not one of the
// sitemap routes -- folding its failure into `failures` while reporting
// against `paths.length` produced impossible counts like "23/22 pages"
// (23 failures against a 22-page denominator that never counted this
// check in the first place).
let darkSeedFailed = null;

// Light-only theme invariant, dark-seed case (gy-ruxbj, PM scope addition
// 2026-08-12 — "the one that matters"). Kaushik was served a dark site
// because a runtime theme-flip script read a pre-existing localStorage
// value with no way to escape it (gy-31moh removed the toggle, not the
// flip). Pre-seed localStorage BEFORE the app boots and assert the site
// still renders light — this is the one check that would have caught the
// actual incident; a plain page-load check (no seeded storage) never would.
{
  const checkedThemePage = await newCheckedPage();
  const { page: themePage, diagnostics } = checkedThemePage;
  const themeErrors = [];
  await themePage.addInitScript(() => localStorage.setItem("theme", "dark"));
  const navigation = await navigateToLoad(checkedThemePage, base + "/", "/ (dark-seeded)");
  let bg = "not-evaluated";
  let htmlDark = false;
  if (navigation.kind === "loaded") {
    await themePage.waitForTimeout(300);
    bg = await themePage.evaluate(() => getComputedStyle(document.body).backgroundColor);
    htmlDark = await themePage.evaluate(
      () => document.documentElement.getAttribute("data-theme") === "dark",
    );
  }
  themeErrors.push(...diagnostics.firstPartyFailures());
  await themePage.close();

  if (navigation.kind === "loaded") {
    // Light token is #FAFAF7 -> rgb(250, 250, 247). Allow the whole FAFAFx
    // family (a couple of points of anti-aliasing/rounding slack) rather than
    // an exact string match.
    const m = bg.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    const isLight = m && Number(m[1]) > 240 && Number(m[2]) > 240 && Number(m[3]) > 235;
    if (htmlDark || !isLight) {
      themeErrors.push(`rendered dark (bg=${bg}, data-theme dark=${htmlDark})`);
    }
  }

  if (themeErrors.length) {
    darkSeedFailed = "/ (dark-seeded)";
    console.error('FAIL / with localStorage theme="dark" pre-seeded');
    [...new Set(themeErrors)].forEach((error) => console.error(`     ${error}`));
  } else if (navigation.kind === "loaded") {
    console.log(`OK   / stays light even with localStorage theme="dark" pre-seeded (bg=${bg})`);
  }
}

for (const p of paths) {
  const checkedPage = await newCheckedPage();
  const { page, diagnostics } = checkedPage;
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !ignore(m.text())) errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  const navigation = await navigateToLoad(checkedPage, base + p, p);
  if (navigation.kind === "loaded") {
    await page.waitForTimeout(700); // let hydration settle
  }
  errors.push(...diagnostics.firstPartyFailures());
  await page.close();

  if (errors.length) {
    failures.push(p);
    console.error(`FAIL ${p}`);
    [...new Set(errors)].forEach((error) => console.error(`     ${error}`));
  } else if (navigation.kind === "loaded") {
    console.log(`OK   ${p}`);
  }
}
await browser.close();

if (isolatedThirdPartyHosts.size) {
  const hosts = [...isolatedThirdPartyHosts].sort().join(", ");
  console.log(`console-check: isolated non-gating third-party host(s): ${hosts}`);
}

if (darkSeedFailed) console.error(`\nconsole-check: dark-seed invariant FAILED (${darkSeedFailed})`);
if (failures.length) {
  console.error(
    `console-check: ${failures.length}/${paths.length} page(s) have first-party or console error(s) → gate FAIL`,
  );
}
if (couldNotEvaluate.length) {
  console.error(
    `console-check: COULD-NOT-EVALUATE: ${couldNotEvaluate.length} browser assertion(s) did not reach the load boundary; product verdict incomplete`,
  );
}
if (darkSeedFailed || failures.length) process.exit(1);
if (couldNotEvaluate.length) {
  process.exit(2);
}
console.log(`\nconsole-check: all ${paths.length} pages clean, dark-seed invariant holds`);
