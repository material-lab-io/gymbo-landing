import { test, expect, type Page } from '@playwright/test';
import axe from 'axe-core';
import { ROUTES } from '../src/routes';

/**
 * Web audit suite for the LIVE landing surface (gy-ma11q) — dimensions 1-3.
 * Dimension 4 (performance budget) lives in audit-perf.spec.ts because it MUST
 * run single-worker; see that file's header.
 *
 * PROVENANCE: this is a port of Gymbo-v1's tests/ui/{a11y,touch,perf,scroll}-audit
 * specs. Those specs are proven — they found four genuine defects on their first
 * run — but their TARGET is dead (app.getgymbo.com returns 530). getgymbo.com is
 * the only live web surface we ship and it had NO audit coverage of any kind.
 *
 * WHAT PORTS IS THE FOUR DIMENSIONS, NOT THE ROUTES. The source specs navigate to
 * /clients, /schedule, /settings, /login — routes that do not exist here and would
 * 404 on every one. Repointing routes would be meaningless.
 *
 * Routes come from src/routes.ts, the same SSOT that vite, entry-server and
 * prerender consume. A new page is audited the day it ships; the gate cannot
 * silently cover fewer routes than the site serves.
 *
 * This runs against the BUILT site via playwright.config's preview webServer —
 * deliberately NOT against https://getgymbo.com. A merge gate that reads a live
 * URL couples our CI to that site's uptime and recreates the gy-5o9dz shape
 * (a check that passes because it could not look).
 */

const SEVERE = new Set(['critical', 'serious']);

// Thresholds carried over unchanged from the source suite so this is a faithful
// port rather than a re-specification. Touch: WCAG 2.2 AA is 24x24 (AAA 44x44).
const TOUCH_AA_MIN = 24;

const INTERACTIVE =
  'a, button, input, select, textarea, [role="button"], [role="link"], [tabindex="0"]';

interface AxeViolation {
  id: string;
  impact: string;
  help: string;
  nodes: { target: string[] }[];
}

async function runAxe(page: Page): Promise<AxeViolation[]> {
  // axe.source is the packaged bundle as a string. addScriptTag({path}) needs a
  // CommonJS require.resolve, which does not exist in this ESM spec — that
  // mistake made every a11y check throw, and the positive control is what
  // caught it. Injecting the source directly has no module-system dependency.
  await page.evaluate(axe.source);
  const res = await page.evaluate(() =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    })
  );
  return (res as { violations: AxeViolation[] }).violations;
}

function describeViolations(vs: AxeViolation[]): string {
  return vs
    .map((v) => `[${v.impact}] ${v.id}: ${v.help}\n      ${v.nodes.map((n) => n.target.join(' > ')).slice(0, 4).join('\n      ')}`)
    .join('\n    ');
}

// ── DIMENSION 0: THE POSITIVE CONTROL ────────────────────────────────────────
// Runs FIRST and is not optional. Every clean result below is worthless unless
// the instrument is shown, in the same run, to be capable of returning dirty.
// A zero from a broken scanner is indistinguishable from a zero from a clean
// page, and this rig has filed that bug enough times to stop shipping it.
test.describe('Audit :: positive control', () => {
  test('axe detects known violations on a deliberately broken page', async ({ page }) => {
    await page.setContent(
      `<html><body>
         <button></button>
         <img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">
         <div style="color:#bbb;background:#ccc">invisible text</div>
       </body></html>`,
      { waitUntil: 'domcontentloaded' }
    );

    const violations = await runAxe(page);
    const ids = new Set(violations.map((v) => v.id));

    // Named rules, not a bare count: a count can be satisfied by incidental
    // noise, which would let a half-broken scanner pass as healthy.
    for (const rule of ['button-name', 'image-alt', 'html-has-lang']) {
      expect(ids, `positive control did not fire ${rule} — the scanner is broken, so every clean route in this run is meaningless`).toContain(rule);
    }
  });
});

