import { useEffect, useState } from "react";
import { Check, Plus, Sun, Moon } from "lucide-react";
import { IPhoneMockup } from "react-device-mockup";
import "devices.css/dist/devices.min.css";
import { DemoFrame, ScreenshotFrame, type ClipMap } from "./components/PhoneMockup";
import { WaitlistForm } from "./components/WaitlistForm";
import { useReducedMotion } from "./hooks/useReducedMotion";
import { F, SHADOW, SERIF, SANS, WHATSAPP, scrollToId, useTheme, ForgeStyle, Eyebrow, PrimaryCTA, SecondaryButton } from "./forge-ui";

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

/* Design tokens (F, SHADOW, SERIF, SANS), WHATSAPP, scrollToId, the theme hook,
   and the shared presentational primitives now live in ./forge-ui (SSOT shared
   with the comparison pages). */

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
    chip: { kind: "money", text: "₹2,400 received" },
    comingSoon: "",
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
    ],
    brief: "Your week, classes morning to evening — Ravi, Sara, group, Imran.",
    chip: { kind: "dark", k: "Today", v: "Class logged" },
    comingSoon: "Coming soon: travel-aware scheduling — slots that respect your commute.",
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
    chip: { kind: "money", text: "Looks pro" },
    comingSoon: "",
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
    ],
    brief: "Build a plan (squat, bench, row) and assign it to a client.",
    chip: { kind: "dark", k: "Adherence", v: "92%" },
    comingSoon: "Coming soon: AI “navigate to your next session” — directions to your next class.",
    dark: false,
  },
];

/* ── brand touchpoints ── */
const TOUCHPOINTS: { name: string; desc: string; soon?: boolean }[] = [
  // Live now (real — no tag)
  { name: "QR profile card", desc: "Your shareable pro card — name, city, QR to connect." },
  { name: "Per-client share links", desc: "Send any client their statement with one tap." },
  { name: "Invoices, exported as PDF", desc: "Clean, professional PDFs with your details (India)." },
  // Coming soon (clearly tagged)
  { name: "In-app brand theming", desc: "Your colours across the app.", soon: true },
  { name: "Personalized URL", desc: "Your own Gymbo link.", soon: true },
  { name: "Mini-site / public profile", desc: "A page clients can find you at.", soon: true },
  { name: "Shareable booking link", desc: "Let clients reach out to book.", soon: true },
  { name: "Fitness reports", desc: "Shareable client progress summaries.", soon: true },
  { name: "Welcome + logo splash", desc: "Your logo on first open.", soon: true },
  { name: "Custom-branded client app", desc: "Your brand, your app.", soon: true },
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

/* ── trust metric tiles (PLACEHOLDER values — swap at launch) ── */
// METRICS hidden until real launch figures exist (marketer QA gy-dhcj1) — re-add real numbers here, then uncomment the render block in the trust section.
// const METRICS = [
//   { value: "xxx", label: "Trainers" },
//   { value: "xxx", label: "Classes logged" },
//   { value: "₹xxx", label: "Tracked" },
// ];

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

/* react-device-mockup iPhone 15 Pro (MIT, dynamic island) with a styled
   "here we'll show" BRIEF as the screen content. Inner content swaps
   brief → screenshot → muted-loop video later; the frame stays put. */
function BriefFrame({ brief, label = "Here we'll show", screenWidth = 224, className = "", style }: { brief: string; label?: string; screenWidth?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={className} style={{ filter: "drop-shadow(3px 22px 45px rgba(20,20,30,0.18)) drop-shadow(1px 6px 14px rgba(20,20,30,0.10))", lineHeight: 0, ...style }}>
      <IPhoneMockup screenWidth={screenWidth} screenType="island" frameColor="#1a1a1a" hideStatusBar hideNavBar>
        <div style={{ width: "100%", height: "100%", background: F.beige, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "14% 11%", textAlign: "center", lineHeight: 1.5 }}>
          {label && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: F.amberText, fontFamily: SANS, fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em", marginBottom: "8%" }}>
              <span aria-hidden="true">▶</span> {label}
            </span>
          )}
          <p style={{ color: F.ink, fontFamily: SERIF, fontSize: "13px", lineHeight: 1.5 }}>{brief}</p>
        </div>
      </IPhoneMockup>
    </div>
  );
}

