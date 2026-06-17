import { useEffect, useState } from "react";
import { Check, ArrowRight, Plus, Zap, Wallet } from "lucide-react";
import { WaitlistForm } from "./components/WaitlistForm";
import { useReducedMotion } from "./hooks/useReducedMotion";

/* ============================================================================
   getgymbo.com — Forge redesign (epic gy-9bmwm)
   Founder-reviewed build: sentence case site-wide, NO gradients (flat Forge
   beige/charcoal + solid amber accent), REAL iPhone-15 frame PNG (public/
   iphone-15-frame.png) with screenshots composited inside, angled/perspective
   device presentation. Brand = Forge amber #F59E0B / marigold #FBBF24, accent
   only. Phone screens are PLACEHOLDERS (public/screens/*.png) — slots swap to
   real seeded shots from gy-mqk1n (ios_dev).
   ============================================================================ */

const F = {
  beige: "#fafaf7",
  beigeCard: "#eaeae5",
  beigeCard2: "#e8e8e3",
  beigeMuted: "#dcdcd9",
  ink: "#1a1a1a",
  inkMuted: "#555555",
  inkLabel: "#595959",
  amber: "#f59e0b",
  marigold: "#fbbf24",
  amberText: "#92400e",
  onCta: "#1a1a1a",
  charcoal: "#0a0a0a",
  charcoalCard: "#141414",
  charcoalCard2: "#1c1c1e",
  bone: "#f0f0eb",
  boneMuted: "#b8b8b8",
  boneLabel: "#a0a0a0",
  green: "#15803d",
  red: "#b80f34",
};

const SHADOW = {
  cta: "0 1px 2px rgba(0,0,0,.08), 0 4px 12px rgba(0,0,0,.06)",
  chip: "0 1px 2px rgba(0,0,0,.10), 0 8px 24px -6px rgba(0,0,0,.18)",
  card: "0 1px 2px rgba(0,0,0,.06), 0 12px 32px -12px rgba(0,0,0,.12)",
};

const SERIF = "var(--font-serif)"; // Merriweather
const SANS = "var(--font-sans)"; // Open Sans
const FRAME = "/iphone-15-frame.png";

// Real seeded light-mode screenshots from the shipping build (gy-mqk1n, ios_dev)
const R = "/screens/real/";
const SCREENS = {
  heroWhoOwes: `${R}hero-02-who-owes-balance.png`,
  logPayment: `${R}hero-03-log-payment.png`,
  dashboard: `${R}hero-01-dashboard-clean.png`,
  ledger: `${R}revenue-01-ledger-history.png`,
  exportStatement: `${R}revenue-02-export-statement.png`,
  schedule: `${R}organized-01-schedule-day.png`,
  clientsList: `${R}organized-02-clients-list.png`,
  workoutTemplate: `${R}workouts-01-template-fullbody.png`,
  businessProfile: `${R}brand-01-business-profile.png`,
  qrCard: `${R}brand-02-qr-profile-card.png`,
  vitals: `${R}extra-vitals.png`,
  addClient: `${R}extra-add-client.png`,
  paymentReminders: `${R}extra-payment-reminders.png`,
};

