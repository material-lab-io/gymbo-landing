const { chromium } = require('playwright');
(async () => {
  const url = process.argv[2];
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const reqs = [];
  page.on('request', r => reqs.push(r.url()));
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  const scripts = await page.$$eval('script[src]', els => els.map(e => e.src));
  console.log('SCRIPT_SRCS:');
  scripts.forEach(s => console.log(s));
  console.log('NETWORK_REQS (analytics-related):');
  reqs.filter(u => /posthog|umami|analytics|track/i.test(u)).forEach(u => console.log(u));
  await browser.close();
})();
