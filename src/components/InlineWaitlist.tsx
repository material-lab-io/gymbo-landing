import { useCallback, useEffect, useRef, useState } from "react";
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
  above = false,
  reclaimGutter = true,
  onRevealedChange,
}: {
  children: React.ReactNode;
  className?: string;
  /** Layout-only hook for the call site; never colour. */
  panelClassName?: string;
  /** The page already computes this via useReducedMotion; passed in, not re-read. */
  reducedMotion?: boolean;
  /**
   * gy-w77x3 D7 — whether to reclaim the 20px page gutter on phones.
   *
   * 🔴 TRUE IS RIGHT IN A PAGE COLUMN AND WRONG IN AN ABSOLUTE ONE, and the D7
   * captures showed that rather than argued it. The reclaim is `-mx-5` plus
   * `w-[calc(100%+40px)]`, and for an ABSOLUTELY POSITIONED panel the
   * percentage resolves against the nearest positioned ancestor -- the sticky
   * <nav>, not the little flex box around the button. Measured on a 375px
   * phone, the nav panel rendered from -20 to 395: forty pixels wider than the
   * screen, hanging off BOTH edges with its fields cut.
   *
   * 🔴 AND NO EXISTING TEST COULD SEE IT, which is the part worth keeping. Every
   * width assertion in tests/inline-waitlist.spec.ts checks that the field is
   * WIDE ENOUGH, because being too narrow is what clipped the "optional" hint
   * once before. This panel was too WIDE. A one-sided measurement has a blind
   * side, and the blind side is where this landed.
   *
   * So the reclaim is opt-out and the nav opts out, taking a viewport-bounded
   * width instead. It is not a styling preference: a panel whose width is
   * measured against a different box than its padding needs a different rule,
   * not a tweaked one.
   */
  reclaimGutter?: boolean;
  /**
   * gy-w77x3 D1 — render the capture ABOVE the CTA instead of below it.
   *
   * 🔴 FOR THE FIXED BOTTOM BAR, AND ONLY FOR IT. The bar is pinned to the
   * bottom of the viewport, so a panel rendered below its button is off-screen
   * by construction — the default order silently produces an invisible capture
   * there. designer, 2026-09-16: "the capture renders ABOVE the button inside
   * the fixed container, the button stays under the thumb."
   *
   * This is deliberately NOT inferred from `position: fixed`: a component that
   * guesses its own layout context is a component that guesses wrong on the one
   * call site nobody checked. The call site knows; it says so.
   */
  above?: boolean;
  /**
   * gy-w77x3 K1/K2 — told to the call site, because the call site owns the box
   * that has to move.
   *
   * The fixed bottom bar must lift clear of the software keyboard, and only the
   * bar can do that: it is the positioned element. But only THIS component knows
   * whether a field exists to be focused. Rather than have the bar guess (lift
   * whenever any keyboard is up, including one raised by the footer form far
   * below) or have this component reach upward into a parent it does not own,
   * the state is reported and the bar decides.
   */
  onRevealedChange?: (revealed: boolean) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

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

  // Built once and PLACED per `above`, rather than written twice. Two copies of
  // one panel is how a fix lands on the below variant and quietly not the above
  // one -- the same duplication argument that produced waitlistScrollCtaProps.
  // Rendered only once asked for. Keeping it unmounted (rather than hidden)
  // means the prerendered HTML that ships from scripts/prerender.mjs is
  // BYTE-UNCHANGED by this bead, which is what lets the existing visual
  // baselines and the prod smoke suite stay meaningful evidence instead of
  // being re-baselined through a diff.
  const panel = revealed ? (
          <div
            ref={panelRef}
            role="group"
            // 🔴 LABELLED, NOT HEADED. A first pass rendered a visible "Request
            // access" line at the top of the panel and the phone capture showed
            // the words twice, six pixels apart: once on the button just tapped
            // and again immediately below it. The panel opens directly under its
            // own CTA, so it needs no visible title to be understood — but it
            // still needs an ACCESSIBLE NAME, because a screen-reader user who
            // lands in the group after the reveal does not have that adjacency.
            // aria-label gives the name without repeating the words on screen.
            aria-label="Request access"
            // 🔴 THE PANEL'S INSET IS RECLAIMED ON PHONES, AND IT IS A MEASUREMENT.
            // A first pass used a plain p-5 and made the capture 40px NARROWER
            // than the footer form it mirrors — the same WaitlistForm, two
            // widths. Measured on a 375px viewport: the email placeholder
            // ("Your email (optional if you gave a number)") needs 276px, the
            // footer field gives it 295 and does not clip, and the inset panel
            // gave it 255 and DID. I had assumed that clipping was pre-existing;
            // measuring both forms showed I had introduced it. The hint that
            // gets cut is the half that says email is OPTIONAL, on the capture a
            // phone visitor from Instagram actually reaches.
            // -mx-5 gives the padding back below sm so the fields land at the
            // footer's exact width; from sm up the column is wide enough that
            // the inset costs nothing and the panel sits inside it as designed.
            className={`${reclaimGutter ? "-mx-5 w-[calc(100%+40px)] sm:mx-0 sm:w-full" : "w-[min(calc(100vw-32px),360px)]"} ${above ? "mb-3" : "mt-5"} max-w-[480px] rounded-2xl p-5 ${panelClassName} ${reducedMotion ? "" : "gy-reveal"}`}
            style={{ background: F.charcoal, boxShadow: "var(--c-elevation-3)" }}
          >
            <WaitlistForm />
          </div>
  ) : null;

  // Reported as an EFFECT rather than from inside the reveal callback: calling a
  // parent's setState during our own state updater is a render-phase update, and
  // React will warn or drop it. This fires after commit, when the panel really
  // is in the DOM and the field can actually take focus.
  useEffect(() => {
    onRevealedChange?.(revealed);
  }, [revealed, onRevealedChange]);

  return (
    <WaitlistRevealContext.Provider value={{ revealed, reveal }}>
      <div className={className}>
        {above && panel}
        {children}
        {!above && panel}
      </div>
    </WaitlistRevealContext.Provider>
  );
}
