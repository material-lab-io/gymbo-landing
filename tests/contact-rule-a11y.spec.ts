import { test, expect } from '@playwright/test';

/**
 * gy-31zk5 — the waitlist contact rule, as an ACCESSIBLE DESCRIPTION.
 *
 * WHAT WAS WRONG, and the width story was only its visible half. The rule
 * ("either a phone number or an email is enough") lived in the email field's
 * PLACEHOLDER, while the input carries aria-label="Your email". An aria-label
 * WINS over a placeholder when the accessible NAME is computed, so — verified
 * from Chromium's own accessibility tree — the computed name was "Your email",
 * the placeholder appeared as a SUPERSEDED name source, and the description was
 * null. A screen-reader user was never told the field was optional, at EVERY
 * width, including the two clusters measured at 295px and recorded as passing.
 *
 * 🔴 THESE TESTS MEASURE THE REFERENCE, NOT THE ANNOUNCED TEXT (designer). Every
 * form renders the SAME hint string, so a form pointing at ANOTHER form's node
 * still announces the right words — there is no user-visible symptom to catch
 * today, and an assertion on the text passes on a fully broken build. The defect
 * is that the reference is invalid, and it bites the first time a hint is made
 * cluster-specific. So the property asserted throughout is: each input resolves
 * to the hint node INSIDE ITS OWN FORM.
 */

const CLUSTERS = ['hero', 'nav', 'gallery', 'pricing', 'footer'] as const;

/**
 * Click a cluster's CTA and report whether it actually REVEALED a form.
 *
 * 🔴 "CLICKED" IS NOT "REVEALED", and conflating them made this file's own log
 * line overclaim on its first run: it printed all five clusters as "exercised"
 * on a build where only two reveal. The other three scroll to the footer, so
 * they contribute no second form and the loop merely re-checked the footer one.
 * A count of clicks reads identically to a count of coverage — the same
 * observable-that-cannot-distinguish-two-worlds this bead is full of. So the
 * form count is measured across the click and reported separately.
 */
async function openCluster(page: import('@playwright/test').Page, loc: string) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  if (loc === 'footer') {
    await page.evaluate(() => window.scrollTo(0, Math.round(window.innerHeight * 1.2)));
    await page.waitForTimeout(600);
  }
  const cta = page.locator(`[data-cta="waitlist"][data-cta-location="${loc}"]`).first();
  if (!(await cta.isVisible().catch(() => false))) return { clicked: false, revealed: false };
  await cta.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => document.querySelectorAll('form').length);
  await cta.click();
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => document.querySelectorAll('form').length);
  return { clicked: true, revealed: after > before };
}

/**
 * AC3b/AC3c/AC4 — THE LOAD-BEARING ONE. Per form, BOTH forms, every cluster.
 *
 * 🔴 DIRECTION-AGNOSTIC ON PURPOSE. A duplicate id breaks in OPPOSITE directions
 * depending on the cluster, because an IDREF resolves to the first match in
 * DOCUMENT order: for nav/hero/gallery/pricing the revealed panel is earlier, so
 * the FOOTER form ends up described by the panel's node; for the sticky bar the
 * footer is earlier, so the REVEALED panel loses. Measured, not assumed. A test
 * that inspected only the revealed panel would PASS ON A BROKEN BUILD for four
 * of five clusters, and one that inspected only the footer would pass for the
 * fifth. Checking every form removes the need to be right about the direction.
 *
 * Mutation-verified: replacing useId() with a literal id reports
 * "form1:tel,form1:email" on hero and gallery. (The mutation must actually
 * BUILD to mean anything — the first attempt left an unused import, `tsc`
 * failed, `dist/` stayed stale and the check "passed" against the unmutated
 * build. A mutation that does not compile silently tests the previous build.)
 */
