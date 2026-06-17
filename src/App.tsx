import { useEffect, useRef, useState } from "react";
import { Check, ArrowRight, Plus, Zap, Wallet } from "lucide-react";
import { WaitlistForm } from "./components/WaitlistForm";
import { useReducedMotion } from "./hooks/useReducedMotion";

/* ============================================================================
   getgymbo.com — Forge redesign (epic gy-9bmwm.7/.8/.9)
   Built to the marketer redesign spec (2026-06-17) + designer hero artifact of
   record (936b539). Brand = FORGE amber #F59E0B (light) / marigold #FBBF24
   (dark) used as ACCENT only — NO coral/orange #f8623a, NO left-stripe callouts.
   Section rhythm flips beige <-> charcoal so no container repeats twice.
   Phone screens are PLACEHOLDERS (public/screens/*.png) — slots ready to swap
   the real seeded iPhone-15 screenshots from gy-mqk1n (ios_dev).
   ============================================================================ */

/* ── Forge tokens (mirror src/forge/forge.css) ── */
const F = {
  beige: "#fafaf7",
  beigeCard: "#eaeae5",
  beigeCard2: "#e8e8e3",
  beigeMuted: "#dcdcd9",
  ink: "#1a1a1a",
  inkMuted: "#555555",
  inkLabel: "#595959",
  amber: "#f59e0b", // light brand fill
  marigold: "#fbbf24", // dark brand fill / brand-as-text on dark
  amberText: "#92400e", // amber-as-text on light (AA)
  onCta: "#1a1a1a", // dark ink on amber/marigold
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
  phone: "0 2px 8px rgba(0,0,0,.10), 0 24px 60px -12px rgba(0,0,0,.28)",
  chip: "0 1px 2px rgba(0,0,0,.10), 0 8px 24px -6px rgba(0,0,0,.18)",
  card: "0 1px 2px rgba(0,0,0,.06), 0 12px 32px -12px rgba(0,0,0,.12)",
};

const SERIF = "var(--font-serif)"; // Merriweather
const SANS = "var(--font-sans)"; // Open Sans

const SCREENS = {
  clients: "/screens/screen-hero.png?v=3",
  payments: "/screens/screen-payments.png?v=3",
  schedule: "/screens/screen-schedule.png?v=3",
  brand: "/screens/screen-brand.png?v=3",
  profile: "/screens/screen-profile.png?v=3",
  ai: "/screens/screen-ai.png?v=3",
  checkin: "/screens/screen-checkin.png?v=3",
};

const WHATSAPP =
  "https://wa.me/918050131733?text=Hi%2C%20I%27d%20like%20to%20try%20Gymbo";

const CTA_LABEL = "join the waitlist — free, no card";

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ── 4 emotion-led pillars ── */
const PILLARS = [
  {
    id: "revenue",
    n: "01",
    eyebrow: "the gymbo ledger",
    title: "track your revenue",
    intro:
      "the gymbo ledger tracks every class, payment, and balance automatically — so you always know who owes you.",
    bullets: [
      "automatic balances: credit, classes left, who's overdue",
      "log a payment in two taps",
      "stop chasing money on whatsapp",
    ],
    screen: SCREENS.payments,
    chip: { kind: "money", text: "₹8,000 received" },
    dark: false,
  },
  {
    id: "organized",
    n: "02",
    eyebrow: "your whole roster",
    title: "get organized",
    intro: "every client, schedule, and class in one place — not in your head.",
    bullets: [
      "one tap to log a class",
      "recurring slots and reminders",
      "no more paper register or notes app",
    ],
    screen: SCREENS.schedule,
    chip: { kind: "dark", k: "today", v: "class logged" },
    dark: true,
  },
  {
    id: "brand",
    n: "03",
    eyebrow: "look professional",
    title: "your brand, your business",
    intro:
      "show up like the professional you are — a branded profile, invoices, and reminders that carry your name.",
    bullets: [
      "branded pdf invoices and statements",
      "a public profile + qr clients can book from",
      "reminders that look like you sent them",
    ],
    screen: SCREENS.brand,
    chip: { kind: "money", text: "looks pro" },
    dark: false,
  },
  {
    id: "smarter",
    n: "04",
    eyebrow: "level up",
    title: "train smarter",
    intro:
      "an assistant that knows your coaching style — draft plans, answer client questions, see what needs attention.",
    bullets: [
      "draft workout plans in your style",
      "ask anything about your clients and numbers",
      "spend evenings training, not on admin",
    ],
    screen: SCREENS.ai,
    chip: { kind: "dark", k: "insight", v: "3 clients overdue" },
    dark: false,
  },
];

/* ── brand-touchpoints carousel ── */
const TOUCHPOINTS = [
  { name: "public profile page", desc: "a shareable page that is unmistakably you", screen: SCREENS.profile },
  { name: "qr booking card", desc: "clients scan and book a trial in seconds", screen: SCREENS.brand },
  { name: "branded pdf invoices", desc: "professional invoices with your name and logo", screen: SCREENS.payments },
  { name: "branded statements", desc: "clean exports clients can keep", screen: SCREENS.payments },
  { name: "book-a-trial link", desc: "one link to fill your open slots", screen: SCREENS.profile },
  { name: "payment reminders", desc: "polite nudges that look like you sent them", screen: SCREENS.brand },
  { name: "brand & logo settings", desc: "set it once, it shows up everywhere", screen: SCREENS.brand },
];

