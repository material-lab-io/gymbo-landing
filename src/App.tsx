import { useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Menu, X, ArrowRight } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import {
  renderScreen,
  ScreenWithGlow,
} from "./components/PhoneMockup";
import { SectionLabel } from "./components/ui/SectionLabel";
import { SectionTitle } from "./components/ui/SectionTitle";
import { WaitlistForm } from "./components/WaitlistForm";
import { CTAButton } from "./components/ui/CTAButton";
import { useReducedMotion } from "./hooks/useReducedMotion";

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

/* ==============================
   CONSTANTS
   ============================== */

const ACCENT = "var(--accent)";
const ACCENT_HEX = (typeof document !== "undefined" && getComputedStyle(document.documentElement).getPropertyValue("--g-primary-cta-fill").trim()) || "#FBBF24"; // Forge brand (auto-syncs)

const SECTION_BG = {
  hero: "#060608",
  problem: "#08080b",
  features: "#0a0a0f",
  pricing: "#0b0a0e",
  waitlist: "#060608",
  footer: "#040405",
};

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
];


const FEATURES = [
  {
    subtitle: "Session tracking",
    title: "Tap and train.",
    desc: "Log sessions in a single swipe between sets. Track attendance, monitor progress, and update records instantly.",
    screen: "light-checkin",
    badge: null,
  },
  {
    subtitle: "Accounting",
    title: "Stay on top of payments.",
    desc: "Offload the manual math. View real-time balances, spot overdue accounts, and collect payments without the awkward text messages.",
    screen: "light-payments",
    badge: null,
  },
  {
    subtitle: "Scheduling",
    title: "Control your calendar.",
    desc: "Organize your day across multiple locations. Lock in recurring slots, fill cancellations automatically, and dispatch reminders to stop no-shows.",
    screen: "light-schedule",
    badge: null,
  },
  {
    subtitle: "Branding",
    title: "Look the part.",
    desc: "Secure high-value clients with professional brand collateral. Generate branded digital profiles, customized PDF receipts, and beautifully formatted training plans ready to share straight to WhatsApp.",
    screen: "light-brand",
    badge: null,
  },
  {
    subtitle: "Invoicing",
    title: "Send clean invoices.",
    desc: "Turn a completed session into a compliant invoice. Automatically generate, format, and share professional statements in seconds.",
    screen: "light-invoicing",
    badge: null,
  },
  {
    subtitle: "Coaching assistant",
    title: "Outsource the programming.",
    desc: "Reclaim your evenings. Teach your personal AI assistant your coaching style and preferred exercises to instantly draft highly customized workout plans you can share directly to WhatsApp.",
    screen: "light-gymbo",
    badge: "AI-powered",
  },
];


const PRICING_PLANS = [
  {
    name: "Flexible",
    tagline: "Flexible",
    priceINR: "400",
    period: "/month",
    priceFull: null,
    desc: "Billed monthly. Cancel anytime.",
    features: [
      "Unlimited clients",
      "Complete accounting",
      "AI assistant",
      "Branded invoicing",
    ],
    cta: "Get gymbo",
    highlight: false,
  },
  {
    name: "Quarterly",
    tagline: "Save 25%",
    priceINR: "300",
    period: "/month",
    priceFull: "Billed quarterly at ₹900.",
    desc: "Everything in Flexible, billed every 3 months.",
    features: [
      "Everything in Flexible",
      "25% savings",
    ],
    cta: "Get gymbo",
    highlight: false,
  },
  {
    name: "Annual",
    tagline: "Best value",
    priceINR: "200",
    period: "/month",
    priceFull: "Billed annually at \u20B92,400. Save 50%.",
    desc: "Everything in Flexible, plus guaranteed lowest pricing locked in for the year.",
    features: [
      "Everything in Flexible",
      "50% savings",
      "Lowest price guaranteed",
    ],
    cta: "Get gymbo",
    highlight: true,
  },
];

// Nav ticker: factual offer highlights (pricing, status, audience)
const NAV_TICKER_PHRASES = [
  "Now in private alpha",
  "Free for 1 month",
  "Built for independent trainers",
  "From \u20B9200/month \u2014 all features",
];

/* ==============================
   MARKETING PAGE
   ============================== */

