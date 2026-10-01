// gy-vawlh: the copy-change-detector and canonical-strings checks assert PRESENCE IN THE
// DOCUMENT for a ruled string, not VISIBILITY TO A READER. A block hidden with display:none,
// visibility:hidden, clipped to a zero-area box, or moved off-screen still passes those checks.
// This module is the rendered-browser half: given a ruled string, find it in the live DOM and
// decide whether a reader looking at the page would actually see it.
//
// WHAT THIS COVERS (AC4): only ruled entries whose surface is "visible block" (or unset, which
// defaults to visible-block semantics) AND that name a specific `route`. It needs a browser, so
// it cannot and does not cover: metadata description/og/twitter tags, JSON-LD strings, served
// text files (llms.txt etc) -- those have no rendered layout box by nature and stay on the
// existing PRESENCE check (copy-change-detector.mjs / canonical-strings.mjs checkCanonical).
// ruled entries with no `route` (apply-anywhere) are also out of scope: rendering "every page"
// per ruled string is unbounded, and no such entry exists in either ruled source today.
//
// THE PREDICATE, and why each line exists (AC2's four named techniques plus one bonus):
//   1. EFFECTIVE OPACITY (own * every ancestor's computed opacity, multiplied): opacity is not
//      an inherited CSS property, so getComputedStyle(el).opacity alone misses an opacity:0
//      ancestor. A reader sees nothing through a chain product of zero.  [bonus control, not
//      one of AC2's four, but a known hiding technique elsewhere in this repo (NAMED_LIMITS)]
//   2. ZERO-AREA BOX: getBoundingClientRect() with width<=0 or height<=0. Catches an element's
//      own height/width:0, AND a display:none ANCESTOR (Chromium does not lay out a descendant
//      of a display:none ancestor, so its rect collapses to all-zero even though
//      getComputedStyle(el).display on the descendant itself still reports its specified value,
//      not "none" -- that is why this check is rect-based, not display-string-based).  [AC2.1,
//      AC2.3]
//   3. OFF-SCREEN AFTER scrollIntoView: a page cannot scroll past the start of its own
//      scrollable area, so position:absolute;left:-9999px (the classic off-screen hider) stays
//      unreachable by scrolling. If the rect does not intersect the viewport even after
//      scrollIntoView, nothing a reader does brings it into view.  [AC2.4]
//   4. HIT-TEST: document.elementFromPoint at the (post-scroll) rect's centre must resolve to
//      the element itself, a descendant, or an ancestor. visibility:hidden elements are excluded
//      from hit-testing by the browser (the point resolves to whatever is behind them), and so
//      is anything clipped to nothing by an ancestor's overflow:hidden box (the element's OWN
//      rect can still report a non-zero size in that case -- clipping does not shrink the
//      clipped element's layout box, only what is painted -- which is exactly why check 2 alone
//      cannot catch it).  [AC2.1, AC2.2, AC2.3]
//
// All four checks run in-browser via page.evaluate; this file only passes the predicate in, so
// it does not duplicate Node-side text matching logic against a different DOM representation
// than the one a reader's browser actually paints.
import { norm } from "./copy-blocks.mjs";