test('every contact input resolves to the hint inside its OWN form', async ({ page }) => {
  const revealed: string[] = [];
  const scrolledOnly: string[] = [];
  for (const loc of CLUSTERS) {
    const r = await openCluster(page, loc);
    if (!r.clicked) continue;
    (r.revealed ? revealed : scrolledOnly).push(loc);

    const report = await page.evaluate(() =>
      [...document.querySelectorAll('form')].map((f, i) => ({
        form: i,
        fields: [...f.querySelectorAll('input')]
          .filter((el) => el.type === 'tel' || el.type === 'email')
          .map((el) => {
            const id = el.getAttribute('aria-describedby');
            const target = id ? document.getElementById(id) : null;
            return {
              type: el.type,
              described: Boolean(id),
              resolves: Boolean(target),
              inOwnForm: target ? f.contains(target) : false,
              text: target ? (target.textContent || '').trim() : '',
            };
          }),
      })),
    );

    // Positive control: a page with no forms would satisfy every assertion below
    // vacuously. The footer form is always rendered, so one is the floor.
    expect(report.length, `${loc}: positive control — at least one form must be present`).toBeGreaterThan(0);

    for (const f of report) {
      expect(
        f.fields.length,
        `${loc}: form ${f.form} has no contact inputs — the pair this hint describes is gone`,
      ).toBe(2);
      for (const field of f.fields) {
        expect(field.described, `${loc}: form ${f.form} ${field.type} carries no aria-describedby`).toBe(true);
        expect(field.resolves, `${loc}: form ${f.form} ${field.type} points at an id that does not exist`).toBe(true);
        expect(
          field.inOwnForm,
          `${loc}: form ${f.form} ${field.type} is described by a node in ANOTHER form — a duplicate id, resolving to the first match in document order`,
        ).toBe(true);
        expect(field.text.length, `${loc}: form ${f.form} ${field.type} hint is empty`).toBeGreaterThan(0);
      }
    }
  }

  // 🔴 REPORTS COVERAGE AS TWO NUMBERS, because they mean different things and a
  // single total hides which. A cluster that only SCROLLED contributed no second
  // form, so it did not exercise the cross-form property at all — it merely
  // re-checked the footer form. Two reveal on main today (hero, gallery);
  // gy-w77x3 takes it to five, at which point this line should say so, and a
  // silent shrink back is the regression those controls exist to catch.
  expect(
    revealed.length,
    `positive control: NO cluster revealed a second form, so the cross-form property was never exercised (clicked but only scrolled: ${scrolledOnly.join(', ') || 'none'})`,
  ).toBeGreaterThan(0);
  console.log(`[gy-31zk5] revealed a form: ${revealed.join(', ') || 'none'} | scrolled only: ${scrolledOnly.join(', ') || 'none'}`);
});

/**
 * AC6 (designer R2) — written as the PROPERTY, not the instance: every
 * text-bearing input names itself from an EXPLICIT attribute, never from a
 * placeholder. A placeholder-derived name is a side effect of a copy string:
 * empty it in a copy pass and the field silently has no name.
 */
test('every text-bearing input names itself from an explicit attribute, not a placeholder', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.locator('#cta').scrollIntoViewIfNeeded();

  const unnamed = await page.evaluate(() =>
    [...document.querySelectorAll('#cta form input')]
      .filter((el) => !(el as HTMLInputElement).getAttribute('aria-label') && !el.getAttribute('aria-labelledby'))
      .map((el) => `${(el as HTMLInputElement).type}: placeholder-only name "${(el as HTMLInputElement).placeholder}"`),
  );
  expect(
    unnamed,
    'an input whose only name is its placeholder loses that name the moment a copy pass empties the string, and nothing goes red',
  ).toEqual([]);
});

/**
 * C1 — the general property, at whatever the narrowest rendered field is.
 *
 * 🔴 THE NEG IS THE LOAD-BEARING HALF (designer): this must NOT be satisfiable
 * by shaving field padding, because shaving padding INCREASES inner width and
 * would turn the guard green on the exact defect it exists to stop. So it is a
 * relationship between two MEASURED widths — the placeholder's rendered width
 * against the field's own inner width — never a fixed threshold.
 */
test('no placeholder is wider than the field that renders it', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.locator('#cta').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  const over = await page.evaluate(() =>
    [...document.querySelectorAll('form input')]
      .map((el) => {
        const i = el as HTMLInputElement;
        if (!i.placeholder) return null;
        const cs = getComputedStyle(i);
        const ctx = document.createElement('canvas').getContext('2d')!;
        ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const inner = i.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const needed = ctx.measureText(i.placeholder).width;
        return needed > inner ? `${i.type}: "${i.placeholder}" needs ${Math.round(needed)}px, field gives ${Math.round(inner)}px` : null;
      })
      .filter(Boolean),
  );
  expect(over, 'a clipped placeholder loses its tail, which is where the qualifying half of a sentence lives').toEqual([]);
});
