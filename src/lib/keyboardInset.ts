// gy-w77x3 D1/K1/K2 — how far the on-screen keyboard intrudes, in CSS pixels.
//
// 🔴 THE KEYBOARD IS THE LOAD-BEARING CONSTRAINT OF THE STICKY-BAR REVEAL, NOT
// THE EXPANSION. designer, 2026-09-16: a `position: fixed` element is pinned to
// the LAYOUT viewport, while the software keyboard shrinks only the VISUAL one.
// So on mobile Safari the bar — and the capture we just opened above it — sits
// UNDERNEATH the keyboard the moment the field takes focus. A visitor who
// cannot see herself typing is a worse disorientation than the scroll this bead
// exists to remove, which would make the fix a downgrade.
//
// visualViewport is the only API that reports this. The inset is what the layout
// viewport has that the visual one does not:
//
//   innerHeight ─┬─────────────────────┐
//                │  visual viewport    │  vv.height
//                ├─────────────────────┤  ← vv.offsetTop shifts this down
//                │  KEYBOARD           │  ← what we must clear
//                └─────────────────────┘
//
// 🔴 SSR-SAFE BY CONSTRUCTION, AND THAT IS NOT INCIDENTAL. scripts/prerender.mjs
// evaluates these modules in NODE, where `window` does not exist. The reads live
// inside useEffect, which never runs during prerender, and the initial state is
// 0 — so the server-rendered markup is byte-identical to today's. Touching
// `window` at module scope here would be a build-green/page-blank failure, the
// same class src/lib/waitlistReveal.ts was split out to avoid.
//
// 🔴 NO TRANSITION ON THE CONSUMER'S OFFSET. K2 is "no jump or detach while the
// keyboard animates": the bar must track the keyboard 1:1. Animating the offset
// makes it LAG the keyboard, which reads as the bar tearing away from the
// keyboard edge and is precisely the detachment K2 forbids.
import { useEffect, useState } from "react";

export function useKeyboardInset(active: boolean): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    // Not revealed: no field can be focused here, so there is nothing to clear.
    // Reset rather than leave a stale offset behind — a bar still holding a
    // keyboard-sized gap after dismissal floats above the safe area.
    if (!active) {
      setInset(0);
      return;
    }
    const vv = typeof window !== "undefined" ? window.visualViewport : undefined;
    // 🔴 NO visualViewport IS A SUPPORTED ANSWER, NOT A FAILURE. Older browsers
    // and every desktop path land here and get 0 — the panel still opens above
    // the button and nothing moves. Degrading to today's behaviour is correct;
    // throwing or guessing a keyboard height would be worse than not knowing.
    if (!vv) return;

    const read = () => {
      // Clamped at 0: vv.height can momentarily exceed innerHeight mid-rotation,
      // and a negative offset would push the bar off the bottom of the screen.
      setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    };
    read();
    // resize fires as the keyboard opens/closes; scroll fires when the visual
    // viewport is panned while the keyboard is already up. Both move offsetTop,
    // so both must re-read or the bar drifts.
    vv.addEventListener("resize", read);
    vv.addEventListener("scroll", read);
    return () => {
      vv.removeEventListener("resize", read);
      vv.removeEventListener("scroll", read);
    };
  }, [active]);

  return inset;
}