/* ── 3-step journey ── */
const JOURNEY = [
  { step: "01", title: "add a client", caption: "name and rate — that's it.", screen: SCREENS.checkin, icon: Plus },
  { step: "02", title: "punch a class", caption: "one tap when they show up.", screen: SCREENS.schedule, icon: Zap },
  { step: "03", title: "see who owes you", caption: "balance updates automatically.", screen: SCREENS.clients, icon: Wallet },
];

/* ── pricing (resolved ₹400/300/200) ── */
const PRICING = [
  {
    name: "flexible",
    tagline: "monthly",
    price: "400",
    period: "/month",
    note: "billed monthly. cancel anytime.",
    features: ["unlimited clients", "the gymbo ledger", "ai assistant", "branded invoicing"],
    highlight: false,
  },
  {
    name: "quarterly",
    tagline: "save 25%",
    price: "300",
    period: "/month",
    note: "billed every 3 months at ₹900.",
    features: ["everything in flexible", "25% savings"],
    highlight: false,
  },
  {
    name: "annual",
    tagline: "best value",
    price: "200",
    period: "/month",
    note: "billed yearly at ₹2,400. save 50%.",
    features: ["everything in flexible", "50% savings", "lowest price, locked in"],
    highlight: true,
  },
];

/* ── FAQ ── */
const FAQ = [
  { q: "is it free?", a: "your first month is free, no card required. after that, plans start at ₹200/month." },
  { q: "do my clients need to download anything?", a: "no. gymbo is for you, the trainer. your clients just train — you log it." },
  { q: "does it work offline?", a: "yes. log classes and payments without signal; everything syncs when you're back online." },
  { q: "is my client data private?", a: "your client data is yours. you can export it anytime, and we never contact your clients." },
  { q: "which phones does it support?", a: "iphone now. android is coming soon — join the waitlist and we'll tell you first." },
  { q: "how do payments work?", a: "you record cash or upi payments yourself. gymbo keeps the running balance — it doesn't touch your money." },
  { q: "can i import my existing clients?", a: "yes. bring your current roster over in minutes and pick up where you left off." },
];

/* ============================================================================
   small building blocks
   ============================================================================ */

function Eyebrow({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-2 text-[11px] font-bold uppercase mb-5"
      style={{
        letterSpacing: "0.16em",
        color: dark ? F.marigold : F.amberText,
        fontFamily: SANS,
      }}
    >
      <span
        className="inline-block w-[7px] h-[7px] rounded-full"
        style={{ background: dark ? F.marigold : F.amber }}
      />
      {children}
    </span>
  );
}