function Chip({ chip, className = "", style }: { chip: { kind: string; text?: string; k?: string; v?: string }; className?: string; style?: React.CSSProperties }) {
  if (chip.kind === "money") {
    return (
      <div className={`absolute z-10 items-center gap-1.5 px-3 py-1.5 rounded-full ${className}`} style={{ background: F.amber, color: F.onCta, boxShadow: SHADOW.chip, ...style }}>
        <span className="grid place-items-center w-4 h-4 rounded-full text-[9px]" style={{ background: "rgba(26,26,26,0.16)" }}>↓</span>
        <span className="text-[12px] font-bold" style={{ fontFamily: SANS }}>{chip.text}</span>
      </div>
    );
  }
  return (
    <div className={`absolute z-10 items-center gap-1.5 px-3 py-1.5 rounded-full ${className}`} style={{ background: F.charcoal, color: F.bone, boxShadow: SHADOW.chip, ...style }}>
      <span className="text-[9px]" style={{ color: F.boneMuted, fontFamily: SANS }}>{chip.k}</span>
      <span className="text-[12px] font-bold" style={{ color: F.marigold, fontFamily: SANS }}>{chip.v}</span>
    </div>
  );
}

function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`reveal-on-scroll ${className}`}>{children}</div>;
}

/* ============================================================================
   page
   ============================================================================ */

/* Hero device — a real screenshot (optimized WebP from public/screens/gallery)
   in a plain rounded bezel, sized large to bleed (competitor scale, gy-k2543.10). */
function HeroPhone({ slug, alt = "", theme, className = "", style }: { slug: string; alt?: string; theme: "light" | "dark"; className?: string; style?: React.CSSProperties }) {
  const bezel = theme === "dark" ? "#000" : "#1a1a1a";
  const base = `/screens/gallery/${slug}`;
  return (
    <div className={className} style={{ background: bezel, borderRadius: 56, padding: 12, boxShadow: "0 70px 120px -28px rgba(10,10,8,.55)", lineHeight: 0, ...style }}>
      <div style={{ borderRadius: 44, overflow: "hidden", background: "#fff", aspectRatio: "1206 / 2622" }}>
        <picture>
          <source type="image/webp" srcSet={`${base}-540.webp 540w, ${base}-720.webp 720w, ${base}-1080.webp 1080w`} sizes="(min-width: 1024px) 42vw, 86vw" />
          <img src={`${base}.png`} alt={alt} decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center", display: "block" }} />
        </picture>
      </div>
    </div>
  );
}

/* Floating Forge UI chip beside the hero device — seeded-positive only.
   Sized down relative to the (now smaller) hero device (gy-pzefj item 3). */
function HeroChip({ variant, className = "", style }: { variant: "logged" | "paid"; className?: string; style?: React.CSSProperties }) {
  const paid = variant === "paid";
  return (
    <div className={`absolute z-10 flex items-center gap-2.5 ${className}`} style={{ background: F.beigeCard, border: "1px solid var(--c-line)", borderRadius: 14, padding: "10px 14px", boxShadow: "0 24px 44px -16px rgba(10,10,8,.35)", ...style }}>
      <span className="grid place-items-center shrink-0" style={{ width: 30, height: 30, borderRadius: 9, fontWeight: 800, fontSize: 14, background: paid ? F.amber : "#16a34a", color: paid ? "#1a1a1a" : "#fff", fontFamily: SANS }}>{paid ? "₹" : "✓"}</span>
      <div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 12.5, color: F.ink, lineHeight: 1.2 }}>{paid ? "₹12,000 received" : "Class logged"}</div>
        <div style={{ fontFamily: SANS, fontSize: 10.5, color: F.inkMuted, marginTop: 2 }}>{paid ? "Balance updated" : "Aadesh · 1 tap"}</div>
      </div>
    </div>
  );
}

