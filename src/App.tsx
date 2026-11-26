import { useEffect, useRef, useState } from "react";
import { HomeHero } from "./components/HomeHero";
import {
  Check,
  Plus,
  QrCode,
  Share2,
  FileText,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Type,
  FileSpreadsheet,
  MessageCircle,
  IdCard,
  AtSign,
  Globe,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { DemoFrame, ScreenshotFrame, type ClipMap } from "./components/PhoneMockup";
import { InlineWaitlist } from "./components/InlineWaitlist";
import { WaitlistOverlayProvider, useWaitlistOverlayOwner } from "./lib/waitlistOverlay";
import { useReducedMotion } from "./hooks/useReducedMotion";
import { F, SERIF, SANS, WHATSAPP_PLAIN, scrollToId, signupCtaProps, ForgeStyle, Eyebrow, WhatsAppCTA, WhatsAppButton, WaitlistPlainButton, darkIconButton, StartFreeCTA, LogInLink } from "./forge-ui";
import { FIGURE_SURFACE } from "./figure-surface";
import { PRICE_MONTHLY_INR, START_FREE_LABEL } from "./lib/trialAccess";
import { HOME } from "./content/home";

/* gm-1w6 slice 3 (gy-3mpvo designer ruling) — home footer link groups. Support anchors
   to the support contact (#support, App Review 1.5), never the waitlist form. */
const FOOTER_GROUPS = HOME.footer.groups;

/* ============================================================================
   getgymbo.com — Forge redesign (epic gy-9bmwm)
   Founder-reviewed build: sentence case site-wide, NO gradients (flat Forge
   beige/charcoal + solid amber accent). Brand = Forge amber #F59E0B / marigold
   #FBBF24, accent only. Hero and gallery use the approved licensed photoreal
   device compositions; all 4 pillars use the approved light/dark photoreal demo
   clips. Masters are the founder-approved curated set, optimized to WebP via
   scripts/optimize-gallery.mjs (gy-9bmwm.4, gy-dyu6r.9).
   ============================================================================ */

/* Design tokens (F, SHADOW, SERIF, SANS), the WhatsApp constants and button,
   scrollToId, and the shared presentational primitives now live in ./forge-ui
   (SSOT shared with the comparison pages). */

/* ── 4 pillars ── */
// gy-sk86p2.3 L3 (Damini 26 Nov): no orange icon highlight. Icon tiles are neutral: ink on a faint ink wash (light), bone on a faint bone wash (dark).
const NEUTRAL_TILE = { light: "rgba(26,26,26,0.06)", dark: "rgba(240,240,235,0.10)" } as const;
const PILLAR_LAYOUT = [
  { id: "revenue", demoId: "log-payment", dark: false },
  { id: "organized", demoId: "schedule", dark: true },
  { id: "brand", demoId: "branded-statement", dark: false },
  { id: "workouts", demoId: "build-workout", dark: false },
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
    card.scrollIntoView({ block: "nearest", inline: "center", behavior: "auto" });
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
    setGalleryIndex(closest);
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
    <div style={{ background: F.beige, color: F.ink, fontFamily: SANS, lineHeight: 1.5 }}>
      <ForgeStyle />

      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:px-4 focus:py-2 focus:rounded-lg" style={{ background: F.amber, color: F.onCta }}>
        {HOME.nav.skip}
      </a>

      {/* ───────── nav ───────── */}
      <nav
        aria-label="Main navigation"
        data-fixed-chrome="nav"
        className="sticky top-0 z-40 flex items-center justify-between px-5 md:px-12 py-4"
        style={{ background: "var(--c-nav-bg)", backdropFilter: "saturate(140%) blur(14px)", WebkitBackdropFilter: "saturate(140%) blur(14px)", borderBottom: "1px solid var(--c-line)" }}
      >
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center focus-visible:outline-none gy-focus-ring-light" aria-label={HOME.nav.backToTop}>
          <img
            src="/gymbo-mark-darkorange-9d3900.svg"
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
            <button key={l.id} onClick={() => scrollToId(l.id)} className="text-[14px] transition-colors" style={{ color: F.inkMuted, fontFamily: SANS, fontWeight: 500 }}>
              {l.label}
            </button>
          ))}
        </div>

        {/* gy-1vd9qy.10.4 option A: Log in is a quiet text link next to the amber Start free pill. Both are real links into
            app.getgymbo.com, so there is no reveal panel in the nav any more. */}
        <div className="flex items-center gap-1.5">
          <LogInLink location="nav" />
          <StartFreeCTA position="nav" />
        </div>
      </nav>

      <main id="main">
        {/* ───────── hero ───────── */}
        {/* Competitor-scale device (gy-k2543.10): copy column verbatim; device stage
            breaks out of the 1180 box and bleeds to the right viewport edge on lg+,
            stacks below the copy on mobile/tablet. */}
        <HomeHero prefersReduced={prefersReduced} />

        {/* ───────── why — 4 pillars ───────── */}
        <section id="why" aria-label={HOME.why.label}>
          <div className="max-w-[1180px] mx-auto px-5 md:px-12 pt-10 md:pt-14 pb-2 text-center">
            <Reveal>
              {HOME.why.eyebrow ? <Eyebrow>{HOME.why.eyebrow}</Eyebrow> : null}
              <h2 className="text-[clamp(28px,4vw,44px)] font-black mx-auto" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", lineHeight: 1.15, maxWidth: "18ch" }}>
                {HOME.why.heading}
              </h2>
            </Reveal>
          </div>

          {PILLARS.map((p, i) => {
            const dark = p.dark;
            // gy-v9pwo.4 (pm 2026-09-28): log-payment's demo video/poster has the retired
            // "Get paid for every class you teach." claim burned into its pixels. Pulled
            // entirely (no crop, no overlay) until video re-renders it under gy-7zhx1.
            const hasDemo = p.demoId !== "log-payment";
            return (
              <div key={p.id} data-testid={`pillar-band-${p.id}`} style={{ background: hasDemo ? (dark ? FIGURE_SURFACE.dark : FIGURE_SURFACE.light) : (dark ? F.charcoal : F.beige) }}>
                <div data-testid={`pillar-${p.id}`} className={`max-w-[1180px] mx-auto px-5 md:px-12 py-8 md:py-10 grid ${hasDemo ? "md:grid-cols-2" : "md:grid-cols-1"} items-center gap-6 md:gap-12 ${hasDemo && i % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""}`}>
                  <Reveal className={hasDemo ? undefined : "md:text-center md:mx-auto md:max-w-[640px]"}>
                    {p.eyebrow ? (
                      <span className="block text-[13px] font-bold mb-3" style={{ color: dark ? F.marigold : F.amberText, fontFamily: SANS, letterSpacing: "0.04em" }}>
                        {p.eyebrow}
                      </span>
                    ) : null}
                    <h3 className="text-[clamp(26px,3.4vw,40px)] font-black mb-4" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", lineHeight: 1.15, color: dark ? F.bone : F.ink }}>
                      {p.title}
                    </h3>
                    <p className="text-[15px] md:text-[16px] mb-6" style={{ color: dark ? F.boneMuted : F.inkMuted, fontWeight: 400, lineHeight: 1.6, maxWidth: "44ch" }}>
                      {p.intro}
                    </p>
                    <ul className="flex flex-col gap-3">
                      {p.bullets.map((b) => {
                        return (
                          <li key={b} className="flex items-start gap-3">
                            <span className="grid place-items-center shrink-0 w-[22px] h-[22px] rounded-md mt-0.5" style={{ background: dark ? NEUTRAL_TILE.dark : NEUTRAL_TILE.light, color: dark ? F.bone : F.ink }}>
                              <Check size={13} strokeWidth={2.5} />
                            </span>
                            <span className="text-[14px] md:text-[15px]" style={{ color: dark ? F.bone : F.ink, fontFamily: SANS, lineHeight: 1.5 }}>
                              {b}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </Reveal>

                  {hasDemo && (
                    <Reveal className="relative flex items-center justify-center" >
                      <div className="relative">
                        <DemoFrame
                          demoId={p.demoId}
                          clip={demoClip(p.demoId)}
                          poster={demoPoster(p.demoId)}
                          theme={dark ? "dark" : "light"}
                          label={`${p.title}: demo`}
                          maxWidth={360}
                        />
                      </div>
                    </Reveal>
                  )}
                </div>

                {p.id === "brand" && <BrandMarquee />}
              </div>
            );
          })}
        </section>

        {/* ───────── in-action gallery (current real-app screenshots, framed) ───────── */}
        <section data-testid="gallery-section" aria-label={HOME.gallery.label} style={{ background: F.charcoal }}>
          <div className="max-w-[1180px] mx-auto px-5 md:px-12 py-10 md:py-14">
            <Reveal className="text-center">
              {HOME.gallery.eyebrow ? <Eyebrow dark>{HOME.gallery.eyebrow}</Eyebrow> : null}
              <h2 className="text-[clamp(28px,4vw,44px)] font-black mx-auto" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", lineHeight: 1.15, color: F.bone, maxWidth: "16ch" }}>
                {HOME.gallery.heading}
              </h2>
              <p className="mt-4 text-[15px] mx-auto" style={{ color: F.boneMuted, fontFamily: SANS, maxWidth: "40ch" }}>
                {HOME.gallery.note}
              </p>
            </Reveal>

            <div className="mt-6 flex items-center justify-center gap-4" aria-label={HOME.gallery.controls}>
              <button
                type="button"
                onClick={() => scrollGalleryTo(galleryIndex - 1)}
                disabled={galleryIndex === 0}
                aria-label={HOME.gallery.prev}
                {...darkIconButton("h-10 w-10")}
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <p className="min-w-[5.5rem] text-center text-[13px] font-bold tabular-nums" style={{ color: F.boneMuted, fontFamily: SANS }} aria-live="polite">
                {galleryIndex + 1} {HOME.gallery.of} {SCREENS.length}
              </p>
              <button
                type="button"
                onClick={() => scrollGalleryTo(galleryIndex + 1)}
                disabled={galleryIndex === SCREENS.length - 1}
                aria-label={HOME.gallery.next}
                {...darkIconButton("h-10 w-10")}
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>

            <div ref={galleryRef} onScroll={syncGalleryPosition} className="carousel mt-6 flex gap-6 md:gap-10 overflow-x-auto snap-x snap-mandatory -mx-5 px-5 md:mx-0 md:px-0 pb-2" role="region" aria-label={HOME.gallery.region} aria-describedby="gallery-position">
              {SCREENS.map((s, index) => (
                <div key={s.slug} data-gallery-index={index} tabIndex={0} className="snap-center shrink-0 flex flex-col items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
                  <ScreenshotFrame slug={s.slug} alt={s.alt} screenWidth={360} />
                  <p className="mt-6 text-center text-[14px] md:text-[15px]" style={{ color: F.boneMuted, fontFamily: SANS, lineHeight: 1.5, maxWidth: "22ch" }}>
                    {s.caption}
                  </p>
                </div>
              ))}
            </div>
            <p id="gallery-position" className="sr-only">{HOME.gallery.help(SCREENS.length)}</p>

            <Reveal className="mt-6 flex flex-col items-center gap-3">
              <div className="flex flex-col items-center">
                <StartFreeCTA dark size="lg" position="gallery" />
              </div>
            </Reveal>
          </div>
        </section>

        {/* ───────── why we built gymbo (F5 dedup + F6 restructure) ───────── */}
        <section aria-label={HOME.built.label} style={{ background: F.beige }}>
          <div className="max-w-[1180px] mx-auto px-5 md:px-12 py-10 md:py-14">
            <Reveal className="text-center">
              {HOME.built.eyebrow ? <Eyebrow>{HOME.built.eyebrow}</Eyebrow> : null}
              <h2 className="text-[clamp(28px,4vw,44px)] font-black mx-auto" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", maxWidth: "22ch", lineHeight: 1.15 }}>
                {HOME.built.heading}
              </h2>
              <p className="mt-4 text-[16px] mx-auto" style={{ color: F.inkAnchor, fontFamily: SANS, maxWidth: "50ch" }}>
                {HOME.built.body}
              </p>
            </Reveal>
          </div>
        </section>

        {/* ───────── pricing ───────── */}
        <section id="pricing" data-testid="pricing-section" aria-label={HOME.pricing.label} style={{ background: F.charcoal }}>
          <div className="max-w-[1180px] mx-auto px-5 md:px-12 py-10 md:py-14">
            <Reveal className="text-center">
              {HOME.pricing.eyebrow ? <Eyebrow dark>{HOME.pricing.eyebrow}</Eyebrow> : null}
              <h2 className="text-[clamp(28px,4vw,44px)] font-black mx-auto" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", lineHeight: 1.15, color: F.bone, maxWidth: "24ch" }}>
                {HOME.pricing.heading}
              </h2>
            </Reveal>

            <div className="mt-8 grid md:grid-cols-2 gap-6 items-stretch max-w-[720px] mx-auto">
              {PRICING.map((plan) => {
                const hi = plan.highlight;
                return (
                  <Reveal key={plan.name} className="flex">
                    <div className="flex flex-col w-full p-[var(--g-space-6)] md:p-[var(--g-space-8)] rounded-[var(--g-radius-xl)]" style={{ background: F.charcoalCard, border: hi ? `2px solid ${F.marigold}` : "1px solid rgba(240,240,235,0.08)" }}>
                      <span className="inline-flex self-start text-[11px] font-bold px-3 py-1.5 rounded-md mb-5" style={{ letterSpacing: "0.04em", background: "rgba(240,240,235,0.06)", color: F.boneMuted, fontFamily: SANS }}>
                        {plan.tagline}
                      </span>
                      <h3 className="text-[clamp(30px,4vw,42px)] font-black mb-3" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", color: F.bone, lineHeight: 1.15 }}>{plan.name}</h3>
                      <div className="flex items-baseline gap-1.5 mb-1">
                        <span className="text-[30px] font-bold" style={{ fontFamily: SANS, color: F.bone }}>₹{plan.price}</span>
                        {plan.period ? <span className="text-[12px]" style={{ letterSpacing: "0.04em", color: F.boneLabel, fontFamily: SANS }}>{plan.period}</span> : null}
                      </div>
                      <p className="text-[12px] mb-5" style={{ color: F.boneLabel, fontFamily: SANS }}>{plan.note}</p>
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
            <Reveal className="text-center mt-5">
              <p className="text-[13px]" style={{ color: F.boneLabel, fontFamily: SANS }}>{HOME.pricing.payment}</p>
            </Reveal>
          </div>
        </section>

        {/* ───────── faq ───────── */}
        <section id="faq" aria-label={HOME.faq.label} style={{ background: F.beige }}>
          <div className="max-w-[800px] mx-auto px-5 md:px-12 py-10 md:py-14">
            {HOME.faq.eyebrow || HOME.faq.heading ? (
              <Reveal className="text-center mb-6">
                {HOME.faq.eyebrow ? <Eyebrow>{HOME.faq.eyebrow}</Eyebrow> : null}
                {HOME.faq.heading ? (
                  <h2 className="text-[clamp(28px,4vw,44px)] font-black mx-auto" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", lineHeight: 1.15, maxWidth: "16ch" }}>
                    {HOME.faq.heading}
                  </h2>
                ) : null}
              </Reveal>
            ) : null}
            <div className="flex flex-col">
              {FAQ.map((item) => (
                <Reveal key={item.q}>
                  <details className="faq py-1" style={{ borderBottom: "1px solid var(--c-line)" }}>
                    <summary className="flex items-center justify-between gap-4 py-5">
                      <span className="text-[16px] md:text-[18px] font-bold" style={{ fontFamily: SERIF, color: F.ink }}>{item.q}</span>
                      <span className="faq-plus shrink-0 grid place-items-center w-7 h-7 rounded-full transition-transform duration-200" style={{ background: NEUTRAL_TILE.light, color: F.ink }}>
                        <Plus size={15} strokeWidth={2.4} />
                      </span>
                    </summary>
                    <p className="pb-3 pr-10 text-[14px] md:text-[15px]" style={{ color: F.inkMuted, fontFamily: SANS, lineHeight: 1.6 }}>{item.a}</p>
                    {"waitlist" in item && item.waitlist ? (
                      // Secondary path (gy-1vd9qy.10.4): the iPhone-app email list stays reachable from this answer.
                      <InlineWaitlist className="pb-5" reducedMotion={prefersReduced}>
                        <WaitlistPlainButton location="cta-section" className="inline-flex items-center min-h-11 text-[14px] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 gy-focus-ring-light" style={{ color: F.amberText, fontFamily: SANS, fontWeight: 600 }}>
                          {HOME.faq.waitlist}
                        </WaitlistPlainButton>
                      </InlineWaitlist>
                    ) : <div className="pb-2" />}
                  </details>
                </Reveal>
              ))}
            </div>
            <Reveal className="mt-6 text-center">
              <a href="/compare/gymbo-vs-wellnessz" className="text-[14px] md:text-[15px] font-semibold underline underline-offset-4 transition-opacity hover:opacity-80" style={{ color: F.amberText, fontFamily: SANS }}>
                {HOME.faq.compare} →
              </a>
            </Reveal>
          </div>
        </section>

        {/* ───────── final cta ───────── */}
        <section id="cta" data-testid="footer-cta-section" aria-label={HOME.closing.label} style={{ background: F.charcoal }}>
          <div className="max-w-[640px] mx-auto px-5 md:px-12 py-10 md:py-14 flex flex-col items-center text-center">
            <Reveal>
              {HOME.closing.eyebrow ? <Eyebrow dark>{HOME.closing.eyebrow}</Eyebrow> : null}
              <h2 className="text-[clamp(30px,4.5vw,48px)] font-black mx-auto" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", lineHeight: 1.15, color: F.bone, maxWidth: "16ch" }}>
                {HOME.closing.heading}
              </h2>
              <p className="mt-4 text-[15px] gy-text-balance" style={{ color: F.boneMuted, fontFamily: SANS }}>
                {HOME.closing.sub}
              </p>
            </Reveal>

            <Reveal className="mt-6 w-full flex flex-col items-center gap-4">
              <StartFreeCTA dark size="lg" position="final" className="w-full sm:w-auto" />
              <WhatsAppButton location="cta-section">{HOME.closing.talk}</WhatsAppButton>
            </Reveal>

          </div>
        </section>
      </main>

      {/* ───────── footer ───────── */}
      <footer className="gy-clear-sticky-bar" style={{ background: F.charcoal, borderTop: "1px solid rgba(240,240,235,0.06)" }}>
        <div className="max-w-[1100px] mx-auto px-5 md:px-12 py-8">
          <span className="block text-[13px] mb-6" style={{ color: F.boneMuted, fontFamily: SANS }}>
            <span className="font-bold" style={{ fontFamily: SERIF, color: F.bone }}>{HOME.footer.name}</span> {HOME.footer.tagline}
          </span>
          {/* gm-1w6 slice 3 / gy-3mpvo designer ruling — the footer is the canonical way
              into the content estate: four labelled groups, no SEO links in the top nav,
              no in-page band. 2 cols below 1024 (2x2 from 640), 4 at >=1024. Research
              links the deep slug on purpose: /research/ has no index and 404s. */}
          <nav aria-label={HOME.footer.nav} className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-8">
            {FOOTER_GROUPS.map((g) => (
              <div key={g.label}>
                <p id={`footer-${g.label.toLowerCase()}`} className="text-[12px] font-bold uppercase mb-2" style={{ color: F.boneLabel, fontFamily: SANS, letterSpacing: "0.09em" }}>{g.label}</p>
                <ul aria-labelledby={`footer-${g.label.toLowerCase()}`} className="list-none p-0 m-0">
                  {g.links.map((l) => (
                    <li key={l.label}>
                      <a href={l.href} className="flex items-center min-h-11 text-[13px] transition-colors" style={{ color: F.boneMuted, fontFamily: SANS }}>{l.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 mt-8 pt-4" style={{ borderTop: "1px solid rgba(240,240,235,0.05)" }}>
            {/* App Review guideline 1.5 (pm, 2026-09-18): the Support URL (getgymbo.com)
                must show a visible contact method. The address was already here; it is
                now LABELLED as support and anchored, so the footer "Support" link lands on
                it. scripts/prerender.mjs wraps <footer> in Cloudflare's email_off comments,
                because the zone's email obfuscation otherwise serves "[email protected]"
                to anything that reads the page without JavaScript (the audit did). */}
            <p id="support" className="text-[12px]" style={{ color: F.boneLabel, fontFamily: SANS }}>
              {HOME.footer.support} <a href="mailto:damini@materiallab.io" className="inline-flex items-center min-h-11 underline" style={{ color: F.boneMuted }}>damini@materiallab.io</a>
            </p>
            <div className="flex items-center gap-4">
              <a href="https://www.linkedin.com/company/material-lab-io" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center min-h-11 min-w-11 text-[12px]" style={{ color: F.boneLabel, fontFamily: SANS }}>LinkedIn</a>
              <a href={WHATSAPP_PLAIN} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center min-h-11 min-w-11 text-[12px]" style={{ color: F.boneLabel, fontFamily: SANS }}>WhatsApp</a>
              <span className="text-[11px]" style={{ color: F.boneLabel, fontFamily: SANS }}>{HOME.footer.copyright}</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ───────── mobile sticky CTA ───────── */}
      <StickyCtaBar show={showStickyCTA && !barHiddenBySection} />
    </div>
    </WaitlistOverlayProvider>
  );
}

/* ── brand-touchpoint marquee (under the "Your brand" pillar, F2 gy-wh9li.2) ──
   Kaushik (round 7): "Your brand everywhere" is a subset of "Look
   professional" — no standalone section, just "a little marquee ... that
   talks about all the brand touch points". Replaces the old two-grid
   BrandTouchpoints block. Designer spec (2026-08-14): compact chips, single
   continuous auto-scroll, label-free (gy-slagn — no shipped/forthcoming
   split), pause on hover + keyboard focus, static wrapped row under
   prefers-reduced-motion.

   Chip list is the source-verified touchpoints (marketer, gy-mdqxp
   2026-08-13) — shortened to scannable labels, tangible/shipped ones
   leading. 'Booking link' and 'Fitness reports' were REMOVED 2026-09-26
   (pm ruling on gy-l6dsr): not built, so they must not sit in a strip
   readers take as shipped. They return only with product proof of shipped
   status (a screenshot on a released build). */
const CHIP_ICONS: Record<string, LucideIcon> = { pdf: FileText, logo: ImageIcon, brandname: Type, share: Share2, csv: FileSpreadsheet, qr: QrCode, whatsapp: MessageCircle, card: IdCard, social: AtSign, website: Globe, bio: UserRound };
const MARQUEE_CHIPS: { name: string; icon: LucideIcon }[] = HOME.brandStrip.chips.map((c) => ({ name: c.name, icon: CHIP_ICONS[c.icon] }));

/* The track scrolls by -50%, so each HALF must be at least as wide as the widest screen or an empty band shows at the end of the loop
   (gy-1vd9qy.10.2: 6 chips left ~325px empty at 1440, 4 chips ~670px). Two identical halves of MARQUEE_HALF_COPIES copies each: the half is
   ~770px at 4 chips, so 3 copies (~2.3k px) fill up to 2300px wide. tests/marquee-fill.spec.ts measures it. */
const MARQUEE_HALF_COPIES = MARQUEE_CHIPS.length >= 8 ? 2 : 3; // 11 chips (strings-v2): one copy is ~2.1k px, two fill a 2300 px screen
const MARQUEE_TRACK = Array.from({ length: MARQUEE_HALF_COPIES * 2 }, () => MARQUEE_CHIPS).flat();

function BrandMarquee() {
  const prefersReduced = useReducedMotion();
  return (
    <div style={{ background: F.charcoal }}>
      <div className="pt-6 md:pt-8 pb-8 md:pb-10">
        {HOME.brandStrip.label ? (
          <span className="block text-center text-[13px] font-bold mb-4" style={{ color: F.marigold, fontFamily: SANS, letterSpacing: "0.04em" }}>
            {HOME.brandStrip.label}
          </span>
        ) : null}
        {prefersReduced ? (
          <div role="region" aria-label={HOME.brandStrip.region} className="mx-auto flex flex-wrap justify-center gap-2 max-w-[820px] px-5">
            {MARQUEE_CHIPS.map((c) => (
              <MarqueeChip key={c.name} t={c} />
            ))}
          </div>
        ) : (
          <div
            role="region"
            aria-label={HOME.brandStrip.region}
            tabIndex={0}
            className="marquee-mask relative overflow-hidden"
          >
            <div className="marquee-track flex gap-2 w-max">
              {MARQUEE_TRACK.map((c, i) => (
                <MarqueeChip key={`${c.name}-${i}`} t={c} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* One brand-touchpoint chip — compact, icon + name only (no description),
   same gradient-border card treatment as the rest of the site's chips. */
function MarqueeChip({ t }: { t: { name: string; icon: LucideIcon } }) {
  return (
    <span
      className="shrink-0 flex items-center gap-2 rounded-[var(--g-radius-lg)] pl-2.5 pr-4 h-11"
      style={{
        border: "1px solid transparent",
        backgroundImage: `linear-gradient(${F.charcoalCard}, ${F.charcoalCard}), linear-gradient(155deg, rgba(240,240,235,0.14), rgba(240,240,235,0.02) 45%, rgba(240,240,235,0.06))`,
        backgroundOrigin: "border-box",
        backgroundClip: "padding-box, border-box",
      }}
    >
      <span aria-hidden="true" className="grid place-items-center shrink-0 w-[26px] h-[26px] rounded-md" style={{ background: NEUTRAL_TILE.dark, color: F.bone }}>
        <t.icon size={14} strokeWidth={2} />
      </span>
      <span className="text-[13px] md:text-[14px] font-bold whitespace-nowrap" style={{ fontFamily: SANS, color: F.bone }}>{t.name}</span>
    </span>
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
        background: "var(--c-nav-bg)",
        backdropFilter: "saturate(140%) blur(12px)",
        WebkitBackdropFilter: "saturate(140%) blur(12px)",
        borderTop: "1px solid var(--c-line)",
        transform: show ? "translateY(0)" : "translateY(120%)",
      }}
    >
      <WhatsAppCTA size="lg" className="w-full" location="footer">{HOME.footer.talk}</WhatsAppCTA>
    </div>
  );
}
