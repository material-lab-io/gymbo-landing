import { useEffect, useRef, useState } from "react";
import {
  Check,
  Plus,
  QrCode,
  Share2,
  FileText,
  Palette,
  Link,
  Globe,
  CalendarCheck,
  BarChart3,
  Sparkles,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import "devices.css/dist/devices.min.css";
import { DemoFrame, ScreenshotFrame, type ClipMap } from "./components/PhoneMockup";
import { WaitlistForm } from "./components/WaitlistForm";
import { useReducedMotion } from "./hooks/useReducedMotion";
import { F, SHADOW, SERIF, SANS, WHATSAPP, scrollToId, ForgeStyle, Eyebrow, PrimaryCTA, SecondaryButton } from "./forge-ui";

// Wave 2↔3 seam (marketer dr-g4ps): video renders per-journey clips to
// public/demos/<journey-id>-<theme>.mp4 (+ poster), plus hero-light/hero-dark
// montages. ids: hero, client-list, punch-class, log-payment, branded-statement,
// schedule, build-workout, ask-gymbo, profile-qr. 1080x1920 9:16 H.264, light+dark.
// Until those real renders land, every slot uses the stand-in hero-demo.mp4 —
// flip DEMOS_READY to true (one line) when public/demos/* ships.
const DEMOS_READY = true;
const STANDIN_CLIP = "/hero-demo.mp4";
const STANDIN_POSTER = "/hero-demo-poster.png";
const demoClip = (id: string): ClipMap =>
  DEMOS_READY ? { light: `/demos/${id}-light.mp4`, dark: `/demos/${id}-dark.mp4` } : { light: STANDIN_CLIP, dark: STANDIN_CLIP };
const demoPoster = (id: string): ClipMap =>
  DEMOS_READY ? { light: `/demos/${id}-light.png`, dark: `/demos/${id}-dark.png` } : { light: STANDIN_POSTER, dark: STANDIN_POSTER };

/* ============================================================================
   getgymbo.com — Forge redesign (epic gy-9bmwm)
   Founder-reviewed build: sentence case site-wide, NO gradients (flat Forge
   beige/charcoal + solid amber accent). Brand = Forge amber #F59E0B / marigold
   #FBBF24, accent only. Hero + 4 pillars use composed demo clips (DemoFrame);
   the "see it in action" gallery uses current real-app screenshots in a device
   frame (ScreenshotFrame) — founder-approved curated set, optimized to WebP via
   scripts/optimize-gallery.mjs (gy-9bmwm.4).
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
    intro: "The Gymbo ledger tracks every class, payment, and balance automatically — so you always know where every client stands.",
    bullets: [
      "Every balance, clear — credit and classes left, always current",
      "Get paid for every class you teach",
      "Cash or UPI logged — nothing slips",
    ],
    brief: "Log a payment — UPI or cash, and the balance clears.",
    dark: false,
  },
  {
    id: "organized",
    demoId: "schedule",
    n: "02",
    eyebrow: "Your whole roster",
    title: "Get organized",
    intro: "Less busywork, more training. Every client, schedule, and class in one place — not in your head.",
    bullets: [
      "One-tap punch to log a class",
      "Recurring time slots, sorted by day",
      "No more paper register or notes app",
      "Account for travel distance between clients on the calendar, so you can optimize your day",
    ],
    brief: "Your week, classes morning to evening — Ravi, Sara, group, Imran.",
    dark: true,
  },
  {
    id: "brand",
    demoId: "branded-statement",
    n: "03",
    eyebrow: "Look professional",
    title: "Your brand, your business",
    intro: "Look like the professional you already are. Your name and details on every statement your client sees — plus a QR profile card you can share anywhere.",
    bullets: [
      "Branded PDF statements — your name, tagline, and details on each one",
      "A shareable QR profile card in three styles",
      "Send any client their statement with a single tap",
    ],
    brief: "Your brand on a clean statement PDF — share in a tap (India).",
    dark: false,
  },
  {
    id: "workouts",
    demoId: "build-workout",
    n: "04",
    eyebrow: "Coaching tools",
    title: "Train smarter",
    intro: "Build workouts, assign them to clients, and track real progress — adherence and per-exercise gains. And Ask Gymbo — an AI chat assistant grounded in your real client and payment data — answers 'who owes me?' or 'who's due this week?' in a tap.",
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

/* ── brand touchpoints ──
   `span: 2` is a DELIBERATE per-card call (Kaushik, gy-dfl55.4), not a
   pattern derived from array position — only the QR profile card (the
   most tangible, most-shown touchpoint) spans two grid columns; every
   other card is single-span. Do not replace with an alternating/index
   rule — that just reads as a different loop.

   gy-dfl55.6: `icon` replaces the generic yellow-dot bullet with a
   minimalist lucide glyph that depicts THIS touchpoint specifically —
   real SVG (recolourable/animatable), not the brand mark (gy-c571s is
   open — these must not drift into looking like the logo). */
const TOUCHPOINTS: { name: string; desc: string; span?: 2; icon: LucideIcon }[] = [
  { name: "QR profile card", desc: "Your shareable pro card — name, city, QR to connect.", span: 2, icon: QrCode },
  { name: "Per-client share links", desc: "Send any client their statement with one tap.", icon: Share2 },
  { name: "Invoices, exported as PDF", desc: "Clean, professional PDFs with your details (India).", icon: FileText },
  { name: "In-app brand theming", desc: "Your colours across the app.", icon: Palette },
  { name: "Personalized URL", desc: "Your own Gymbo link.", icon: Link },
  { name: "Mini-site / public profile", desc: "A page clients can find you at.", icon: Globe },
  { name: "Shareable booking link", desc: "Let clients reach out to book.", icon: CalendarCheck },
  { name: "Fitness reports", desc: "Shareable client progress summaries.", icon: BarChart3 },
  { name: "Welcome + logo splash", desc: "Your logo on first open.", icon: Sparkles },
  { name: "Custom-branded client app", desc: "Your brand, your app.", icon: Smartphone },
];

/* ── "see it in action" gallery: current real-app screenshots (founder-approved
   curated set, public/screens/gallery/) shown in a unified iPhone device frame.
   Static stills (the motion lives in the hero + pillar demo clips). Source files:
   public/screens/real/* → optimized via scripts/optimize-gallery.mjs (gy-9bmwm.4). ── */
const SCREENS: { slug: string; caption: string; alt: string }[] = [
  { slug: "dashboard", caption: "Every client, at a glance", alt: "Gymbo home screen showing a client's punch card — Aadesh, 3 of 10 classes used" },
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
  { q: "Is it free?", a: "Your first 7 days are free on every plan. After that, Gymbo Pro is ₹399/month — or ₹250/month effective on the annual plan — billed through the App Store." },
  { q: "Do my clients need to download anything?", a: "No. Gymbo is for you, the trainer. Your clients just train — you log it." },
  { q: "Does it work offline?", a: "Yes. Log classes and payments without signal; everything syncs when you're back online." },
  { q: "Is my client data private?", a: "Your client data is yours. You can export it anytime, and we never contact your clients." },
  { q: "Which phones does it support?", a: "iPhone, for now — that's where we're focused." },
  { q: "How do payments work?", a: "You record cash or UPI payments yourself. Gymbo keeps the running balance — it doesn't touch your money." },
  { q: "Can I import my existing clients?", a: "Yes. Bring your current roster over in minutes and pick up where you left off." },
];

/* ============================================================================
   building blocks
   ============================================================================ */

function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`reveal-on-scroll ${className}`}>{children}</div>;
}

