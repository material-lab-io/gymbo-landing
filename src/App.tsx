import { useEffect, useState } from "react";
import { Check, ArrowRight, Plus, Sun, Moon } from "lucide-react";
import { IPhoneMockup } from "react-device-mockup";
import "devices.css/dist/devices.min.css";
import { DemoFrame, type ThemeName, type ClipMap } from "./components/PhoneMockup";
import { WaitlistForm } from "./components/WaitlistForm";
import { useReducedMotion } from "./hooks/useReducedMotion";

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
const demoPoster = (id: string): string => (DEMOS_READY ? `/demos/${id}-light.png` : STANDIN_POSTER);

/* ============================================================================
   getgymbo.com — Forge redesign (epic gy-9bmwm)
   Founder-reviewed build: sentence case site-wide, NO gradients (flat Forge
   beige/charcoal + solid amber accent), REAL iPhone-15 frame PNG (public/
   iphone-15-frame.png) with screenshots composited inside, angled/perspective
   device presentation. Brand = Forge amber #F59E0B / marigold #FBBF24, accent
   only. Phone screens are PLACEHOLDERS (public/screens/*.png) — slots swap to
   real seeded shots from gy-mqk1n (ios_dev).
   ============================================================================ */

// Theme-reactive tokens resolve to CSS custom properties (see the <style> block:
// :root[data-theme=light|dark]). Charcoal/bone/marigold are always-dark-surface
// tokens (the contrast bands stay dark in both themes), so they're literal.
const F = {
  beige: "var(--c-bg)",
  beigeCard: "var(--c-card)",
  beigeCard2: "var(--c-card2)",
  beigeMuted: "var(--c-muted)",
  ink: "var(--c-ink)",
  inkMuted: "var(--c-ink-muted)",
  inkLabel: "var(--c-ink-label)",
  amber: "var(--c-brand)",
  marigold: "#fbbf24",
  amberText: "var(--c-brand-text)",
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

// Visual slots show a styled "here we'll show" BRIEF inside the iPhone-15 frame
// (founder direction) — these swap out for real-app video loops later (phased).

const WHATSAPP = "https://wa.me/918050131733?text=Hi%2C%20I%27d%20like%20to%20try%20Gymbo";

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

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
    chip: { kind: "money", text: "₹xxx received" },
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
    intro: "Build workouts, assign them to clients, and track real progress — adherence and per-exercise gains — with an AI assistant in your corner.",
    bullets: [
      "Build and assign workouts from a template library",
      "A muscle and body map for every plan",
      "Track client progress: logged sessions, adherence, per-exercise gains",
    ],
    brief: "Build a plan (squat, bench, row) and assign it to a client.",
    chip: { kind: "dark", k: "Adherence", v: "xx%" },
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

/* ── journey strip: the remaining real clips (all 8 ids get represented across
   hero composite + pillars + here). Clips are self-captioned, so no titles. ── */
const JOURNEY = ["client-list", "profile-qr", "ask-gymbo"];

/* ── trust metric tiles (PLACEHOLDER values — swap at launch) ── */
const METRICS = [
  { value: "xxx", label: "Trainers" },
  { value: "xxx", label: "Classes logged" },
  { value: "₹xxx", label: "Tracked" },
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
      style={{ background: "transparent", color: dark ? F.bone : F.ink, border: `1px solid ${dark ? "rgba(240,240,235,0.22)" : "var(--c-line)"}`, fontFamily: SANS, fontWeight: 500 }}
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

/* devices.css Apple Watch Ultra (MIT), scaled, with a "coming soon" badge */
function Watch({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div className={className} style={style}>
      <div style={{ position: "relative", width: 100, height: 106 }}>
        <div className="device device-apple-watch-ultra" style={{ transform: "scale(0.278)", transformOrigin: "top left" }}>
          <div className="device-frame">
            <div className="device-screen" style={{ display: "grid", placeItems: "center", alignContent: "center", gap: 18, background: "#0a0a0a" }}>
              <span style={{ display: "grid", placeItems: "center", width: 96, height: 96, borderRadius: 24, background: F.marigold, color: F.onCta, fontFamily: SANS, fontWeight: 700, fontSize: 56 }}>g</span>
              <span style={{ color: F.bone, fontFamily: SANS, fontWeight: 700, fontSize: 34, letterSpacing: 2 }}>9:41</span>
            </div>
          </div>
          <div className="device-stripe"></div>
          <div className="device-header"></div>
          <div className="device-btns"></div>
        </div>
        <span style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: -8, whiteSpace: "nowrap", borderRadius: 999, background: F.amber, color: F.onCta, fontFamily: SANS, fontSize: "10px", fontWeight: 700, letterSpacing: "0.04em", padding: "4px 10px", boxShadow: SHADOW.chip }}>
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
  const [theme, setTheme] = useState<ThemeName>(() => {
    if (typeof document !== "undefined") {
      const t = document.documentElement.getAttribute("data-theme");
      if (t === "dark") return "dark";
    }
    return "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("gymbo-theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

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
        :root,:root[data-theme="light"]{--c-bg:#fafaf7;--c-card:#eaeae5;--c-card2:#e8e8e3;--c-muted:#dcdcd9;--c-ink:#1a1a1a;--c-ink-muted:#555555;--c-ink-label:#595959;--c-brand:#f59e0b;--c-brand-text:#92400e;--c-line:rgba(26,26,26,.1);--c-nav-bg:rgba(250,250,247,.85)}
        :root[data-theme="dark"]{--c-bg:#0a0a0a;--c-card:#141414;--c-card2:#1c1c1e;--c-muted:#2c2c2e;--c-ink:#f0f0eb;--c-ink-muted:#b8b8b8;--c-ink-label:#a0a0a0;--c-brand:#fbbf24;--c-brand-text:#fbbf24;--c-line:rgba(240,240,235,.12);--c-nav-bg:rgba(10,10,10,.8)}
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
        style={{ background: "var(--c-nav-bg)", backdropFilter: "saturate(140%) blur(14px)", WebkitBackdropFilter: "saturate(140%) blur(14px)", borderBottom: "1px solid var(--c-line)" }}
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

            {/* hero = the single 2-phone composite demo clip (bare; baked frame + caption) */}
            <div className="flex items-center justify-center">
              <DemoFrame
                clip={demoClip("hero")}
                poster={demoPoster("hero")}
                theme={theme}
                label="Gymbo on iPhone — your clients and payments"
                maxWidth={400}
                className={`w-full ${prefersReduced ? "" : "hero-fade d6"}`}
              />
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
                      <Chip chip={p.chip} className="inline-flex" style={i % 2 === 1 ? { bottom: "12%", left: "-4%" } : { top: "12%", right: "-4%" }} />
                    </div>
                  </Reveal>
                </div>

                {p.id === "brand" && <BrandTouchpoints />}
              </div>
            );
          })}
        </section>

        {/* ───────── in-action strip (bare demo clips, self-captioned) ───────── */}
        <section aria-label="See Gymbo in action" style={{ background: F.charcoal }}>
          <div className="max-w-[1180px] mx-auto px-5 md:px-12 py-16 md:py-24">
            <Reveal className="text-center">
              <Eyebrow dark>A closer look</Eyebrow>
              <h2 className="text-[clamp(28px,4vw,44px)] font-black mx-auto" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", color: F.bone, maxWidth: "16ch" }}>
                See Gymbo in action.
              </h2>
            </Reveal>

            <div className="carousel mt-12 flex md:grid md:grid-cols-3 gap-5 md:gap-10 overflow-x-auto md:overflow-visible snap-x snap-mandatory -mx-5 px-5 md:mx-0 md:px-0">
              {JOURNEY.map((id) => (
                <Reveal key={id} className="snap-center shrink-0 w-[78vw] sm:w-[60vw] md:w-auto flex justify-center">
                  <DemoFrame clip={demoClip(id)} poster={demoPoster(id)} theme={theme} label={`Gymbo — ${id.replace(/-/g, " ")}`} maxWidth={260} />
                </Reveal>
              ))}
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
              <p className="text-[12px]" style={{ color: F.inkLabel, fontFamily: SANS }}>Placeholder — real figures at launch.</p>
            </Reveal>

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

            {/* Apple Watch coming-soon teaser (relocated out of the hero) */}
            <Reveal className="mt-12 flex flex-col items-center gap-4">
              <Watch />
              <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
                {["iPhone — coming soon", "Android — coming soon"].map((b) => (
                  <span key={b} className="text-[12px] px-4 py-2 rounded-full" style={{ background: "rgba(240,240,235,0.05)", border: "1px solid rgba(240,240,235,0.1)", color: F.boneLabel, fontFamily: SANS }}>{b}</span>
                ))}
              </div>
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
          <span className="block text-[13px] font-bold mb-2" style={{ color: F.marigold, fontFamily: SANS, letterSpacing: "0.04em" }}>Brand touchpoints</span>
          <h3 className="text-[clamp(22px,3vw,32px)] font-black mx-auto" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", color: F.bone, maxWidth: "24ch" }}>
            Your brand, everywhere — here now, more coming.
          </h3>
        </Reveal>
        <div className="carousel flex gap-5 overflow-x-auto snap-x snap-mandatory -mx-5 px-5 md:mx-0 md:px-0 pb-2">
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