const WHATSAPP = "https://wa.me/918050131733?text=Hi%2C%20I%27d%20like%20to%20try%20Gymbo";

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ── 4 pillars ── */
const PILLARS = [
  {
    id: "revenue",
    n: "01",
    eyebrow: "The Gymbo ledger",
    title: "Track your revenue",
    intro: "The Gymbo ledger tracks every class, payment, and balance automatically — so you always know who owes you.",
    bullets: [
      "Automatic balances: credit, classes left, who's overdue",
      "Log a payment in two taps",
      "Stop chasing money on WhatsApp",
    ],
    screen: SCREENS.ledger,
    chip: { kind: "money", text: "₹8,000 received" },
    dark: false,
  },
  {
    id: "organized",
    n: "02",
    eyebrow: "Your whole roster",
    title: "Get organized",
    intro: "Every client, schedule, and class in one place — not in your head.",
    bullets: [
      "One-tap punch to log a class",
      "Recurring time slots, sorted by day",
      "No more paper register or notes app",
    ],
    screen: SCREENS.schedule,
    chip: { kind: "dark", k: "Today", v: "Class logged" },
    dark: true,
  },
  {
    id: "brand",
    n: "03",
    eyebrow: "Look professional",
    title: "Your brand, your business",
    intro: "Your name and details on every statement your client sees — plus a QR profile card you can share anywhere.",
    bullets: [
      "Branded PDF statements — your name, tagline, and details on each one",
      "A shareable QR profile card in three styles",
      "Send any client their statement with a single tap",
    ],
    screen: SCREENS.businessProfile,
    chip: { kind: "money", text: "Looks pro" },
    dark: false,
  },
  {
    id: "workouts",
    n: "04",
    eyebrow: "Coaching tools",
    title: "Train smarter",
    intro: "Build workouts, assign them to clients, and track real progress — adherence and per-exercise gains — with an AI assistant in your corner.",
    bullets: [
      "Build and assign workouts from a template library",
      "A muscle and body map for every plan",
      "Track client progress: logged sessions, adherence, per-exercise gains",
    ],
    screen: SCREENS.workoutTemplate,
    chip: { kind: "dark", k: "Adherence", v: "92%" },
    dark: false,
  },
];

/* ── brand touchpoints ── */
const TOUCHPOINTS: { name: string; desc: string; screen: string; soon?: boolean }[] = [
  // Live now (real — no tag)
  { name: "Branded PDF statements", desc: "Your name, tagline, and details on every statement your client keeps", screen: SCREENS.exportStatement },
  { name: "QR profile card", desc: "Three styles — share it on WhatsApp or anywhere", screen: SCREENS.qrCard },
  { name: "Per-client share links", desc: "Send any client their statement with one tap", screen: SCREENS.businessProfile },
  { name: "Invoices, exported as PDF", desc: "Clean, professional PDFs with your details (India)", screen: SCREENS.exportStatement },
  // Coming soon (clearly tagged)
  { name: "In-app brand theming", desc: "Your colours across the app", screen: SCREENS.businessProfile, soon: true },
  { name: "Personalized URL", desc: "Your own Gymbo link", screen: SCREENS.qrCard, soon: true },
  { name: "Mini-site / public profile", desc: "A page clients can find you at", screen: SCREENS.businessProfile, soon: true },
  { name: "Shareable booking link", desc: "Let clients reach out to book", screen: SCREENS.qrCard, soon: true },
  { name: "Progress & client reports", desc: "Shareable progress summaries", screen: SCREENS.vitals, soon: true },
  { name: "Welcome + logo splash", desc: "Your logo on first open", screen: SCREENS.businessProfile, soon: true },
  { name: "Custom-branded client app", desc: "Your brand, your app", screen: SCREENS.dashboard, soon: true },
];

/* ── journey ── */
const JOURNEY = [
  { step: "01", title: "Add a client", caption: "Name and rate — that's it.", screen: SCREENS.addClient, icon: Plus },
  { step: "02", title: "Punch a class", caption: "One tap when they show up.", screen: SCREENS.schedule, icon: Zap },
  { step: "03", title: "See who owes you", caption: "Balance updates automatically.", screen: SCREENS.paymentReminders, icon: Wallet },
];

/* ── trust metric tiles (PLACEHOLDER values — swap at launch) ── */
const METRICS = [
  { value: "200+", label: "Trainers" },
  { value: "50,000+", label: "Classes logged" },
  { value: "₹2 Cr+", label: "Tracked" },
];