for (const route of ROUTES) {
  const url = route.url;

  test.describe(`Audit :: ${url}`, () => {
    // ── DIMENSION 1: ACCESSIBILITY (axe, WCAG 2.0/2.1 A+AA) ────────────────
    test('no critical/serious a11y violations', async ({ page }) => {
      await page.goto(url, { waitUntil: 'networkidle' });
      const severe = (await runAxe(page)).filter((v) => SEVERE.has(v.impact));
      expect(
        severe,
        `${severe.length} critical/serious violation(s) on ${url}:\n    ${describeViolations(severe)}`
      ).toHaveLength(0);
    });

    // ── DIMENSION 2: TOUCH TARGETS (WCAG 2.2 AA, 24x24) ────────────────────
    // Only VISIBLE targets are measured. A zero-size element that is display:none
    // or inside a closed menu is not a violation, and counting it would produce
    // a wall of false positives that gets the gate muted — which is how a real
    // finding ends up suppressed alongside the noise.
    test('no interactive target below 24x24 (WCAG 2.2 target-size, with normative exceptions)', async ({ page }) => {
      await page.goto(url, { waitUntil: 'networkidle' });
      const violations = await page.evaluate(
        ({ selector, min }) => {
          const rects: { el: Element; r: DOMRect }[] = [];
          for (const el of Array.from(document.querySelectorAll(selector))) {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
            if (r.width === 0 || r.height === 0) continue;
            rects.push({ el, r });
          }

          const out: { tag: string; text: string; w: number; h: number }[] = [];
          for (const { el, r } of rects) {
            if (r.width >= min && r.height >= min) continue;

            // EXCEPTION 1 — "Inline": the target sits inside a sentence or block
            // of text. A link in body copy is normatively exempt, and treating it
            // as a defect is how this dimension produces 15 findings per page and
            // gets itself muted. Approximated as: a text-flow parent that carries
            // meaningful text of its own beyond this target.
            const parent = el.parentElement;
            if (parent) {
              const parentText = (parent.textContent || '').trim();
              const selfText = (el.textContent || '').trim();
              const surrounding = parentText.replace(selfText, '').trim();
              const flow = /^(P|LI|TD|TH|SPAN|EM|STRONG|DD|DT|BLOCKQUOTE|FIGCAPTION|SMALL|LABEL)$/.test(parent.tagName);
              if (flow && surrounding.length >= 20) continue;
            }

            // EXCEPTION 2 — "Spacing": exempt when a 24px-diameter circle centred
            // on the target does not intersect the circle of any other target.
            // Undersized but well-separated controls are conformant.
            const cx = r.x + r.width / 2;
            const cy = r.y + r.height / 2;
            let crowded = false;
            for (const other of rects) {
              if (other.el === el) continue;
              const ox = other.r.x + other.r.width / 2;
              const oy = other.r.y + other.r.height / 2;
              if (Math.hypot(cx - ox, cy - oy) < min) { crowded = true; break; }
            }
            if (!crowded) continue;

            out.push({
              tag: el.tagName.toLowerCase(),
              text: (el.textContent || '').trim().slice(0, 40),
              w: Math.round(r.width),
              h: Math.round(r.height),
            });
          }
          return out;
        },
        { selector: INTERACTIVE, min: TOUCH_AA_MIN }
      );

      expect(
        violations,
        `${violations.length} target(s) under ${TOUCH_AA_MIN}px on ${url}, after applying the WCAG 2.2 inline and spacing exceptions:\n    ` +
          violations.map((v) => `<${v.tag}> ${v.w}x${v.h} "${v.text}"`).join('\n    ')
      ).toHaveLength(0);
    });

    // ── DIMENSION 3: SCROLL INTEGRITY ──────────────────────────────────────
    // The source suite's scroll checks are app-shell shapes (BottomNav,
    // AppShell double-scroll) that do not exist on a static marketing site.
    // What ports is the DIMENSION: the page must not be scroll-locked, and any
    // horizontally scrollable region must be reachable without a mouse. The
    // second assertion is the exact defect this bead was filed on — stated
    // directly here rather than only via axe, so it cannot regress silently if
    // the axe ruleset changes.
    test('page is not scroll-locked and scrollable regions are keyboard-reachable', async ({ page }) => {
      await page.goto(url, { waitUntil: 'networkidle' });

      const result = await page.evaluate(() => {
        const bodyOverflow = getComputedStyle(document.body).overflow;
        const htmlOverflow = getComputedStyle(document.documentElement).overflow;

        const unreachable: string[] = [];
        for (const el of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
          if (el.scrollWidth <= el.clientWidth + 1) continue;
          const cs = getComputedStyle(el);
          if (!['auto', 'scroll'].includes(cs.overflowX)) continue;
          // Reachable if the region itself is focusable, or it contains a
          // focusable descendant a keyboard user can tab into.
          const selfFocusable = el.tabIndex >= 0;
          const hasFocusableChild = !!el.querySelector(
            'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (!selfFocusable && !hasFocusableChild) {
            unreachable.push(
              el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(/\s+/).join('.') : '')
            );
          }
        }
        return { bodyOverflow, htmlOverflow, unreachable };
      });

      expect(result.bodyOverflow, `body is scroll-locked on ${url}`).not.toBe('hidden');
      expect(result.htmlOverflow, `html is scroll-locked on ${url}`).not.toBe('hidden');
      expect(
        result.unreachable,
        `${result.unreachable.length} horizontally scrollable region(s) unreachable by keyboard on ${url}:\n    ` +
          result.unreachable.join('\n    ')
      ).toHaveLength(0);
    });

  });
}
