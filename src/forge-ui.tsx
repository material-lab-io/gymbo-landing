import { ArrowRight } from "lucide-react";

/* ============================================================================
   forge-ui — shared design tokens and presentational primitives for
   getgymbo.com. Single source of truth so the homepage (App.tsx) and the
   comparison pages stay visually identical. Forge palette: amber #F59E0B /
   marigold #FBBF24 accent on flat beige/charcoal, sentence case, no gradients.
   getgymbo.com is LIGHT ONLY (founder ruling, gy-uesmd 2026-08-12) — there is
   no page-wide theme toggle. `ThemeName` below still exists as a per-section
   variant selector (some sections are permanently dark charcoal accent bands
   by design, e.g. the "brand touchpoints" section and alternating pillar
   rows) — that is unrelated to the removed global dark mode.
   ============================================================================ */

export type ThemeName = "light" | "dark";

// Charcoal/bone/marigold below are always-dark-surface tokens (used by the
// permanently-dark accent-band sections), so they're literal, not CSS vars.
export const F = {
  beige: "var(--c-bg)",
  beigeCard: "var(--c-card)",
  beigeCard2: "var(--c-card2)",
  beigeMuted: "var(--c-muted)",
  ink: "var(--c-ink)",
  inkMuted: "var(--c-ink-muted)",
  inkLabel: "var(--c-ink-label)",
  inkAnchor: "var(--c-ink-anchor)",
  amber: "var(--c-brand)",
  marigold: "var(--g-color-brand-marigold-500)",
  amberText: "var(--c-brand-text)",
  onCta: "var(--g-color-neutral-light-fg)",
  charcoal: "var(--g-color-neutral-dark-0)",
  charcoalCard: "var(--g-color-neutral-dark-1)",
  charcoalCard2: "var(--g-color-neutral-dark-2)",
  bone: "var(--g-color-neutral-dark-fg)",
  boneMuted: "var(--g-color-grey-muted-fg-dark)",
  boneLabel: "var(--g-color-grey-label-dark)",
  green: "var(--g-color-status-green-text)",
  red: "var(--g-color-status-destructive-light)",
  white: "var(--g-color-absolute-white)",
  // No Forge token for pure black; 0 usages. Kept so the object stays
  // exhaustive, flagged so nobody reads it as an approved brand value.
  black: "#000000",
};

// Forge radius scale (--g-radius-sm/md/lg/xl/xxl/full in src/forge/forge.css:
// 8/12/16/20/28/9999) — the single source of truth for corner radii.
export const RADIUS = {
  sm: "var(--g-radius-sm)",
  md: "var(--g-radius-md)",
  lg: "var(--g-radius-lg)",
  xl: "var(--g-radius-xl)",
  xxl: "var(--g-radius-xxl)",
  full: "var(--g-radius-full)",
};

// 5-step layered elevation scale (--c-elevation-1..5 in FORGE_CSS above): one
// light direction, tight+medium+ambient layers per step, tinted to the surface
// hue (warm on light-theme beige, cool on dark-theme charcoal) instead of pure
// black, offset+blur scaling together as elevation rises. cta/chip/card are
// semantic aliases onto specific steps so existing call sites keep their names.
export const SHADOW = {
  elevation1: "var(--c-elevation-1)",
  elevation2: "var(--c-elevation-2)",
  elevation3: "var(--c-elevation-3)",
  elevation4: "var(--c-elevation-4)",
  elevation5: "var(--c-elevation-5)",
  // filter form for elements shadowed via CSS `filter: drop-shadow(...)`
  // (transparent-background device frames) — drop-shadow has no spread
  // parameter, so this is the closest filter-safe rendering of elevation-4.
  elevation4Filter: "var(--c-elevation-4-filter)",
  cta: "var(--c-elevation-2)",
  chip: "var(--c-elevation-3)",
  card: "var(--c-elevation-2)",
};

export const SERIF = "var(--font-serif)"; // Merriweather
export const SANS = "var(--font-sans)"; // Open Sans

