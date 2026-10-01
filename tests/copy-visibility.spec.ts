// gy-vawlh: the copy-change-detector and canonical-strings checks assert PRESENCE IN THE
// DOCUMENT for a ruled claim, not VISIBILITY TO A READER (see scripts/copy-visibility-check.mjs
// for the full writeup). This file is the wiring: it runs the rendered-visibility predicate
// against (a) synthetic fixtures proving each hiding technique is actually caught, and (b) the
// real ruled strings against the built site this test run serves, as a gate.
import { test, expect } from '@playwright/test';
import { loadRuled, RULED_FILE } from '../scripts/copy-change-detector.mjs';
import { loadCanonical, canonicalRuled, CANON_DIR } from '../scripts/canonical-strings.mjs';
import { checkRuledVisibility, renderableRuled, skippedRuled } from '../scripts/copy-visibility-check.mjs';

const VISIBLE_TEXT = 'This sentence must reach a reader.';

// AC2: four named negative controls (plus one bonus, effective opacity) proving the predicate
// fails each hiding technique, and does not just re-measure presence under a new name.
test.describe('AC2 negative controls: each hiding technique must FAIL', () => {
  test('display:none on the block', async ({ page }) => {
    await page.setContent(`<body><p style="display:none">${VISIBLE_TEXT}</p></body>`);
    const r = await checkRuledVisibility(page, { equals: VISIBLE_TEXT, route: '/x', surface: 'visible block' });
    expect(r.found, 'the text must still be in the DOM -- display:none does not remove it').toBe(true);
    expect(r.visible).toBe(false);
    expect(r.reason).toBe('zero-area-box');
  });

  test('display:none on an ANCESTOR of the block', async ({ page }) => {
    await page.setContent(`<body><div style="display:none"><p>${VISIBLE_TEXT}</p></div></body>`);
    const r = await checkRuledVisibility(page, { equals: VISIBLE_TEXT, route: '/x', surface: 'visible block' });
    expect(r.visible).toBe(false);
    expect(r.reason).toBe('zero-area-box');
  });

  test('visibility:hidden', async ({ page }) => {
    await page.setContent(`<body><p style="visibility:hidden">${VISIBLE_TEXT}</p></body>`);
    const r = await checkRuledVisibility(page, { equals: VISIBLE_TEXT, route: '/x', surface: 'visible block' });
    expect(r.found).toBe(true);
    expect(r.visible).toBe(false);
    expect(r.reason).toBe('not-hit-testable');
  });

  test('clipped to nothing by an overflow:hidden, zero-size ANCESTOR (own box stays non-zero)', async ({ page }) => {
    // The <p> gets an EXPLICIT width/height and top:0;left:0 against a position:relative
    // ancestor, so it is actually contained (and clipped) by the zero-size overflow:hidden
    // box, rather than escaping to the initial containing block with no positioning context
    // in the ancestor chain (which is what an un-positioned, offset-less absolute child did in
    // an earlier draft of this fixture: it painted at its static in-flow position, not inside
    // the clip box at all, so this control was not testing clipping).
    await page.setContent(`<body><div style="position:relative;width:0;height:0;overflow:hidden"><p style="position:absolute;top:0;left:0;width:300px;height:20px;white-space:nowrap">${VISIBLE_TEXT}</p></div></body>`);
    const r = await checkRuledVisibility(page, { equals: VISIBLE_TEXT, route: '/x', surface: 'visible block' });
    expect(r.found).toBe(true);
    expect(r.visible).toBe(false);
    // The paragraph's OWN rect is non-zero (nowrap keeps its intrinsic width/height); the only
    // thing that can catch this is the hit-test, which is the point of this control.
    expect(r.reason).toBe('not-hit-testable');
  });

  test('moved off-screen: position:absolute;left:-9999px, unreachable by scroll', async ({ page }) => {
    await page.setContent(`<body><p style="position:absolute;left:-9999px;top:0">${VISIBLE_TEXT}</p></body>`);
    const r = await checkRuledVisibility(page, { equals: VISIBLE_TEXT, route: '/x', surface: 'visible block' });
    expect(r.found).toBe(true);
    expect(r.visible).toBe(false);
    expect(r.reason).toBe('off-screen-unreachable-by-scroll');
  });

  test('bonus: opacity:0 on an ANCESTOR (own opacity is 1, box is on-screen, hit-testable)', async ({ page }) => {
    await page.setContent(`<body><div style="opacity:0"><p>${VISIBLE_TEXT}</p></div></body>`);
    const r = await checkRuledVisibility(page, { equals: VISIBLE_TEXT, route: '/x', surface: 'visible block' });
    expect(r.found).toBe(true);
    expect(r.visible).toBe(false);
    expect(r.reason).toBe('effective-opacity-zero');
  });
});

