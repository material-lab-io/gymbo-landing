/**
 * gy-31zk5 — the capture designer asked for: SUBMIT WITH NO CONTACT FILLED,
 * showing the new hint and the existing failure alert at the same time.
 *
 * designer, 2026-09-18: the two are now near-duplicates about 60px apart, and
 * nothing covered this state because until the hint existed there was only one
 * sentence to see. The ruling is that the ALERT changes, not the hint — the
 * hint is the aria-describedby anchor and must stay stable — and that string is
 * content's follow-up, which does not block this bead.
 *
 * NARROWEST AVAILABLE, AND THE ARITHMETIC CORRECTED (2026-09-18). On main only
 * hero and gallery reveal, so the 245px pricing cluster does not exist until
 * gy-w77x3 lands and the 245 capture is owed then. This captures at a 320px
 * VIEWPORT as the nearest available stand-in.
 *
 * 🔴 DO NOT READ THE 320 FRAME AS COVERING THE WORST CASE. designer flagged the
 * substitute as WIDER than what it stands in for; re-measuring shows the
 * comparison had mixed two units, and the honest numbers are closer than either
 * reading suggested:
 *     320 viewport: email field OUTER 280.0px, INNER 240.0px (padding 20/20)
 *     pricing cluster (gy-w77x3): INNER 245px
 * Like for like, inner against inner, 320 is 5px tighter — not 34.6px wider, and
 * not meaningfully "harder". Five pixels is not coverage of a different cluster
 * in a different container, so the claim is dropped rather than restated.
 */
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = 'evidence/gy-31zk5';
mkdirSync(OUT, { recursive: true });
const PORT = process.env.PW_PORT || '4205';

const b = await chromium.launch();
for (const [tag, width] of [['375', 375], ['320-tightest', 320]]) {
  const ctx = await b.newContext({ ...devices['Pixel 5'], viewport: { width, height: 812 }, baseURL: `http://localhost:${PORT}` });
  const p = await ctx.newPage();
  await p.goto('/');
  await p.waitForLoadState('networkidle');
  await p.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation-duration:0s!important}.reveal-on-scroll{opacity:1!important;transform:none!important}' });

  await p.locator('[data-cta="waitlist"][data-cta-location="hero"]').first().click();
  await p.waitForTimeout(400);
  const panel = p.locator('[role="group"][aria-label="Request access"]').first();

  // Submit with NOTHING filled — the state that puts both sentences on screen.
  await panel.locator('button[type="submit"]').click();
  await p.waitForTimeout(500);

  const measured = await p.evaluate(() => {
    const group = document.querySelector('[role="group"][aria-label="Request access"]');
    const form = group.querySelector('form');
    const email = form.querySelector('input[type="email"]');
    const hint = document.getElementById(email.getAttribute('aria-describedby'));
    const alert = form.querySelector('[role="alert"]');
    const gap = alert ? Math.round(alert.getBoundingClientRect().top - hint.getBoundingClientRect().bottom) : null;
    return {
      hint: hint.textContent.trim(),
      alert: alert ? alert.textContent.trim() : null,
      bothVisible: Boolean(alert) && hint.getBoundingClientRect().height > 0,
      verticalGapPx: gap,
      hintLines: Math.round(hint.getBoundingClientRect().height / parseFloat(getComputedStyle(hint).lineHeight)),
    };
  });

  console.log(tag, JSON.stringify(measured, null, 1));

  await panel.screenshot({ path: `${OUT}/submit-no-contact-${tag}.png`, animations: 'disabled' });
  await ctx.close();
}
await b.close();
