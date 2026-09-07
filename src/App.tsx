import { useEffect, useRef, useState } from "react";
import {
  Check,
  Plus,
  QrCode,
  Share2,
  FileText,
  Palette,
  Link,
  CalendarCheck,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { DemoFrame, ScreenshotFrame, type ClipMap } from "./components/PhoneMockup";
import { WaitlistForm } from "./components/WaitlistForm";
import { useReducedMotion } from "./hooks/useReducedMotion";
import { F, SHADOW, SERIF, SANS, WHATSAPP, scrollToId, ForgeStyle, Eyebrow, PrimaryCTA, SecondaryButton } from "./forge-ui";

/* ============================================================================
   getgymbo.com — Forge redesign (epic gy-9bmwm)
   Founder-reviewed build: sentence case site-wide, NO gradients (flat Forge
   beige/charcoal + solid amber accent). Brand = Forge amber #F59E0B / marigold
   #FBBF24, accent only. Hero and gallery use the approved licensed photoreal
   device compositions; all 4 pillars use the approved light/dark photoreal demo
   clips. Masters are the founder-approved curated set, optimized to WebP via
   scripts/optimize-gallery.mjs (gy-9bmwm.4, gy-dyu6r.9).
   ============================================================================ */

/* Design tokens (F, SHADOW, SERIF, SANS), WHATSAPP, scrollToId, and the shared
   presentational primitives now live in ./forge-ui (SSOT shared with the
   comparison pages). */

/* ── 4 pillars ── */
const PILLARS = [
  {
    id: "revenue",
    demoId: "log-payment",
    n: "01",
    eyebrow: "The Gymbo ledger",
    title: "Track your revenue",
    intro: "The Gymbo ledger tracks every class, payment, and balance automatically, so you always know where every client stands.",
    bullets: [
      "Every balance, clear: credit and classes left, always current",
      "Get paid for every class you teach",
      "Cash or UPI logged. Nothing slips.",
    ],
    brief: "Log a payment: UPI or cash, and the balance clears.",
    dark: false,
  },
  {
    id: "organized",
    demoId: "schedule",
    n: "02",
    eyebrow: "Your whole roster",
    title: "Get organized",
    intro: "Less busywork, more training. Every client, schedule, and class in one place, not in your head.",
    bullets: [
      "One-tap punch to log a class",
      "Recurring time slots, sorted by day",
      "No more paper register or notes app",
      "Account for travel distance between clients on the calendar, so you can optimize your day",
    ],
    brief: "Your week, classes morning to evening: Ravi, Sara, group, Imran.",
    dark: true,
  },
  {
    id: "brand",
    demoId: "branded-statement",
    n: "03",
    eyebrow: "Look professional",
    title: "Your brand, your business",
    intro: "Look like the professional you already are. Your name and details on every statement your client sees, plus a QR profile card you can share anywhere.",
    bullets: [
      "Branded PDF statements: your name, tagline, and details on each one",
      "A shareable QR profile card in three styles",
      "Send any client their statement with a single tap",
    ],
    brief: "Your brand on a clean statement PDF. Share in a tap (India).",
    dark: false,
  },
  {
    id: "workouts",
    demoId: "build-workout",
    n: "04",
    eyebrow: "Coaching tools",
    title: "Train smarter",
    intro: "Build workouts, assign them to clients, and track real progress: adherence and per-exercise gains. And Ask Gymbo, an AI chat assistant grounded in your real client and payment data, answers 'who owes me?' or 'who's due this week?' in a tap.",
    bullets: [
      "Build and assign workouts from a template library",
      "A muscle and body map for every plan",
      "Track client progress: logged sessions, adherence, per-exercise gains",
      "Get directions to your next class, right from the app",
    ],
    brief: "Build a plan (squat, bench, row) and assign it to a client.",
    dark: false,
  },
];

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
const SCREENS: { slug: string; caption: string; alt: string }[] = [
  { slug: "dashboard", caption: "Every client, at a glance", alt: "Gymbo home screen showing a client's punch card: Aadesh, 3 of 10 classes used" },
  { slug: "schedule", caption: "Your week, one tap to log", alt: "Gymbo schedule for Wednesday with classes booked at 8 and 10 in the morning" },
  { slug: "payments", caption: "Every class and payment, tracked", alt: "Gymbo class history showing ₹45,663 in payments logged for June" },
  { slug: "workouts", caption: "Build and assign workouts", alt: "A full-body strength workout template in Gymbo with squat, bench press and barbell row" },
  { slug: "ai", caption: "Ask Gymbo anything", alt: "Gymbo's built-in AI assistant, ready to answer questions about your training business" },
  { slug: "export", caption: "Branded statements in a tap", alt: "Exporting a branded client statement as a PDF or CSV in Gymbo" },
];

/* ── pricing ── */
const PRICING = [
  { name: "Monthly", tagline: "Flexible", price: "399", period: "/month", note: "Billed monthly via the App Store. Cancel anytime.", features: ["Unlimited clients", "The Gymbo ledger", "Workout builder", "Ask Gymbo AI", "Branded invoicing"], highlight: false },
  { name: "Annual", tagline: "Save 37%", price: "250", period: "/month", note: "Billed yearly at ₹2,999 via the App Store. Save 37%.", features: ["Everything in Monthly", "37% savings", "Lowest price, locked in"], highlight: true },
];

/* ── FAQ ── */
const FAQ = [
  { q: "Is it free?", a: "Your first 7 days are free on every plan. After that, Gymbo Pro is ₹399/month, or ₹250/month effective on the annual plan, billed through the App Store." },
  { q: "Do my clients need to download anything?", a: "No. Gymbo is for you, the trainer. Your clients just train. You log it." },
  { q: "Does it work offline?", a: "Yes. Log classes and payments without signal; everything syncs when you're back online." },
  { q: "Is my client data private?", a: "Your client data is yours. You can export it anytime, and we never contact your clients." },
  { q: "Which phones does it support?", a: "iPhone, for now. That's where we're focused." },
  { q: "How do payments work?", a: "You record cash or UPI payments yourself. Gymbo keeps the running balance. It doesn't touch your money." },
  { q: "Can I import my existing clients?", a: "Yes. Bring your current roster over in minutes and pick up where you left off." },
];

/* ============================================================================
   building blocks
   ============================================================================ */

function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`reveal-on-scroll ${className}`}>{children}</div>;
}