/**
 * 🔴 THE FOUNDER LINE. +91 80501 31733 is Kaushik's, confirmed by him 2026-09-10.
 *
 * DO NOT "fix" the fact that Damini's outreach signature carries a different
 * number (wa.me/message/XBV6ZBNZOHOBM1). Inbound-from-site and outbound-to-lead
 * are deliberately different channels; making them match would merge two
 * conversations that are meant to stay apart.
 *
 * Hoisted here by gy-e9h9y AC2 because the bare URL was written out by hand in
 * three footers (App.tsx, PageShell.tsx, CompareWellnessZ.tsx) plus this
 * constant — four independent copies of one phone number, which is three
 * opportunities for it to be changed in only some of them.
 */
const WHATSAPP_NUMBER = "918050131733";

/** Bare chat link, no prefilled message. For contact listings (footers). */
export const WHATSAPP_PLAIN = `https://wa.me/${WHATSAPP_NUMBER}`;

/**
 * Chat link with the visitor's intent prefilled. For CTAs.
 *
 * AC2 asked for "one shape for prefilled text". The honest answer is TWO shapes
 * over ONE number, and that is deliberate rather than a dodge: the thing that
 * must never diverge is the NUMBER, and it no longer can. The prefill is a
 * per-intent choice — a CTA states why the visitor is writing ("I'd like to try
 * Gymbo"), whereas a footer contact link is used for support and billing too,
 * and stuffing trial intent into a support message would put words in the
 * sender's mouth. Collapsing these into one URL would be tidier and wrong.
 *
 * The query string is kept byte-identical to the pre-hoist literal (%27 for the
 * apostrophe, which encodeURIComponent does NOT produce) so this stays a pure
 * refactor with no change to the rendered href.
 */
export const WHATSAPP = `${WHATSAPP_PLAIN}?text=Hi%2C%20I%27d%20like%20to%20try%20Gymbo`;

/**
 * The WhatsApp glyph. Was copy-pasted verbatim into App.tsx and
 * CompareWellnessZ.tsx (gy-e9h9y AC2).
 */
export function WhatsAppGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
    </svg>
  );
}

/**
 * The dark-surface WhatsApp button used in the closing CTA section.
 *
 * This whole <a> — classes, inline style and label — was duplicated BYTE FOR
 * BYTE in App.tsx and CompareWellnessZ.tsx. gy-e9h9y AC2 described the glyph as
 * the copy-pasted part; measured, the entire button was.
 *
 * 🔴 It is a THIRD visual variant, outside the primary/secondary pair in
 * forge-ui — a neutral-dark surface rather than either. Hoisting it does not
 * bless it; it makes the fact that a third variant exists visible in one place
 * so gy-e9h9y's shape work can decide what happens to it, instead of that
 * decision being spread across two files.
 */
export function WhatsAppButton({ location, children }: { location: CtaLocation; children: React.ReactNode }) {
  return (
    <a
      href={WHATSAPP}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackCta("whatsapp_cta_click", location)}
      data-cta="whatsapp"
      data-cta-location={location}
      className="inline-flex items-center justify-center gap-2.5 h-12 px-7 rounded-full text-[14px] transition-transform duration-150 hover:-translate-y-px active:scale-[0.97]"
      style={{ background: "var(--g-color-neutral-dark-1)", color: F.bone, border: "1px solid var(--g-color-grey-placeholder-dark)", fontFamily: SANS }}
    >
      <WhatsAppGlyph />
      {children}
    </a>
  );
}