/* ── pricing ── */
const PRICING = [
  { name: "Flexible", tagline: "Monthly", price: "400", period: "/month", note: "Billed monthly. Cancel anytime.", features: ["Unlimited clients", "The Gymbo ledger", "Workouts + AI assistant", "Branded invoicing"], highlight: false },
  { name: "Quarterly", tagline: "Save 25%", price: "300", period: "/month", note: "Billed every 3 months at ₹900.", features: ["Everything in Flexible", "25% savings"], highlight: false },
  { name: "Annual", tagline: "Best value", price: "200", period: "/month", note: "Billed yearly at ₹2,400. Save 50%.", features: ["Everything in Flexible", "50% savings", "Lowest price, locked in"], highlight: true },
];

/* ── FAQ ── */
const FAQ = [
  { q: "Is it free?", a: "Your first month is free, no card required. After that, plans start at ₹200/month." },
  { q: "Do my clients need to download anything?", a: "No. Gymbo is for you, the trainer. Your clients just train — you log it." },
  { q: "Does it work offline?", a: "Yes. Log classes and payments without signal; everything syncs when you're back online." },
  { q: "Is my client data private?", a: "Your client data is yours. You can export it anytime, and we never contact your clients." },
  { q: "Which phones does it support?", a: "iPhone now. Android is coming soon — join the waitlist and we'll tell you first." },
  { q: "How do payments work?", a: "You record cash or UPI payments yourself. Gymbo keeps the running balance — it doesn't touch your money." },
  { q: "Can I import my existing clients?", a: "Yes. Bring your current roster over in minutes and pick up where you left off." },
];

/* ============================================================================
   building blocks
   ============================================================================ */

function Eyebrow({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-2 text-[12px] font-bold mb-5"
      style={{ letterSpacing: "0.08em", color: dark ? F.marigold : F.amberText, fontFamily: SANS }}
    >
      <span className="inline-block w-[7px] h-[7px] rounded-full" style={{ background: dark ? F.marigold : F.amber }} />
      {children}
    </span>
  );
}