// AC3: the positive control. A checker that fails everything is not a checker.
test.describe('AC3 positive control', () => {
  test('an ordinary, unhidden block PASSES', async ({ page }) => {
    await page.setContent(`<body><main><p>${VISIBLE_TEXT}</p></main></body>`);
    const r = await checkRuledVisibility(page, { equals: VISIBLE_TEXT, route: '/x', surface: 'visible block' });
    expect(r.found).toBe(true);
    expect(r.visible, JSON.stringify(r)).toBe(true);
  });

  test('a long page where the block is below the fold still PASSES (scrollIntoView reaches it)', async ({ page }) => {
    const filler = Array.from({ length: 80 }, () => '<p>filler line that pushes layout down.</p>').join('');
    await page.setContent(`<body>${filler}<p>${VISIBLE_TEXT}</p></body>`);
    const r = await checkRuledVisibility(page, { equals: VISIBLE_TEXT, route: '/x', surface: 'visible block' });
    expect(r.visible, JSON.stringify(r)).toBe(true);
  });

  test('a FAQ answer collapsed inside <details> (closed by default) is flagged as its own distinct finding, not conflated with a hiding bug', async ({ page }) => {
    await page.setContent(`<body><details><summary>Q</summary><p>${VISIBLE_TEXT}</p></details></body>`);
    const r = await checkRuledVisibility(page, { equals: VISIBLE_TEXT, route: '/x', surface: 'visible block' });
    // A ruled claim living only inside a closed accordion is not visible to a reader who has
    // not interacted with the page, but it is ALSO not a rendering bug the way display:none or
    // an off-screen position are -- one click reaches it. This check reports it under its own
    // name (inside-closed-disclosure) rather than the generic hiding reasons above, so the gate
    // can route it to pm/content as a product question instead of a defect report.
    expect(r.reason).toBe('inside-closed-disclosure');
  });
});

// gy-vawlh landing 2026-10-01: measured on main, this gate found THREE ruled strings that live
// only inside a closed-by-default <details> accordion -- a trial eligibility note (legal/App
// Store weight) and two FAQ answers. This is NOT a hiding bug (one click reaches each of them;
// the original scoping comment on this bead flagged the WellnessZ one as a case to "watch
// for"), but it IS a real, pre-existing gap between "present" and "visible without
// interaction" that nobody has ruled on. Rather than either (a) silently passing them, which
// would launder an unreviewed product question through a gate that is supposed to surface
// exactly this kind of thing, or (b) blocking every future PR on a question this PR did not
// create, each is named here with a dated pointer so pm/content can rule per-string; the
// allowance covers ONLY this exact reason -- any other failure reason on these ids (a real
// hiding regression) still fails the gate.
const PENDING_PM_RULING_ACCORDION_GATED = new Set([
  'canonical.trial.eligibilityNote',
  'canonical.site.home.faq.clientsDownload.answer',
  'wellnessz-session-first',
]);

// AC1 + AC5: the real gate, against the ruled strings this repo actually carries, on the page
// this test run serves (playwright.config.ts's webServer: `npm run preview` over dist/).
test.describe('AC1 gate: every visible-block ruled string must be visible, not merely present', () => {
  const ruled = [
    ...canonicalRuled(loadCanonical(CANON_DIR)),
    ...loadRuled(RULED_FILE),
  ];
  const renderable = renderableRuled(ruled);
  const skipped = skippedRuled(ruled);

  test('AC4: coverage boundary is stated, not silently assumed', () => {
    // Surfaces this rendered check cannot and does not cover (meta/JSON-LD/served text have no
    // layout box by nature) stay on the presence-only checks in copy-change-detector.mjs and
    // canonical-strings.mjs's checkCanonical. Printing the split here means a new ruled entry
    // that nobody wired into either mechanism shows up as neither renderable nor acknowledged.
    for (const r of skipped) {
      expect(['metadata description', 'metadata og:description', 'metadata twitter:description',
        'JSON-LD $.description', 'JSON-LD $.mainEntity[].acceptedAnswer.text', 'served line']
        .includes(r.surface) || !r.route, `ruled id ${r.id} (surface=${r.surface}, route=${r.route}) is neither renderable nor a known non-visual surface -- it is falling through both gates uncovered`).toBe(true);
    }
    expect(renderable.length, 'no visible-block ruled strings found to gate -- check the ruled sources loaded').toBeGreaterThan(0);
  });

  for (const entry of renderable) {
    test(`${entry.id} is VISIBLE on ${entry.route}`, async ({ page }) => {
      await page.goto(entry.route);
      await page.waitForLoadState('networkidle');
      const r = await checkRuledVisibility(page, entry);
      expect(r.found, `ruled string for ${entry.id} not found anywhere in the rendered DOM of ${entry.route} (ref: ${entry.ref})`).toBe(true);
      if (PENDING_PM_RULING_ACCORDION_GATED.has(entry.id)) {
        expect(r.visible || r.reason === 'inside-closed-disclosure',
          `${entry.id} on ${entry.route} was expected to be either visible or accordion-gated (pending pm ruling), but failed a DIFFERENT way (${r.reason}): ${JSON.stringify(r)}`).toBe(true);
        return;
      }
      expect(r.visible, `${entry.id} on ${entry.route} is present but NOT visible (${r.reason}): ${JSON.stringify(r)}`).toBe(true);
    });
  }
});