/** Smooth-scroll to an in-page anchor by id (used by CTAs + nav). */
export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Forge token + animation CSS. Injected via dangerouslySetInnerHTML (NOT JSX
// children): <style> is a raw-text element, and renderToString HTML-escapes
// element children, which would corrupt raw CSS. __html keeps it raw.
// LIGHT ONLY (gy-uesmd) — no [data-theme="dark"] rule ships here or anywhere
// else in the bundle; do not reintroduce one without a new founder ruling.
// 🔴 --c-* POINTS AT FORGE, IT DOES NOT COPY IT — gy-swdgh, 2026-09-12.
// Nine of these values were verbatim copies of Forge tokens, including the brand
// amber. They AGREED with Forge at the time, so nothing rendered wrong; the defect
// was that if a Forge colour moved, --c-* silently would not. The drift gate that
// exists to catch exactly this could not see this file at all (a path-prefix
// exemption swallowed src/forge-ui.tsx), so it stayed green over its own founding
// defect for its whole life. Resolution order is not a concern: both namespaces
// are declared on :root and custom properties resolve at computed-value time.
//
// DELIBERATE DIVERGENCES, stated rather than left to look like oversights:
//  · --c-ink-anchor #3d3d3d has NO Forge equivalent (advisory in the gate, not a
//    duplicate). Left literal; it is a real value with no token to point at.
//  · the rgba() values below sit outside this gate by design — it compares HEX
//    only, and the alpha family is gy-73h3j's scope, not this bead's.
const FORGE_CSS = `
        :root{--c-bg:var(--g-color-neutral-light-0);--c-card:var(--g-color-neutral-light-1);--c-card2:var(--g-color-neutral-light-2);--c-muted:var(--g-color-neutral-light-3);--c-ink:var(--g-color-neutral-light-fg);--c-ink-muted:var(--g-color-grey-muted-fg-light);--c-ink-anchor:#3d3d3d;--c-ink-label:var(--g-color-grey-label-light);--c-brand:var(--g-color-brand-amber-500);--c-brand-text:var(--g-color-brand-amber-text-light);--c-line:rgba(26,26,26,.1);--c-nav-bg:rgba(250,250,247,.85);--c-elevation-1:0 1px 2px rgba(34,24,14,.05),0 4px 10px -4px rgba(34,24,14,.06),0 10px 20px -10px rgba(34,24,14,.05);--c-elevation-2:0 1px 2px rgba(34,24,14,.06),0 6px 16px -6px rgba(34,24,14,.08),0 16px 32px -14px rgba(34,24,14,.07);--c-elevation-3:0 2px 3px rgba(34,24,14,.07),0 10px 24px -8px rgba(34,24,14,.10),0 24px 48px -20px rgba(34,24,14,.09);--c-elevation-4:0 2px 4px rgba(34,24,14,.08),0 16px 32px -10px rgba(34,24,14,.11),0 36px 64px -26px rgba(34,24,14,.10);--c-elevation-5:0 3px 6px rgba(34,24,14,.09),0 20px 44px -12px rgba(34,24,14,.13),0 52px 96px -34px rgba(34,24,14,.14);--c-elevation-4-filter:drop-shadow(0 2px 3px rgba(34,24,14,.08)) drop-shadow(0 14px 26px rgba(34,24,14,.10)) drop-shadow(0 28px 46px rgba(34,24,14,.09))}
        .reveal-on-scroll{opacity:0;transform:translateY(20px);transition:opacity .6s cubic-bezier(.22,.9,.3,1),transform .6s cubic-bezier(.22,.9,.3,1)}
        .reveal-on-scroll.is-visible{opacity:1;transform:none}
        @keyframes g-rise{to{opacity:1;transform:none}}
        @keyframes g-fade{to{opacity:1}}
        .hero-rise{opacity:0;transform:translateY(16px);animation:g-rise .7s cubic-bezier(.22,.9,.3,1) forwards}
        .hero-fade{opacity:0;animation:g-fade .8s ease forwards}
        .d1{animation-delay:.05s}.d2{animation-delay:.16s}.d3{animation-delay:.30s}.d4{animation-delay:.44s}.d5{animation-delay:.58s}
        .d6{animation-delay:.55s}.d7{animation-delay:.95s}
        .carousel{scrollbar-width:none}
        .carousel::-webkit-scrollbar{display:none}
        details.faq>summary{list-style:none;cursor:pointer}
        details.faq>summary::-webkit-details-marker{display:none}
        details.faq[open] .faq-plus{transform:rotate(45deg)}
        .legal-prose h2{font-family:var(--font-serif);font-weight:800;font-size:21px;line-height:1.3;color:var(--c-ink);letter-spacing:-0.01em}
        .legal-prose h3{font-weight:700;font-size:16px;color:var(--c-ink)}
        .legal-prose p{margin:0}
        .legal-prose a{color:var(--c-brand-text);text-decoration:underline;text-underline-offset:2px}
        .legal-prose ul{list-style:disc;padding-left:22px;display:flex;flex-direction:column;gap:7px;margin:0}
        .legal-prose strong{color:var(--c-ink);font-weight:600}
        .article-prose>*+*{margin-top:18px}
        .article-prose h2{font-family:var(--font-serif);font-weight:800;font-size:clamp(20px,2.6vw,26px);line-height:1.25;letter-spacing:-0.01em;color:var(--c-ink);margin-top:36px}
        .article-prose h3{font-weight:700;font-size:17px;color:var(--c-ink);margin-top:24px}
        .article-prose a{color:var(--c-brand-text);text-decoration:underline;text-underline-offset:2px;overflow-wrap:anywhere}
        .article-prose strong{color:var(--c-ink);font-weight:600}
        .article-prose ul{list-style:disc;padding-left:22px;display:flex;flex-direction:column;gap:8px}
        .article-prose ol{list-style:decimal;padding-left:22px;display:flex;flex-direction:column;gap:8px}
        .article-prose blockquote{border-left:3px solid var(--c-brand);padding-left:16px;color:var(--c-ink-muted);font-style:italic}
        .article-prose hr{border:0;border-top:1px solid var(--c-line);margin:28px 0}
        /* gy-ma11q: the scroll container is the WRAPPER, not the table. 'display:block;
           overflow-x:auto' on the <table> itself made the table a scrollable region with no
           focusable descendant, so a keyboard or switch user could not scroll it at all and
           simply could not reach the off-screen columns (axe scrollable-region-focusable,
           WCAG-AA, measured on 6 live guide/research routes 2026-09-06). 'display:block' also
           drops the table's semantics in some AT. The wrapper carries the overflow AND
           tabindex=0, which is what makes it keyboard-scrollable. */
        .article-prose table{width:100%;border-collapse:collapse;font-size:14px}
        .article-prose .table-scroll{overflow-x:auto}
        /* A tabbable element must show where focus is (WCAG 2.4.7). Focus-visible only, so
           mouse users never see a ring on a plain click. */
        /* UNSCOPED on purpose: .table-scroll is also used outside .article-prose (the
           /compare at-a-glance table). A tabbable element with no visible focus
           indicator is itself a WCAG 2.4.7 failure, so scoping this to .article-prose
           would trade one violation for another. */
        .table-scroll:focus-visible{outline:2px solid var(--c-brand);outline-offset:3px;border-radius:6px}
        .article-prose th,.article-prose td{border:1px solid var(--c-line);padding:10px 12px;text-align:left;vertical-align:top}
        .article-prose thead th{background:rgba(245,158,11,0.08);font-family:var(--font-serif);color:var(--c-ink)}
        .article-prose tbody td:first-child{color:var(--c-ink);font-weight:600}
        @keyframes waiting-pulse{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(245,158,11,.22)}50%{transform:scale(1.06);box-shadow:0 0 0 9px rgba(245,158,11,0)}}
        .waiting-pulse{animation:waiting-pulse 2.8s cubic-bezier(.4,0,.6,1) infinite}
        .feature-card-hover{transition:transform .25s cubic-bezier(.22,.9,.3,1),background-color .25s ease,border-color .25s ease}
        .feature-card-icon{transition:transform .25s cubic-bezier(.22,.9,.3,1)}
        @media (hover:hover) and (pointer:fine){
          .feature-card-hover:hover{transform:scale(1.02);background-color:rgba(240,240,235,0.04)}
          .feature-card-hover:hover .feature-card-icon{transform:rotate(8deg) scale(1.08)}
        }
        @keyframes g-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        .marquee-mask{-webkit-mask-image:linear-gradient(to right,transparent,black 8%,black 92%,transparent);mask-image:linear-gradient(to right,transparent,black 8%,black 92%,transparent)}
        .marquee-track{animation:g-marquee 38s linear infinite}
        .marquee-mask:hover .marquee-track,.marquee-mask:focus-within .marquee-track{animation-play-state:paused}
        @media (prefers-reduced-motion:reduce){
          .hero-rise,.hero-fade{opacity:1!important;transform:none!important;animation:none!important}
          .reveal-on-scroll{opacity:1!important;transform:none!important;transition:none!important}
          .waiting-pulse{animation:none!important;box-shadow:0 0 0 0 rgba(245,158,11,.22)!important}
          .feature-card-hover,.feature-card-icon{transition:none!important}
          .feature-card-hover:hover,.feature-card-hover:hover .feature-card-icon{transform:none!important}
          .marquee-track{animation:none!important;transform:none!important}
        }
      `;

/** The Forge token + animation CSS, rendered once per page. */
export function ForgeStyle() {
  return <style dangerouslySetInnerHTML={{ __html: FORGE_CSS }} />;
}

/* ── presentational primitives ── */

export function Eyebrow({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-2 text-[12px] font-bold mb-5 rounded-full"
      style={{
        letterSpacing: "0.08em",
        color: dark ? F.marigold : F.amberText,
        fontFamily: SANS,
        background: dark ? "rgba(251,191,36,0.12)" : "rgba(245,158,11,0.08)",
        border: dark ? "1px solid rgba(251,191,36,0.22)" : "1px solid rgba(245,158,11,0.14)",
        padding: "6px 12px 6px 10px",
        boxShadow: dark ? SHADOW.elevation1 : "none",
      }}
    >
      <span className="inline-block w-[7px] h-[7px] rounded-full" style={{ background: dark ? F.marigold : F.amber }} />
      {children}
    </span>
  );
}

/** Where a CTA sits. Measured inventory, not a guess — designer's design named
 * "hero / mid-page / footer" but flagged it as an intended taxonomy they had not
 * checked against the code. The real placements are these five. */
export type CtaLocation = "hero" | "gallery" | "cta-section" | "footer" | "compare";

/**
 * Fire a CTA click event.
 *
 * 🔴 FIRE AND DO NOT WAIT. A click that navigates away can lose an in-flight
 * beacon, and the tempting fix — preventDefault, send, then navigate — makes the
 * site's primary conversion hesitate. A CTA that stalls to improve its own
 * telemetry is a worse CTA. We accept a small undercount instead, and that
 * undercount must be stated wherever these numbers are quoted.
 *
 * Guarded on `umami` existing: #110 scoped the tracker to production hostnames,
 * so on localhost it is legitimately absent and this must be a no-op, never a
 * crash inside a click handler.
 */
export function trackCta(event: "whatsapp_cta_click" | "waitlist_cta_click", location: CtaLocation) {
  if (typeof window !== "undefined" && (window as any).umami) {
    (window as any).umami.track(event, { location });
  }
}

/**
 * THE SHARED CTA VISUAL (gy-e9h9y AC3).
 *
 * This file used to WELD TWO INDEPENDENT AXES together:
 *   VISUAL:    primary (filled amber + shadow + arrow) | secondary (transparent + 1px border)
 *   BEHAVIOUR: in-page scroll (<button>)               | navigate off-site (<a href>)
 * Only two of the four combinations existed, each hardwired: PrimaryCTA was
 * primary+scroll, SecondaryButton was secondary+link. gy-e9h9y needs the OTHER
 * diagonal — primary+link for WhatsApp, secondary+scroll for the demoted
 * waitlist — which is why "add an href prop" and "add one sibling" both felt
 * wrong: each fixes one cell of a 2x2.
 *
 * 🔴 NOT A POLYMORPHIC PrimaryCTA THAT RENDERS <a> OR <button> ON A PROP. That
 * puts a branch inside a primitive used at every CTA site, and makes the prop
 * combination (href AND scroll) representable-but-invalid. Thin wrappers over
 * one shared style cannot express the invalid state.
 */
export function ctaVisual(variant: "primary" | "secondary", { dark, size = "md" }: { dark?: boolean; size?: "md" | "lg" } = {}) {
  // 🔴 The class strings below reproduce the pre-existing PrimaryCTA and
  // SecondaryButton markup EXACTLY, including class ORDER. Tailwind does not
  // care about order, but the rendered HTML does: keeping it identical is what
  // lets the visual-regression baselines and the built-output diff stay
  // meaningful evidence rather than noise to be waved through.
  const sizing = size === "lg" ? "h-14 px-7 text-[15px]" : "h-12 px-6 text-[14px]";
  if (variant === "primary") {
    return {
      className: `inline-flex items-center justify-center gap-2 rounded-full font-bold transition-transform duration-150 hover:-translate-y-px active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${sizing}`,
      style: { background: dark ? F.marigold : F.amber, color: F.onCta, boxShadow: SHADOW.cta, fontFamily: SANS } as React.CSSProperties,
    };
  }
  return {
    className: `inline-flex items-center justify-center gap-2 ${sizing} rounded-full transition-transform duration-150 hover:-translate-y-px active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2`,
    style: {
      background: "transparent",
      color: dark ? F.bone : F.ink,
      border: `1px solid ${dark ? "rgba(240,240,235,0.22)" : "var(--c-line)"}`,
      fontFamily: SANS,
      fontWeight: 500,
    } as React.CSSProperties,
  };
}

/**
 * PRIMARY + LINK — the WhatsApp conversion (gy-e9h9y).
 *
 * 🔴 THIS MUST BE A REAL <a href>, NEVER <button> + window.open, and that is the
 * single thing in this bead that must not be got wrong. A fake link breaks
 * cmd/middle-click "open in new tab", right-click "Copy link address", and is
 * announced as a button rather than a link by screen readers. Making the site's
 * primary conversion a fake link is a real regression AND an invisible one:
 * every smoke test we have asserts the LABEL, so all of them would still pass.
 *
 * No WhatsApp green (AC4): #25D366 beside our amber reads as third-party chrome
 * pasted into the page, and "this is the main action here" is a hierarchy
 * statement that belongs in our own palette. The glyph carries the channel
 * recognition instead, at zero token cost.
 */
export function WhatsAppCTA({ dark, size = "md", location, className = "", children }: { dark?: boolean; size?: "md" | "lg"; location: CtaLocation; className?: string; children: React.ReactNode }) {
  const v = ctaVisual("primary", { dark, size });
  return (
    <a
      href={WHATSAPP}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackCta("whatsapp_cta_click", location)}
      data-cta="whatsapp"
      data-cta-location={location}
      className={`${v.className} ${className}`}
      style={v.style}
    >
      <WhatsAppGlyph />
      {children}
    </a>
  );
}