export default function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const navHiddenRef = useRef(false);
  const mobileMenuOpenRef = useRef(false);

  useEffect(() => {
    mobileMenuOpenRef.current = mobileMenuOpen;
  }, [mobileMenuOpen]);

  /* Refs for GSAP */
  const containerRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const phoneCenterRef = useRef<HTMLDivElement>(null);
  const heroH1Ref = useRef<HTMLHeadingElement>(null);
  const heroSubRef = useRef<HTMLParagraphElement>(null);
  const heroCTARef = useRef<HTMLDivElement>(null);
  const heroBottomRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const footerInnerRef = useRef<HTMLDivElement>(null);

  /* GSAP Master Timeline */
  useEffect(() => {
    if (prefersReducedMotion) {
      [heroSubRef, heroCTARef, phoneCenterRef].forEach((ref) => {
        if (ref.current) gsap.set(ref.current, { opacity: 1 });
      });
      if (heroH1Ref.current) {
        heroH1Ref.current.querySelectorAll(".word").forEach((el) => {
          gsap.set(el, { opacity: 1, y: 0, rotateX: 0 });
        });
      }
      return;
    }

    const ctx = gsap.context(() => {
      /* NAV: directionally aware hide/show */
      const navEl = navRef.current;
      if (navEl) {
        ScrollTrigger.create({
          start: "top top",
          end: "max",
          onUpdate: (self) => {
            const scrollY = self.scroll();
            if (scrollY < 120) return;
            if (mobileMenuOpenRef.current) return;
            const dir = self.direction;
            if (dir === 1 && !navHiddenRef.current) {
              navHiddenRef.current = true;
              gsap.to(navEl, { yPercent: -110, duration: 0.35, ease: "power3.in" });
            } else if (dir === -1 && navHiddenRef.current) {
              navHiddenRef.current = false;
              gsap.to(navEl, { yPercent: 0, duration: 0.35, ease: "power3.out" });
            }
          },
        });
      }

      /* HERO: Staggered entrance */
      const heroTL = gsap.timeline({ delay: 0.3 });

      if (heroH1Ref.current) {
        const words = heroH1Ref.current.querySelectorAll(".word");
        heroTL.fromTo(
          words,
          { y: "110%", opacity: 0, rotateX: -20 },
          { y: "0%", opacity: 1, rotateX: 0, stagger: 0.06, duration: 0.9, ease: "power4.out" },
          0.15
        );
      }

      heroTL.fromTo(
        heroSubRef.current,
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" },
        0.6
      );

      heroTL.fromTo(
        heroCTARef.current,
        { y: 25, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7, ease: "power3.out" },
        0.8
      );

      heroTL.fromTo(
        phoneCenterRef.current,
        { y: 80, opacity: 0, scale: 0.92 },
        { y: 0, opacity: 1, scale: 1, duration: 1.2, ease: "expo.out" },
        0.5
      );

      /* HERO SCROLL-ZOOM */
      if (heroRef.current && phoneCenterRef.current) {
        const phoneEl = phoneCenterRef.current;
        const heroEl = heroRef.current;
        const FOCAL_Y_PERCENT = 13;

        const zoomTL = gsap.timeline({
          scrollTrigger: {
            trigger: heroEl,
            start: "top top",
            end: "+=60%",
            pin: true,
            scrub: 0.6,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });

        zoomTL.to(
          [heroH1Ref.current, heroBottomRef.current].filter(Boolean),
          { opacity: 0, duration: 0.3, ease: "power1.inOut" },
          0
        );

        zoomTL.fromTo(
          phoneEl,
          { scale: 1, xPercent: 0, yPercent: 0 },
          {
            scale: () => {
              const currentScale = (gsap.getProperty(phoneEl, "scaleX") as number) || 1;
              const rect = phoneEl.getBoundingClientRect();
              const naturalWidth = rect.width / currentScale;
              return Math.max((window.innerWidth * 1.1) / naturalWidth, 3);
            },
            xPercent: () => {
              const rect = phoneEl.getBoundingClientRect();
              const currentScale = (gsap.getProperty(phoneEl, "scaleX") as number) || 1;
              const phoneCenterX = rect.left + rect.width / 2;
              const viewCenterX = window.innerWidth / 2;
              const offsetPx = viewCenterX - phoneCenterX;
              const naturalWidth = rect.width / currentScale;
              return (offsetPx / naturalWidth) * 100;
            },
            yPercent: () => {
              const rect = phoneEl.getBoundingClientRect();
              const currentScale = (gsap.getProperty(phoneEl, "scaleX") as number) || 1;
              const naturalHeight = rect.height / currentScale;
              const focalAbsoluteY = rect.top + (naturalHeight * FOCAL_Y_PERCENT / 100) * currentScale;
              const viewCenterY = window.innerHeight / 2;
              const offsetPx = viewCenterY - focalAbsoluteY;
              return (offsetPx / naturalHeight) * 100;
            },
            transformOrigin: `50% ${FOCAL_Y_PERCENT}%`,
            duration: 1,
            ease: "power1.inOut",
          },
          0.05
        );

        const onResize = () => ScrollTrigger.refresh();
        window.addEventListener("resize", onResize);
      }

      /* FEATURES: removed old sticky-panel GSAP — grid rows use gsap-fade observer */

      /* FOOTER BOUNCE */
      if (footerRef.current && footerInnerRef.current) {
        const footerChildren = Array.from(footerInnerRef.current.children);
        gsap.set(footerChildren, { y: 60, opacity: 0 });

        ScrollTrigger.create({
          trigger: footerRef.current,
          start: "top 90%",
          onEnter: () => {
            gsap.to(footerChildren, {
              y: 0, opacity: 1, duration: 0.8, stagger: 0.1, ease: "power3.out",
            });
          },
          onLeaveBack: () => {
            gsap.set(footerChildren, { y: 60, opacity: 0 });
          },
        });
      }

      /* Generic fade-ins */
      gsap.utils.toArray<HTMLElement>(".gsap-fade").forEach((el) => {
        gsap.fromTo(
          el,
          { y: 25, opacity: 0 },
          {
            y: 0, opacity: 1, duration: 0.7, ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 88%", toggleActions: "play none none none" },
          }
        );
      });
    }, containerRef);

    return () => ctx.revert();
  }, [prefersReducedMotion]);

  /* Scroll-to via GSAP ScrollToPlugin */
  const scrollTo = useCallback((id: string) => {
    setMobileMenuOpen(false);
    const target = document.getElementById(id);
    if (!target) return;

    if (navHiddenRef.current && navRef.current) {
      navHiddenRef.current = false;
      gsap.to(navRef.current, { yPercent: 0, duration: 0.35, ease: "power3.out" });
    }

    gsap.to(window, {
      scrollTo: { y: target, offsetY: 70 },
      duration: 1.2,
      ease: "power3.inOut",
    });
  }, []);

  /* Hero headline word-split helper */
  const renderHeroWords = (text: string) =>
    text.split(" ").map((word, i) => (
      <span key={i} className="inline-block overflow-hidden" style={{ marginRight: "0.2em", paddingBottom: "0.05em" }}>
        <span className="word inline-block" style={{ paddingLeft: "0.02em", paddingRight: "0.02em" }}>{word}</span>
      </span>
    ));

  return (
    <div
      ref={containerRef}
      className="min-h-screen w-full"
      style={{
        background: SECTION_BG.hero,
        fontFamily: "var(--font-sans)",
        fontWeight: 300,
        color: "#f0f0eb",
      }}
    >
      {/* Skip to main content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:px-4 focus:py-2 focus:rounded-lg focus:text-black focus:outline-none"
        style={{ background: ACCENT }}
      >
        Skip to main content
      </a>

      {/* Film grain */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-[100] opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "128px",
          mixBlendMode: "overlay",
        }}
      />

      {/* TOP NAV (OSMO-style) */}
      <nav
        ref={navRef}
        aria-label="Main navigation"
        className="fixed top-0 left-0 right-0 z-50 px-3 md:px-5 pt-3"
        style={{ willChange: "transform" }}
      >
        {/* Main bar */}
        <div
          className="relative max-w-[1200px] mx-auto flex items-center justify-between px-6 md:px-10 py-4 md:py-5 rounded-2xl"
          style={{
            background: "#0a0a0a",
            border: "1px solid rgba(255,255,255,0.06)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
          }}
        >
          {/* Left: hamburger + Menu */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileMenuOpen}
            className="flex items-center gap-3 text-white/80 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none focus-visible:rounded-lg select-none"
          >
            {mobileMenuOpen ? <X size={22} strokeWidth={1.5} /> : <Menu size={22} strokeWidth={1.5} />}
            <span
              className="text-[16px] md:text-[18px] tracking-[-0.01em] hidden sm:inline"
              style={{ fontFamily: "var(--font-sans)", fontWeight: 400 }}
            >
              Menu
            </span>
          </button>

          {/* Center: Gymbo logo */}
          <button
            onClick={() => gsap.to(window, { scrollTo: 0, duration: 1, ease: "power3.inOut" })}
            className="absolute left-1/2 -translate-x-1/2 flex items-center select-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none focus-visible:rounded-lg"
            aria-label="Scroll to top"
          >
            <span
              className="text-[26px] md:text-[32px] text-white tracking-[-0.03em]"
              style={{ fontFamily: "var(--font-serif)", fontWeight: 700 }}
            >
              GYMBO
            </span>
          </button>

          {/* Right: Get gymbo button */}
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); scrollTo("cta"); }}
            className="px-8 h-12 inline-flex items-center justify-center rounded-xl text-[14px] tracking-[-0.01em] transition-all hover:opacity-90 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
            style={{
              background: ACCENT,
              color: "#000",
              fontWeight: 600,
              fontFamily: "var(--font-sans)",
            }}
          >
            Get gymbo
          </a>
        </div>

        {/* Ticker strip */}
        <div
          className="mt-1.5 mb-4 md:mb-6 overflow-hidden"
          style={{ background: ACCENT }}
          aria-hidden="true"
        >
          <div className="py-2.5 md:py-3 overflow-hidden">
            <div
              className="flex whitespace-nowrap"
              style={{ animation: "ticker-scroll 20s linear infinite", width: "max-content" }}
            >
              {[0, 1].map((set) => (
                <div key={set} className="flex shrink-0">
                  {NAV_TICKER_PHRASES.map((phrase, i) => (
                    <span
                      key={`${set}-${i}`}
                      className="inline-flex items-center gap-5 mx-5 text-[13px] md:text-[15px] tracking-[0.08em]"
                      style={{ color: "#000", fontWeight: 500, fontFamily: "var(--font-sans)" }}
                    >
                      {phrase}
                      <span style={{ color: "rgba(0,0,0,0.35)" }}>*</span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <style>{`
            @keyframes ticker-scroll {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
          `}</style>
        </div>

        {/* Menu dropdown */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="max-w-[1200px] mx-auto mt-1.5 rounded-xl overflow-hidden"
              style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex flex-col gap-1 px-6 py-5">
                {NAV_LINKS.map((link) => (
                  <button
                    key={link.label}
                    onClick={() => scrollTo(link.href.replace("#", ""))}
                    className="text-[15px] text-white/60 py-3 text-left hover:text-white transition-colors"
                    style={{ fontWeight: 400, borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                  >
                    {link.label}
                  </button>
                ))}
                <div className="pt-3">
                  <CTAButton variant="primary" size="md" onClick={() => scrollTo("cta")} className="w-full">
                    Get gymbo
                  </CTAButton>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ======== HERO ======== */}
      <main
        id="main-content"
        ref={heroRef}
        className="relative min-h-screen flex flex-col justify-between px-5 md:px-8 pt-48 pb-6 overflow-hidden"
        style={{ background: SECTION_BG.hero, minHeight: "100vh" }}
      >
        {/* Background mesh */}
        <div
          aria-hidden="true"
          className="absolute top-[-300px] left-[30%] w-[700px] h-[700px] rounded-full blur-[250px] opacity-[0.06]"
          style={{ background: ACCENT }}
        />
        <div
          aria-hidden="true"
          className="absolute bottom-[10%] right-[-100px] w-[400px] h-[400px] rounded-full blur-[180px] opacity-[0.03]"
          style={{ background: "var(--accent)" }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-[45%] pointer-events-none"
          style={{ background: "linear-gradient(to top, color-mix(in srgb, var(--accent) 6%, transparent) 0%, transparent 100%)" }}
        />

        {/* Middle: Headline LEFT + Phone RIGHT */}
        <div className="relative flex-1 flex items-center justify-center">
          <div className="w-full max-w-[1200px] mx-auto flex flex-col md:flex-row md:items-start md:justify-between gap-6 md:gap-8">
            {/* LEFT: Headline */}
            <h1
              ref={heroH1Ref}
              className="relative select-none shrink-0 text-center md:text-left"
              style={{ fontFamily: "var(--font-serif)", fontWeight: 700, lineHeight: 0.95, letterSpacing: "-0.03em" }}
            >
              <span className="relative z-20 block text-[clamp(40px,8.5vw,110px)] text-white">
                {renderHeroWords("Run your")}
              </span>
              <span className="relative z-20 block text-[clamp(40px,8.5vw,110px)] text-white">
                {renderHeroWords("entire fitness")}
              </span>
              <span className="relative z-20 block text-[clamp(40px,8.5vw,110px)] text-white">
                {renderHeroWords("business")}
              </span>
              <span className="relative z-20 block text-[clamp(40px,8.5vw,110px)]" style={{ color: ACCENT }}>
                {renderHeroWords("from your")}
              </span>
              <span className="relative z-20 block text-[clamp(40px,8.5vw,110px)]" style={{ color: ACCENT }}>
                {renderHeroWords("phone.")}
              </span>
            </h1>

            {/* RIGHT: Phone mockup */}
            <div
              ref={phoneCenterRef}
              className="relative flex items-start justify-center md:justify-end shrink-0 self-center md:self-start md:mt-2"
              style={{ opacity: 0, willChange: "transform" }}
            >
              <ScreenWithGlow
                src="/screens/screen-hero.png?v=3"
                alt="Gymbo client dashboard"
                glowColor={ACCENT_HEX}
                className="w-[clamp(180px,28vw,300px)]"
              />
            </div>
          </div>
        </div>

        {/* Bottom bar: description left, CTA + scroll right */}
        <div ref={heroBottomRef} className="relative z-20 max-w-[1200px] w-full mx-auto flex flex-col md:flex-row items-start md:items-end justify-between gap-6 mt-4">
          <p
            ref={heroSubRef}
            className="text-[13px] md:text-[14px] text-white/60 max-w-[340px]"
            style={{ lineHeight: 1.55, fontWeight: 300, opacity: 0 }}
          >
            Tired of juggling WhatsApp threads and paper diaries? Schedule sessions, track payments, and manage every client in seconds — so you can focus on training, not admin.
          </p>

          <div ref={heroCTARef} className="flex items-center gap-6" style={{ opacity: 0 }}>
            <div className="flex flex-col">
              <CTAButton variant="primary" size="md" onClick={() => scrollTo("cta")}>
                Get gymbo <ArrowRight size={16} aria-hidden="true" />
              </CTAButton>
              <span className="text-[12px] text-white/50 mt-2" style={{ fontWeight: 400 }}>Setup takes under two minutes.</span>
            </div>
            <motion.button
              onClick={() => scrollTo("problem")}
              className="hidden md:flex items-center gap-2 text-[11px] tracking-[0.15em] uppercase text-white/60 hover:text-white/80 transition-colors"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.5, duration: 1 }}
              aria-label="Scroll to see how"
            >
              <span style={{ fontWeight: 500 }}>(Scroll to see how)</span>
              <motion.span
                animate={{ y: [0, 4, 0] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                className="inline-block"
              >
                <ArrowRight size={12} className="rotate-90" />
              </motion.span>
            </motion.button>
          </div>
        </div>
      </main>

      {/* ======== BEFORE & AFTER ======== */}
      <section
        id="problem"
        aria-label="Before and After"
        className="relative py-16 md:py-24 px-5 md:px-8"
        style={{ background: SECTION_BG.problem }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[1px]"
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }}
        />
        <div className="max-w-[1200px] mx-auto">
          <SectionLabel>Before &amp; After</SectionLabel>
          <SectionTitle>Drop the mental load.</SectionTitle>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12 gsap-fade">
            {/* LEFT — The Friction */}
            <div className="flex flex-col items-center">
              <div
                className="w-full rounded-2xl p-8 md:p-10 flex flex-col items-center justify-center min-h-[320px]"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <span
                  className="text-[10px] tracking-[0.2em] uppercase mb-6"
                  style={{ color: "rgba(255,255,255,0.45)", fontWeight: 500, fontFamily: "var(--font-sans)" }}
                >
                  The Friction
                </span>
                <div className="flex items-center gap-6 md:gap-8">
                  {[
                    { icon: "\uD83D\uDCC5", label: "Calendar app" },
                    { icon: "\uD83D\uDCDD", label: "Notes + math" },
                    { icon: "\u23F0", label: "Alarm clock" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex flex-col items-center gap-2"
                    >
                      <div
                        className="w-[64px] h-[64px] md:w-[72px] md:h-[72px] rounded-xl flex items-center justify-center text-[28px] md:text-[32px]"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        {item.icon}
                      </div>
                      <span className="text-[10px] text-white/40" style={{ fontWeight: 400 }}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p
                className="text-[13px] md:text-[14px] text-white/55 text-center mt-5 max-w-[380px]"
                style={{ lineHeight: 1.6, fontWeight: 300 }}
              >
                Juggling schedules in your head, tracking payments in notes, and spending weekends calculating overdue balances.
              </p>
            </div>

            {/* RIGHT — The Solution */}
            <div className="flex flex-col items-center">
              <div
                className="w-full rounded-2xl p-8 md:p-10 flex flex-col items-center justify-center min-h-[320px]"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <span
                  className="text-[10px] tracking-[0.2em] uppercase mb-6"
                  style={{ color: ACCENT, fontWeight: 500, fontFamily: "var(--font-sans)" }}
                >
                  The Solution
                </span>
                <ScreenWithGlow
                  src="/screens/screen-checkin.png?v=3"
                  alt="Gymbo app — the solution"
                  glowColor={ACCENT_HEX}
                  className="w-[clamp(160px,22vw,220px)]"
                />
              </div>
              <p
                className="text-[13px] md:text-[14px] text-white/55 text-center mt-5 max-w-[380px]"
                style={{ lineHeight: 1.6, fontWeight: 300 }}
              >
                Know exactly who paid, who&apos;s next, and what to train at a single glance. Replace your scattered apps with one lightning-fast interface built strictly to keep you moving.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* ======== FEATURES — OVERLAPPING PARALLAX PANELS ======== */}
      <section id="features" aria-label="Features" className="relative">
        {/* Section header */}
        <div
          className="relative px-5 md:px-8 pt-12 md:pt-16 pb-10 md:pb-12"
          style={{ background: SECTION_BG.features }}
        >
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-[1px]"
            style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }}
          />
          <div className="max-w-[1200px] mx-auto">
            <SectionLabel>Features</SectionLabel>
            <SectionTitle>Scale your business. Protect your time.</SectionTitle>
          </div>
        </div>

        {/* Feature grid — two-column alternating */}
        <div className="max-w-[1200px] mx-auto px-5 md:px-8 py-12 md:py-16 flex flex-col gap-16 md:gap-24"
             style={{ background: SECTION_BG.features }}>
          {FEATURES.map((feat, i) => (
            <div
              key={feat.subtitle}
              className={`flex flex-col ${i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"} items-center gap-8 md:gap-16 gsap-fade`}
            >
              {/* Text */}
              <div className="flex-1 flex flex-col">
                {feat.badge && (
                  <span className="inline-flex items-center gap-1.5 text-[10px] tracking-wider uppercase px-3 py-1 rounded-full self-start mb-4"
                        style={{ background: `${ACCENT}15`, color: ACCENT, border: `1px solid ${ACCENT}25`, fontWeight: 600 }}>
                    {feat.badge}
                  </span>
                )}
                <span className="text-[10px] tracking-[0.2em] uppercase mb-3"
                      style={{ color: "rgba(255,255,255,0.60)", fontFamily: "var(--font-sans)", fontWeight: 500 }}>
                  {feat.subtitle}
                </span>
                <h3 className="text-[28px] md:text-[36px] text-white tracking-[-0.025em] mb-3 max-w-[480px]"
                    style={{ fontFamily: "var(--font-serif)", fontWeight: 400, lineHeight: 1.08 }}>
                  {feat.title}
                </h3>
                <p className="text-[14px] md:text-[15px] text-white/65 max-w-[420px]"
                   style={{ lineHeight: 1.65, fontWeight: 300 }}>
                  {feat.desc}
                </p>
              </div>

              {/* Phone screenshot */}
              <div className="shrink-0 w-[clamp(200px,26vw,280px)]">
                {renderScreen(feat.screen)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ======== PERSONA ======== */}
      <section
        id="persona"
        aria-label="The Job"
        className="relative py-16 md:py-24 px-5 md:px-8"
        style={{ background: SECTION_BG.features }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[1px]"
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }}
        />
        <div className="max-w-[700px] mx-auto text-center gsap-fade">
          <SectionLabel>The Job</SectionLabel>
          <SectionTitle>Built for the coach on the go.</SectionTitle>
          <p
            className="text-[14px] md:text-[15px] text-white/60 mt-6"
            style={{ lineHeight: 1.7, fontWeight: 300 }}
          >
            You move between apartment gyms, private studios, and parks. Every minute on admin is a minute stolen from coaching. Gymbo handles the back office — your schedule, accounting, and clients, all in your pocket. Handle 30+ clients without the mental load.
          </p>
          <div className="mt-8">
            <CTAButton variant="primary" size="md" onClick={() => scrollTo("cta")}>
              Get gymbo
            </CTAButton>
          </div>
        </div>
      </section>

      {/* ======== PRICING (with social proof merged in) ======== */}
      <section
        id="pricing"
        aria-label="Pricing plans"
        className="relative py-10 md:py-16 px-5 md:px-8"
        style={{ background: SECTION_BG.pricing }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[1px]"
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }}
        />
        <div className="max-w-[1100px] mx-auto">
          <SectionLabel>Pricing</SectionLabel>
          <SectionTitle>Less than the cost of a missed session.</SectionTitle>

          <p className="text-[15px] text-white/60 mt-4 mb-8 gsap-fade" style={{ fontWeight: 300, lineHeight: 1.6 }}>
            Priced for the independent trainer. Lock in your rate today.
          </p>

          {/* Testimonial card (merged from social proof) */}
          <div className="max-w-[800px] mx-auto mb-5">
            <div
              className="flex flex-col items-center p-6 md:p-8 rounded-2xl gsap-fade"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.04)",
                backdropFilter: "blur(8px)",
              }}
            >
              <h4
                className="text-[14px] md:text-[15px] text-white/80 text-center mb-4"
                style={{ fontFamily: "var(--font-sans)", fontWeight: 500, lineHeight: 1.5 }}
              >
                From a notebook and WhatsApp threads to one app.
              </h4>
              <p
                className="text-[17px] md:text-[20px] text-white/65 text-center max-w-[560px]"
                style={{ lineHeight: 1.6, fontFamily: "var(--font-serif)", fontWeight: 400, fontStyle: "italic" }}
              >
                &ldquo;I used to run everything through WhatsApp and a notebook. Lost track of classes, payments, forgot who owed what. With Gymbo, I open the app, log the session, and move on.&rdquo;
              </p>

              <div className="flex items-center gap-3 mt-5 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                <div
                  className="w-[40px] h-[40px] rounded-full flex items-center justify-center text-[14px]"
                  style={{ background: `${ACCENT}15`, color: ACCENT, fontWeight: 600, fontFamily: "var(--font-sans)" }}
                >
                  S
                </div>
                <div className="flex flex-col">
                  <span className="text-[14px] text-white/75" style={{ fontWeight: 500 }}>Sarfaraz</span>
                  <span className="text-[12px] text-white/55">Fitness Trainer, Bangalore</span>
                </div>
              </div>
            </div>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 mb-6 gsap-fade">
            {["iOS Native", "UPI via Razorpay", "GST Compliant", "Built for India"].map((badge) => (
              <span
                key={badge}
                className="text-[11px] tracking-[0.08em] px-4 py-2 rounded-full"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.60)",
                  fontWeight: 500,
                  fontFamily: "var(--font-sans)",
                }}
              >
                {badge}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-[1100px] mx-auto">
            {PRICING_PLANS.map((plan) => {
              const isHighlight = plan.highlight;
              const cardBg = isHighlight ? ACCENT : "rgba(255,255,255,0.04)";
              const cardBorder = isHighlight ? `1px solid ${ACCENT}` : "1px solid rgba(255,255,255,0.06)";
              const textPrimary = isHighlight ? "#000" : "#fff";
              const textSecondary = isHighlight ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.65)";
              const textTertiary = isHighlight ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.6)";
              const ruleBg = isHighlight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.06)";
              const badgeBg = isHighlight ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.06)";
              const badgeBorder = isHighlight ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.1)";
              const badgeText = isHighlight ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.6)";
              const ctaBg = ACCENT;
              const ctaColor = "#000";
              const featureBadgeBg = isHighlight ? "rgba(0,0,0,0.1)" : `${ACCENT}18`;
              const featureBadgeBorder = isHighlight ? "rgba(0,0,0,0.15)" : `${ACCENT}30`;
              const featureBadgeText = isHighlight ? "rgba(0,0,0,0.7)" : ACCENT;

              return (
                <div
                  key={plan.name}
                  className={`relative flex flex-col rounded-3xl gsap-fade overflow-hidden${isHighlight ? " scale-[1.03] md:scale-[1.05] z-10" : ""}`}
                  style={{
                    background: cardBg,
                    border: cardBorder,
                    boxShadow: isHighlight ? "0 24px 80px color-mix(in srgb, var(--accent) 15%, transparent)" : "none",
                  }}
                >
                  <div className="flex flex-col p-6 md:p-8 flex-1">
                    {/* Top badge */}
                    <div className="flex items-start justify-between mb-5">
                      <span
                        className="inline-flex text-[10px] tracking-[0.15em] uppercase px-3 py-1.5 rounded-md"
                        style={{
                          background: badgeBg,
                          border: `1px solid ${badgeBorder}`,
                          color: badgeText,
                          fontFamily: "var(--font-sans)",
                          fontWeight: 600,
                        }}
                      >
                        {plan.tagline}
                      </span>
                      {isHighlight && (
                        <span
                          className="text-[13px] text-right"
                          style={{
                            fontFamily: "var(--font-serif)",
                            fontStyle: "italic",
                            fontWeight: 400,
                            color: "rgba(0,0,0,0.45)",
                            lineHeight: 1.3,
                          }}
                        >
                          Best value,<br />no question
                        </span>
                      )}
                    </div>

                    {/* Plan name */}
                    <h3
                      className="mb-4"
                      style={{
                        fontFamily: "var(--font-serif)",
                        fontWeight: 400,
                        fontSize: "clamp(32px, 4vw, 48px)",
                        lineHeight: 1,
                        color: textPrimary,
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {plan.name}
                    </h3>

                    {/* Price row */}
                    <div className="flex items-baseline gap-2 mb-2">
                      <span
                        className="tracking-[-0.03em]"
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontWeight: 500,
                          fontSize: "clamp(22px, 2.5vw, 28px)",
                          color: textPrimary,
                        }}
                      >
                        {"\u20B9"}{plan.priceINR}
                      </span>
                      <span
                        className="text-[12px] tracking-[0.1em] uppercase"
                        style={{ fontFamily: "var(--font-sans)", fontWeight: 400, color: textTertiary }}
                      >
                        {plan.period}
                      </span>
                    </div>

                    {/* Billing note */}
                    {plan.priceFull && (
                      <span className="text-[12px] mb-4" style={{ color: textTertiary, fontWeight: 300 }}>
                        {plan.priceFull}
                      </span>
                    )}

                    {!plan.priceFull && <div className="mb-4" />}

                    {/* Rule */}
                    <div className="h-[1px] mb-6" style={{ background: ruleBg }} />

                    {/* Description */}
                    <p className="text-[14px] mb-5" style={{ lineHeight: 1.6, fontWeight: 300, color: textSecondary }}>
                      {plan.desc}
                    </p>

                    {/* CTA button */}
                    <a
                      href="#"
                      onClick={(e) => { e.preventDefault(); scrollTo("cta"); }}
                      className="w-full h-12 rounded-xl text-[14px] tracking-[-0.01em] transition-all hover:opacity-90 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none text-center flex items-center justify-center"
                      style={{
                        background: ctaBg,
                        color: ctaColor,
                        fontFamily: "var(--font-sans)",
                        fontWeight: 600,
                      }}
                    >
                      {plan.cta}
                    </a>

                    {/* Benefits */}
                    <div className="mt-5">
                      <span
                        className="text-[13px] tracking-[-0.01em] mb-4 block"
                        style={{ fontFamily: "var(--font-serif)", fontWeight: 400, color: textPrimary }}
                      >
                        Includes:
                      </span>
                      <div className="flex flex-col gap-3">
                        {plan.features.map((f) => (
                          <div key={f} className="flex items-center gap-3">
                            <span
                              className="inline-flex items-center justify-center shrink-0 w-[22px] h-[22px] rounded-md text-[10px]"
                              style={{
                                background: featureBadgeBg,
                                border: `1px solid ${featureBadgeBorder}`,
                                color: featureBadgeText,
                                fontFamily: "var(--font-sans)",
                                fontWeight: 600,
                              }}
                            >
                              <Check size={12} strokeWidth={2.5} />
                            </span>
                            <span className="text-[13px]" style={{ lineHeight: 1.4, color: textSecondary, fontWeight: 400 }}>
                              {f}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Private alpha status */}
          <p className="text-center text-[12px] text-white/55 mt-8 gsap-fade">
            Private Alpha &middot; Bangalore &middot; 2026
          </p>
        </div>
      </section>

      {/* ======== CTA — JOIN ALPHA ======== */}
      <section
        id="cta"
        aria-label="Join the Private Alpha"
        className="relative py-10 md:py-14 px-5 md:px-8 overflow-hidden"
        style={{ background: SECTION_BG.waitlist }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[1px]"
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }}
        />
        <div
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[160px] opacity-[0.08]"
          style={{ background: ACCENT }}
        />

        <div className="relative max-w-[640px] mx-auto flex flex-col items-center text-center gsap-fade">
          <SectionLabel>Join the Private Alpha</SectionLabel>
          <SectionTitle>Ready to run your business from one app?</SectionTitle>

          <div className="flex flex-col items-center gap-4 mt-6 w-full">
            {/* Primary: waitlist form */}
            <WaitlistForm />

            {/* Secondary CTA: WhatsApp */}
            <a
              href="https://wa.me/918050131733?text=Hi%20Damini%2C%20I%27d%20like%20to%20try%20Gymbo"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2.5 px-8 h-12 rounded-xl text-[14px] transition-all hover:opacity-90 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
              style={{
                background: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.75)",
                border: "1px solid rgba(255,255,255,0.08)",
                fontWeight: 400,
                fontFamily: "var(--font-sans)",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
              </svg>
              Message us on WhatsApp
            </a>
          </div>

          <span className="text-[13px] text-white/65 mt-6">
            Free for 1 month &middot; No credit card &middot; iOS &middot; Private Alpha
          </span>
        </div>
      </section>

      {/* ======== FOOTER — BOUNCE EFFECT ======== */}
      <footer
        ref={footerRef}
        className="relative py-6 md:py-8 px-5 md:px-8 overflow-hidden"
        style={{ borderTop: "1px solid rgba(255,255,255,0.04)", background: SECTION_BG.footer }}
      >
        <div ref={footerInnerRef} className="max-w-[1100px] mx-auto">
          {/* Top row: brand + nav */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <span className="text-[13px] text-white/60" style={{ fontWeight: 300 }}>
              <span
                className="text-white tracking-[-0.02em]"
                style={{ fontFamily: "var(--font-serif)", fontWeight: 700 }}
              >
                Gymbo.
              </span>
              {" "}Your business, in your pocket.
            </span>

            <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-8 gap-y-2">
              {[
                { label: "Support", action: () => scrollTo("cta") },
                { label: "Terms of Service", href: "#" },
                { label: "Privacy Policy", href: "#" },
                { label: "Contact Us", href: "mailto:damini@materiallab.io" },
              ].map((link) => (
                "action" in link ? (
                  <button
                    key={link.label}
                    onClick={link.action}
                    className="text-[13px] text-white/65 hover:text-white/70 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none focus-visible:rounded"
                    style={{ fontWeight: 400 }}
                  >
                    {link.label}
                  </button>
                ) : (
                  <a
                    key={link.label}
                    href={link.href}
                    className="text-[13px] text-white/65 hover:text-white/70 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none focus-visible:rounded"
                    style={{ fontWeight: 400 }}
                  >
                    {link.label}
                  </a>
                )
              ))}
            </nav>
          </div>

          {/* Bottom row: email + social + copyright */}
          <div
            className="flex flex-col md:flex-row items-center justify-between gap-3 mt-4 pt-3"
            style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}
          >
            <a href="mailto:damini@materiallab.io" className="text-[12px] text-white/60 hover:text-white/80 transition-colors">
              damini@materiallab.io
            </a>
            <div className="flex items-center gap-4">
              <a
                href="https://www.linkedin.com/company/material-lab-io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] text-white/55 hover:text-white/80 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none focus-visible:rounded"
                style={{ fontWeight: 400 }}
              >
                LinkedIn
              </a>
              <a
                href="https://wa.me/918050131733"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] text-white/55 hover:text-white/80 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none focus-visible:rounded"
                style={{ fontWeight: 400 }}
              >
                WhatsApp
              </a>
              <span className="text-[11px] text-white/55">
                &copy; 2026 Material Lab.
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