/* ============================================================================
   page
   ============================================================================ */

const HERO_SRCSET = "/mockups/hero-three-panel-800.webp 800w, /mockups/hero-three-panel-1200.webp 1200w, /mockups/hero-three-panel-1800.webp 1800w";
function HeroDeviceArt({ alt = "", priority = false }: { alt?: string; priority?: boolean }) {
  return <div data-testid="hero-device-art" style={{ aspectRatio: "4800 / 3236", lineHeight: 0 }}><picture><source type="image/webp" srcSet={HERO_SRCSET} sizes="(min-width: 1024px) min(46vw, 720px), min(92vw, 560px)" /><img src="/mockups/hero-three-panel-1200.png" alt={alt} aria-hidden={alt ? undefined : true} decoding="async" {...(priority ? { fetchpriority: "high" as const } : {})} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} /></picture></div>;
}

export default function App() {
  const prefersReduced = useReducedMotion();
  const [showStickyCTA, setShowStickyCTA] = useState(false);
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
    const onScroll = () => setShowStickyCTA(window.scrollY > window.innerHeight * 0.8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div style={{ background: F.beige, color: F.ink, fontFamily: SANS, lineHeight: 1.5 }}>
      <ForgeStyle />

      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:px-4 focus:py-2 focus:rounded-lg" style={{ background: F.amber, color: F.onCta }}>
        Skip to content
      </a>

      {/* ───────── nav ───────── */}
      <nav
        aria-label="Main navigation"
        className="sticky top-0 z-40 flex items-center justify-between px-5 md:px-12 py-4"
        style={{ background: "var(--c-nav-bg)", backdropFilter: "saturate(140%) blur(14px)", WebkitBackdropFilter: "saturate(140%) blur(14px)", borderBottom: "1px solid var(--c-line)" }}
      >
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center focus-visible:outline-none" aria-label="Gymbo, back to top">
          <img
            src="/gymbo-mark-darkorange-9d3900.svg"
            alt=""
            className="h-[38px] w-[38px]"
          />
        </button>

        <div className="hidden md:flex items-center gap-8">
          {[
            { label: "Why Gymbo", id: "why" },
            { label: "Pricing", id: "pricing" },
            { label: "FAQ", id: "faq" },
          ].map((l) => (
            <button key={l.id} onClick={() => scrollToId(l.id)} className="text-[14px] transition-colors" style={{ color: F.inkMuted, fontFamily: SANS, fontWeight: 500 }}>
              {l.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2.5">
          <button onClick={() => scrollToId("cta")} className="inline-flex items-center h-11 px-5 rounded-full text-[13px] font-bold transition-transform duration-150 hover:-translate-y-px active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2" style={{ background: F.amber, color: F.onCta, fontFamily: SANS, boxShadow: SHADOW.cta }}>
            Get Gymbo
          </button>
        </div>
      </nav>

      <main id="main">
        {/* ───────── hero ───────── */}
        {/* Competitor-scale device (gy-k2543.10): copy column verbatim; device stage
            breaks out of the 1180 box and bleeds to the right viewport edge on lg+,
            stacks below the copy on mobile/tablet. */}
        <header data-testid="hero-section" className="relative overflow-hidden" style={{ background: F.beige }}>
          {/* desktop device stage — absolute to the section, bleeds past 1180 off the right
              edge. The three-panel mockup is a single flat landscape image (not stacked
              portrait phones), so it's vertically centered rather than stretched the full
              header height. Floating "class logged" / "paid" chips removed (gy-dfl55.1 —
              tags read as nonsense at this distance from the screens). */}
          {/* gy-k095b: the stage used to bleed flush to the right viewport edge
              (gy-k2543.10) — correct for the old landscape raster, which had its
              own margin baked in and read as art running off the page. Three
              discrete screen cards bleeding off the edge instead read as a
              clipping BUG: the third card loses its right corner radius and its
              shadow. Inset so all three cards sit whole. */}
          <div aria-hidden="true" className={`hidden lg:block absolute right-0 top-1/2 -translate-y-1/2 z-[1] ${prefersReduced ? "" : "hero-fade d6"}`} style={{ width: "min(46vw, 720px)" }}>
            <HeroDeviceArt priority />
          </div>

          <div className="relative z-[2] max-w-[1180px] mx-auto px-5 md:px-12 pt-10 md:pt-16 pb-16 md:pb-24">
            <div className="max-w-[600px] lg:w-[46%]">
              <div className={prefersReduced ? "" : "hero-rise d1"}>
                <Eyebrow>In beta</Eyebrow>
              </div>
              <h1 className={`text-[clamp(34px,5.4vw,62px)] font-black ${prefersReduced ? "" : "hero-rise d2"}`} style={{ fontFamily: SERIF, lineHeight: 1.08, letterSpacing: "-0.022em" }}>
                Run your entire{" "}
                <span className="relative whitespace-nowrap" style={{ color: F.amberText }}>
                  <span aria-hidden="true" className="absolute rounded-lg" style={{ inset: "-0.04em -0.14em", background: "rgba(245,158,11,0.18)", zIndex: -1 }} />
                  fitness business
                </span>{" "}
                from your phone.
              </h1>
              <p className={`mt-6 text-[clamp(15px,1.6vw,18px)] ${prefersReduced ? "" : "hero-rise d3"}`} style={{ color: F.inkMuted, fontWeight: 400, lineHeight: 1.6, maxWidth: "46ch" }}>
                <b style={{ color: F.ink, fontWeight: 400 }}>Track revenue, stay organized, look professional, train smarter</b>. Built for independent trainers like you in India.
              </p>
              <div className={`mt-8 flex flex-col sm:flex-row sm:items-center gap-3.5 ${prefersReduced ? "" : "hero-rise d4"}`}>
                <PrimaryCTA size="lg" />
                <SecondaryButton>Talk to us</SecondaryButton>
              </div>
              {/* Mobile/tablet keeps the approved three-phone composition below
                  the copy, scaled as one coherent image so its screens and device
                  silhouettes remain legible without clipping. */}
              <div className={`lg:hidden mt-12 flex justify-center ${prefersReduced ? "" : "hero-fade d6"}`} style={{ width: "min(92vw, 560px)" }}>
                <HeroDeviceArt alt="Gymbo dashboard, balances, and payment logging shown across three phones." priority />
              </div>
            </div>
          </div>
        </header>

        {/* ───────── why — 4 pillars ───────── */}
        <section id="why" aria-label="Why trainers use Gymbo">
          <div className="max-w-[1180px] mx-auto px-5 md:px-12 pt-16 md:pt-24 pb-4 text-center">
            <Reveal>
              <Eyebrow>Why trainers use Gymbo</Eyebrow>
              <h2 className="text-[clamp(28px,4vw,44px)] font-black mx-auto" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", lineHeight: 1.15, maxWidth: "18ch" }}>
                Everything your training business needs to run.
              </h2>
            </Reveal>
          </div>

          {PILLARS.map((p, i) => {
            const dark = p.dark;
            return (
              <div key={p.id} style={{ background: dark ? F.charcoal : F.beige }}>
                <div data-testid={`pillar-${p.id}`} className={`max-w-[1180px] mx-auto px-5 md:px-12 py-12 md:py-16 grid md:grid-cols-2 items-center gap-10 md:gap-16 ${i % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""}`}>
                  <Reveal>
                    <span className="block text-[13px] font-bold mb-3" style={{ color: dark ? F.marigold : F.amberText, fontFamily: SANS, letterSpacing: "0.04em" }}>
                      {p.n} · {p.eyebrow}
                    </span>
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
                            <span className="grid place-items-center shrink-0 w-[22px] h-[22px] rounded-md mt-0.5" style={{ background: dark ? "rgba(251,191,36,0.14)" : "rgba(245,158,11,0.14)", color: dark ? F.marigold : F.amberText }}>
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

                  <Reveal className="relative flex items-center justify-center" >
                    <div className="relative">
                      <DemoFrame
                        demoId={p.demoId}
                        clip={demoClip(p.demoId)}
                        poster={demoPoster(p.demoId)}
                        theme={dark ? "dark" : "light"}
                        label={`${p.title} — demo`}
                        maxWidth={360}
                      />
                    </div>
                  </Reveal>
                </div>

                {p.id === "brand" && <BrandMarquee />}
              </div>
            );
          })}
        </section>

        {/* ───────── in-action gallery (current real-app screenshots, framed) ───────── */}
        <section data-testid="gallery-section" aria-label="See Gymbo in action" style={{ background: F.charcoal }}>
          <div className="max-w-[1180px] mx-auto px-5 md:px-12 py-16 md:py-24">
            <Reveal className="text-center">
              <Eyebrow dark>A closer look</Eyebrow>
              <h2 className="text-[clamp(28px,4vw,44px)] font-black mx-auto" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", lineHeight: 1.15, color: F.bone, maxWidth: "16ch" }}>
                See Gymbo in action.
              </h2>
            </Reveal>

            <div className="mt-10 flex items-center justify-center gap-4" aria-label="Gallery controls">
              <button
                type="button"
                onClick={() => scrollGalleryTo(galleryIndex - 1)}
                disabled={galleryIndex === 0}
                aria-label="Show previous Gymbo screen"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full transition-transform hover:-translate-y-px active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--g-color-neutral-dark-0)]"
                style={{ background: F.charcoalCard2, border: "1px solid rgba(240,240,235,0.22)", color: F.bone, boxShadow: SHADOW.elevation1 }}
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <p className="min-w-[5.5rem] text-center text-[13px] font-bold tabular-nums" style={{ color: F.boneMuted, fontFamily: SANS }} aria-live="polite">
                {galleryIndex + 1} of {SCREENS.length}
              </p>
              <button
                type="button"
                onClick={() => scrollGalleryTo(galleryIndex + 1)}
                disabled={galleryIndex === SCREENS.length - 1}
                aria-label="Show next Gymbo screen"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full transition-transform hover:-translate-y-px active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--g-color-neutral-dark-0)]"
                style={{ background: F.charcoalCard2, border: "1px solid rgba(240,240,235,0.22)", color: F.bone, boxShadow: SHADOW.elevation1 }}
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>

            <div ref={galleryRef} onScroll={syncGalleryPosition} className="carousel mt-6 flex gap-6 md:gap-10 overflow-x-auto snap-x snap-mandatory -mx-5 px-5 md:mx-0 md:px-0 pb-2" role="region" aria-label="See Gymbo in action gallery" aria-describedby="gallery-position">
              {SCREENS.map((s, index) => (
                <div key={s.slug} data-gallery-index={index} tabIndex={0} className="snap-center shrink-0 flex flex-col items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
                  <ScreenshotFrame slug={s.slug} alt={s.alt} screenWidth={360} />
                  <p className="mt-6 text-center text-[14px] md:text-[15px]" style={{ color: F.boneMuted, fontFamily: SANS, lineHeight: 1.5, maxWidth: "22ch" }}>
                    {s.caption}
                  </p>
                </div>
              ))}
            </div>
            <p id="gallery-position" className="sr-only">Use the previous and next buttons, arrow keys, or horizontal swipe to browse all {SCREENS.length} Gymbo screens.</p>

            <Reveal className="mt-12 flex flex-col items-center gap-3">
              <PrimaryCTA dark size="lg" />
            </Reveal>
          </div>
        </section>

        {/* ───────── why we built gymbo (F5 dedup + F6 restructure) ───────── */}
        <section aria-label="Why we built Gymbo" style={{ background: F.beige }}>
          <div className="max-w-[1180px] mx-auto px-5 md:px-12 py-16 md:py-24">
            <Reveal className="text-center">
              <Eyebrow>Why we built Gymbo</Eyebrow>
              <h2 className="text-[clamp(28px,4vw,44px)] font-black mx-auto" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", maxWidth: "22ch", lineHeight: 1.15 }}>
                Built in India for Indian trainers
              </h2>
              <p className="mt-4 text-[16px] mx-auto" style={{ color: F.inkAnchor, fontFamily: SANS, maxWidth: "50ch" }}>
                Most independent trainers in India run their business through WhatsApp threads, paper registers, and mental math. Payments get missed, schedules live in someone's head, and looking professional means building your own invoices from scratch. We built Gymbo to replace all of that: one app that tracks every class and payment, keeps your schedule straight, and makes you look like the business you already are. Your client list stays yours too: we never contact them directly.
              </p>
            </Reveal>

            {/* testimonial */}
            <Reveal className="mt-12 mx-auto max-w-[720px]">
              <figure className="flex flex-col text-center p-[var(--g-space-6)] md:p-[var(--g-space-8)] rounded-[var(--g-radius-xl)]" style={{ background: F.beigeCard, boxShadow: SHADOW.card }}>
                <blockquote className="text-[15px] md:text-[17px] italic" style={{ fontFamily: SERIF, lineHeight: 1.75, color: F.ink }}>
                  “I used to run everything through WhatsApp and a notebook. Lost track of classes, payments, forgot who owed what. With Gymbo, I open the app, log the session, and move on.”
                </blockquote>
                <figcaption className="flex flex-col items-center gap-3 mt-6 pt-5" style={{ borderTop: "1px solid var(--c-line)" }}>
                  <span className="grid place-items-center w-11 h-11 rounded-full text-[15px] font-bold" style={{ background: "rgba(245,158,11,0.15)", color: F.amberText, fontFamily: SANS }}>S</span>
                  <span className="flex flex-col items-center">
                    <span className="text-[14px] font-bold" style={{ color: F.ink, fontFamily: SANS }}>Sarfaraz</span>
                    <span className="text-[12px]" style={{ color: F.inkLabel, fontFamily: SANS }}>Fitness trainer · Bangalore</span>
                  </span>
                </figcaption>
              </figure>
              <p className="mt-4 text-center text-[14px]" style={{ color: F.inkLabel, fontFamily: SANS }}>More trainers across India are coming on board.</p>
            </Reveal>
          </div>
        </section>

        {/* ───────── pricing ───────── */}
        <section id="pricing" data-testid="pricing-section" aria-label="Pricing" style={{ background: F.charcoal }}>
          <div className="max-w-[1180px] mx-auto px-5 md:px-12 py-16 md:py-24">
            <Reveal className="text-center">
              <Eyebrow dark>Pricing</Eyebrow>
              <h2 className="text-[clamp(28px,4vw,44px)] font-black mx-auto" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", lineHeight: 1.15, color: F.bone, maxWidth: "20ch" }}>
                Less than one missed session.
              </h2>
            </Reveal>

            <div className="mt-12 grid md:grid-cols-2 gap-6 items-stretch max-w-[720px] mx-auto">
              {PRICING.map((plan) => {
                const hi = plan.highlight;
                return (
                  <Reveal key={plan.name} className="flex">
                    <div className="flex flex-col w-full p-[var(--g-space-6)] md:p-[var(--g-space-8)] rounded-[var(--g-radius-xl)]" style={{ background: hi ? F.marigold : F.charcoalCard, border: hi ? "none" : "1px solid rgba(240,240,235,0.08)" }}>
                      <span className="inline-flex self-start text-[11px] font-bold px-3 py-1.5 rounded-md mb-5" style={{ letterSpacing: "0.04em", background: hi ? "rgba(26,26,26,0.14)" : "rgba(240,240,235,0.06)", color: hi ? "rgba(26,26,26,0.75)" : F.boneMuted, fontFamily: SANS }}>
                        {plan.tagline}
                      </span>
                      <h3 className="text-[clamp(30px,4vw,42px)] font-black mb-3" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", color: hi ? F.onCta : F.bone, lineHeight: 1.15 }}>{plan.name}</h3>
                      <div className="flex items-baseline gap-1.5 mb-1">
                        <span className="text-[30px] font-bold" style={{ fontFamily: SANS, color: hi ? F.onCta : F.bone }}>₹{plan.price}</span>
                        <span className="text-[12px]" style={{ letterSpacing: "0.04em", color: hi ? "rgba(26,26,26,0.55)" : F.boneLabel, fontFamily: SANS }}>{plan.period}</span>
                      </div>
                      <p className="text-[12px] mb-5" style={{ color: hi ? "rgba(26,26,26,0.6)" : F.boneLabel, fontFamily: SANS }}>{plan.note}</p>
                      <div className="h-px mb-5" style={{ background: hi ? "rgba(26,26,26,0.12)" : "rgba(240,240,235,0.08)" }} />
                      <ul className="flex flex-col gap-3 mb-7">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-center gap-2.5">
                            <span className="grid place-items-center shrink-0 w-[20px] h-[20px] rounded-md" style={{ background: hi ? "rgba(26,26,26,0.12)" : "rgba(251,191,36,0.14)", color: hi ? F.onCta : F.marigold }}>
                              <Check size={12} strokeWidth={2.5} />
                            </span>
                            <span className="text-[14px]" style={{ color: hi ? F.onCta : F.bone, fontFamily: SANS }}>{f}</span>
                          </li>
                        ))}
                      </ul>
                      <button onClick={() => scrollToId("cta")} className="mt-auto inline-flex items-center justify-center h-12 rounded-full text-[14px] font-bold transition-transform duration-150 hover:-translate-y-px active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2" style={{ background: hi ? F.charcoal : F.marigold, color: hi ? F.bone : F.onCta, fontFamily: SANS }}>
                        Get Gymbo
                      </button>
                    </div>
                  </Reveal>
                );
              })}
            </div>
            <Reveal className="text-center mt-8">
              <p className="text-[13px]" style={{ color: F.boneLabel, fontFamily: SANS }}>One plan, two ways to pay · 7 days free · billed via the App Store.</p>
            </Reveal>
          </div>
        </section>

        {/* ───────── faq ───────── */}
        <section id="faq" aria-label="Frequently asked questions" style={{ background: F.beige }}>
          <div className="max-w-[800px] mx-auto px-5 md:px-12 py-16 md:py-24">
            <Reveal className="text-center mb-10">
              <Eyebrow>Questions</Eyebrow>
              <h2 className="text-[clamp(28px,4vw,44px)] font-black mx-auto" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", lineHeight: 1.15, maxWidth: "16ch" }}>
                Everything you might ask.
              </h2>
            </Reveal>
            <div className="flex flex-col">
              {FAQ.map((item) => (
                <Reveal key={item.q}>
                  <details className="faq py-1" style={{ borderBottom: "1px solid var(--c-line)" }}>
                    <summary className="flex items-center justify-between gap-4 py-5">
                      <span className="text-[16px] md:text-[18px] font-bold" style={{ fontFamily: SERIF, color: F.ink }}>{item.q}</span>
                      <span className="faq-plus shrink-0 grid place-items-center w-7 h-7 rounded-full transition-transform duration-200" style={{ background: "rgba(245,158,11,0.14)", color: F.amberText }}>
                        <Plus size={15} strokeWidth={2.4} />
                      </span>
                    </summary>
                    <p className="pb-5 pr-10 text-[14px] md:text-[15px]" style={{ color: F.inkMuted, fontFamily: SANS, lineHeight: 1.6 }}>{item.a}</p>
                  </details>
                </Reveal>
              ))}
            </div>
            <Reveal className="mt-10 text-center">
              <a href="/compare/gymbo-vs-wellnessz" className="text-[14px] md:text-[15px] font-semibold underline underline-offset-4 transition-opacity hover:opacity-80" style={{ color: F.amberText, fontFamily: SANS }}>
                Comparing trainer apps? See how Gymbo compares to WellnessZ →
              </a>
            </Reveal>
          </div>
        </section>

        {/* ───────── final cta ───────── */}
        <section id="cta" data-testid="footer-cta-section" aria-label="Join the waitlist" style={{ background: F.charcoal }}>
          <div className="max-w-[640px] mx-auto px-5 md:px-12 py-16 md:py-24 flex flex-col items-center text-center">
            <Reveal>
              <Eyebrow dark>In beta</Eyebrow>
              <h2 className="text-[clamp(30px,4.5vw,48px)] font-black mx-auto" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", lineHeight: 1.15, color: F.bone, maxWidth: "16ch" }}>
                Run your whole business from one app.
              </h2>
              <p className="mt-4 text-[15px]" style={{ color: F.boneMuted, fontFamily: SANS }}>
                Join the waitlist and we'll tell you the moment it's your turn.
              </p>
            </Reveal>

            <Reveal className="mt-8 w-full flex flex-col items-center gap-4">
              <WaitlistForm />
              <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2.5 h-12 px-7 rounded-full text-[14px] transition-transform duration-150 hover:-translate-y-px active:scale-[0.97]" style={{ background: "rgba(240,240,235,0.06)", color: F.bone, border: "1px solid rgba(240,240,235,0.12)", fontFamily: SANS }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                </svg>
                Talk to the founder
              </a>
            </Reveal>

          </div>
        </section>
      </main>

      {/* ───────── footer ───────── */}
      <footer style={{ background: F.charcoal, borderTop: "1px solid rgba(240,240,235,0.06)" }}>
        <div className="max-w-[1100px] mx-auto px-5 md:px-12 py-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <span className="text-[13px]" style={{ color: F.boneMuted, fontFamily: SANS }}>
              <span className="font-bold" style={{ fontFamily: SERIF, color: F.bone }}>Gymbo.</span> Your business, in your pocket.
            </span>
            <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-7 gap-y-2">
              <button onClick={() => scrollToId("cta")} className="text-[13px] transition-colors" style={{ color: F.boneMuted, fontFamily: SANS }}>Support</button>
              <a href="/compare/gymbo-vs-wellnessz/" className="text-[13px] transition-colors" style={{ color: F.boneMuted, fontFamily: SANS }}>Gymbo vs WellnessZ</a>
              <a href="/privacy/" className="text-[13px] transition-colors" style={{ color: F.boneMuted, fontFamily: SANS }}>Privacy</a>
              <a href="/terms/" className="text-[13px] transition-colors" style={{ color: F.boneMuted, fontFamily: SANS }}>Terms</a>
              <a href="mailto:damini@materiallab.io" className="text-[13px] transition-colors" style={{ color: F.boneMuted, fontFamily: SANS }}>Contact</a>
            </nav>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 mt-5 pt-4" style={{ borderTop: "1px solid rgba(240,240,235,0.05)" }}>
            <a href="mailto:damini@materiallab.io" className="text-[12px]" style={{ color: F.boneLabel, fontFamily: SANS }}>damini@materiallab.io</a>
            <div className="flex items-center gap-4">
              <a href="https://www.linkedin.com/company/material-lab-io" target="_blank" rel="noopener noreferrer" className="text-[12px]" style={{ color: F.boneLabel, fontFamily: SANS }}>LinkedIn</a>
              <a href="https://wa.me/918050131733" target="_blank" rel="noopener noreferrer" className="text-[12px]" style={{ color: F.boneLabel, fontFamily: SANS }}>WhatsApp</a>
              <span className="text-[11px]" style={{ color: F.boneLabel, fontFamily: SANS }}>© 2026 Material Lab.</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ───────── mobile sticky CTA ───────── */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pt-3 transition-transform duration-300"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)", background: "var(--c-nav-bg)", backdropFilter: "saturate(140%) blur(12px)", WebkitBackdropFilter: "saturate(140%) blur(12px)", borderTop: "1px solid var(--c-line)", transform: showStickyCTA ? "translateY(0)" : "translateY(120%)" }}
      >
        <PrimaryCTA size="lg" className="w-full" />
      </div>
    </div>
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

   Chip list is the 8 already source-verified touchpoints (marketer,
   gy-mdqxp 2026-08-13) — shortened to scannable labels, tangible/shipped
   ones leading. */