function PrimaryCTA({ dark, size = "md", className = "", children = "Join the waitlist" }: { dark?: boolean; size?: "md" | "lg"; className?: string; children?: React.ReactNode }) {
  return (
    <button
      onClick={() => scrollToId("cta")}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-bold transition-transform duration-150 hover:-translate-y-px active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${size === "lg" ? "h-14 px-7 text-[15px]" : "h-12 px-6 text-[14px]"} ${className}`}
      style={{ background: dark ? F.marigold : F.amber, color: F.onCta, boxShadow: SHADOW.cta, fontFamily: SANS }}
    >
      {children}
      <ArrowRight size={16} aria-hidden="true" />
    </button>
  );
}

function SecondaryButton({ dark, children }: { dark?: boolean; children: React.ReactNode }) {
  return (
    <a
      href={WHATSAPP}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full text-[14px] transition-transform duration-150 hover:-translate-y-px active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2"
      style={{ background: "transparent", color: dark ? F.bone : F.ink, border: `1px solid ${dark ? "rgba(240,240,235,0.22)" : "rgba(26,26,26,0.2)"}`, fontFamily: SANS, fontWeight: 500 }}
    >
      {children}
    </a>
  );
}

function RiskReversal({ dark }: { dark?: boolean }) {
  return (
    <p className="text-[13px]" style={{ color: dark ? F.boneLabel : F.inkLabel, fontFamily: SANS }}>
      Free · no credit card
    </p>
  );
}

/* Real iPhone-15 frame PNG with the screenshot composited behind its transparent screen window */
function DeviceFrame({ src, alt, className = "", style }: { src: string; alt: string; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={className}
      style={{ position: "relative", aspectRatio: "868 / 1772", filter: "drop-shadow(0 22px 38px rgba(0,0,0,0.32))", ...style }}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        style={{ position: "absolute", top: "1.47%", left: "3.0%", width: "94.0%", height: "97.06%", objectFit: "cover", objectPosition: "top center", borderRadius: "14% / 6.8%", background: "#000", display: "block" }}
      />
      <img src={FRAME} alt="" aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", pointerEvents: "none" }} />
    </div>
  );
}

function Watch({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div className={className} style={style}>
      <div className="gwatch">
        <div className="gwatch-face">
          <span className="grid place-items-center rounded-[8px] font-bold" style={{ width: "34%", aspectRatio: "1", background: F.marigold, color: F.onCta, fontFamily: SANS, fontSize: "clamp(11px,5vw,16px)" }}>g</span>
          <span className="font-bold" style={{ color: F.bone, fontFamily: SANS, fontSize: "clamp(9px,3.4vw,12px)", letterSpacing: "0.04em" }}>9:41</span>
        </div>
        <span
          className="absolute left-1/2 -translate-x-1/2 -bottom-2.5 whitespace-nowrap rounded-full font-bold"
          style={{ background: F.amber, color: F.onCta, fontFamily: SANS, fontSize: "10px", letterSpacing: "0.04em", padding: "4px 10px", boxShadow: SHADOW.chip }}
        >
          Coming soon
        </span>
      </div>
    </div>
  );
}

function Chip({ chip, className = "", style }: { chip: { kind: string; text?: string; k?: string; v?: string }; className?: string; style?: React.CSSProperties }) {
  if (chip.kind === "money") {
    return (
      <div className={`absolute z-10 items-center gap-2 px-4 py-2.5 rounded-full ${className}`} style={{ background: F.amber, color: F.onCta, boxShadow: SHADOW.chip, ...style }}>
        <span className="grid place-items-center w-5 h-5 rounded-full text-[11px]" style={{ background: "rgba(26,26,26,0.16)" }}>↓</span>
        <span className="text-[14px] font-bold" style={{ fontFamily: SANS }}>{chip.text}</span>
      </div>
    );
  }
  return (
    <div className={`absolute z-10 items-center gap-2 px-4 py-2.5 rounded-full ${className}`} style={{ background: F.charcoal, color: F.bone, boxShadow: SHADOW.chip, ...style }}>
      <span className="text-[10px]" style={{ color: F.boneMuted, fontFamily: SANS }}>{chip.k}</span>
      <span className="text-[14px] font-bold" style={{ color: F.marigold, fontFamily: SANS }}>{chip.v}</span>
    </div>
  );
}

function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`reveal-on-scroll ${className}`}>{children}</div>;
}

/* ============================================================================
   page
   ============================================================================ */

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
    <div style={{ background: F.beige, color: F.ink, fontFamily: SERIF, lineHeight: 1.5 }}>
      <style>{`
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
        /* coming-soon apple watch — flat surfaces, no gradients */
        .gwatch{position:relative;aspect-ratio:1/1.2;background:#18181a;border-radius:30%;padding:6%;box-shadow:0 1px 2px rgba(0,0,0,.10),0 8px 24px -6px rgba(0,0,0,.22)}
        .gwatch-face{width:100%;height:100%;border-radius:24%;background:#0a0a0a;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6%}
        @media (prefers-reduced-motion:reduce){
          .hero-rise,.hero-fade{opacity:1!important;transform:none!important;animation:none!important}
          .reveal-on-scroll{opacity:1!important;transform:none!important;transition:none!important}
        }
      `}</style>

      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:px-4 focus:py-2 focus:rounded-lg" style={{ background: F.amber, color: F.onCta }}>
        Skip to content
      </a>

      {/* ───────── nav ───────── */}
      <nav
        aria-label="Main navigation"
        className="sticky top-0 z-40 flex items-center justify-between px-5 md:px-12 py-4"
        style={{ background: "rgba(250,250,247,0.85)", backdropFilter: "saturate(140%) blur(14px)", WebkitBackdropFilter: "saturate(140%) blur(14px)", borderBottom: "1px solid rgba(26,26,26,0.06)" }}
      >
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center gap-2.5 focus-visible:outline-none" aria-label="Gymbo — back to top">
          <span className="grid place-items-center w-[30px] h-[30px] rounded-[9px] font-bold text-[17px]" style={{ background: F.amber, color: F.onCta, fontFamily: SANS, boxShadow: SHADOW.cta }}>g</span>
          <span className="text-[20px] font-bold tracking-[-0.01em]" style={{ fontFamily: SERIF }}>Gymbo</span>
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

        <button onClick={() => scrollToId("cta")} className="inline-flex items-center h-11 px-5 rounded-full text-[13px] font-bold transition-transform duration-150 hover:-translate-y-px active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2" style={{ background: F.amber, color: F.onCta, fontFamily: SANS, boxShadow: SHADOW.cta }}>
          Get Gymbo
        </button>
      </nav>

      <main id="main">
        {/* ───────── hero ───────── */}
        <header style={{ background: F.beige }}>
          <div className="relative max-w-[1180px] mx-auto px-5 md:px-12 pt-10 md:pt-16 pb-16 md:pb-24 grid md:grid-cols-[1.05fr_.95fr] items-center gap-8 md:gap-16">
            <div className="max-w-[560px]">
              <div className={prefersReduced ? "" : "hero-rise d1"}>
                <Eyebrow>Private alpha · limited spots</Eyebrow>
              </div>
              <h1 className={`text-[clamp(34px,5.4vw,62px)] font-black ${prefersReduced ? "" : "hero-rise d2"}`} style={{ fontFamily: SERIF, lineHeight: 1.05, letterSpacing: "-0.022em" }}>
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
              <div className={`mt-4 ${prefersReduced ? "" : "hero-rise d5"}`}>
                <RiskReversal />
              </div>
            </div>

            {/* angled multi-device stage */}
            <div className="relative flex items-center justify-center min-h-[440px] md:min-h-[540px]" style={{ perspective: "1700px" }}>
              <DeviceFrame
                src={SCREENS.logPayment}
                alt="Gymbo — record a payment"
                className={`absolute w-[clamp(190px,22vw,240px)] hidden md:block ${prefersReduced ? "" : "hero-fade d6"}`}
                style={{ transform: "rotateY(18deg) rotateZ(-5deg) translateX(34%) scale(.9)", zIndex: 1 }}
              />
              <DeviceFrame
                src={SCREENS.heroWhoOwes}
                alt="Gymbo — client balance and who owes you"
                className={`relative w-[clamp(228px,27vw,272px)] ${prefersReduced ? "" : "hero-fade d6"}`}
                style={{ transform: "rotateY(-13deg) rotateZ(3deg) translateX(-6%)", zIndex: 2 }}
              />
              <Watch
                className={`absolute z-[3] w-[clamp(74px,13vw,104px)] ${prefersReduced ? "" : "hero-fade d7"}`}
                style={{ bottom: "8%", right: "1%", transform: "rotate(-8deg)" }}
              />
              <Chip chip={{ kind: "money", text: "₹8,000 received" }} className={`inline-flex ${prefersReduced ? "" : "hero-fade d7"}`} style={{ top: "11%", right: "1%" }} />
              <Chip chip={{ kind: "dark", k: "Balance", v: "12 classes" }} className={`hidden md:inline-flex ${prefersReduced ? "" : "hero-fade d7"}`} style={{ top: "44%", left: "-5%" }} />
            </div>
          </div>
        </header>

        {/* ───────── why — 4 pillars ───────── */}
        <section id="why" aria-label="Why trainers use Gymbo">
          <div className="max-w-[1180px] mx-auto px-5 md:px-12 pt-16 md:pt-24 pb-4 text-center">
            <Reveal>
              <Eyebrow>Why trainers use Gymbo</Eyebrow>
              <h2 className="text-[clamp(28px,4vw,44px)] font-black mx-auto" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", lineHeight: 1.1, maxWidth: "18ch" }}>
                Everything the back office of your business needs.
              </h2>
            </Reveal>
          </div>

          {PILLARS.map((p, i) => {
            const dark = p.dark;
            const angle = i % 2 === 1 ? "rotateY(12deg) rotateZ(2deg)" : "rotateY(-12deg) rotateZ(-2deg)";
            return (
              <div key={p.id} style={{ background: dark ? F.charcoal : F.beige }}>
                <div className={`max-w-[1180px] mx-auto px-5 md:px-12 py-16 md:py-24 grid md:grid-cols-2 items-center gap-10 md:gap-16 ${i % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""}`}>
                  <Reveal>
                    <span className="block text-[13px] font-bold mb-3" style={{ color: dark ? F.marigold : F.amberText, fontFamily: SANS, letterSpacing: "0.04em" }}>
                      {p.n} · {p.eyebrow}
                    </span>
                    <h3 className="text-[clamp(26px,3.4vw,40px)] font-black mb-4" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", lineHeight: 1.1, color: dark ? F.bone : F.ink }}>
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
                  </Reveal>

                  <Reveal className="relative flex items-center justify-center" >
                    <div className="relative" style={{ perspective: "1500px" }}>
                      <DeviceFrame src={p.screen} alt={`Gymbo — ${p.title}`} className="w-[clamp(220px,26vw,268px)]" style={{ transform: angle }} />
                      <Chip chip={p.chip} className="inline-flex" style={i % 2 === 1 ? { bottom: "12%", left: "-4%" } : { top: "12%", right: "-4%" }} />
                    </div>
                  </Reveal>
                </div>

                {p.id === "brand" && <BrandTouchpoints />}
              </div>
            );
          })}
        </section>

        {/* ───────── journey ───────── */}
        <section aria-label="Set up in under a minute" style={{ background: F.charcoal }}>
          <div className="max-w-[1180px] mx-auto px-5 md:px-12 py-16 md:py-24">
            <Reveal className="text-center">
              <Eyebrow dark>Three taps to set up</Eyebrow>
              <h2 className="text-[clamp(28px,4vw,44px)] font-black mx-auto" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", color: F.bone, maxWidth: "16ch" }}>
                Set up in under a minute.
              </h2>
            </Reveal>

            <div className="carousel mt-12 flex md:grid md:grid-cols-3 gap-5 md:gap-10 overflow-x-auto md:overflow-visible snap-x snap-mandatory -mx-5 px-5 md:mx-0 md:px-0" style={{ perspective: "1600px" }}>
              {JOURNEY.map((j, idx) => {
                const Icon = j.icon;
                return (
                  <Reveal key={j.step} className="snap-center shrink-0 w-[78vw] sm:w-[60vw] md:w-auto flex flex-col items-center text-center">
                    <div className="relative">
                      <DeviceFrame src={j.screen} alt={`Gymbo — ${j.title}`} className="w-[clamp(200px,24vw,236px)]" style={{ transform: idx === 1 ? "rotateY(0deg)" : idx === 0 ? "rotateY(-9deg) rotateZ(-2deg)" : "rotateY(9deg) rotateZ(2deg)" }} />
                      <span className="absolute -top-3 -left-1 grid place-items-center w-9 h-9 rounded-full text-[13px] font-bold z-10" style={{ background: F.marigold, color: F.onCta, fontFamily: SANS, boxShadow: SHADOW.chip }}>
                        <Icon size={16} strokeWidth={2.4} />
                      </span>
                    </div>
                    <h3 className="mt-6 text-[20px] font-bold" style={{ fontFamily: SERIF, color: F.bone }}>{j.title}</h3>
                    <p className="mt-1.5 text-[14px]" style={{ color: F.boneMuted, fontFamily: SANS }}>{j.caption}</p>
                  </Reveal>
                );
              })}
            </div>

            <Reveal className="mt-12 flex flex-col items-center gap-3">
              <PrimaryCTA dark size="lg" />
              <RiskReversal dark />
            </Reveal>
          </div>
        </section>

        {/* ───────── trust (positioning-led) ───────── */}
        <section aria-label="Trusted by trainers" style={{ background: F.beige }}>
          <div className="max-w-[1180px] mx-auto px-5 md:px-12 py-16 md:py-24">
            <Reveal className="text-center">
              <Eyebrow>Built in India, for Indian trainers</Eyebrow>
              <h2 className="text-[clamp(28px,4vw,44px)] font-black mx-auto" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", maxWidth: "22ch", lineHeight: 1.1 }}>
                The #1 app for professional fitness trainers in India.
              </h2>
              <p className="mt-4 text-[16px] mx-auto" style={{ color: F.inkMuted, fontFamily: SANS, maxWidth: "40ch" }}>
                Log classes, track revenue, look professional.
              </p>
            </Reveal>

            {/* metric tiles — placeholder values */}
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
              <p className="text-[12px]" style={{ color: F.inkLabel, fontFamily: SANS }}>Indicative figures — live counts at launch.</p>
            </Reveal>

            {/* testimonials */}
            <div className="mt-12 grid md:grid-cols-2 gap-6">
              <Reveal>
                <figure className="h-full flex flex-col p-7 md:p-8 rounded-[20px]" style={{ background: F.beigeCard, boxShadow: SHADOW.card }}>
                  <blockquote className="text-[17px] md:text-[19px] italic" style={{ fontFamily: SERIF, lineHeight: 1.55, color: F.ink }}>
                    “I used to run everything through WhatsApp and a notebook. Lost track of classes, payments, forgot who owed what. With Gymbo, I open the app, log the session, and move on.”
                  </blockquote>
                  <figcaption className="flex items-center gap-3 mt-6 pt-5" style={{ borderTop: "1px solid rgba(26,26,26,0.08)" }}>
                    <span className="grid place-items-center w-11 h-11 rounded-full text-[15px] font-bold" style={{ background: "rgba(245,158,11,0.15)", color: F.amberText, fontFamily: SANS }}>S</span>
                    <span className="flex flex-col">
                      <span className="text-[14px] font-bold" style={{ color: F.ink, fontFamily: SANS }}>Sarfaraz</span>
                      <span className="text-[12px]" style={{ color: F.inkLabel, fontFamily: SANS }}>Fitness trainer · Bangalore</span>
                    </span>
                  </figcaption>
                </figure>
              </Reveal>
              <Reveal>
                <div className="h-full flex flex-col items-center justify-center text-center p-7 md:p-8 rounded-[20px]" style={{ background: "transparent", border: "1px dashed rgba(26,26,26,0.18)" }}>
                  <span className="grid place-items-center w-11 h-11 rounded-full text-[15px] font-bold mb-4" style={{ background: "rgba(245,158,11,0.12)", color: F.amberText, fontFamily: SANS }}>+</span>
                  <p className="text-[15px]" style={{ color: F.inkMuted, fontFamily: SANS, lineHeight: 1.5, maxWidth: "26ch" }}>More alpha trainers are coming on board across India.</p>
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

            <div className="mt-12 grid md:grid-cols-3 gap-6 items-stretch">
              {PRICING.map((plan) => {
                const hi = plan.highlight;
                return (
                  <Reveal key={plan.name} className="flex">
                    <div className="flex flex-col w-full p-7 md:p-8 rounded-[20px]" style={{ background: hi ? F.marigold : F.charcoalCard, border: hi ? "none" : "1px solid rgba(240,240,235,0.08)" }}>
                      <span className="inline-flex self-start text-[11px] font-bold px-3 py-1.5 rounded-md mb-5" style={{ letterSpacing: "0.04em", background: hi ? "rgba(26,26,26,0.14)" : "rgba(240,240,235,0.06)", color: hi ? "rgba(26,26,26,0.75)" : F.boneMuted, fontFamily: SANS }}>
                        {plan.tagline}
                      </span>
                      <h3 className="text-[clamp(30px,4vw,42px)] font-black mb-3" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", color: hi ? F.onCta : F.bone, lineHeight: 1 }}>{plan.name}</h3>
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
              <p className="text-[13px]" style={{ color: F.boneLabel, fontFamily: SANS }}>Private alpha · first month free · no credit card.</p>
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
                  <details className="faq py-1" style={{ borderBottom: "1px solid rgba(26,26,26,0.1)" }}>
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
          </div>
        </section>

        {/* ───────── final cta ───────── */}
        <section id="cta" aria-label="Join the waitlist" style={{ background: F.charcoal }}>
          <div className="max-w-[640px] mx-auto px-5 md:px-12 py-16 md:py-24 flex flex-col items-center text-center">
            <Reveal>
              <Eyebrow dark>Private alpha · limited spots</Eyebrow>
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
              <RiskReversal dark />
            </Reveal>

            <Reveal className="mt-10 flex flex-wrap items-center justify-center gap-3">
              {["iPhone — coming soon", "Android — coming soon"].map((b) => (
                <span key={b} className="text-[12px] px-4 py-2 rounded-full" style={{ background: "rgba(240,240,235,0.05)", border: "1px solid rgba(240,240,235,0.1)", color: F.boneLabel, fontFamily: SANS }}>{b}</span>
              ))}
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
              <a href="#" className="text-[13px] transition-colors" style={{ color: F.boneMuted, fontFamily: SANS }}>Terms</a>
              <a href="#" className="text-[13px] transition-colors" style={{ color: F.boneMuted, fontFamily: SANS }}>Privacy</a>
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
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)", background: "rgba(250,250,247,0.92)", backdropFilter: "saturate(140%) blur(12px)", WebkitBackdropFilter: "saturate(140%) blur(12px)", borderTop: "1px solid rgba(26,26,26,0.08)", transform: showStickyCTA ? "translateY(0)" : "translateY(120%)" }}
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
          <span className="block text-[13px] font-bold mb-2" style={{ color: F.marigold, fontFamily: SANS, letterSpacing: "0.04em" }}>Brand touchpoints</span>
          <h3 className="text-[clamp(22px,3vw,32px)] font-black mx-auto" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", color: F.bone, maxWidth: "24ch" }}>
            Your brand, everywhere — here now, more coming.
          </h3>
        </Reveal>
        <div className="carousel flex gap-5 overflow-x-auto snap-x snap-mandatory -mx-5 px-5 md:mx-0 md:px-0 pb-2" style={{ perspective: "1600px" }}>
          {TOUCHPOINTS.map((t) => (
            <div key={t.name} className="relative snap-center shrink-0 w-[70vw] sm:w-[48vw] md:w-[260px] flex flex-col items-center text-center p-5 rounded-[20px]" style={{ background: F.charcoalCard, border: t.soon ? "1px dashed rgba(240,240,235,0.16)" : "1px solid rgba(240,240,235,0.08)" }}>
              {t.soon && (
                <span className="absolute top-3 right-3 z-10 rounded-full font-bold" style={{ background: F.amber, color: F.onCta, fontFamily: SANS, fontSize: "10px", letterSpacing: "0.02em", padding: "3px 9px", boxShadow: SHADOW.chip }}>Coming soon</span>
              )}
              <div style={t.soon ? { opacity: 0.5, filter: "grayscale(0.5)" } : undefined}>
                <DeviceFrame src={t.screen} alt={`Gymbo — ${t.name}${t.soon ? " (coming soon)" : ""}`} className="w-[clamp(150px,40vw,180px)]" style={{ transform: "rotateY(-8deg) rotateZ(-1deg)" }} />
              </div>
              <h4 className="mt-5 text-[16px] font-bold" style={{ fontFamily: SERIF, color: F.bone }}>{t.name}</h4>
              <p className="mt-1.5 text-[13px]" style={{ color: F.boneMuted, fontFamily: SANS, lineHeight: 1.5 }}>{t.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
