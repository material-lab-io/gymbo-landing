import { test, expect } from '@playwright/test';

/**
 * gy-becxi — the inline waitlist capture, verified as BEHAVIOUR.
 *
 * Damini, 2026-09-07, arriving from Instagram: "I tap on the Join Waitlist
 * button. That scrolls to the bottom of the page to the name and email fields.
 * This journey is a bit annoying."
 *
 * 🔴 THE LOAD-BEARING ASSERTION IN THIS FILE IS THAT scrollY DOES NOT CHANGE.
 * Everything else here — a form appears, a field is focused — is ALSO true of
 * the old behaviour once the page has finished scrolling to the footer. A test
 * that only asserted "a waitlist form is visible after the tap" would have
 * passed against the exact defect this bead exists to remove. The viewport
 * staying put is the only assertion that can tell the two apart.
 */

const WAITLIST_CTA = (loc: string) => `[data-cta="waitlist"][data-cta-location="${loc}"]`;

for (const [page_, loc, label] of [
  ['/', 'hero', 'the App hero — the founder-reported journey'],
  ['/compare/gymbo-vs-wellnessz/', 'compare', 'the compare page hero'],
] as const) {
  test(`${label}: tapping the waitlist CTA reveals the capture WITHOUT scrolling`, async ({ page }) => {
    await page.goto(page_);
    const cta = page.locator(WAITLIST_CTA(loc));
    await expect(cta).toHaveCount(1);

    // The cluster must be the one wired for reveal. Asserted from the SERVED
    // markup rather than inferred from behaviour, so a cluster that silently
    // fell back to scrolling names itself here instead of failing obscurely
    // three assertions later.
    await expect(cta).toHaveAttribute('data-cta-behaviour', 'reveal');

    await cta.scrollIntoViewIfNeeded();

    // 🔴 SETTLE BEFORE MEASURING, AND SETTLE ON THE CTA ITSELF. Two pre-existing
    // page behaviours land inside a naive measurement window and are NOT this
    // bead: lazy images above the CTA reflow and scroll anchoring compensates
    // (a first draft of this test read 398px of movement the click did not
    // cause), and on /compare the cluster sits in <Reveal>, whose
    // .reveal-on-scroll entry animation is a 0.6s translateY(20px) -> none — it
    // was still running and reported 19.8px, which is that animation to within
    // rounding and not a jump.
    // Both are removed by waiting for the CTA's own box AND scrollY to stop
    // moving. The alternative — widening the tolerance until the noise fits —
    // would have widened it past a 20px real jump too, and a control that
    // cannot fail is not a control.
    await page.waitForLoadState('networkidle');
    await expect.poll(async () => {
      const a = (await cta.boundingBox())!.y;
      const sa = await page.evaluate(() => window.scrollY);
      await page.waitForTimeout(200);
      const b = (await cta.boundingBox())!.y;
      const sb = await page.evaluate(() => window.scrollY);
      return Math.abs(a - b) < 0.5 && sa === sb;
    }, { timeout: 10_000 }).toBe(true);

    // 🔴 THE BEAD, MEASURED AS THE VISITOR EXPERIENCES IT. The property Damini
    // reported is not "scrollY is constant" — it is "the thing I was looking at
    // did not move". Anchoring the assertion to the CTA's own position in the
    // VIEWPORT states exactly that, and is immune to a scroll-anchoring
    // adjustment that moves scrollY and the content together (which is not a
    // jump, and which a raw scrollY assertion cannot tell apart from one).
    const beforeY = (await cta.boundingBox())!.y;
    const beforeScroll = await page.evaluate(() => window.scrollY);

    await cta.click();

    // Two settling beats: long enough that a smooth-scroll would have started
    // and a focus()-induced jump would have landed.
    await page.waitForTimeout(400);
    const afterY = (await cta.boundingBox())!.y;
    const afterScroll = await page.evaluate(() => window.scrollY);
    expect(Math.abs(afterY - beforeY), 'the CTA the visitor tapped must not move in the viewport').toBeLessThanOrEqual(2);
    expect(Math.abs(afterScroll - beforeScroll), 'the page must not scroll when the capture opens').toBeLessThanOrEqual(2);

    // The capture is revealed, and it is revealed INSIDE this cluster — not the
    // footer form becoming visible because the page moved.
    const panel = page.locator('[role="group"][aria-labelledby]').filter({ has: page.locator('input[type="email"]') });
    await expect(panel).toBeVisible();

    // designer item 2: focus the first field, because revealing a form the
    // visitor must then tap into spends the click we set out to save.
    const focused = await page.evaluate(() => {
      const el = document.activeElement as HTMLInputElement | null;
      return el ? { tag: el.tagName, name: el.getAttribute('name') } : null;
    });
    expect(focused, 'reveal must leave focus in the capture, not on the button').toMatchObject({ tag: 'INPUT' });

    // AC2, stated as a measurement rather than a claim: ONE tap from the CTA to
    // a focused, typable field. The old path was tap -> scroll -> tap a field.
    await page.keyboard.type('gy-becxi control');
    const typed = await page.evaluate(() => (document.activeElement as HTMLInputElement)?.value);
    expect(typed, 'the focused field must accept typing with no further tap').toBe('gy-becxi control');
  });
}

/**
 * designer item 3 — the footer form STAYS. This add a capture point; it does not
 * relocate one. People who arrive by scrolling must still find a form there, and
 * #cta is the target of every existing deep link and of the prod smoke suite.
 */
test('the footer capture still exists and is untouched by the reveal (item 3)', async ({ page }) => {
  await page.goto('/');
  const footer = page.locator('#cta');
  await footer.scrollIntoViewIfNeeded();
  await expect(footer).toBeVisible();
  await expect(footer.locator('input[type="email"]')).toBeVisible();
});

