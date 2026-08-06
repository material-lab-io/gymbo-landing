const { chromium } = require('playwright');
(async () => {
  const url = process.argv[2];
  const out = process.argv[3];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  console.log('STATUS', resp.status(), url);
  await page.screenshot({ path: out, fullPage: true });
  const text = await page.innerText('body');
  console.log('---TEXT_START---');
  console.log(text.slice(0, 6000));
  console.log('---TEXT_END---');
  await browser.close();
})();
