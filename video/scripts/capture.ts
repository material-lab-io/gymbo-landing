/**
 * capture.ts — Playwright screenshot capture for HeroDemo video
 *
 * Produces 3 app screenshots at 390×844 (matching video dimensions):
 *   public/screens/schedule.png   — Schedule screen
 *   public/screens/punchcard.png  — Client punch card
 *   public/screens/balance.png    — Client list with balances
 *
 * Usage:
 *   npm run capture
 *
 * Env vars (all optional):
 *   GYMBO_URL    - base URL of the app  (default: http://localhost:3000)
 *   GYMBO_PHONE  - phone number         (default: +919999999999)
 *   GYMBO_OTP    - OTP to enter         (default: 123456)
 */

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const GYMBO_URL  = process.env.GYMBO_URL   ?? 'http://localhost:3000';
const PHONE_RAW  = process.env.GYMBO_PHONE ?? '+919999999999';
const OTP        = process.env.GYMBO_OTP   ?? '123456';
const OUT_DIR    = path.join(__dirname, '../public/screens');

// Strip country prefix — the app's PhoneInput only accepts the 10-digit national number
const PHONE_DIGITS = PHONE_RAW.replace(/^\+?91/, '').replace(/\D/g, '');

fs.mkdirSync(OUT_DIR, { recursive: true });

/** Wait for .animate-pulse elements to disappear (loading skeletons gone) */
async function waitForLoaded(page: import('playwright').Page, timeout = 8000) {
  try {
    await page.waitForFunction(
      () => document.querySelectorAll('.animate-pulse').length === 0,
      { timeout }
    );
  } catch {
    // If timeout, just continue — page may not have loading states
  }
  await page.waitForTimeout(400); // let final render settle
}

async function main() {
  console.log(`Capturing screenshots from ${GYMBO_URL}`);
  console.log(`  phone: +91${PHONE_DIGITS}  otp: ${OTP}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // ── Login — phone step ─────────────────────────────────────────────────────
  console.log('\n→ Login: phone step');
  await page.goto(`${GYMBO_URL}/login`, { waitUntil: 'networkidle' });

  // The real input is opacity:0 but fully interactable
  const phoneInput = page.locator('input[aria-label="Mobile number"]');
  await phoneInput.waitFor({ state: 'attached', timeout: 10_000 });
  await phoneInput.fill(PHONE_DIGITS);

  // AuthButton — rendered below the fold, enabled once phone.length >= 7
  const continueBtn = page.getByRole('button', { name: 'continue' });
  await continueBtn.waitFor({ state: 'visible', timeout: 5_000 });
  await continueBtn.click();

  // ── Login — OTP step ───────────────────────────────────────────────────────
  console.log('→ Login: OTP step');
  const otpInput = page.locator('input[aria-label="One-time passcode"]');
  await otpInput.waitFor({ state: 'attached', timeout: 10_000 });
  await otpInput.fill(OTP);
  // OTPInput calls onComplete automatically after 6 digits — no submit button needed

  // Wait for redirect away from /login
  await page.waitForURL(
    url => !url.pathname.startsWith('/login'),
    { timeout: 15_000 }
  );
  console.log(`✓ Logged in  (${page.url()})`);

  // ── Screenshot 1: Schedule ─────────────────────────────────────────────────
  console.log('\n→ Screenshot 1: schedule');
  await page.goto(`${GYMBO_URL}/schedule`, { waitUntil: 'domcontentloaded' });
  await waitForLoaded(page, 8_000);
  await page.screenshot({ path: path.join(OUT_DIR, 'schedule.png') });
  console.log('✓ schedule.png');

  // ── Screenshot 2: Punch card ───────────────────────────────────────────────
  console.log('\n→ Screenshot 2: punchcard');
  await page.goto(`${GYMBO_URL}/clients`, { waitUntil: 'domcontentloaded' });
  await waitForLoaded(page, 8_000);

  // Click first client link — exclude /clients/new and /clients/export
  const clientLinks = page.locator('a[href^="/clients/"]').filter({
    hasNot: page.locator('[href="/clients/new"], [href="/clients/export"]'),
  });
  const count = await clientLinks.count();

  if (count > 0) {
    const href = await clientLinks.first().getAttribute('href');
    console.log(`  clicking client: ${href}`);
    await clientLinks.first().click();
    await page.waitForURL(url => /\/clients\/[^/]+$/.test(url.pathname), { timeout: 8_000 });
    await waitForLoaded(page, 8_000);
    await page.screenshot({ path: path.join(OUT_DIR, 'punchcard.png') });
    console.log('✓ punchcard.png');
  } else {
    console.warn('  ⚠ No client rows found — saving clients page as punchcard fallback');
    await page.screenshot({ path: path.join(OUT_DIR, 'punchcard.png') });
    console.log('✓ punchcard.png (fallback)');
  }

  // ── Screenshot 3: Balance (clients list) ───────────────────────────────────
  console.log('\n→ Screenshot 3: balance (clients list)');
  await page.goto(`${GYMBO_URL}/clients`, { waitUntil: 'domcontentloaded' });
  await waitForLoaded(page, 8_000);
  await page.screenshot({ path: path.join(OUT_DIR, 'balance.png') });
  console.log('✓ balance.png');

  await browser.close();

  console.log(`\n── Capture complete ─────────────────────────────────────`);
  console.log(`  ${OUT_DIR}/schedule.png`);
  console.log(`  ${OUT_DIR}/punchcard.png`);
  console.log(`  ${OUT_DIR}/balance.png`);
  console.log(`\nNext: npm run render`);
}

main().catch((err) => {
  console.error('\nCapture failed:', err.message ?? err);
  process.exit(1);
});