export default function App() {
  const prefersReduced = useReducedMotion();
  const [showStickyCTA, setShowStickyCTA] = useState(false);
  const { theme, setTheme } = useTheme();

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
    <div style={{ background: F.beige, color: F.ink, fontFamily: SERIF, lineHeight: 1.5 }}>
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
            src={theme === "dark" ? "/gymbo-mark-amber-ff9800.svg" : "/gymbo-mark-darkorange-9d3900.svg"}
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
          <button
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
            aria-pressed={theme === "dark"}
            data-theme-toggle
            className="grid place-items-center w-11 h-11 rounded-full transition-transform duration-150 hover:-translate-y-px active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2"
            style={{ background: F.beigeCard, color: F.ink, border: "1px solid var(--c-line)" }}
          >
            {theme === "light" ? <Moon size={17} strokeWidth={1.8} aria-hidden="true" /> : <Sun size={17} strokeWidth={1.8} aria-hidden="true" />}
          </button>
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
        <header className="relative overflow-hidden" style={{ background: F.beige }}>
          {/* desktop device stage — absolute to the section, bleeds past 1180 off the top/right edges.
              Stage 30vw + text 46% = 76% at the lg breakpoint (1024px) (gy-pzefj: was 38vw + 46% = 84%,
              Kaushik flagged it as still too big; gy-v5ltl before that was 50vw + 52% = 102%, guaranteed
              to overlap). The dashboard phone no longer bleeds past the stage's right edge, and the
              schedule (calendar) phone sits further out from behind it so more of it reads as visible —
              was ~59% visible, now ~78%. */}
          <div aria-hidden="true" className={`hidden lg:block absolute inset-y-0 right-0 z-[1] ${prefersReduced ? "" : "hero-fade d6"}`} style={{ width: "min(30vw, 520px)" }}>
            <HeroPhone slug="schedule" theme={theme} className="absolute" style={{ width: "min(15vw, 210px)", top: 190, right: "min(18.4vw, 262px)", transform: "rotate(-6deg)", opacity: 0.96 }} />
            <HeroPhone slug="hero-dashboard" theme={theme} className="absolute" style={{ width: "min(22vw, 310px)", top: -20, right: "0vw" }} />
            <HeroChip variant="logged" style={{ top: 110, right: "min(19vw, 270px)" }} />
            <HeroChip variant="paid" style={{ top: 400, right: "min(12vw, 170px)" }} />
          </div>

          <div className="relative z-[2] max-w-[1180px] mx-auto px-5 md:px-12 pt-10 md:pt-16 pb-16 md:pb-24">
            <div className="max-w-[600px] lg:w-[46%]">
              <div className={prefersReduced ? "" : "hero-rise d1"}>
                <Eyebrow>In beta</Eyebrow>
              </div>
              <h1 className={`text-[clamp(34px,5.4vw,62px)] font-black ${prefersReduced ? "" : "hero-rise d2"}`} style={{ fontFamily: SERIF, lineHeight: 1.5, letterSpacing: "-0.022em" }}>
                Run your entire{" "}
                <span className="relative whitespace-nowrap" style={{ color: F.amberText }}>
                  fitness business
                  <span aria-hidden="true" className="absolute left-0 right-0 -z-0" style={{ bottom: "0.05em", height: "0.16em", background: F.amber, borderRadius: 2, opacity: 0.85 }} />
                </span>{" "}
                from your phone.
              </h1>
              <p className={`mt-6 text-[clamp(15px,1.6vw,18px)] ${prefersReduced ? "" : "hero-rise d3"}`} style={{ color: F.inkMuted, fontWeight: 300, lineHeight: 1.6, maxWidth: "46ch" }}>
                <b style={{ color: F.ink, fontWeight: 400 }}>Track revenue, stay organized, look professional, train smarter</b> — built for independent trainers in India.
              </p>
              <div className={`mt-8 flex flex-col sm:flex-row sm:items-center gap-3.5 ${prefersReduced ? "" : "hero-rise d4"}`}>
                <PrimaryCTA size="lg" />
                <SecondaryButton>Talk to us</SecondaryButton>
              </div>
              {/* mobile / tablet device — below copy, ~86vw, chips hidden, bleeds off the bottom */}
              <div className={`lg:hidden mt-12 -mb-16 md:-mb-24 flex justify-center ${prefersReduced ? "" : "hero-fade d6"}`}>
                <HeroPhone slug="hero-dashboard" alt="Gymbo — a client's punch card, 3 of 10 classes" theme={theme} style={{ width: "min(74vw, 320px)" }} />
              </div>
            </div>
          </div>
        </header>

        {/* ───────── why — 4 pillars ───────── */}
        <section id="why" aria-label="Why trainers use Gymbo">
          <div className="max-w-[1180px] mx-auto px-5 md:px-12 pt-16 md:pt-24 pb-4 text-center">
            <Reveal>
              <Eyebrow>Why trainers use Gymbo</Eyebrow>
              <h2 className="text-[clamp(28px,4vw,44px)] font-black mx-auto" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", lineHeight: 1.5, maxWidth: "18ch" }}>
                Everything the back office of your business needs.
              </h2>
            </Reveal>
          </div>

          {PILLARS.map((p, i) => {
            const dark = p.dark;
            return (
              <div key={p.id} style={{ background: dark ? F.charcoal : F.beige }}>
                <div className={`max-w-[1180px] mx-auto px-5 md:px-12 py-16 md:py-24 grid md:grid-cols-2 items-center gap-10 md:gap-16 ${i % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""}`}>
                  <Reveal>
                    <span className="block text-[13px] font-bold mb-3" style={{ color: dark ? F.marigold : F.amberText, fontFamily: SANS, letterSpacing: "0.04em" }}>
                      {p.n} · {p.eyebrow}
                    </span>
                    <h3 className="text-[clamp(26px,3.4vw,40px)] font-black mb-4" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", lineHeight: 1.5, color: dark ? F.bone : F.ink }}>
                      {p.title}
                    </h3>
                    <p className="text-[15px] md:text-[16px] mb-6" style={{ color: dark ? F.boneMuted : F.inkMuted, fontWeight: 300, lineHeight: 1.6, maxWidth: "44ch" }}>
                      {p.intro}
                    </p>
                    <ul className="flex flex-col gap-3">
                      {p.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-3">
                          <span className="grid place-items-center shrink-0 w-[22px] h-[22px] rounded-md mt-0.5" style={{ background: dark ? "rgba(251,191,36,0.14)" : "rgba(245,158,11,0.14)", color: dark ? F.marigold : F.amberText }}>
                            <Check size={13} strokeWidth={2.5} />
                          </span>
                          <span className="text-[14px] md:text-[15px]" style={{ color: dark ? F.bone : F.ink, fontFamily: SANS, lineHeight: 1.5 }}>{b}</span>
                        </li>
                      ))}
                    </ul>
                    {p.comingSoon && (
                      <div className="mt-6 flex items-start gap-2.5">
                        <span
                          className="shrink-0 rounded-full font-bold mt-0.5"
                          style={{ background: dark ? F.marigold : F.amber, color: F.onCta, fontFamily: SANS, fontSize: "10px", letterSpacing: "0.04em", padding: "3px 9px" }}
                        >
                          Soon
                        </span>
                        <span className="text-[13px] md:text-[14px]" style={{ color: dark ? F.boneMuted : F.inkMuted, fontFamily: SANS, lineHeight: 1.5 }}>
                          {p.comingSoon.replace(/^Coming soon:\s*/, "")}
                        </span>
                      </div>
                    )}
                  </Reveal>

                  <Reveal className="relative flex items-center justify-center" >
                    <div className="relative">
                      <DemoFrame
                        clip={demoClip(p.demoId)}
                        poster={demoPoster(p.demoId)}
                        theme={theme}
                        label={`${p.title} — demo`}
                        maxWidth={300}
                        comingSoon={p.id === "organized" ? "Travel-aware · soon" : p.id === "workouts" ? "AI navigate · soon" : undefined}
                      />
                      {/* Chip floats OUTSIDE the composed demo asset (which bakes its own
                          heading + caption text into the frame) so it never occludes them
                          (gy-pzefj item 3: "Looks pro" was overlapping the demo's own
                          "Branded statement" heading; "Class logged" was overlapping the
                          demo's own bottom caption). */}
                      <Chip chip={p.chip} className="inline-flex" style={i % 2 === 1 ? { bottom: "-6%", left: "-6%" } : { top: "-6%", right: "-6%" }} />
                    </div>
                  </Reveal>
                </div>

                {p.id === "brand" && <BrandTouchpoints />}
              </div>
            );
          })}
        </section>

        {/* ───────── in-action gallery (current real-app screenshots, framed) ───────── */}
        <section aria-label="See Gymbo in action" style={{ background: F.charcoal }}>
          <div className="max-w-[1180px] mx-auto px-5 md:px-12 py-16 md:py-24">
            <Reveal className="text-center">
              <Eyebrow dark>A closer look</Eyebrow>
              <h2 className="text-[clamp(28px,4vw,44px)] font-black mx-auto" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", color: F.bone, maxWidth: "16ch" }}>
                See Gymbo in action.
              </h2>
            </Reveal>

            <div className="carousel mt-14 flex gap-6 md:gap-10 overflow-x-auto snap-x snap-mandatory -mx-5 px-5 md:mx-0 md:px-0 pb-2" role="region" aria-label="See Gymbo in action gallery">
              {SCREENS.map((s) => (
                <div key={s.slug} tabIndex={0} className="snap-center shrink-0 flex flex-col items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
                  <ScreenshotFrame slug={s.slug} alt={s.alt} screenWidth={360} />
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
              <h2 className="text-[clamp(28px,4vw,44px)] font-black mx-auto" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", maxWidth: "22ch", lineHeight: 1.5 }}>
                Made for independent fitness trainers in India.
              </h2>
              <p className="mt-4 text-[16px] mx-auto" style={{ color: F.inkMuted, fontFamily: SANS, maxWidth: "40ch" }}>
                Log classes, track revenue, look professional.
              </p>
            </Reveal>

            {/* metric tiles HIDDEN until real launch figures exist — were literal "xxx" on prod (marketer QA gy-dhcj1; spec: build empty slots, fill post-launch). Re-enable by populating METRICS and uncommenting.
            <div className="mt-10 grid grid-cols-3 gap-3 md:gap-6">
              {METRICS.map((m) => (
                <Reveal key={m.label}>
                  <div className="h-full flex flex-col items-center justify-center text-center px-3 py-6 md:py-8 rounded-[16px]" style={{ background: F.beigeCard }}>
                    <span className="font-black" style={{ fontFamily: SERIF, color: F.amberText, fontSize: "clamp(22px,4vw,40px)", letterSpacing: "-0.02em" }}>{m.value}</span>
                    <span className="mt-1 text-[12px] md:text-[14px]" style={{ color: F.inkMuted, fontFamily: SANS }}>{m.label}</span>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal className="text-center mt-3">
              <p className="text-[12px]" style={{ color: F.inkLabel, fontFamily: SANS }}>Placeholder — real figures at launch.</p>
            </Reveal>
            */}

            {/* testimonials */}
            <div className="mt-12 grid md:grid-cols-2 gap-6">
              <Reveal>
                <figure className="h-full flex flex-col p-7 md:p-8 rounded-[20px]" style={{ background: F.beigeCard, boxShadow: SHADOW.card }}>
                  <blockquote className="text-[17px] md:text-[19px] italic" style={{ fontFamily: SERIF, lineHeight: 1.55, color: F.ink }}>
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
                <div className="h-full flex flex-col items-center justify-center text-center p-7 md:p-8 rounded-[20px]" style={{ background: "transparent", border: "1px dashed var(--c-line)" }}>
                  <span className="grid place-items-center w-11 h-11 rounded-full text-[15px] font-bold mb-4" style={{ background: "rgba(245,158,11,0.12)", color: F.amberText, fontFamily: SANS }}>+</span>
                  <p className="text-[15px]" style={{ color: F.inkMuted, fontFamily: SANS, lineHeight: 1.5, maxWidth: "26ch" }}>More trainers are coming on board across India.</p>
                </div>
              </Reveal>
            </div>

            <div className="mt-10 grid sm:grid-cols-2 gap-4">
              <Reveal>
                <div className="p-6 rounded-[16px]" style={{ background: F.beigeCard }}>
                  <h4 className="text-[15px] font-bold mb-1.5" style={{ fontFamily: SANS, color: F.ink }}>Your client data is yours</h4>
                  <p className="text-[14px]" style={{ color: F.inkMuted, fontFamily: SANS, lineHeight: 1.55 }}>Export anytime. We never contact your clients.</p>
                </div>
              </Reveal>
              <Reveal>
                <div className="p-6 rounded-[16px]" style={{ background: F.beigeCard }}>
                  <h4 className="text-[15px] font-bold mb-1.5" style={{ fontFamily: SANS, color: F.ink }}>Why we built Gymbo</h4>
                  <p className="text-[14px]" style={{ color: F.inkMuted, fontFamily: SANS, lineHeight: 1.55 }}>We watched trainers run their whole business on WhatsApp threads and paper registers — so we built Gymbo.</p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ───────── pricing ───────── */}
        <section id="pricing" aria-label="Pricing" style={{ background: F.charcoal }}>
          <div className="max-w-[1180px] mx-auto px-5 md:px-12 py-16 md:py-24">
            <Reveal className="text-center">
              <Eyebrow dark>Pricing</Eyebrow>
              <h2 className="text-[clamp(28px,4vw,44px)] font-black mx-auto" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", color: F.bone, maxWidth: "20ch" }}>
                Less than one missed session.
              </h2>
            </Reveal>

            <div className="mt-12 grid md:grid-cols-2 gap-6 items-stretch max-w-[720px] mx-auto">
              {PRICING.map((plan) => {
                const hi = plan.highlight;
                return (
                  <Reveal key={plan.name} className="flex">
                    <div className="flex flex-col w-full p-7 md:p-8 rounded-[20px]" style={{ background: hi ? F.marigold : F.charcoalCard, border: hi ? "none" : "1px solid rgba(240,240,235,0.08)" }}>
                      <span className="inline-flex self-start text-[11px] font-bold px-3 py-1.5 rounded-md mb-5" style={{ letterSpacing: "0.04em", background: hi ? "rgba(26,26,26,0.14)" : "rgba(240,240,235,0.06)", color: hi ? "rgba(26,26,26,0.75)" : F.boneMuted, fontFamily: SANS }}>
                        {plan.tagline}
                      </span>
                      <h3 className="text-[clamp(30px,4vw,42px)] font-black mb-3" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", color: hi ? F.onCta : F.bone, lineHeight: 1.5 }}>{plan.name}</h3>
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
              <h2 className="text-[clamp(28px,4vw,44px)] font-black mx-auto" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", maxWidth: "16ch" }}>
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
        <section id="cta" aria-label="Join the waitlist" style={{ background: F.charcoal }}>
          <div className="max-w-[640px] mx-auto px-5 md:px-12 py-16 md:py-24 flex flex-col items-center text-center">
            <Reveal>
              <Eyebrow dark>In beta</Eyebrow>
              <h2 className="text-[clamp(30px,4.5vw,48px)] font-black mx-auto" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", color: F.bone, maxWidth: "16ch" }}>
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

            {/* Apple Watch coming-soon teaser (relocated out of the hero) — plain text only,
                the devices.css mockup below it was removed (gy-5hw2m): it rendered as a generic
                smartwatch shape carrying the Gymbo "g" mark, not an Apple Watch icon/logo, which
                read as broken/off-brand rather than communicating "Apple Watch". */}
            <Reveal className="mt-12 flex flex-col items-center gap-4">
              <span className="text-[12px] px-4 py-2 rounded-full" style={{ background: F.amber, color: F.onCta, fontFamily: SANS, fontWeight: 700, letterSpacing: "0.04em" }}>Apple Watch — coming soon</span>
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

/* ── brand-touchpoints carousel (under the "Your brand" pillar) ── */
function BrandTouchpoints() {
  return (
    <div style={{ background: F.charcoal }}>
      <div className="max-w-[1180px] mx-auto px-5 md:px-12 pb-16 md:pb-24 -mt-4 md:-mt-8">
        <Reveal className="text-center mb-8">
          <span className="block text-[13px] font-bold mb-4" style={{ color: F.marigold, fontFamily: SANS, letterSpacing: "0.04em" }}>Brand touchpoints</span>
          <h3 className="text-[clamp(22px,3vw,32px)] font-black mx-auto" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", color: F.bone, maxWidth: "24ch" }}>
            Your brand, everywhere — here now, more coming.
          </h3>
        </Reveal>
        <div className="carousel flex gap-5 overflow-x-auto snap-x snap-mandatory -mx-5 px-5 md:mx-0 md:px-0 pb-2" tabIndex={0} role="region" aria-label="Brand touchpoints">
          {TOUCHPOINTS.map((t) => (
            <div key={t.name} className="relative snap-center shrink-0 w-[70vw] sm:w-[48vw] md:w-[260px] flex flex-col items-center text-center p-5 rounded-[20px]" style={{ background: F.charcoalCard, border: t.soon ? "1px dashed rgba(240,240,235,0.16)" : "1px solid rgba(240,240,235,0.08)" }}>
              {t.soon && (
                <span className="absolute top-3 right-3 z-10 rounded-full font-bold" style={{ background: F.amber, color: F.onCta, fontFamily: SANS, fontSize: "10px", letterSpacing: "0.02em", padding: "3px 9px", boxShadow: SHADOW.chip }}>Coming soon</span>
              )}
              <div style={t.soon ? { opacity: 0.6 } : undefined}>
                <BriefFrame brief={t.desc} label="" screenWidth={150} />
              </div>
              <h4 className="mt-5 text-[16px] font-bold" style={{ fontFamily: SERIF, color: F.bone }}>{t.name}</h4>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