const MARQUEE_CHIPS: { name: string; icon: LucideIcon }[] = [
  { name: "QR profile", icon: QrCode },
  { name: "Share links", icon: Share2 },
  { name: "PDF invoices", icon: FileText },
  { name: "Brand theming", icon: Palette },
  { name: "Your own URL", icon: Link },
  { name: "Booking link", icon: CalendarCheck },
  { name: "Fitness reports", icon: BarChart3 },
  { name: "Branded client app", icon: Smartphone },
];

function BrandMarquee() {
  const prefersReduced = useReducedMotion();
  return (
    <div style={{ background: F.charcoal }}>
      <div className="pt-10 md:pt-14 pb-16 md:pb-24">
        <span className="block text-center text-[13px] font-bold mb-4" style={{ color: F.marigold, fontFamily: SANS, letterSpacing: "0.04em" }}>
          Your brand, everywhere
        </span>
        {prefersReduced ? (
          <div role="region" aria-label="Brand touchpoints" className="mx-auto flex flex-wrap justify-center gap-2 max-w-[820px] px-5">
            {MARQUEE_CHIPS.map((c) => (
              <MarqueeChip key={c.name} t={c} />
            ))}
          </div>
        ) : (
          <div
            role="region"
            aria-label="Brand touchpoints"
            tabIndex={0}
            className="marquee-mask relative overflow-hidden"
          >
            <div className="marquee-track flex gap-2 w-max">
              {[...MARQUEE_CHIPS, ...MARQUEE_CHIPS].map((c, i) => (
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
      <span aria-hidden="true" className="grid place-items-center shrink-0 w-[26px] h-[26px] rounded-md" style={{ background: "rgba(251,191,36,0.14)", color: F.marigold }}>
        <t.icon size={14} strokeWidth={2} />
      </span>
      <span className="text-[13px] md:text-[14px] font-bold whitespace-nowrap" style={{ fontFamily: SANS, color: F.bone }}>{t.name}</span>
    </span>
  );
}