/* gy-dfl55.11: staggered scroll reveal for the touchpoint/feature cards.
   Deliberately NOT the site-wide .reveal-on-scroll class (that bakes
   opacity:0 into CSS unconditionally, so it never appears without JS).
   Here the card renders at its normal visible style until JS mounts and
   arms the hidden-then-reveal transition — a JS failure (or the SSG
   prerender pass, which never runs effects) leaves the card visible,
   never blank. Dependency decision settled on the epic: CSS transition +
   native IntersectionObserver, no GSAP/ScrollTrigger. */
function CardReveal({
  index,
  className,
  style,
  children,
}: {
  index: number;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const prefersReduced = useReducedMotion();
  const [armed, setArmed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (prefersReduced) {
      // useReducedMotion() starts false and flips true asynchronously after
      // its own mount effect reads matchMedia — if we already armed (and the
      // card hadn't scrolled into view yet), un-arm so it falls back to its
      // default visible style instead of getting stuck at opacity:0.
      setArmed(false);
      return;
    }
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    setArmed(true);
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [prefersReduced]);

  const revealStyle: React.CSSProperties | undefined = armed
    ? {
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateY(30px)",
        transition: `opacity .5s cubic-bezier(.22,.9,.3,1) ${(index * 0.1).toFixed(2)}s, transform .5s cubic-bezier(.22,.9,.3,1) ${(index * 0.1).toFixed(2)}s`,
      }
    : undefined;

  return (
    <li ref={ref} className={className} style={{ ...style, ...revealStyle }}>
      {children}
    </li>
  );
}

/* ============================================================================
   page
   ============================================================================ */

/* Hero device art — Kaushik's three-iPhone MockupWorld mockup (founder-
   verified free/open-source, gy-dfl55.14), NOT a hand-built CSS bezel. The
   three "Change-This" screen apertures were extracted from the source SVG
   (composing its nested transform groups for true coordinates — the raw
   layer x/y report as 0,0), then hero-01/02/03 (dashboard / who-owes /
   log-payment) were composited into them and the whole scene exported as
   ONE flat raster (scripts/gy-7yhkh/build-hero.mjs) — the mockup's own
   metal, reflections, shadows and fan arrangement ship as-is, per Kaushik's
   direction not to reconstruct a finished asset in CSS (gy-7yhkh). Source:
   review-artifacts/gy-dfl55.14/mockupworld-three-iphone-17-screens.svg,
   supplied by Kaushik via Drive, downloaded 2026-08-11.
   Exported bbox: 4800×3236 (cropped from the 6000×4500 canvas to content). */
const HERO_PANEL_W = 4800;
const HERO_PANEL_H = 3236;
const HERO_PANEL_SRCSET = "/mockups/hero-three-panel-800.webp 800w, /mockups/hero-three-panel-1200.webp 1200w, /mockups/hero-three-panel-1800.webp 1800w";
const HERO_PANEL_PNG = "/mockups/hero-three-panel-1200.png";

function HeroThreePanel({ alt = "", className = "", style, sizes, priority = false }: { alt?: string; className?: string; style?: React.CSSProperties; sizes: string; priority?: boolean }) {
  return (
    <div className={className} style={{ lineHeight: 0, aspectRatio: `${HERO_PANEL_W} / ${HERO_PANEL_H}`, ...style }}>
      <picture>
        <source type="image/webp" srcSet={HERO_PANEL_SRCSET} sizes={sizes} />
        <img
          src={HERO_PANEL_PNG}
          alt={alt}
          decoding="async"
          {...(priority ? { fetchpriority: "high" as const } : {})}
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
        />
      </picture>
    </div>
  );
}

export default function App() {
  const prefersReduced = useReducedMotion();
  const [showStickyCTA, setShowStickyCTA] = useState(false);

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
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center focus-visible:outline-none" aria-label="Gymbo — back to top">
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
          <div aria-hidden="true" className={`hidden lg:block absolute right-0 top-1/2 -translate-y-1/2 z-[1] ${prefersReduced ? "" : "hero-fade d6"}`} style={{ width: "min(46vw, 720px)" }}>
            <HeroThreePanel style={{ width: "100%" }} sizes="(min-width: 1024px) min(46vw, 720px)" priority />
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
                <b style={{ color: F.ink, fontWeight: 400 }}>Track revenue, stay organized, look professional, train smarter</b> — built for independent trainers in India.
              </p>
              <div className={`mt-8 flex flex-col sm:flex-row sm:items-center gap-3.5 ${prefersReduced ? "" : "hero-rise d4"}`}>
                <PrimaryCTA size="lg" />
                <SecondaryButton>Talk to us</SecondaryButton>
              </div>
              {/* mobile / tablet device — below copy, chips hidden. Landscape three-panel
                  art (not a tall single phone), so no bottom bleed needed. */}
              <div className={`lg:hidden mt-12 flex justify-center ${prefersReduced ? "" : "hero-fade d6"}`}>
                <HeroThreePanel alt="Gymbo — dashboard, balances, and payment logging shown across three phones" style={{ width: "min(92vw, 560px)" }} sizes="min(92vw, 560px)" priority />
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
                Everything the back office of your business needs.
              </h2>
            </Reveal>
          </div>

          {PILLARS.map((p, i) => {
            const dark = p.dark;
            return (
              <div key={p.id} style={{ background: dark ? F.charcoal : F.beige }}>
                <div data-testid={`pillar-${p.id}`} className={`max-w-[1180px] mx-auto px-5 md:px-12 py-16 md:py-24 grid md:grid-cols-2 items-center gap-10 md:gap-16 ${i % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""}`}>
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
                        clip={demoClip(p.demoId)}
                        poster={demoPoster(p.demoId)}
                        theme={dark ? "dark" : "light"}
                        label={`${p.title} — demo`}
                        maxWidth={300}
                      />
                    </div>
                  </Reveal>
                </div>

                {p.id === "brand" && <BrandTouchpoints />}
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

            <div className="carousel mt-14 flex gap-6 md:gap-10 overflow-x-auto snap-x snap-mandatory -mx-5 px-5 md:mx-0 md:px-0 pb-2" role="region" aria-label="See Gymbo in action gallery">
              {SCREENS.map((s) => (
                <div key={s.slug} tabIndex={0} className="snap-center shrink-0 flex flex-col items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
                  <ScreenshotFrame slug={s.slug} alt={s.alt} screenWidth={276} />
                  <p className="mt-6 text-center text-[14px] md:text-[15px]" style={{ color: F.boneMuted, fontFamily: SANS, lineHeight: 1.5, maxWidth: "22ch" }}>
                    {s.caption}
                  </p>
                </div>
              ))}
            </div>

            <Reveal className="mt-12 flex flex-col items-center gap-3">
              <PrimaryCTA dark size="lg" />
            </Reveal>
          </div>
        </section>

        {/* ───────── trust (positioning-led) ───────── */}
        <section aria-label="Trusted by trainers" style={{ background: F.beige }}>
          <div className="max-w-[1180px] mx-auto px-5 md:px-12 py-16 md:py-24">
            <Reveal className="text-center">
              <Eyebrow>Built in India, for Indian trainers</Eyebrow>
              <h2 className="text-[clamp(28px,4vw,44px)] font-black mx-auto" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", maxWidth: "22ch", lineHeight: 1.15 }}>
                We're early — and built for trainers like you.
              </h2>
              <p className="mt-4 text-[16px] mx-auto" style={{ color: F.inkAnchor, fontFamily: SANS, maxWidth: "40ch" }}>
                Gymbo is in beta, built in India with real trainers. Your client data is yours, and we never contact your clients.
              </p>
            </Reveal>

            {/* testimonials */}
            <div className="mt-12 grid md:grid-cols-2 gap-6">
              <Reveal>
                <figure className="h-full flex flex-col p-[var(--g-space-6)] md:p-[var(--g-space-8)] rounded-[var(--g-radius-xl)]" style={{ background: F.beigeCard, boxShadow: SHADOW.card }}>
                  <blockquote className="text-[15px] md:text-[17px] italic" style={{ fontFamily: SERIF, lineHeight: 1.75, color: F.ink }}>
                    “I used to run everything through WhatsApp and a notebook. Lost track of classes, payments, forgot who owed what. With Gymbo, I open the app, log the session, and move on.”
                  </blockquote>
                  <figcaption className="flex items-center gap-3 mt-6 pt-5" style={{ borderTop: "1px solid var(--c-line)" }}>
                    <span className="grid place-items-center w-11 h-11 rounded-full text-[15px] font-bold" style={{ background: "rgba(245,158,11,0.15)", color: F.amberText, fontFamily: SANS }}>S</span>
                    <span className="flex flex-col">
                      <span className="text-[14px] font-bold" style={{ color: F.ink, fontFamily: SANS }}>Sarfaraz</span>
                      <span className="text-[12px]" style={{ color: F.inkLabel, fontFamily: SANS }}>Fitness trainer · Bangalore</span>
                    </span>
                  </figcaption>
                </figure>
              </Reveal>
              <Reveal>
                <div className="h-full flex flex-col items-center justify-center text-center p-[var(--g-space-6)] md:p-[var(--g-space-8)] rounded-[var(--g-radius-xl)]" style={{ background: "transparent", border: "1px dashed var(--c-line)" }}>
                  <span className={`grid place-items-center w-12 h-12 rounded-full text-[16px] font-bold mb-4 ${prefersReduced ? "" : "waiting-pulse"}`} style={{ background: "rgba(245,158,11,0.12)", color: F.amberText, fontFamily: SANS }}>+</span>
                  <p className="text-[15px]" style={{ color: F.inkAnchor, fontFamily: SANS, lineHeight: 1.5, maxWidth: "26ch" }}>More trainers are coming on board across India.</p>
                </div>
              </Reveal>
            </div>

            <div className="mt-10 grid sm:grid-cols-2 gap-4">
              <Reveal>
                <div className="p-[var(--g-space-6)] md:p-[var(--g-space-8)] rounded-[var(--g-radius-lg)]" style={{ background: F.beige, border: "1px solid var(--c-line)" }}>
                  <h4 className="text-[15px] font-bold mb-1.5" style={{ fontFamily: SANS, color: F.ink }}>Your client data is yours</h4>
                  <p className="text-[14px]" style={{ color: F.inkAnchor, fontFamily: SANS, lineHeight: 1.55 }}>Export anytime. We never contact your clients.</p>
                </div>
              </Reveal>
              <Reveal>
                <div className="p-[var(--g-space-6)] md:p-[var(--g-space-8)] rounded-[var(--g-radius-lg)]" style={{ background: F.beige, border: "1px solid var(--c-line)" }}>
                  <h4 className="text-[15px] font-bold mb-1.5" style={{ fontFamily: SANS, color: F.ink }}>Why we built Gymbo</h4>
                  <p className="text-[14px]" style={{ color: F.inkAnchor, fontFamily: SANS, lineHeight: 1.55 }}>We watched trainers run their whole business on WhatsApp threads and paper registers — so we built Gymbo.</p>
                </div>
              </Reveal>
            </div>
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

/* ── brand-touchpoints section (under the "Your brand" pillar) ──
   TEMPORARY (gy-cgfm8): the BriefFrame placeholder-screenshot cards ("Here
   we'll show…") are gone — Kaushik doesn't want to wait for real artwork.
   Reduced to a plain bullet list until there's real screenshots/footage to
   show per touchpoint. Do not treat this bullet layout as the final design.

   gy-slagn (2026-08-13): ONE unified grid, one card treatment — no
   shipped/coming-soon split
   (gy-slagn, founder 2026-08-13: "you don't have to call out what's
   coming soon, mix it in"). Every card renders identically regardless
   of ship status; the founder's explicit instruction is to STOP
   LABELLING, not to delete unshipped items. */
function BrandTouchpoints() {
  return (
    <div style={{ background: F.charcoal }}>
      <div className="max-w-[900px] mx-auto px-5 md:px-12 pt-16 md:pt-24 pb-16 md:pb-24">
        <Reveal className="text-center mb-8">
          <span className="block text-[13px] font-bold mb-4" style={{ color: F.marigold, fontFamily: SANS, letterSpacing: "0.04em" }}>Brand touchpoints</span>
          <h3 className="text-[clamp(22px,3vw,32px)] font-black mx-auto" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", lineHeight: 1.15, color: F.bone, maxWidth: "24ch" }}>
            Your brand, everywhere.
          </h3>
        </Reveal>

        <ul className="mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" style={{ maxWidth: "820px" }}>
          {TOUCHPOINTS.map((t, i) => (
            <CardReveal
              key={t.name}
              index={i}
              /* gy-dfl55.12/.13: feature-card-hover drives the magnetic hover
                 (scale 1.02 + brighten) and feature-card-icon drives the icon
                 micro-interaction on the same hover. */
              className={`feature-card-hover flex items-start gap-3 rounded-[var(--g-radius-lg)] p-4 ${t.span === 2 ? "sm:col-span-2" : ""}`}
              style={{
                border: "1px solid transparent",
                backgroundImage: `linear-gradient(${F.charcoalCard}, ${F.charcoalCard}), linear-gradient(155deg, rgba(240,240,235,0.14), rgba(240,240,235,0.02) 45%, rgba(240,240,235,0.06))`,
                backgroundOrigin: "border-box",
                backgroundClip: "padding-box, border-box",
              }}
            >
              <span aria-hidden="true" className="feature-card-icon grid place-items-center shrink-0 w-[30px] h-[30px] rounded-lg" style={{ background: "rgba(251,191,36,0.14)", color: F.marigold }}>
                <t.icon size={16} strokeWidth={2} />
              </span>
              <div className="text-left">
                <span className="block text-[15px] font-bold" style={{ fontFamily: SERIF, color: F.bone }}>{t.name}</span>
                <span className="block mt-1 text-[13px]" style={{ fontFamily: SANS, color: F.boneMuted }}>{t.desc}</span>
              </div>
            </CardReveal>
          ))}
        </ul>
      </div>
    </div>
  );
}