/**
 * NEGATIVE CONTROL, and it is the one that keeps the fallback honest.
 *
 * A waitlist CTA OUTSIDE any cluster must still scroll — that fallback is what
 * makes this change additive. The mobile sticky bar is such a CTA (it is a fixed
 * viewport-bottom bar, so an inline panel beneath it would render off-screen;
 * filed as a follow-up rather than absorbed here, per the bead's scope rule).
 * If this test ever fails because the sticky bar became "reveal", that is a real
 * signal: it means someone wrapped it without solving the off-screen problem.
 */
test('an unwrapped waitlist CTA still scrolls, so the change is additive (negative control)', async ({ page }) => {
  await page.goto('/');
  const sticky = page.locator(WAITLIST_CTA('footer'));
  await expect(sticky).toHaveCount(1);
  await expect(sticky).toHaveAttribute('data-cta-behaviour', 'scroll');
});

/**
 * item 4 — ONE submitted form, not two. Both captures must post through the same
 * component to the same endpoint. Two forms that can diverge is how one of them
 * silently stops working; gy-if6mq's confirmation mail and team alert hang off
 * this single endpoint (AC6), so a second submit path would send a lead into a
 * hole with no mail and no alert.
 */
test('the revealed capture posts to the same endpoint as the footer one (item 4, AC6)', async ({ page }) => {
  await page.goto('/');
  const posts: string[] = [];
  await page.route('**/api/waitlist', async (route) => {
    posts.push(route.request().url());
    await route.fulfill({ status: 200, body: '{}' });
  });

  await page.locator(WAITLIST_CTA('hero')).click();
  // 🔴 ADDRESSED BY ROLE, NOT BY "the group that contains an email input". On
  // success WaitlistForm REPLACES the fields with the confirmation line, so a
  // locator filtered on the email input stops matching the moment the thing it
  // is there to check happens — it would report "not found" for a submit that
  // worked perfectly.
  const panel = page.locator('[role="group"][aria-labelledby]').first();
  await panel.locator('input[type="email"]').fill('gy-becxi-control@example.invalid');
  await panel.locator('button[type="submit"]').click();

  await expect.poll(() => posts.length).toBe(1);
  expect(new URL(posts[0]).pathname).toBe('/api/waitlist');
  await expect(panel.getByText(/you're on the list/i)).toBeVisible();
});

/**
 * 🔴 THE preventScroll CONTROL, AND WHY IT NEEDS ITS OWN SETUP.
 *
 * Removing `preventScroll` from the reveal's focus() call is the subtlest way to
 * break this bead: the capture still opens, the field is still focused, and the
 * page silently jumps again — the original defect, wearing the fix's clothes.
 * Mutation-testing the change showed the general tests above catch that removal
 * in only ONE of four browser/page combinations, because a field that happens to
 * be inside the viewport is not scrolled to even by default focus. The guard is
 * only exercised when the revealed field falls BELOW the fold.
 *
 * So this test creates that condition deliberately, and it is also the realistic
 * one: a visitor on a phone with the CTA partway down the screen, where the
 * panel necessarily opens past the bottom edge. Verified to fail when
 * preventScroll is removed, on both projects.
 */
test('the capture opens below the fold without the page chasing it (preventScroll control)', async ({ page }) => {
  await page.goto('/');
  const cta = page.locator(WAITLIST_CTA('hero'));
  const viewport0 = page.viewportSize()!;
  await page.waitForLoadState('networkidle');

  // Put the CTA hard against the BOTTOM edge, so the panel that opens under it
  // is entirely below the fold and default focus behaviour would HAVE to scroll
  // to reach the field.
  //
  // 🔴 TWO OBVIOUS WAYS TO DO THIS DO NOT WORK, and both produced a control that
  // could not fail:
  //   scrollIntoView({ block: 'end' }) — a no-op here. The hero CTA is near the
  //     TOP of the document, so there is nothing to scroll; scrollY stayed 0,
  //     the revealed field landed in view at y=606 of an 812px viewport, and
  //     plain focus() had nothing to scroll to.
  //   scrollBy(bottom - innerHeight) — negative at scrollY 0, so also a no-op.
  // The CTA cannot be moved DOWN to the fold; the fold has to be brought UP to
  // it. Shrinking the viewport to just below the CTA does that deterministically
  // on any page, at any scroll position.
  const ctaBottom = (await cta.boundingBox())!.y + (await cta.boundingBox())!.height;
  await page.setViewportSize({ width: viewport0.width, height: Math.round(ctaBottom) + 12 });
  await page.waitForTimeout(200);
  await expect.poll(async () => {
    const a = (await cta.boundingBox())!.y;
    await page.waitForTimeout(200);
    return Math.abs(a - (await cta.boundingBox())!.y) < 0.5;
  }, { timeout: 10_000 }).toBe(true);

  const viewport = page.viewportSize()!;
  const boxBefore = (await cta.boundingBox())!;
  // The setup is asserted, not assumed — see above for what happens when it
  // silently does not hold.
  expect(boxBefore.y, 'setup: the CTA must sit against the bottom edge so the panel opens off-screen')
    .toBeGreaterThan(viewport.height - 80);
  const scrollBefore = await page.evaluate(() => window.scrollY);

  await cta.click();
  await page.waitForTimeout(400);

  const boxAfter = (await cta.boundingBox())!;
  const scrollAfter = await page.evaluate(() => window.scrollY);
  expect(Math.abs(scrollAfter - scrollBefore), 'focusing a below-the-fold field must not scroll the page').toBeLessThanOrEqual(2);
  expect(Math.abs(boxAfter.y - boxBefore.y), 'the CTA must stay exactly where the visitor tapped it').toBeLessThanOrEqual(2);
});
