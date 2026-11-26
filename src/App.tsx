import { useEffect, useRef, useState } from "react";
import { HomeHero } from "./components/HomeHero";
import { Check, Plus } from "lucide-react";
import { DemoFrame, ScreenshotFrame, type ClipMap } from "./components/PhoneMockup";
import { InlineWaitlist } from "./components/InlineWaitlist";
import { WaitlistOverlayProvider, useWaitlistOverlayOwner } from "./lib/waitlistOverlay";
import { useReducedMotion } from "./hooks/useReducedMotion";
import { F, PAGE_BLACK, SANS, WHATSAPP_PLAIN, scrollToId, signupCtaProps, ForgeStyle, Eyebrow, WhatsAppCTA, WhatsAppButton, WaitlistPlainButton, StartFreeCTA, LogInLink } from "./forge-ui";
import { FIGURE_SURFACE } from "./figure-surface";
import { PRICE_MONTHLY_INR, START_FREE_LABEL } from "./lib/trialAccess";
import { HOME } from "./content/home";

/* gm-1w6 slice 3 (gy-3mpvo designer ruling) — home footer link groups. Support anchors
   to the support contact (#support, App Review 1.5), never the waitlist form. */
const FOOTER_GROUPS = HOME.footer.groups;

/* ============================================================================
   getgymbo.com — Forge redesign (epic gy-9bmwm); Damini round 2 (gy-sk86p2.3, 26 Nov).
   The whole page is BLACK (her words: "Keep it all black and let the cards that you
   are building define the sections"): one page colour (PAGE_BLACK = the hero's), no
   light band anywhere. Brand = Forge marigold #FBBF24, accent only. Hero and gallery
   use the approved licensed photoreal device compositions; the feature cards use the
   approved DARK photoreal demo clips. Masters are the founder-approved curated set,
   optimized to WebP via scripts/optimize-gallery.mjs (gy-9bmwm.4, gy-dyu6r.9).
   ============================================================================ */

/* Design tokens (F, SHADOW, SANS), the WhatsApp constants and button,
   scrollToId, and the shared presentational primitives now live in ./forge-ui
   (SSOT shared with the comparison pages). */

/* ── the four feature cards, in her order ── */
// gy-sk86p2.3 L3 (Damini 26 Nov): no orange icon highlight. Icon tiles are neutral: white on a faint white wash.
const NEUTRAL_TILE = "rgba(240,240,235,0.10)";
const CARD_LINE = "rgba(240,240,235,0.14)";
// Card art (pm ruling 2 on gy-sk86p2.3, web_designer 26 Nov): the phone only, no headline or caption in the image, a CURRENT app screen.
// "screen" = a real dark iOS capture in the photoreal frame (gallery pipeline, freshness-gated in ops/screens/manifest.json);
// "demo-crop" = interim: the approved demo cropped to its phone so the burned-in title + caption never show; "none" = no art yet.
// Owed captures (fresh dark iOS, then these switch to "screen"): card 1 Activity Log with month total, card 3 a statement PDF with a
// trainer logo, card 4 the builder with a neutral client name.
const PILLAR_LAYOUT = [
  { id: "revenue", demoId: "log-payment", art: { kind: "none" } },
  { id: "organized", demoId: "schedule", art: { kind: "screen", slug: "card-week" } },
  { id: "brand", demoId: "branded-statement", art: { kind: "demo-crop" } },
  { id: "workouts", demoId: "build-workout", art: { kind: "screen", slug: "card-builder" } },
] as const;
const PILLARS = PILLAR_LAYOUT.map((l) => ({ ...l, ...HOME.pillars[l.id] }));

const demoClip = (id: string): ClipMap => ({
  light: `/demos/${id}-light.mp4`,
  dark: `/demos/${id}-dark.mp4`,
});
const demoPoster = (id: string): ClipMap => ({
  light: `/demos/${id}-light.png`,
  dark: `/demos/${id}-dark.png`,
});