function WaitlistButton({
  dark,
  size = "md",
  className = "",
}: {
  dark?: boolean;
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <button
      onClick={() => scrollToId("cta")}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-bold lowercase transition-transform duration-150 hover:-translate-y-px active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
        size === "lg" ? "h-14 px-7 text-[15px]" : "h-12 px-6 text-[14px]"
      } ${className}`}
      style={{
        background: dark ? F.marigold : F.amber,
        color: F.onCta,
        boxShadow: SHADOW.cta,
        fontFamily: SANS,
        letterSpacing: "0.01em",
      }}
    >
      {CTA_LABEL}
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
      className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full text-[14px] lowercase transition-transform duration-150 hover:-translate-y-px active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2"
      style={{
        background: "transparent",
        color: dark ? F.bone : F.ink,
        border: `1px solid ${dark ? "rgba(240,240,235,0.22)" : "rgba(26,26,26,0.2)"}`,
        fontFamily: SANS,
        fontWeight: 500,
      }}
    >
      {children}
    </a>
  );
}

function Phone({
  src,
  alt,
  className = "",
  style,
}: {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={`h-auto ${className}`}
      style={{
        borderRadius: "clamp(20px,9%,40px)",
        boxShadow: SHADOW.phone,
        ...style,
      }}
    />
  );
}

function Chip({
  chip,
  className = "",
  style,
}: {
  chip: { kind: string; text?: string; k?: string; v?: string };
  className?: string;
  style?: React.CSSProperties;
}) {
  if (chip.kind === "money") {
    return (
      <div
        className={`absolute z-10 inline-flex items-center gap-2 px-4 py-2.5 rounded-full ${className}`}
        style={{ background: F.amber, color: F.onCta, boxShadow: SHADOW.chip, ...style }}
      >
        <span
          className="grid place-items-center w-5 h-5 rounded-full text-[11px]"
          style={{ background: "rgba(26,26,26,0.16)" }}
        >
          ↓
        </span>
        <span className="text-[14px] font-bold" style={{ fontFamily: SANS }}>
          {chip.text}
        </span>
      </div>
    );
  }
  return (
    <div
      className={`absolute z-10 inline-flex items-center gap-2 px-4 py-2.5 rounded-full ${className}`}
      style={{ background: F.charcoal, color: F.bone, boxShadow: SHADOW.chip, ...style }}
    >
      <span className="text-[10px] lowercase" style={{ color: F.boneMuted, fontFamily: SANS }}>
        {chip.k}
      </span>
      <span className="text-[14px] font-bold" style={{ color: F.marigold, fontFamily: SANS }}>
        {chip.v}
      </span>
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
  const rootRef = useRef<HTMLDivElement>(null);

  /* scroll-reveal via IntersectionObserver (light, mobile-safe) */
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

  /* mobile sticky CTA appears after the hero */
  useEffect(() => {
    const onScroll = () => setShowStickyCTA(window.scrollY > window.innerHeight * 0.8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      ref={rootRef}
      style={{ background: F.beige, color: F.ink, fontFamily: SERIF, lineHeight: 1.5 }}
    >
      <style>{`
        .reveal-on-scroll{opacity:0;transform:translateY(20px);transition:opacity .6s cubic-bezier(.22,.9,.3,1),transform .6s cubic-bezier(.22,.9,.3,1)}
        .reveal-on-scroll.is-visible{opacity:1;transform:none}
        @keyframes g-rise{to{opacity:1;transform:none}}
        @keyframes g-pop{to{opacity:1;transform:scale(1)}}
        @keyframes g-pulse{0%,100%{box-shadow:0 0 0 4px rgba(245,158,11,.18)}50%{box-shadow:0 0 0 7px rgba(245,158,11,.04)}}
        .hero-rise{opacity:0;transform:translateY(16px);animation:g-rise .7s cubic-bezier(.22,.9,.3,1) forwards}
        .hero-pop{opacity:0;transform:scale(.8);animation:g-pop .55s cubic-bezier(.34,1.56,.64,1) forwards}
        .d1{animation-delay:.05s}.d2{animation-delay:.16s}.d3{animation-delay:.30s}.d4{animation-delay:.44s}.d5{animation-delay:.58s}
        .d6{animation-delay:.95s}.d7{animation-delay:1.1s}
        .carousel{scrollbar-width:none}
        .carousel::-webkit-scrollbar{display:none}
        details.faq>summary{list-style:none;cursor:pointer}
        details.faq>summary::-webkit-details-marker{display:none}
        details.faq[open] .faq-plus{transform:rotate(45deg)}
        @media (prefers-reduced-motion:reduce){
          .hero-rise,.hero-pop{opacity:1!important;transform:none!important;animation:none!important}
          .reveal-on-scroll{opacity:1!important;transform:none!important;transition:none!important}
        }
      `}</style>

      {/* skip link */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:px-4 focus:py-2 focus:rounded-lg"
        style={{ background: F.amber, color: F.onCta }}
      >
        skip to content
      </a>

      {/* ───────── sticky nav ───────── */}
      <nav
        aria-label="Main navigation"
        className="sticky top-0 z-40 flex items-center justify-between px-5 md:px-12 py-4"
        style={{
          background: "rgba(250,250,247,0.78)",
          backdropFilter: "saturate(140%) blur(14px)",
          WebkitBackdropFilter: "saturate(140%) blur(14px)",
          borderBottom: "1px solid rgba(26,26,26,0.06)",
        }}
      >
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="flex items-center gap-2.5 focus-visible:outline-none"
          aria-label="gymbo — back to top"
        >
          <span
            className="grid place-items-center w-[30px] h-[30px] rounded-[9px] font-bold text-[17px]"
            style={{ background: F.amber, color: F.onCta, fontFamily: SANS, boxShadow: SHADOW.cta }}
          >
            g
          </span>
          <span className="text-[20px] font-bold tracking-[-0.01em]" style={{ fontFamily: SERIF }}>
            gymbo
          </span>
        </button>

        <div className="hidden md:flex items-center gap-8">
          {[
            { label: "why gymbo", id: "why" },
            { label: "pricing", id: "pricing" },
            { label: "faq", id: "faq" },
          ].map((l) => (
            <button
              key={l.id}
              onClick={() => scrollToId(l.id)}
              className="text-[14px] lowercase transition-colors hover:opacity-100"
              style={{ color: F.inkMuted, fontFamily: SANS, fontWeight: 500 }}
            >
              {l.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => scrollToId("cta")}
          className="inline-flex items-center h-11 px-5 rounded-full text-[13px] font-bold lowercase transition-transform duration-150 hover:-translate-y-px active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2"
          style={{ background: F.amber, color: F.onCta, fontFamily: SANS, boxShadow: SHADOW.cta, letterSpacing: "0.02em" }}
        >
          get gymbo
        </button>
      </nav>

      <main id="main">
        {/* ───────── hero ───────── */}
        <header
          className="relative overflow-hidden"
          style={{ background: F.beige }}
        >
          {/* warm amber bloom */}
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(58% 48% at 80% 36%, rgba(245,158,11,.16), rgba(245,158,11,0) 70%), radial-gradient(40% 40% at 10% 80%, rgba(245,158,11,.07), rgba(245,158,11,0) 70%)",
            }}
          />
          <div className="relative max-w-[1180px] mx-auto px-5 md:px-12 pt-10 md:pt-16 pb-16 md:pb-24 grid md:grid-cols-[1.05fr_.95fr] items-center gap-8 md:gap-16">
            {/* copy */}
            <div className="max-w-[560px]">
              <div className={prefersReduced ? "" : "hero-rise d1"}>
                <Eyebrow>private alpha · limited spots</Eyebrow>
              </div>
              <h1
                className={`text-[clamp(34px,5.4vw,62px)] font-black lowercase ${prefersReduced ? "" : "hero-rise d2"}`}
                style={{ fontFamily: SERIF, lineHeight: 1.04, letterSpacing: "-0.022em" }}
              >
                run your entire{" "}
                <span className="relative whitespace-nowrap" style={{ color: F.amberText }}>
                  fitness business
                  <span
                    aria-hidden="true"
                    className="absolute left-0 right-0 -z-0"
                    style={{
                      bottom: "0.06em",
                      height: "0.18em",
                      background: `linear-gradient(90deg, ${F.amber}, rgba(245,158,11,.35))`,
                      borderRadius: 2,
                      opacity: 0.55,
                    }}
                  />
                </span>{" "}
                from your phone.
              </h1>
              <p
                className={`mt-6 text-[clamp(15px,1.6vw,18px)] ${prefersReduced ? "" : "hero-rise d3"}`}
                style={{ color: F.inkMuted, fontWeight: 300, lineHeight: 1.6, maxWidth: "46ch" }}
              >
                <b style={{ color: F.ink, fontWeight: 400 }}>
                  track revenue · stay organized · look professional · train smarter
                </b>{" "}
                — built for independent trainers in india.
              </p>
              <div className={`mt-8 flex flex-col sm:flex-row gap-3.5 ${prefersReduced ? "" : "hero-rise d4"}`}>
                <WaitlistButton size="lg" />
                <SecondaryButton>talk to us</SecondaryButton>
              </div>
              <p
                className={`mt-6 text-[13px] lowercase ${prefersReduced ? "" : "hero-rise d5"}`}
                style={{ color: F.inkLabel, fontFamily: SANS }}
              >
                no app-store wait ·{" "}
                <b style={{ color: F.amberText }}>stop chasing payments on whatsapp</b>
              </p>
            </div>

            {/* two-phone stage */}
            <div className="relative flex items-center justify-center min-h-[420px] md:min-h-[520px]">
              {/* back phone — log payment */}
              <Phone
                src={SCREENS.payments}
                alt="Gymbo — log a payment (placeholder)"
                className={`absolute w-[clamp(190px,22vw,250px)] hidden md:block ${prefersReduced ? "" : "hero-pop d6"}`}
                style={{ transform: "translate(34%,-8%) rotate(6deg) scale(.92)" }}
              />
              {/* front phone — client list */}
              <Phone
                src={SCREENS.clients}
                alt="Gymbo — clients and balances (placeholder)"
                className={`relative z-[2] w-[clamp(230px,28vw,280px)] ${prefersReduced ? "" : "hero-pop d6"}`}
                style={{ transform: "rotate(-2deg)" }}
              />
              {/* chips */}
              <Chip
                chip={{ kind: "money", text: "₹8,000 received" }}
                className={prefersReduced ? "" : "hero-pop d7"}
                style={{ top: "12%", right: "2%" }}
              />
              <Chip
                chip={{ kind: "dark", k: "balance", v: "12 classes" }}
                className={`hidden md:inline-flex ${prefersReduced ? "" : "hero-pop d7"}`}
                style={{ bottom: "13%", left: "0%" }}
              />
            </div>
          </div>
        </header>

        {/* ───────── why trainers use gymbo — 4 pillars ───────── */}
        <section id="why" aria-label="Why trainers use gymbo">
          {/* header sits on beige (continues from hero) */}
          <div className="max-w-[1180px] mx-auto px-5 md:px-12 pt-16 md:pt-24 pb-4 text-center">
            <Reveal>
              <Eyebrow>why trainers use gymbo</Eyebrow>
              <h2
                className="text-[clamp(28px,4vw,44px)] font-black lowercase mx-auto"
                style={{ fontFamily: SERIF, letterSpacing: "-0.02em", lineHeight: 1.08, maxWidth: "16ch" }}
              >
                everything the back office of your business needs.
              </h2>
            </Reveal>
          </div>

          {PILLARS.map((p, i) => {
            const dark = p.dark;
            return (
              <div
                key={p.id}
                style={{ background: dark ? F.charcoal : F.beige }}
              >
                <div
                  className={`max-w-[1180px] mx-auto px-5 md:px-12 py-16 md:py-24 grid md:grid-cols-2 items-center gap-10 md:gap-16 ${
                    i % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""
                  }`}
                >
                  {/* text */}
                  <Reveal>
                    <span
                      className="block text-[13px] font-bold mb-3"
                      style={{ color: dark ? F.marigold : F.amberText, fontFamily: SANS, letterSpacing: "0.04em" }}
                    >
                      {p.n} · {p.eyebrow}
                    </span>
                    <h3
                      className="text-[clamp(26px,3.4vw,40px)] font-black lowercase mb-4"
                      style={{
                        fontFamily: SERIF,
                        letterSpacing: "-0.02em",
                        lineHeight: 1.08,
                        color: dark ? F.bone : F.ink,
                      }}
                    >
                      {p.title}
                    </h3>
                    <p
                      className="text-[15px] md:text-[16px] mb-6"
                      style={{ color: dark ? F.boneMuted : F.inkMuted, fontWeight: 300, lineHeight: 1.6, maxWidth: "42ch" }}
                    >
                      {p.intro}
                    </p>
                    <ul className="flex flex-col gap-3">
                      {p.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-3">
                          <span
                            className="grid place-items-center shrink-0 w-[22px] h-[22px] rounded-md mt-0.5"
                            style={{
                              background: dark ? "rgba(251,191,36,0.14)" : "rgba(245,158,11,0.14)",
                              color: dark ? F.marigold : F.amberText,
                            }}
                          >
                            <Check size={13} strokeWidth={2.5} />
                          </span>
                          <span
                            className="text-[14px] md:text-[15px] lowercase"
                            style={{ color: dark ? F.bone : F.ink, fontFamily: SANS, lineHeight: 1.5 }}
                          >
                            {b}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Reveal>

                  {/* phone */}
                  <Reveal className="relative flex items-center justify-center">
                    <Phone
                      src={p.screen}
                      alt={`Gymbo — ${p.title} (placeholder)`}
                      className="w-[clamp(220px,26vw,270px)]"
                      style={{ transform: i % 2 === 1 ? "rotate(2deg)" : "rotate(-2deg)" }}
                    />
                    <Chip
                      chip={p.chip}
                      style={i % 2 === 1 ? { bottom: "12%", left: "2%" } : { top: "12%", right: "2%" }}
                    />
                  </Reveal>
                </div>

                {/* brand-touchpoints carousel sits right under the brand pillar (03) */}
                {p.id === "brand" && <BrandTouchpoints />}
              </div>
            );
          })}
        </section>

        {/* ───────── journey strip ───────── */}
        <section aria-label="Set up in under a minute" style={{ background: F.charcoal }}>
          <div className="max-w-[1180px] mx-auto px-5 md:px-12 py-16 md:py-24">
            <Reveal className="text-center">
              <Eyebrow dark>three taps to set up</Eyebrow>
              <h2
                className="text-[clamp(28px,4vw,44px)] font-black lowercase mx-auto"
                style={{ fontFamily: SERIF, letterSpacing: "-0.02em", color: F.bone, maxWidth: "14ch" }}
              >
                set up in under a minute.
              </h2>
            </Reveal>

            <div className="carousel mt-12 flex md:grid md:grid-cols-3 gap-5 md:gap-10 overflow-x-auto md:overflow-visible snap-x snap-mandatory -mx-5 px-5 md:mx-0 md:px-0">
              {JOURNEY.map((j) => {
                const Icon = j.icon;
                return (
                  <Reveal
                    key={j.step}
                    className="snap-center shrink-0 w-[78vw] sm:w-[60vw] md:w-auto flex flex-col items-center text-center"
                  >
                    <div className="relative">
                      <Phone src={j.screen} alt={`Gymbo — ${j.title} (placeholder)`} className="w-[clamp(200px,24vw,240px)]" />
                      <span
                        className="absolute -top-3 -left-1 grid place-items-center w-9 h-9 rounded-full text-[13px] font-bold"
                        style={{ background: F.marigold, color: F.onCta, fontFamily: SANS, boxShadow: SHADOW.chip }}
                      >
                        <Icon size={16} strokeWidth={2.4} />
                      </span>
                    </div>
                    <h3
                      className="mt-6 text-[20px] font-bold lowercase"
                      style={{ fontFamily: SERIF, color: F.bone }}
                    >
                      {j.title}
                    </h3>
                    <p className="mt-1.5 text-[14px] lowercase" style={{ color: F.boneMuted, fontFamily: SANS }}>
                      {j.caption}
                    </p>
                  </Reveal>
                );
              })}
            </div>

            <Reveal className="mt-12 flex justify-center">
              <WaitlistButton dark size="lg" />
            </Reveal>
          </div>
        </section>

        {/* ───────── trust (testimonials-led) ───────── */}
        <section aria-label="Trusted by trainers" style={{ background: F.beige }}>
          <div className="max-w-[1180px] mx-auto px-5 md:px-12 py-16 md:py-24">
            <Reveal className="text-center">
              <Eyebrow>built in india, for indian trainers</Eyebrow>
              <h2
                className="text-[clamp(28px,4vw,44px)] font-black lowercase mx-auto"
                style={{ fontFamily: SERIF, letterSpacing: "-0.02em", maxWidth: "18ch" }}
              >
                trainers across india are switching.
              </h2>
            </Reveal>

            {/* testimonials */}
            <div className="mt-12 grid md:grid-cols-2 gap-6">
              <Reveal>
                <figure
                  className="h-full flex flex-col p-7 md:p-8 rounded-[20px]"
                  style={{ background: F.beigeCard, boxShadow: SHADOW.card }}
                >
                  <blockquote
                    className="text-[17px] md:text-[19px] italic"
                    style={{ fontFamily: SERIF, lineHeight: 1.55, color: F.ink }}
                  >
                    “i used to run everything through whatsapp and a notebook. lost track of classes,
                    payments, forgot who owed what. with gymbo, i open the app, log the session, and move on.”
                  </blockquote>
                  <figcaption className="flex items-center gap-3 mt-6 pt-5" style={{ borderTop: "1px solid rgba(26,26,26,0.08)" }}>
                    <span
                      className="grid place-items-center w-11 h-11 rounded-full text-[15px] font-bold"
                      style={{ background: "rgba(245,158,11,0.15)", color: F.amberText, fontFamily: SANS }}
                    >
                      S
                    </span>
                    <span className="flex flex-col">
                      <span className="text-[14px] font-bold lowercase" style={{ color: F.ink, fontFamily: SANS }}>sarfaraz</span>
                      <span className="text-[12px] lowercase" style={{ color: F.inkLabel, fontFamily: SANS }}>fitness trainer · bangalore</span>
                    </span>
                  </figcaption>
                </figure>
              </Reveal>

              {/* empty structural slot — fill with the real Tiger (Mumbai) quote post-launch */}
              <Reveal>
                <div
                  className="h-full flex flex-col items-center justify-center text-center p-7 md:p-8 rounded-[20px]"
                  style={{ background: "transparent", border: "1px dashed rgba(26,26,26,0.18)" }}
                >
                  <span
                    className="grid place-items-center w-11 h-11 rounded-full text-[15px] font-bold mb-4"
                    style={{ background: "rgba(245,158,11,0.12)", color: F.amberText, fontFamily: SANS }}
                  >
                    +
                  </span>
                  <p className="text-[15px] lowercase" style={{ color: F.inkMuted, fontFamily: SANS, lineHeight: 1.5, maxWidth: "26ch" }}>
                    more alpha trainers are coming on board across india.
                  </p>
                </div>
              </Reveal>
            </div>

            {/* trust promises */}
            <div className="mt-10 grid sm:grid-cols-2 gap-4">
              <Reveal>
                <div className="p-6 rounded-[16px]" style={{ background: F.beigeCard }}>
                  <h4 className="text-[15px] font-bold lowercase mb-1.5" style={{ fontFamily: SANS, color: F.ink }}>
                    your client data is yours
                  </h4>
                  <p className="text-[14px] lowercase" style={{ color: F.inkMuted, fontFamily: SANS, lineHeight: 1.55 }}>
                    export anytime. we never contact your clients.
                  </p>
                </div>
              </Reveal>
              <Reveal>
                <div className="p-6 rounded-[16px]" style={{ background: F.beigeCard }}>
                  <h4 className="text-[15px] font-bold lowercase mb-1.5" style={{ fontFamily: SANS, color: F.ink }}>
                    why we built gymbo
                  </h4>
                  <p className="text-[14px] lowercase" style={{ color: F.inkMuted, fontFamily: SANS, lineHeight: 1.55 }}>
                    we watched trainers run their whole business on whatsapp threads and paper registers — so we built gymbo.
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ───────── pricing ───────── */}
        <section id="pricing" aria-label="Pricing" style={{ background: F.charcoal }}>
          <div className="max-w-[1180px] mx-auto px-5 md:px-12 py-16 md:py-24">
            <Reveal className="text-center">
              <Eyebrow dark>pricing</Eyebrow>
              <h2
                className="text-[clamp(28px,4vw,44px)] font-black lowercase mx-auto"
                style={{ fontFamily: SERIF, letterSpacing: "-0.02em", color: F.bone, maxWidth: "20ch" }}
              >
                less than one missed session.
              </h2>
            </Reveal>

            <div className="mt-12 grid md:grid-cols-3 gap-6 items-stretch">
              {PRICING.map((plan) => {
                const hi = plan.highlight;
                return (
                  <Reveal key={plan.name} className="flex">
                    <div
                      className="flex flex-col w-full p-7 md:p-8 rounded-[20px]"
                      style={{
                        background: hi ? F.marigold : F.charcoalCard,
                        border: hi ? "none" : "1px solid rgba(240,240,235,0.08)",
                        boxShadow: hi ? "0 24px 70px -20px rgba(251,191,36,0.45)" : "none",
                      }}
                    >
                      <span
                        className="inline-flex self-start text-[10px] font-bold uppercase px-3 py-1.5 rounded-md mb-5"
                        style={{
                          letterSpacing: "0.12em",
                          background: hi ? "rgba(26,26,26,0.14)" : "rgba(240,240,235,0.06)",
                          color: hi ? "rgba(26,26,26,0.75)" : F.boneMuted,
                          fontFamily: SANS,
                        }}
                      >
                        {plan.tagline}
                      </span>
                      <h3
                        className="text-[clamp(30px,4vw,42px)] font-black lowercase mb-3"
                        style={{ fontFamily: SERIF, letterSpacing: "-0.02em", color: hi ? F.onCta : F.bone, lineHeight: 1 }}
                      >
                        {plan.name}
                      </h3>
                      <div className="flex items-baseline gap-1.5 mb-1">
                        <span
                          className="text-[30px] font-bold"
                          style={{ fontFamily: SANS, color: hi ? F.onCta : F.bone }}
                        >
                          ₹{plan.price}
                        </span>
                        <span
                          className="text-[12px] uppercase"
                          style={{ letterSpacing: "0.08em", color: hi ? "rgba(26,26,26,0.55)" : F.boneLabel, fontFamily: SANS }}
                        >
                          {plan.period}
                        </span>
                      </div>
                      <p
                        className="text-[12px] lowercase mb-5"
                        style={{ color: hi ? "rgba(26,26,26,0.6)" : F.boneLabel, fontFamily: SANS }}
                      >
                        {plan.note}
                      </p>
                      <div className="h-px mb-5" style={{ background: hi ? "rgba(26,26,26,0.12)" : "rgba(240,240,235,0.08)" }} />
                      <ul className="flex flex-col gap-3 mb-7">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-center gap-2.5">
                            <span
                              className="grid place-items-center shrink-0 w-[20px] h-[20px] rounded-md"
                              style={{
                                background: hi ? "rgba(26,26,26,0.12)" : "rgba(251,191,36,0.14)",
                                color: hi ? F.onCta : F.marigold,
                              }}
                            >
                              <Check size={12} strokeWidth={2.5} />
                            </span>
                            <span className="text-[14px] lowercase" style={{ color: hi ? F.onCta : F.bone, fontFamily: SANS }}>
                              {f}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <button
                        onClick={() => scrollToId("cta")}
                        className="mt-auto inline-flex items-center justify-center h-12 rounded-full text-[14px] font-bold lowercase transition-transform duration-150 hover:-translate-y-px active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2"
                        style={{
                          background: hi ? F.charcoal : F.marigold,
                          color: hi ? F.bone : F.onCta,
                          fontFamily: SANS,
                          letterSpacing: "0.01em",
                        }}
                      >
                        get gymbo
                      </button>
                    </div>
                  </Reveal>
                );
              })}
            </div>
            <Reveal className="text-center mt-8">
              <p className="text-[13px] lowercase" style={{ color: F.boneLabel, fontFamily: SANS }}>
                private alpha · first month free · no credit card
              </p>
            </Reveal>
          </div>
        </section>

        {/* ───────── faq ───────── */}
        <section id="faq" aria-label="Frequently asked questions" style={{ background: F.beige }}>
          <div className="max-w-[800px] mx-auto px-5 md:px-12 py-16 md:py-24">
            <Reveal className="text-center mb-10">
              <Eyebrow>questions</Eyebrow>
              <h2
                className="text-[clamp(28px,4vw,44px)] font-black lowercase mx-auto"
                style={{ fontFamily: SERIF, letterSpacing: "-0.02em", maxWidth: "16ch" }}
              >
                everything you might ask.
              </h2>
            </Reveal>
            <div className="flex flex-col">
              {FAQ.map((item) => (
                <Reveal key={item.q}>
                  <details className="faq py-1" style={{ borderBottom: "1px solid rgba(26,26,26,0.1)" }}>
                    <summary className="flex items-center justify-between gap-4 py-5">
                      <span className="text-[16px] md:text-[18px] font-bold lowercase" style={{ fontFamily: SERIF, color: F.ink }}>
                        {item.q}
                      </span>
                      <span
                        className="faq-plus shrink-0 grid place-items-center w-7 h-7 rounded-full transition-transform duration-200"
                        style={{ background: "rgba(245,158,11,0.14)", color: F.amberText }}
                      >
                        <Plus size={15} strokeWidth={2.4} />
                      </span>
                    </summary>
                    <p
                      className="pb-5 pr-10 text-[14px] md:text-[15px] lowercase"
                      style={{ color: F.inkMuted, fontFamily: SANS, lineHeight: 1.6 }}
                    >
                      {item.a}
                    </p>
                  </details>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ───────── final cta ───────── */}
        <section id="cta" aria-label="Join the waitlist" className="relative overflow-hidden" style={{ background: F.charcoal }}>
          <div
            aria-hidden="true"
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(251,191,36,0.12), transparent 70%)" }}
          />
          <div className="relative max-w-[640px] mx-auto px-5 md:px-12 py-16 md:py-24 flex flex-col items-center text-center">
            <Reveal>
              <Eyebrow dark>private alpha · limited spots</Eyebrow>
              <h2
                className="text-[clamp(30px,4.5vw,48px)] font-black lowercase mx-auto"
                style={{ fontFamily: SERIF, letterSpacing: "-0.02em", color: F.bone, maxWidth: "16ch" }}
              >
                run your whole business from one app.
              </h2>
              <p className="mt-4 text-[15px] lowercase" style={{ color: F.boneMuted, fontFamily: SANS }}>
                join the waitlist — free, no card. we'll tell you the moment it's your turn.
              </p>
            </Reveal>

            <Reveal className="mt-8 w-full flex flex-col items-center gap-4">
              <WaitlistForm />
              <a
                href={WHATSAPP}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2.5 h-12 px-7 rounded-full text-[14px] lowercase transition-transform duration-150 hover:-translate-y-px active:scale-[0.97]"
                style={{ background: "rgba(240,240,235,0.06)", color: F.bone, border: "1px solid rgba(240,240,235,0.12)", fontFamily: SANS }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                </svg>
                talk to the founder
              </a>
            </Reveal>

            {/* store badges — coming soon (honest) */}
            <Reveal className="mt-10 flex flex-wrap items-center justify-center gap-3">
              {["iphone — coming soon", "android — coming soon"].map((b) => (
                <span
                  key={b}
                  className="text-[12px] lowercase px-4 py-2 rounded-full"
                  style={{ background: "rgba(240,240,235,0.05)", border: "1px solid rgba(240,240,235,0.1)", color: F.boneLabel, fontFamily: SANS }}
                >
                  {b}
                </span>
              ))}
            </Reveal>
          </div>
        </section>
      </main>

      {/* ───────── footer ───────── */}
      <footer style={{ background: F.charcoal, borderTop: "1px solid rgba(240,240,235,0.06)" }}>
        <div className="max-w-[1100px] mx-auto px-5 md:px-12 py-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <span className="text-[13px] lowercase" style={{ color: F.boneMuted, fontFamily: SANS }}>
              <span className="font-bold" style={{ fontFamily: SERIF, color: F.bone }}>gymbo.</span> your business, in your pocket.
            </span>
            <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-7 gap-y-2">
              <button onClick={() => scrollToId("cta")} className="text-[13px] lowercase transition-colors" style={{ color: F.boneMuted, fontFamily: SANS }}>support</button>
              <a href="#" className="text-[13px] lowercase transition-colors" style={{ color: F.boneMuted, fontFamily: SANS }}>terms</a>
              <a href="#" className="text-[13px] lowercase transition-colors" style={{ color: F.boneMuted, fontFamily: SANS }}>privacy</a>
              <a href="mailto:damini@materiallab.io" className="text-[13px] lowercase transition-colors" style={{ color: F.boneMuted, fontFamily: SANS }}>contact</a>
            </nav>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 mt-5 pt-4" style={{ borderTop: "1px solid rgba(240,240,235,0.05)" }}>
            <a href="mailto:damini@materiallab.io" className="text-[12px]" style={{ color: F.boneLabel, fontFamily: SANS }}>damini@materiallab.io</a>
            <div className="flex items-center gap-4">
              <a href="https://www.linkedin.com/company/material-lab-io" target="_blank" rel="noopener noreferrer" className="text-[12px] lowercase" style={{ color: F.boneLabel, fontFamily: SANS }}>linkedin</a>
              <a href="https://wa.me/918050131733" target="_blank" rel="noopener noreferrer" className="text-[12px] lowercase" style={{ color: F.boneLabel, fontFamily: SANS }}>whatsapp</a>
              <span className="text-[11px]" style={{ color: F.boneLabel, fontFamily: SANS }}>© 2026 Material Lab.</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ───────── mobile sticky CTA bar ───────── */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pt-3 transition-transform duration-300"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
          background: "rgba(250,250,247,0.86)",
          backdropFilter: "saturate(140%) blur(12px)",
          WebkitBackdropFilter: "saturate(140%) blur(12px)",
          borderTop: "1px solid rgba(26,26,26,0.08)",
          transform: showStickyCTA ? "translateY(0)" : "translateY(120%)",
        }}
      >
        <WaitlistButton size="lg" className="w-full" />
      </div>
    </div>
  );
}

/* ── brand-touchpoints carousel (under the "your brand" pillar) ── */
function BrandTouchpoints() {
  return (
    <div style={{ background: F.charcoal }}>
      <div className="max-w-[1180px] mx-auto px-5 md:px-12 pb-16 md:pb-24 -mt-4 md:-mt-8">
        <Reveal className="text-center mb-8">
          <span
            className="block text-[13px] font-bold mb-2"
            style={{ color: F.marigold, fontFamily: SANS, letterSpacing: "0.04em" }}
          >
            brand touchpoints
          </span>
          <h3
            className="text-[clamp(22px,3vw,32px)] font-black lowercase mx-auto"
            style={{ fontFamily: SERIF, letterSpacing: "-0.02em", color: F.bone, maxWidth: "22ch" }}
          >
            your brand shows up everywhere your client sees you.
          </h3>
        </Reveal>
        <div className="carousel flex gap-5 overflow-x-auto snap-x snap-mandatory -mx-5 px-5 md:mx-0 md:px-0 pb-2">
          {TOUCHPOINTS.map((t) => (
            <div
              key={t.name}
              className="snap-center shrink-0 w-[70vw] sm:w-[48vw] md:w-[260px] flex flex-col items-center text-center p-5 rounded-[20px]"
              style={{ background: F.charcoalCard, border: "1px solid rgba(240,240,235,0.08)" }}
            >
              <Phone src={t.screen} alt={`Gymbo — ${t.name} (placeholder)`} className="w-[clamp(150px,40vw,180px)]" />
              <h4 className="mt-5 text-[16px] font-bold lowercase" style={{ fontFamily: SERIF, color: F.bone }}>
                {t.name}
              </h4>
              <p className="mt-1.5 text-[13px] lowercase" style={{ color: F.boneMuted, fontFamily: SANS, lineHeight: 1.5 }}>
                {t.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