// Runs INSIDE the page. Self-contained on purpose: page.evaluate serialises this function by
// source text, so it cannot close over anything from the Node side (norm() included) -- the
// small re-implementation below is deliberate, not an oversight.
export async function browserFindAndCheckVisibility([targetRaw, mode]) {
  const normalize = (s) => String(s).replace(/[\s ]+/g, " ").trim();
  const target = normalize(targetRaw);
  const all = Array.from(document.querySelectorAll("body *"));
  const matches = all.filter((el) => {
    const t = normalize(el.textContent || "");
    return mode === "equals" ? t === target : t.includes(target);
  });
  if (!matches.length) return { found: false };
  // Drop any match that is an ANCESTOR of another match. A wrapper with no text of its own
  // besides its single matching child ties on textContent length and sorts first in document
  // order, which silently picked the wrapper instead of the actual text-bearing element --
  // caught because the wrapper's own box can be 0x0 (e.g. an overflow:hidden clip container)
  // while the real element inside it is not, making this the difference between a false FAIL
  // and the true result.
  const leaves = matches.filter((el) => !matches.some((o) => o !== el && el.contains(o)));
  leaves.sort((a, b) => a.textContent.length - b.textContent.length);
  const el = leaves[0];

  // CLOSED-DISCLOSURE CHECK FIRST, before any measurement. A FAQ answer inside a closed
  // <details> is typically ALSO wrapped in a .reveal-on-scroll (opacity:0 until an
  // IntersectionObserver fires), and that observer never fires for a collapsed, zero-size
  // disclosure -- so measuring opacity first would misreport this as a plain hidden block
  // instead of the distinct, pm/content product question it actually is (see below).
  for (let a = el.parentElement; a; a = a.parentElement) {
    if (a.tagName === "DETAILS" && !a.open) {
      // A closed <details> ancestor is a DIFFERENT finding from "hidden": a reader CAN see
      // this with one click, which no other hiding technique here offers. Named separately so
      // a gate reader does not read "FAQ answer closed by default" and "text hidden with
      // display:none" as the same severity -- this is a product-behaviour question (is
      // accordion-gating acceptable for THIS ruled claim?), not a rendering bug, and it is
      // pm's/content's call, not this check's, to decide per string (gy-vawlh's own scoping
      // note flagged exactly this case in advance: "WellnessZ FAQ answer is in the DOM but
      // not visible until opened").
      return { found: true, visible: false, reason: "inside-closed-disclosure" };
    }
  }

  // SCROLL FIRST, THEN SETTLE, THEN MEASURE. This site uses a scroll-triggered reveal
  // (.reveal-on-scroll, IntersectionObserver-driven: opacity:0 until .is-visible is added, a
  // .6s transition) for below-the-fold content. Measuring opacity BEFORE scrolling a block
  // into view would read every such block as hidden, which is a FALSE POSITIVE this check
  // must not produce -- a reader who scrolls the page sees it fine. Checking after settling
  // is also what makes the result mean "can a reader who scrolls ever see this", matching
  // AC1's "visible without scrolling... [or] scroll it into view" framing used elsewhere on
  // this epic (gy-e60uc.7).
  el.scrollIntoView({ block: "center", inline: "center" });
  await new Promise((r) => setTimeout(r, 700));

  let opacity = 1;
  for (let a = el; a; a = a.parentElement) {
    const v = parseFloat(getComputedStyle(a).opacity);
    if (!Number.isNaN(v)) opacity *= v;
  }
  if (opacity <= 0.05) return { found: true, visible: false, reason: "effective-opacity-zero", opacity };

  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return { found: true, visible: false, reason: "zero-area-box", rect: { w: rect.width, h: rect.height } };
  }

  const vw = window.innerWidth, vh = window.innerHeight;
  if (rect.bottom <= 0 || rect.right <= 0 || rect.top >= vh || rect.left >= vw) {
    return { found: true, visible: false, reason: "off-screen-unreachable-by-scroll", rect: { top: rect.top, left: rect.left, vw, vh } };
  }

  const cx = Math.min(Math.max(rect.left + rect.width / 2, 1), vw - 1);
  const cy = Math.min(Math.max(rect.top + rect.height / 2, 1), vh - 1);
  const hit = document.elementFromPoint(cx, cy);
  // DELIBERATELY one-directional: el === hit, or hit is a DESCENDANT of el (an inline child
  // like <b> inside the matched block). hit being an ANCESTOR of el (el.contains is reversed:
  // hit.contains(el)) is NOT a pass -- an ancestor is structurally true for almost any
  // invisible element (body contains everything), so that direction would make this hit-test
  // a no-op. This exact reversal was caught empirically: it let BOTH visibility:hidden and a
  // closed <details> (Chromium hides its non-summary content without display:none or
  // content-visibility, the hit-test lands on BODY) read as visible before this was fixed.
  const hitOk = !!hit && (hit === el || el.contains(hit));
  if (!hitOk) {
    return { found: true, visible: false, reason: "not-hit-testable", hitTag: hit ? hit.tagName : null };
  }

  return { found: true, visible: true, rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }, opacity, tag: el.tagName };
}

// Node-side helper: which of a ruled list this rendered check can act on (AC4's boundary).
const VISUAL_SURFACES = new Set([undefined, "visible block"]);
export function renderableRuled(ruled) {
  return ruled.filter((r) => r.route && r.route !== "(any)" && VISUAL_SURFACES.has(r.surface));
}
export function skippedRuled(ruled) {
  return ruled.filter((r) => !(r.route && r.route !== "(any)" && VISUAL_SURFACES.has(r.surface)));
}

export async function checkRuledVisibility(page, entry) {
  const mode = entry.equals !== undefined ? "equals" : "contains";
  const text = norm(entry.equals ?? entry.contains);
  const result = await page.evaluate(browserFindAndCheckVisibility, [text, mode]);
  return { ...result, entry };
}