/* ── "see it in action" gallery: current real-app screenshots (founder-approved
   curated set, public/screens/gallery/) composited into the approved licensed
   photoreal frame. Pillar visuals use the approved animated demo scenes. Source
   files: public/screens/real/* → optimized via scripts/optimize-gallery.mjs
   (gy-9bmwm.4, gy-dyu6r.6). ── */
const SCREEN_ORDER = ["dashboard", "schedule", "payments", "workouts", "ai", "export"] as const;
const SCREENS = SCREEN_ORDER.map((slug) => ({ slug, ...HOME.gallery.screens[slug] }));

/* ── pricing ── */
const PRICING = [
  { ...HOME.pricing.plans[0], price: "0", period: "", highlight: false },
  { ...HOME.pricing.plans[1], price: String(PRICE_MONTHLY_INR), highlight: true },
];

/* ── FAQ ── */
export const FAQ = HOME.faq.items;

/* ============================================================================
   building blocks
   ============================================================================ */

function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`reveal-on-scroll ${className}`}>{children}</div>;
}

/* ============================================================================
   page
   ============================================================================ */

export default function App() {
  const prefersReduced = useReducedMotion();
  const [showStickyCTA, setShowStickyCTA] = useState(false);
  // gy-e9h9y N2: the phone bar is hidden while a section that must not share its screen is in view:
  // the closing section (its own WhatsApp link + the form) and, per designer's P1 on #316, pricing (a
  // plan choice is not the moment to push a different conversion, and amber-on-amber over the Annual card).
  const [barHiddenBySection, setBarHiddenBySection] = useState(false);
  const galleryRef = useRef<HTMLDivElement>(null);
  const galleryNavigationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const scrollGalleryTo = (index: number) => {
    const gallery = galleryRef.current;
    const card = gallery?.querySelector<HTMLElement>(`[data-gallery-index="${index}"]`);
    if (!gallery || !card) return;
    if (galleryNavigationTimer.current) clearTimeout(galleryNavigationTimer.current);
    galleryNavigationTimer.current = setTimeout(() => {
      galleryNavigationTimer.current = null;
    }, 100);
    setGalleryIndex(index);
    // Centre the card by scrolling the STRIP only: scrollIntoView would also move the page.
    gallery.scrollTo({ left: card.offsetLeft - (gallery.clientWidth - card.offsetWidth) / 2, behavior: "auto" });
  };

  const syncGalleryPosition = () => {
    if (galleryNavigationTimer.current) return;
    const gallery = galleryRef.current;
    if (!gallery) return;
    const cards = Array.from(gallery.querySelectorAll<HTMLElement>("[data-gallery-index]"));
    const centre = gallery.scrollLeft + gallery.clientWidth / 2;
    const closest = cards.reduce(
      (winner, card, index) =>
        Math.abs(card.offsetLeft + card.offsetWidth / 2 - centre) < Math.abs(cards[winner].offsetLeft + cards[winner].offsetWidth / 2 - centre)
          ? index
          : winner,
      0,
    );
    // On a wide screen several cards fit, so the first and last never reach the centre: at either end the end dot is the current one.
    const max = gallery.scrollWidth - gallery.clientWidth;
    setGalleryIndex(gallery.scrollLeft <= 1 ? 0 : gallery.scrollLeft >= max - 1 ? cards.length - 1 : closest);
  };

  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal-on-scroll"));
    if (prefersReduced) {
      els.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [prefersReduced]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const inView = new Set<string>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) (e.isIntersecting ? inView.add(e.target.id) : inView.delete(e.target.id));
      setBarHiddenBySection(inView.size > 0);
    });
    for (const id of ["pricing", "cta"]) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onScroll = () => setShowStickyCTA(window.scrollY > window.innerHeight * 0.8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    // gy-w77x3 B5: the ONE owner of which capture overlay (nav or sticky) is open.
    <WaitlistOverlayProvider>
    <div style={{ background: PAGE_BLACK, color: F.bone, fontFamily: SANS, lineHeight: 1.5 }}>
      <ForgeStyle />

      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:px-4 focus:py-2 focus:rounded-lg" style={{ background: F.amber, color: F.onCta }}>
        {HOME.nav.skip}
      </a>

      {/* ───────── nav ───────── */}
      <nav
        aria-label="Main navigation"
        data-fixed-chrome="nav"
        className="sticky top-0 z-40 flex items-center justify-between px-5 md:px-12 py-4"
        style={{ background: PAGE_BLACK, borderBottom: `1px solid ${CARD_LINE}` }}
      >
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center justify-center min-h-11 min-w-11 rounded-md focus-visible:outline-none gy-focus-ring-dark" aria-label={HOME.nav.backToTop}>
          <img
            src="/gymbo-mark-amber-ff9800.svg" /* the mark for DARK grounds (forge --g-color-mark-amber) */
            alt=""
            className="h-[38px] w-[38px]"
          />
        </button>

        <div className="hidden md:flex items-center gap-8">
          {[
            { label: HOME.nav.why, id: "why" },
            { label: HOME.nav.pricing, id: "pricing" },
            { label: HOME.nav.faq, id: "faq" },
          ].map((l) => (
            <button key={l.id} onClick={() => scrollToId(l.id)} className="inline-flex items-center justify-center min-h-11 min-w-11 px-1 rounded-md text-[14px] transition-colors focus-visible:outline-none gy-focus-ring-dark" style={{ color: F.boneMuted, fontFamily: SANS, fontWeight: 500 }}>
              {l.label}
            </button>
          ))}
        </div>

        {/* gy-1vd9qy.10.4 option A: Log in is a quiet text link next to the amber Start free pill. Both are real links into
            app.getgymbo.com, so there is no reveal panel in the nav any more. */}
        <div className="flex items-center gap-1.5">
          <LogInLink location="nav" dark />
          <StartFreeCTA position="nav" dark />
        </div>
      </nav>

      <main id="main">
        {/* ───────── hero ───────── */}
        {/* Competitor-scale device (gy-k2543.10): copy column verbatim; device stage
            breaks out of the 1180 box and bleeds to the right viewport edge on lg+,
            stacks below the copy on mobile/tablet. */}
        <HomeHero prefersReduced={prefersReduced} />

        {/* ───────── the four feature cards ───────── */}
        <section id="why" aria-label={HOME.why.label}>
          <div className="max-w-[1180px] mx-auto px-5 md:px-12 pt-2 pb-4 md:pb-6 flex flex-col gap-2 md:gap-4">
            {PILLARS.map((p, i) => {
              // gy-v9pwo.4 (pm 2026-09-28): log-payment's demo video/poster has the retired
              // "Get paid for every class you teach." claim burned into its pixels. Pulled
              // entirely (no crop, no overlay) until video re-renders it under gy-7zhx1.
              const hasDemo = p.art.kind !== "none" && p.demoId !== "log-payment";
              return (
                <div key={p.id} data-testid={`pillar-band-${p.id}`} className="gy-card">
                  {/* Her round 2: a big yellow numeral sits across the join between sections, with the same top-lit fade as GYMBO.
                      Merriweather is used for these numerals only. Half the numeral is above the card, half inside it. */}
                  <span data-testid={`pillar-numeral-${p.id}`} aria-hidden="true" className="gy-numeral">
                    {i + 1}
                  </span>
                  <div data-testid={`pillar-${p.id}`} className={`gy-card-body grid items-center gap-4 md:gap-10 rounded-[var(--g-radius-xl)] px-5 pb-6 md:px-10 md:pb-8 ${hasDemo ? "md:grid-cols-[minmax(0,1fr)_minmax(0,330px)]" : ""}`} style={{ background: FIGURE_SURFACE.dark, border: `1px solid ${CARD_LINE}` }}>
                    <Reveal>
                      <h2 className="text-[clamp(24px,3.2vw,36px)] font-black mb-3" style={{ fontFamily: SANS, letterSpacing: "-0.01em", lineHeight: 1.2, color: F.bone }}>
                        {p.title}
                      </h2>
                      <p className="text-[15px] md:text-[16px] mb-4" style={{ color: F.boneMuted, fontWeight: 400, lineHeight: 1.6, maxWidth: "52ch" }}>
                        {p.intro}
                      </p>
                      <ul className={`grid gap-3 ${hasDemo ? "" : "md:grid-cols-3 md:gap-6"}`}>
                        {p.bullets.map((b) => (
                          <li key={b} className="flex items-start gap-3">
                            <span className="grid place-items-center shrink-0 w-[22px] h-[22px] rounded-md mt-0.5" style={{ background: NEUTRAL_TILE, color: F.bone }}>
                              <Check size={13} strokeWidth={2.5} />
                            </span>
                            <span className="text-[14px] md:text-[15px]" style={{ color: F.bone, fontFamily: SANS, lineHeight: 1.5 }}>
                              {b}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </Reveal>

                    {hasDemo && (
                      <Reveal className="w-full max-w-[300px] md:max-w-[330px] mx-auto">
                        {p.art.kind === "screen" ? (
                          <ScreenshotFrame slug={p.art.slug} alt={`${p.title}: app screen`} screenWidth={300} style={{ width: "100%" }} />
                        ) : (
                          /* Interim crop: the demo scene is 1080 x 1920; the box shows x 190-890, y 262-1708 = the phone only (the title ends above y 262,
                             the caption starts at y 1725). Percent margins resolve against the box width. */
                          <div data-testid={`pillar-art-crop-${p.id}`} style={{ position: "relative", overflow: "hidden", aspectRatio: "700 / 1446", width: "100%" }}>
                            <div style={{ position: "absolute", width: "154.286%", left: "-27.143%", top: 0, marginTop: "-37.429%" }}>
                              <DemoFrame
                                demoId={p.demoId}
                                clip={demoClip(p.demoId)}
                                poster={demoPoster(p.demoId)}
                                theme="dark"
                                label={`${p.title}: demo`}
                                maxWidth={1080}
                              />
                            </div>
                          </div>
                        )}
                      </Reveal>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ───────── in-action gallery (current real-app screenshots, framed) ───────── */}
        <section data-testid="gallery-section" aria-label={HOME.gallery.label}>
          <div className="max-w-[1180px] mx-auto px-5 md:px-12 py-8 md:py-10">
            <Reveal className="text-center">
              {HOME.gallery.eyebrow ? <Eyebrow dark>{HOME.gallery.eyebrow}</Eyebrow> : null}
              <h2 className="text-[clamp(24px,3.2vw,36px)] font-black mx-auto" style={{ fontFamily: SANS, letterSpacing: "-0.01em", lineHeight: 1.2, color: F.bone }}>
                {HOME.gallery.heading}
              </h2>
              <p className="mt-2 text-[14px] mx-auto" style={{ color: F.boneMuted, fontFamily: SANS, maxWidth: "40ch" }}>
                {HOME.gallery.note}
              </p>
            </Reveal>

            <div ref={galleryRef} onScroll={syncGalleryPosition} className="carousel relative mt-5 flex gap-5 md:gap-8 overflow-x-auto snap-x snap-mandatory -mx-5 px-5 md:mx-0 md:px-0 pb-2" role="region" aria-label={HOME.gallery.region} aria-describedby="gallery-position">
              {SCREENS.map((s, index) => (
                <div key={s.slug} data-gallery-index={index} tabIndex={0} className="snap-center shrink-0 flex flex-col items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
                  {/* Her round 2: smaller screens on phone, iPad and laptop. */}
                  <ScreenshotFrame slug={s.slug} alt={s.alt} screenWidth={210} />
                  <p className="mt-3 text-center text-[13px] md:text-[14px]" style={{ color: F.boneMuted, fontFamily: SANS, lineHeight: 1.5, maxWidth: "22ch" }}>
                    {s.caption}
                  </p>
                </div>
              ))}
            </div>
            <p id="gallery-position" className="sr-only">{HOME.gallery.help(SCREENS.length)}</p>

            {/* Dots instead of "1 of 6". Each dot is a 44px button; the visible mark is small. */}
            <div className="mt-1 flex items-center justify-center" role="group" aria-label={HOME.gallery.controls}>
              {SCREENS.map((s, index) => {
                const current = index === galleryIndex;
                return (
                  <button key={s.slug} type="button" data-testid="gallery-dot" onClick={() => scrollGalleryTo(index)} aria-label={HOME.gallery.dot(index + 1, SCREENS.length, s.caption)} aria-current={current ? "true" : undefined} className="grid place-items-center w-11 h-11 rounded-full focus-visible:outline-none gy-focus-ring-dark">
                    <span aria-hidden="true" className="block h-2 rounded-full transition-all duration-150" style={{ width: current ? 20 : 8, background: current ? F.marigold : "var(--g-color-grey-icon-muted-dark)" }} />
                  </button>
                );
              })}
            </div>

            <Reveal className="mt-3 flex flex-col items-center">
              <StartFreeCTA dark size="lg" position="gallery" />
            </Reveal>
          </div>
        </section>

        {/* ───────── why we built gymbo + pricing, ONE section (her round 2) ───────── */}
        <section id="pricing" data-testid="pricing-section" aria-label={HOME.pricing.label}>
          <div className="max-w-[1180px] mx-auto px-5 md:px-12 py-8 md:py-10">
            <div data-testid="built-and-pricing" className="rounded-[var(--g-radius-xl)] px-5 py-6 md:px-10 md:py-8 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] gap-8 lg:gap-10 items-center" style={{ background: FIGURE_SURFACE.dark, border: `1px solid ${CARD_LINE}` }}>
              <Reveal>
                {HOME.built.eyebrow ? <Eyebrow dark>{HOME.built.eyebrow}</Eyebrow> : null}
                <h2 className="text-[clamp(24px,3.2vw,36px)] font-black" style={{ fontFamily: SANS, letterSpacing: "-0.01em", lineHeight: 1.2, color: F.bone }}>
                  {HOME.built.heading}
                </h2>
                <p className="mt-3 text-[15px]" style={{ color: F.boneMuted, fontFamily: SANS, maxWidth: "60ch" }}>
                  {HOME.built.body}
                </p>
              </Reveal>
              <div>
                <Reveal>
                  {HOME.pricing.eyebrow ? <Eyebrow dark>{HOME.pricing.eyebrow}</Eyebrow> : null}
                  <h3 className="text-[17px] md:text-[19px] font-bold" style={{ fontFamily: SANS, lineHeight: 1.3, color: F.bone }}>
                    {HOME.pricing.heading}
                  </h3>
                </Reveal>
                <div className="mt-4 grid sm:grid-cols-2 gap-4 items-stretch">
                  {PRICING.map((plan) => {
                    const hi = plan.highlight;
                    return (
                      <Reveal key={plan.name} className="flex">
                        <div className="flex flex-col w-full p-5 rounded-[var(--g-radius-lg)]" style={{ background: F.charcoalCard2, border: hi ? `2px solid ${F.marigold}` : `1px solid ${CARD_LINE}` }}>
                          <h4 className="text-[18px] font-bold" style={{ fontFamily: SANS, color: F.bone }}>{plan.name}</h4>
                          <div className="flex items-baseline gap-1.5 mt-1 mb-1">
                            <span className="text-[28px] font-bold" style={{ fontFamily: SANS, color: F.bone }}>₹{plan.price}</span>
                            {plan.period ? <span className="text-[12px]" style={{ letterSpacing: "0.04em", color: F.boneLabel, fontFamily: SANS }}>{plan.period}</span> : null}
                          </div>
                          <p className="text-[12px] mb-4" style={{ color: F.boneLabel, fontFamily: SANS }}>{plan.note}</p>
                          {/* gy-1vd9qy.10.4: both cards say Start free and go to the app's sign-up (mt-auto pins the button to the card bottom). */}
                          <a
                            {...signupCtaProps(plan.highlight ? "pricing-pro" : "pricing-free")}
                            className="mt-auto w-full inline-flex items-center justify-center h-12 rounded-full text-[14px] font-bold transition-transform duration-150 hover:-translate-y-px active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 gy-focus-ring-dark"
                            style={{ background: F.marigold, color: F.onCta, fontFamily: SANS }}
                          >
                            {START_FREE_LABEL}
                          </a>
                        </div>
                      </Reveal>
                    );
                  })}
                </div>
                <Reveal className="mt-3">
                  <p className="text-[13px]" style={{ color: F.boneLabel, fontFamily: SANS }}>{HOME.pricing.payment}</p>
                </Reveal>
              </div>
            </div>
          </div>
        </section>

        {/* ───────── faq (her round 2: less height; two columns from md) ───────── */}
        <section id="faq" aria-label={HOME.faq.label}>
          <div className="max-w-[1000px] mx-auto px-5 md:px-12 py-4 md:py-6">
            {HOME.faq.eyebrow || HOME.faq.heading ? (
              <Reveal className="text-center mb-4">
                {HOME.faq.eyebrow ? <Eyebrow dark>{HOME.faq.eyebrow}</Eyebrow> : null}
                {HOME.faq.heading ? (
                  <h2 className="text-[clamp(24px,3.2vw,36px)] font-black mx-auto" style={{ fontFamily: SANS, lineHeight: 1.2, color: F.bone }}>
                    {HOME.faq.heading}
                  </h2>
                ) : null}
              </Reveal>
            ) : null}
            <div className="grid md:grid-cols-2 md:gap-x-8 items-start">
              {FAQ.map((item) => (
                <Reveal key={item.q}>
                  <details className="faq" style={{ borderBottom: `1px solid ${CARD_LINE}` }}>
                    <summary className="flex items-center justify-between gap-4 py-2.5 min-h-12 rounded-md focus-visible:outline-none gy-focus-ring-dark">
                      <span className="text-[15px] font-bold" style={{ fontFamily: SANS, color: F.bone }}>{item.q}</span>
                      <span className="faq-plus shrink-0 grid place-items-center w-7 h-7 rounded-full transition-transform duration-200" style={{ background: NEUTRAL_TILE, color: F.bone }}>
                        <Plus size={15} strokeWidth={2.4} />
                      </span>
                    </summary>
                    <p className="pb-3 pr-10 text-[14px]" style={{ color: F.boneMuted, fontFamily: SANS, lineHeight: 1.6 }}>{item.a}</p>
                    {"waitlist" in item && item.waitlist ? (
                      // Secondary path (gy-1vd9qy.10.4): the iPhone-app email list stays reachable from this answer.
                      <InlineWaitlist className="pb-3" reducedMotion={prefersReduced}>
                        <WaitlistPlainButton location="cta-section" className="inline-flex items-center min-h-11 text-[14px] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 gy-focus-ring-dark" style={{ color: F.bone, fontFamily: SANS, fontWeight: 600 }}>
                          {HOME.faq.waitlist}
                        </WaitlistPlainButton>
                      </InlineWaitlist>
                    ) : null}
                  </details>
                </Reveal>
              ))}
            </div>
            <Reveal className="mt-2 text-center">
              <a href="/compare/gymbo-vs-wellnessz" className="inline-flex items-center min-h-11 text-[14px] font-semibold underline underline-offset-4 transition-opacity hover:opacity-80 rounded-md focus-visible:outline-none gy-focus-ring-dark" style={{ color: F.bone, fontFamily: SANS }}>
                {HOME.faq.compare} →
              </a>
            </Reveal>
          </div>
        </section>

        {/* ───────── final cta ───────── */}
        <section id="cta" data-testid="footer-cta-section" aria-label={HOME.closing.label}>
          <div className="max-w-[1180px] mx-auto px-5 md:px-12 py-8 md:py-10 flex flex-col items-center text-center">
            <Reveal>
              {HOME.closing.eyebrow ? <Eyebrow dark>{HOME.closing.eyebrow}</Eyebrow> : null}
              {/* Her round 2: ONE line on iPad and desktop. The size follows the width from 768 up. */}
              <h2 data-testid="closing-heading" className="text-[28px] md:text-[clamp(24px,3.2vw,40px)] md:whitespace-nowrap font-black" style={{ fontFamily: SANS, letterSpacing: "-0.01em", lineHeight: 1.2, color: F.bone }}>
                {HOME.closing.heading}
              </h2>
              <p className="mt-2 text-[15px] gy-text-balance" style={{ color: F.boneMuted, fontFamily: SANS }}>
                {HOME.closing.sub}
              </p>
            </Reveal>

            {/* Her round 2: the two buttons share one line from 640 up (iPad included). */}
            <Reveal className="mt-4 w-full flex flex-col sm:flex-row items-center justify-center gap-3">
              <StartFreeCTA dark size="lg" position="final" className="w-full sm:w-auto" />
              <WhatsAppButton location="cta-section">{HOME.closing.talk}</WhatsAppButton>
            </Reveal>
          </div>
        </section>
      </main>

      {/* ───────── footer ───────── */}
      <footer className="gy-clear-sticky-bar" style={{ borderTop: `1px solid ${CARD_LINE}` }}>
        <div className="max-w-[1100px] mx-auto px-5 md:px-12 py-6">
          <span className="block text-[13px] mb-4" style={{ color: F.boneMuted, fontFamily: SANS }}>
            <span className="font-bold" style={{ fontFamily: SANS, color: F.bone }}>{HOME.footer.name}</span> {HOME.footer.tagline}
          </span>
          {/* gm-1w6 slice 3 / gy-3mpvo designer ruling — the footer is the canonical way
              into the content estate: four labelled groups, no SEO links in the top nav,
              no in-page band. 2 cols below 1024 (2x2 from 640), 4 at >=1024. Research
              links the deep slug on purpose: /research/ has no index and 404s. */}
          <nav aria-label={HOME.footer.nav} className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
            {FOOTER_GROUPS.map((g) => (
              <div key={g.label}>
                <p id={`footer-${g.label.toLowerCase()}`} className="text-[12px] font-bold uppercase mb-2" style={{ color: F.boneLabel, fontFamily: SANS, letterSpacing: "0.09em" }}>{g.label}</p>
                <ul aria-labelledby={`footer-${g.label.toLowerCase()}`} className="list-none p-0 m-0">
                  {g.links.map((l) => (
                    <li key={l.label}>
                      <a href={l.href} className="flex items-center min-h-11 text-[13px] transition-colors rounded-md focus-visible:outline-none gy-focus-ring-dark" style={{ color: F.boneMuted, fontFamily: SANS }}>{l.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 mt-4 pt-3" style={{ borderTop: "1px solid rgba(240,240,235,0.05)" }}>
            {/* App Review guideline 1.5 (pm, 2026-09-18): the Support URL (getgymbo.com)
                must show a visible contact method. The address was already here; it is
                now LABELLED as support and anchored, so the footer "Support" link lands on
                it. scripts/prerender.mjs wraps <footer> in Cloudflare's email_off comments,
                because the zone's email obfuscation otherwise serves "[email protected]"
                to anything that reads the page without JavaScript (the audit did). */}
            <p id="support" className="text-[12px]" style={{ color: F.boneLabel, fontFamily: SANS }}>
              {`${HOME.footer.support} `}<a href="mailto:damini@materiallab.io" className="inline-flex items-center min-h-11 underline" style={{ color: F.boneMuted }}>damini@materiallab.io</a>
            </p>
            <div className="flex items-center gap-4">
              <a href="https://www.linkedin.com/company/material-lab-io" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center min-h-11 min-w-11 text-[12px]" style={{ color: F.boneLabel, fontFamily: SANS }}>LinkedIn</a>
              <a href={WHATSAPP_PLAIN} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center min-h-11 min-w-11 text-[12px]" style={{ color: F.boneLabel, fontFamily: SANS }}>WhatsApp</a>
              <span className="text-[11px]" style={{ color: F.boneLabel, fontFamily: SANS }}>{HOME.footer.copyright}</span>
            </div>
          </div>
          <p className="text-center">
            <a data-testid="made-by" href={HOME.footer.madeBy.href} target="_blank" rel="noopener" className="inline-flex items-center justify-center min-h-11 px-2 text-[13px] underline underline-offset-4 rounded-md focus-visible:outline-none gy-focus-ring-dark" style={{ color: F.boneMuted, fontFamily: SANS }}>
              {HOME.footer.madeBy.label}
            </a>
          </p>
        </div>
      </footer>

      {/* ───────── mobile sticky CTA ───────── */}
      <StickyCtaBar show={showStickyCTA && !barHiddenBySection} />
    </div>
    </WaitlistOverlayProvider>
  );
}

/**
 * gy-e9h9y N2 (designer ruling + pm scope OK, 29 Oct) — THE PHONE STICKY BAR IS THE WHATSAPP PRIMARY.
 *
 * The rule is per SCREEN: at most one filled amber CTA in any viewport, and on a page whose primary
 * conversion is WhatsApp the filled one is never the waitlist when a WhatsApp CTA can hold the spot.
 * This bar is on screen for the whole page past the hero, so a filled "Request access" here put the
 * waitlist on top of every phone screen except the first. It now carries the hero's WhatsApp link
 * (amber, full glyph, real <a target=_blank>, whatsapp_cta_click). The waitlist stays reachable
 * from the nav outline button, which reveals the capture panel.
 *
 * SAME show/hide as before (hidden while the hero pair is in view), PLUS hidden while the cta-section
 * is in view (it would duplicate that section's own WhatsApp link and cover its form) and while the
 * pricing section is in view (designer P1 on #316: the Monthly plan's filled button would be a second
 * filled CTA on the screen, and the amber bar loses its edge over the full-amber Annual card).
 *
 * It is no longer a capture surface, so the D1 machinery (in-place expansion, keyboard lift, the
 * "sticky" overlay owner) is gone from here. data-cta-location stays "footer": waitlist_cta_click
 * {footer} history ENDS at the deploy of this change; whatsapp_cta_click {footer} starts there.
 *
 * data-fixed-chrome="sticky-cta" is kept: tests/visual.spec.ts hides the fixed chrome by that hook,
 * and it is deliberately NOT a style class (see D1: a gate keyed on how a value is written cannot see
 * the same value written another way).
 */
function StickyCtaBar({ show }: { show: boolean }) {
  // gy-w77x3 B5: while the NAV panel is open the bar is not rendered at all. Returned after the hook,
  // so hook order never changes. It returns when the nav panel closes.
  const overlay = useWaitlistOverlayOwner();
  if (overlay?.open === "nav") return null;
  return (
    <div
      data-fixed-chrome="sticky-cta"
      className="md:hidden fixed left-0 right-0 bottom-0 z-50 px-4 pt-3 transition-transform duration-300"
      style={{
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
        background: PAGE_BLACK,
        borderTop: `1px solid ${CARD_LINE}`,
        transform: show ? "translateY(0)" : "translateY(120%)",
      }}
    >
      <WhatsAppCTA dark size="lg" className="w-full" location="footer">{HOME.footer.talk}</WhatsAppCTA>
    </div>
  );
}
