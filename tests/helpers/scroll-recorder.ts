import type { Locator, Page } from '@playwright/test';

/**
 * gy-14rfs — WHO MOVED THE PAGE, recorded in the page itself.
 *
 * The "must not move" assertions in inline-waitlist.spec.ts flake in CI only
 * (24 of 36 deploy runs on 2026-09-18 carried a first-attempt failure; the CTA
 * moved 99-458px; 0 of 205 local runs reproduce it). A flaky test uploads no
 * report and the trace is recorded on the RETRY, so the failing attempt leaves
 * no evidence of its own. This recorder puts the evidence INTO the assertion
 * message, so the next CI flake names its cause in the log instead of being
 * retried away.
 *
 * It records, with a ms offset from install:
 *   - every window scroll event (y + the focused element at that moment)
 *   - every HTMLElement.focus() and Element.scrollIntoView() call, with options
 *     and the calling stack frames — a PRODUCT scroller shows up here with a
 *     src/ frame (pm ruling 09-19: that is the founder defect back, report it
 *     the same hour)
 *   - hashchange (a navigation-to-anchor scroll carries no focus/scrollIntoView)
 *   - layout-shift entries with their source nodes (content above the CTA
 *     reflowing moves the CTA without any scroll at all)
 * and, via markScrollRecorder(), a labelled line saying whether React had
 * attached to the target element at that instant (a pre-hydration tap on a
 * prerendered <button> is inert — a different failure from a scroll).
 *
 * It OBSERVES ONLY: the wrapped focus/scrollIntoView call straight through with
 * the caller's own arguments, so installing it cannot change what it measures.
 */
export async function installScrollRecorder(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __scrollLog: string[]; __scrollRecorder?: boolean };
    w.__scrollLog = [];
    if (w.__scrollRecorder) return;
    w.__scrollRecorder = true;
    const t0 = performance.now();
    const who = (el: Element | null) =>
      el ? `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.getAttribute('name') ? `[name=${el.getAttribute('name')}]` : ''}${el.getAttribute('data-cta-location') ? `[cta=${el.getAttribute('data-cta-location')}]` : ''}` : 'null';
    const log = (s: string) => w.__scrollLog.push(`+${Math.round(performance.now() - t0)}ms ${s}`);
    const caller = () => (new Error().stack ?? '').split('\n').slice(2, 5).map((l) => l.trim()).join(' | ');
    window.addEventListener('scroll', () => log(`scroll y=${window.scrollY} active=${who(document.activeElement)}`));
    window.addEventListener('hashchange', () => log(`hashchange -> ${location.hash}`));
    const focus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function (this: HTMLElement, opts?: FocusOptions) {
      log(`focus(${JSON.stringify(opts ?? null)}) on ${who(this)} from ${caller()}`);
      return focus.call(this, opts);
    };
    const siv = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (this: Element, arg?: boolean | ScrollIntoViewOptions) {
      log(`scrollIntoView(${JSON.stringify(arg ?? null)}) on ${who(this)} from ${caller()}`);
      return siv.call(this, arg as ScrollIntoViewOptions);
    };
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as Array<{ value: number; sources?: Array<{ node?: Node | null; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }> }>) {
          const src = (e.sources ?? [])
            .map((s) => `${s.node instanceof Element ? who(s.node) : s.node?.nodeName ?? '?'} y${Math.round(s.previousRect.y)}->${Math.round(s.currentRect.y)} h${Math.round(s.previousRect.height)}->${Math.round(s.currentRect.height)}`)
            .join('; ');
          log(`layout-shift ${e.value.toFixed(4)} ${src || '(no sources)'}`);
        }
      }).observe({ type: 'layout-shift' });
    } catch {
      log('(layout-shift observer unavailable)');
    }
  });
}

/** A labelled line in the log, with the target's hydration state and geometry. */
export async function markScrollRecorder(target: Locator, label: string): Promise<void> {
  await target.evaluate((el, label) => {
    const w = window as unknown as { __scrollLog: string[] };
    const hydrated = Object.keys(el).some((k) => k.startsWith('__reactFiber') || k.startsWith('__reactProps'));
    const r = el.getBoundingClientRect();
    w.__scrollLog?.push(`--- ${label}: target y=${Math.round(r.y)} scrollY=${window.scrollY} docH=${document.documentElement.scrollHeight} hydrated=${hydrated} readyState=${document.readyState}`);
  }, label);
}

/** The log as an assertion-message suffix. */
export async function readScrollLog(page: Page): Promise<string> {
  const log = await page.evaluate(() => (window as unknown as { __scrollLog?: string[] }).__scrollLog?.join('\n') ?? '');
  return `\n--- scroll/focus/layout log (gy-14rfs) ---\n${log || '(no scroll, focus, scrollIntoView or layout shift recorded)'}`;
}
