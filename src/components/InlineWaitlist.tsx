import { useCallback, useId, useRef, useState } from "react";
import { F } from "../forge-ui";
import { WaitlistForm } from "./WaitlistForm";
import { WaitlistRevealContext } from "../lib/waitlistReveal";

/**
 * gy-becxi — REVEAL THE CAPTURE WHERE THE VISITOR ALREADY IS.
 *
 * Damini, 2026-09-07, describing her own arrival from Instagram: "I tap on the
 * Join Waitlist button. That scrolls to the bottom of the page to the name and
 * email fields. This journey is a bit annoying." The CTA was never a button
 * that opens a form — it was an anchor jump to the page footer. This wraps a
 * CTA cluster and renders the capture underneath it, in place.
 *
 * 🔴 THE ONE PROPERTY THAT IS THE WHOLE BEAD: THE VIEWPORT DOES NOT MOVE.
 * If the page still scrolls, nothing was fixed, and every way this can
 * accidentally scroll is handled explicitly below rather than left to luck.
 *
 * WHY NOT A MODAL, since Damini offered "expands there only, or a popup,
 * whichever is easier": designer measured that the site has NO dialog primitive
 * at all — a repo-wide grep for Dialog / Modal / role="dialog" returns nothing.
 * So a popup is the EXPENSIVE option: focus trap, Escape-to-close, background
 * scroll lock, aria-modal + labelling, return-focus on dismiss. That is a new
 * accessibility surface on the highest-traffic conversion path, and each item
 * is another way to lose someone in the funnel she asked us to protect.
 * Inline reuses the component that already exists and adds no new primitive.
 *
 * 🔴 WHY THE PANEL IS CHARCOAL, WHICH IS MY CALL AND NOT THE DESIGN'S.
 * designer specified "reuse WaitlistForm" on a cheapness argument. Reuse is NOT
 * free here and the reason is an accessibility contract, not taste:
 * WaitlistForm is styled for the dark CTA section ONLY. Its fields are
 * --g-color-neutral-dark-1 (#141414) with a --g-color-grey-placeholder-dark
 * (#808080) border and white text, and gy-lgaz6 chose those tokens by MEASURING
 * them against F.charcoal (#0a0a0a) to reach WCAG 1.4.11's 3:1 for a non-text
 * UI boundary. Drop that form onto the bone hero (#fafaf7) and the measurement
 * that justified those exact tokens no longer holds — the form would be a dark
 * slab whose contrast was never computed for the surface it sits on.
 * The alternatives were: give WaitlistForm a light variant (a second styling
 * path through the one component that must not diverge — designer's item 4), or
 * give the reveal its own charcoal ground so the form is ALWAYS on the surface
 * its contrast analysis assumes. The second costs nothing and keeps one form.
 */
export function InlineWaitlist({
  children,
  className = "",
  panelClassName = "",
  reducedMotion = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Layout-only hook for the call site; never colour. */
  panelClassName?: string;
  /** The page already computes this via useReducedMotion; passed in, not re-read. */
  reducedMotion?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const headingId = useId();

  // 🔴 IDEMPOTENT ON PURPOSE. A second tap on the CTA must not re-run the focus
  // effect and yank the caret out of a field the visitor is halfway through
  // typing into. `revealed` only ever goes false -> true.
  const reveal = useCallback(() => {
    setRevealed((was) => {
      if (was) return was;
      // 🔴 FOCUS WITH preventScroll, AND THIS IS THE LINE THE BEAD TURNS ON.
      // designer's item 2 says focus the first field, because revealing a form
      // the visitor must then tap into spends the very click we are saving. But
      // the browser's DEFAULT focus behaviour is to scroll the focused element
      // into view — so the obvious implementation of "focus the first field"
      // reintroduces the exact jump Damini reported, and it would look like the
      // fix simply did not work. preventScroll is not a nicety here.
      //
      // Deferred to the frame after paint: the panel does not exist in the DOM
      // until this state change has rendered, so querying for the field inside
      // the updater or synchronously after would find nothing.
      requestAnimationFrame(() => {
        const first = panelRef.current?.querySelector<HTMLElement>("input, select, textarea");
        first?.focus({ preventScroll: true });
      });
      return true;
    });
  }, []);

  return (
    <WaitlistRevealContext.Provider value={{ revealed, reveal }}>
      <div className={className}>
        {children}
        {/* Rendered only once asked for. Keeping it unmounted (rather than
            hidden) means the prerendered HTML that ships from
            scripts/prerender.mjs is BYTE-UNCHANGED by this bead, which is what
            lets the existing visual baselines and the prod smoke suite stay
            meaningful evidence instead of being re-baselined through a diff. */}
        {revealed && (
          <div
            ref={panelRef}
            role="group"
            aria-labelledby={headingId}
            className={`mt-5 w-full max-w-[440px] rounded-2xl p-5 ${panelClassName} ${reducedMotion ? "" : "gy-reveal"}`}
            style={{ background: F.charcoal, boxShadow: "var(--c-elevation-3)" }}
          >
            <p
              id={headingId}
              className="text-[14px] mb-3"
              style={{ color: F.bone, fontFamily: "var(--font-sans)", fontWeight: 600 }}
            >
              Request access
            </p>
            <WaitlistForm />
          </div>
        )}
      </div>
    </WaitlistRevealContext.Provider>
  );
}