/**
 * SECONDARY + SCROLL — the demoted waitlist (gy-e9h9y).
 *
 * 🔴 DEMOTION MEANS LOWER VISUAL WEIGHT, NOT LOWER REACHABILITY. This stays a
 * full-size outline BUTTON with the same h-12 hit target, sitting immediately
 * beside the primary. It must never become a text link: the waitlist is still
 * the only capture we own that produces a ROW, and Damini's actual request
 * (gy-becxi) is to reduce friction on exactly that path — turning it into a text
 * link would answer her with the opposite.
 *
 * No arrow. The ArrowRight on the primary is doing hierarchy work and should not
 * be duplicated onto the secondary.
 */
export function WaitlistCTA({ dark, size = "md", location, className = "", children = "Request access" }: { dark?: boolean; size?: "md" | "lg"; location: CtaLocation; className?: string; children?: React.ReactNode }) {
  const v = ctaVisual("secondary", { dark, size });
  return (
    <button
      onClick={() => { trackCta("waitlist_cta_click", location); scrollToId("cta"); }}
      data-cta="waitlist"
      data-cta-location={location}
      className={`${v.className} ${className}`}
      style={v.style}
    >
      {children}
    </button>
  );
}

/**
 * PRIMARY + SCROLL — a lone waitlist CTA.
 *
 * Kept, and kept primary, at the three placements where it is the ONLY call to
 * action (gallery, footer, compare-page hero is a pair and is handled there).
 * See the commit message for why a lone waitlist CTA was not converted to
 * WhatsApp: demoting the only on-site capture at a placement where nothing
 * competes with it would reduce waitlist reachability, which AC8 and Damini's
 * actual request both forbid.
 *
 * `location` is required so no CTA can ship untracked (AC6).
 */
export function PrimaryCTA({ dark, size = "md", className = "", location, children = "Request access" }: { dark?: boolean; size?: "md" | "lg"; className?: string; location: CtaLocation; children?: React.ReactNode }) {
  const v = ctaVisual("primary", { dark, size });
  return (
    <button
      onClick={() => { trackCta("waitlist_cta_click", location); scrollToId("cta"); }}
      data-cta="waitlist"
      data-cta-location={location}
      className={`${v.className} ${className}`}
      style={v.style}
    >
      {children}
      <ArrowRight size={16} aria-hidden="true" />
    </button>
  );
}

/* SecondaryButton (secondary + link) was REMOVED by gy-e9h9y.
 *
 * Both of its call sites became <WhatsAppCTA> when WhatsApp was promoted to the
 * primary conversion, leaving it with zero consumers. It is not kept "in case":
 * an exported primitive that nothing uses but that still looks authoritative is
 * the same hazard as a hand-kept copy beside a generated one — the next person
 * reaches for it, and it quietly diverges from the cell that is actually
 * maintained. The secondary+link combination is still expressible via
 * ctaVisual("secondary") if a real call site ever appears.
 */

