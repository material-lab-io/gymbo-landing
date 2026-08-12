import { useEffect } from "react";
import { Check, Plus } from "lucide-react";
import { WaitlistForm } from "../components/WaitlistForm";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { F, SHADOW, SERIF, SANS, WHATSAPP, scrollToId, ForgeStyle, Eyebrow, PrimaryCTA, SecondaryButton } from "../forge-ui";

/* ============================================================================
   getgymbo.com/compare/gymbo-vs-wellnessz — "Gymbo vs WellnessZ" comparison
   page (bead gy-nipik). Copy: crew/marketer/output/getgymbo-vs-wellnessz-page-
   copy-2026-06-22.md. Forge styling + sentence case, honest framing (no
   superlatives, no fabricated switcher numbers — Gymbo is in alpha).
   ============================================================================ */

const HOME = "/";

/* ── at-a-glance comparison rows. `win` marks which column we lead on (honest). ── */
const ROWS: { label: string; gymbo: string; wellnessz: string; win: "g" | "w" | null }[] = [
  { label: "Built for", gymbo: "independent personal trainers (session-led)", wellnessz: "dietitians / nutritionists & health coaches (nutrition-led)", win: null },
  { label: "The core job", gymbo: "log a session in one tap; track payments & balances", wellnessz: "create & assign diet / meal plans", win: null },
  { label: "Entry price", gymbo: "₹399/mo (₹250/mo effective on annual)", wellnessz: "₹499/mo", win: "g" },
  { label: "Client limits", gymbo: "unlimited — flat price, no per-client tiers", wellnessz: "Basic ₹499 = up to 40 clients · Pro ₹999 = up to 120", win: "g" },
  { label: "Free trial", gymbo: "7 days", wellnessz: "14 days", win: null },
  { label: "Session logging", gymbo: "one-tap punch, automatic balance math", wellnessz: "session scheduling (nutrition-centric)", win: "g" },
  { label: "Payments", gymbo: "UPI + cash, GST invoices, colour-coded reminders", wellnessz: "UPI, GST invoices, reminders", win: null },
  { label: "Nutrition / meal plans", gymbo: "Workout builder + AI assistant (training-first)", wellnessz: "deep — 20k+ ICMR-verified meals, nutrition AI", win: "w" },
  { label: "Sign-in", gymbo: "passwordless (Apple + Face ID)", wellnessz: "account-based", win: "g" },
  { label: "White-label app", gymbo: "not yet", wellnessz: "₹3,999/mo tier", win: "w" },
  { label: "Platform", gymbo: "iOS-native", wellnessz: "app + web", win: "w" },
];

const FAQ: { q: string; a: string }[] = [
  { q: "Is Gymbo a good WellnessZ alternative?", a: "For personal trainers, yes — Gymbo is built around session logging, payments, and scheduling at a flat ₹399/month. WellnessZ is better if your core service is nutrition and meal planning." },
  { q: "What's the main difference between Gymbo and WellnessZ?", a: "Focus. WellnessZ is nutrition-first (diet plans, verified meal database, nutrition AI). Gymbo is session-first (one-tap class logging, automatic balance math, payment tracking) for independent personal trainers." },
  { q: "Is Gymbo cheaper than WellnessZ?", a: "Gymbo is ₹399/month (₹250 effective on annual) with no per-client tiers. WellnessZ starts at ₹499/month for up to 40 clients and ₹999/month for up to 120." },
  { q: "Can I move my clients from WellnessZ to Gymbo?", a: "Yes — Gymbo supports bulk client import so you can bring your roster over." },
  { q: "Does Gymbo do diet/meal plans?", a: "Gymbo focuses on training — one-tap session logging, payments, scheduling, a workout builder, and an AI assistant. For deep nutrition and meal-database tooling, WellnessZ is the stronger fit." },
];

const GYMBO_FOR = [
  "You're an independent personal trainer who runs in-person or hybrid sessions.",
  "Your daily jobs are logging classes, tracking payments and balances, and scheduling.",
  "You want one flat, low price and a one-tap, no-passwords experience.",
];
const WELLNESSZ_FOR = [
  "You're a dietitian or nutrition coach and meal planning is your core service.",
  "You need a large verified Indian food database and nutrition AI.",
  "You want a white-label app today (Gymbo doesn't offer one yet).",
];

function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`reveal-on-scroll ${className}`}>{children}</div>;
}

export function CompareWellnessZ() {
  const prefersReduced = useReducedMotion();

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
        <a href={HOME} className="flex items-center gap-2.5 focus-visible:outline-none" aria-label="Gymbo — home">
          <span className="grid place-items-center w-[30px] h-[30px] rounded-[var(--g-radius-sm)] font-bold text-[17px]" style={{ background: F.amber, color: F.onCta, fontFamily: SANS, boxShadow: SHADOW.cta }}>g</span>
          <span className="text-[20px] font-bold tracking-[-0.01em]" style={{ fontFamily: SERIF }}>Gymbo</span>
        </a>

        <div className="hidden md:flex items-center gap-8">
          <a href={`${HOME}#why`} className="text-[14px] transition-colors" style={{ color: F.inkMuted, fontFamily: SANS, fontWeight: 500 }}>Why Gymbo</a>
          <a href={`${HOME}#pricing`} className="text-[14px] transition-colors" style={{ color: F.inkMuted, fontFamily: SANS, fontWeight: 500 }}>Pricing</a>
          <button onClick={() => scrollToId("faq")} className="text-[14px] transition-colors" style={{ color: F.inkMuted, fontFamily: SANS, fontWeight: 500 }}>FAQ</button>
        </div>

        <div className="flex items-center gap-2.5">
          <button onClick={() => scrollToId("cta")} className="inline-flex items-center h-11 px-5 rounded-full text-[13px] font-bold transition-transform duration-150 hover:-translate-y-px active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2" style={{ background: F.amber, color: F.onCta, fontFamily: SANS, boxShadow: SHADOW.cta }}>
            Get Gymbo
          </button>
        </div>
      </nav>

      <main id="main">
        {/* ───────── header + TL;DR ───────── */}
        <header style={{ background: F.beige }}>
          <div className="max-w-[860px] mx-auto px-5 md:px-12 pt-12 md:pt-20 pb-10 md:pb-14">
            <Reveal>
              <Eyebrow>Comparison · personal trainer apps</Eyebrow>
              <h1 className="text-[clamp(30px,5vw,52px)] font-black" style={{ fontFamily: SERIF, lineHeight: 1.08, letterSpacing: "-0.022em" }}>
                Gymbo vs WellnessZ:{" "}
                <span className="relative whitespace-nowrap" style={{ color: F.amberText, isolation: "isolate" }}>
                  <span aria-hidden="true" className="absolute rounded-lg" style={{ inset: "-0.04em -0.14em", background: "rgba(245,158,11,0.18)", zIndex: -1 }} />
                  which fits you?
                </span>
              </h1>
              <p className="mt-6 text-[clamp(15px,1.6vw,18px)]" style={{ color: F.ink, fontWeight: 400, lineHeight: 1.6, maxWidth: "60ch" }}>
                Gymbo and WellnessZ are both India-native coaching apps — but they're built for different people.
              </p>
              <p className="mt-4 text-[15px] md:text-[16px]" style={{ color: F.inkMuted, fontWeight: 400, lineHeight: 1.7, maxWidth: "64ch", fontFamily: SANS }}>
                WellnessZ is a nutrition-first platform for dietitians and health coaches: verified meal databases, diet plans, and nutrition AI. Gymbo is built for the independent <b style={{ color: F.ink, fontWeight: 600 }}>personal trainer</b> who runs sessions — log a class in one tap, track every payment and balance, and look professional, at a flat ₹399/month with no per-client limits.
              </p>
            </Reveal>

            <Reveal className="mt-8 grid sm:grid-cols-2 gap-4">
              <div className="rounded-[var(--g-radius-xl)] p-5" style={{ background: F.beigeCard, border: "1px solid var(--c-line)" }}>
                <span className="text-[12px] font-bold" style={{ color: F.amberText, fontFamily: SANS, letterSpacing: "0.04em" }}>Choose Gymbo if</span>
                <p className="mt-2 text-[14px] md:text-[15px]" style={{ color: F.ink, fontFamily: SANS, lineHeight: 1.6 }}>you train clients and your day is sessions, schedules, and payments.</p>
              </div>
              <div className="rounded-[var(--g-radius-xl)] p-5" style={{ background: F.beigeCard, border: "1px solid var(--c-line)" }}>
                <span className="text-[12px] font-bold" style={{ color: F.inkLabel, fontFamily: SANS, letterSpacing: "0.04em" }}>Choose WellnessZ if</span>
                <p className="mt-2 text-[14px] md:text-[15px]" style={{ color: F.ink, fontFamily: SANS, lineHeight: 1.6 }}>your practice is nutrition and meal planning first.</p>
              </div>
            </Reveal>

            <Reveal className="mt-8 flex flex-col sm:flex-row sm:items-center gap-3.5">
              <PrimaryCTA size="lg" />
              <SecondaryButton>Talk to the founder</SecondaryButton>
            </Reveal>
          </div>
        </header>

        {/* ───────── at-a-glance table ───────── */}
        <section aria-label="At-a-glance comparison" style={{ background: F.beige }}>
          <div className="max-w-[1000px] mx-auto px-5 md:px-12 pb-16 md:pb-20">
            <Reveal className="mb-8">
              <h2 className="text-[clamp(24px,3.4vw,36px)] font-black" style={{ fontFamily: SERIF, letterSpacing: "-0.02em" }}>At a glance</h2>
            </Reveal>
            <Reveal className="overflow-x-auto -mx-5 px-5 md:mx-0 md:px-0">
              <table className="w-full border-collapse" style={{ minWidth: "640px", fontFamily: SANS }}>
                <caption className="sr-only">Feature comparison of Gymbo and WellnessZ</caption>
                <thead>
                  <tr>
                    <th scope="col" className="text-left align-bottom p-4 text-[12px] font-bold" style={{ color: F.inkLabel, letterSpacing: "0.04em" }}></th>
                    <th scope="col" className="text-left p-4 rounded-t-[14px]" style={{ background: "rgba(245,158,11,0.10)", borderBottom: `2px solid ${F.amber}` }}>
                      <span className="text-[17px] font-black" style={{ fontFamily: SERIF, color: F.ink }}>Gymbo</span>
                    </th>
                    <th scope="col" className="text-left p-4" style={{ borderBottom: "2px solid var(--c-line)" }}>
                      <span className="text-[17px] font-black" style={{ fontFamily: SERIF, color: F.inkMuted }}>WellnessZ</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((r) => (
                    <tr key={r.label} style={{ borderBottom: "1px solid var(--c-line)" }}>
                      <th scope="row" className="text-left align-top p-4 text-[13px] font-bold" style={{ color: F.inkLabel }}>{r.label}</th>
                      <td className="align-top p-4 text-[13.5px]" style={{ background: "rgba(245,158,11,0.06)", color: r.win === "g" ? F.ink : F.inkMuted, fontWeight: r.win === "g" ? 600 : 400, lineHeight: 1.5 }}>
                        <span className="inline-flex items-start gap-1.5">
                          {r.win === "g" && <Check size={15} strokeWidth={2.6} aria-hidden="true" style={{ color: F.amberText, marginTop: 2, flexShrink: 0 }} />}
                          <span>{r.gymbo}</span>
                        </span>
                      </td>
                      <td className="align-top p-4 text-[13.5px]" style={{ color: r.win === "w" ? F.ink : F.inkMuted, fontWeight: r.win === "w" ? 600 : 400, lineHeight: 1.5 }}>
                        <span className="inline-flex items-start gap-1.5">
                          {r.win === "w" && <Check size={15} strokeWidth={2.6} aria-hidden="true" style={{ color: F.inkLabel, marginTop: 2, flexShrink: 0 }} />}
                          <span>{r.wellnessz}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Reveal>
            <Reveal><p className="mt-4 text-[12px]" style={{ color: F.inkLabel, fontFamily: SANS }}>Pricing verified 22 June 2026.</p></Reveal>
          </div>
        </section>

        {/* ───────── the real difference (dark) ───────── */}
        <section aria-label="The real difference: sessions vs meals" style={{ background: F.charcoal }}>
          <div className="max-w-[820px] mx-auto px-5 md:px-12 py-16 md:py-24">
            <Reveal>
              <Eyebrow dark>The real difference</Eyebrow>
              <h2 className="text-[clamp(26px,4vw,40px)] font-black" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", color: F.bone, lineHeight: 1.15 }}>Sessions vs. meals</h2>
            </Reveal>
            <Reveal className="mt-6 flex flex-col gap-5" >
              <p className="text-[15px] md:text-[16px]" style={{ color: F.boneMuted, fontFamily: SANS, fontWeight: 400, lineHeight: 1.7 }}>
                WellnessZ leads with nutrition. Its homepage calls it "all-in-one software for dietitians, nutritionists & coaches," and its standout features are a 20,000+ ICMR-NIN verified meal database and nutrition AI. If your business is built on diet plans, that depth is genuinely valuable.
              </p>
              <p className="text-[15px] md:text-[16px]" style={{ color: F.bone, fontFamily: SANS, fontWeight: 400, lineHeight: 1.7 }}>
                Gymbo leads with the <b style={{ fontWeight: 600 }}>session</b>. A personal trainer's day isn't meal planning — it's "did Ravi show up, did he pay, how many classes are left." Gymbo is built around that: a one-tap punch to log a class, a structured client card that does the balance math for you, and payment reminders that go out on their own. A workout builder and an AI assistant are built in, but the hero is running your training business, not planning nutrition.
              </p>
              <p className="text-[15px] md:text-[16px] pt-2" style={{ color: F.marigold, fontFamily: SANS, fontWeight: 600, lineHeight: 1.6 }}>
                Bottom line: same country, different jobs. WellnessZ optimizes the dietitian's day; Gymbo optimizes the trainer's.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ───────── pricing: flat vs tiered ───────── */}
        <section aria-label="Pricing: flat vs client-tiered" style={{ background: F.beige }}>
          <div className="max-w-[820px] mx-auto px-5 md:px-12 py-16 md:py-24">
            <Reveal>
              <Eyebrow>Pricing</Eyebrow>
              <h2 className="text-[clamp(26px,4vw,40px)] font-black" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", lineHeight: 1.15 }}>Flat vs. client-tiered</h2>
            </Reveal>
            <Reveal className="mt-6 flex flex-col gap-5">
              <p className="text-[15px] md:text-[16px]" style={{ color: F.inkMuted, fontFamily: SANS, fontWeight: 400, lineHeight: 1.7 }}>
                WellnessZ prices by how many clients you have — ₹499/month gets you up to 40 active clients, and you move to ₹999/month (up to 120) as you grow. That's fair, but it means your cost climbs as your business does, and there's an upgrade waiting at every milestone.
              </p>
              <p className="text-[15px] md:text-[16px]" style={{ color: F.ink, fontFamily: SANS, fontWeight: 400, lineHeight: 1.7 }}>
                Gymbo is one flat price: <b style={{ fontWeight: 600 }}>₹399/month, or ₹250/month effective on the annual plan</b> — with unlimited clients, so it doesn't change as you grow. For a trainer at 15–25 clients, Gymbo is both cheaper at the entry point and predictable as you scale.
              </p>
            </Reveal>
            <Reveal className="mt-8">
              <div className="rounded-[var(--g-radius-xl)] overflow-hidden" style={{ border: "1px solid var(--c-line)" }}>
                <div className="flex items-center justify-between px-5 py-4" style={{ background: F.beigeCard2 }}>
                  <span className="text-[13px] font-bold" style={{ color: F.inkLabel, fontFamily: SANS }}>Real trainer, ~20 clients</span>
                  <span className="text-[13px] font-bold" style={{ color: F.inkLabel, fontFamily: SANS }}>Monthly cost</span>
                </div>
                <div className="flex items-center justify-between px-5 py-4" style={{ background: "rgba(245,158,11,0.07)", borderTop: "1px solid var(--c-line)" }}>
                  <span className="text-[15px] font-black" style={{ fontFamily: SERIF, color: F.ink }}>Gymbo</span>
                  <span className="text-[15px] font-bold" style={{ color: F.amberText, fontFamily: SANS }}>₹399 <span style={{ color: F.inkMuted, fontWeight: 400 }}>(₹250 effective annual)</span></span>
                </div>
                <div className="flex items-center justify-between px-5 py-4" style={{ borderTop: "1px solid var(--c-line)" }}>
                  <span className="text-[15px] font-black" style={{ fontFamily: SERIF, color: F.inkMuted }}>WellnessZ</span>
                  <span className="text-[15px] font-bold" style={{ color: F.inkMuted, fontFamily: SANS }}>₹999 <span style={{ fontWeight: 400 }}>(Pro — 40+ clients)</span></span>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ───────── who each is best for ───────── */}
        <section aria-label="Who each is best for" style={{ background: F.charcoal }}>
          <div className="max-w-[1000px] mx-auto px-5 md:px-12 py-16 md:py-24">
            <Reveal className="text-center mb-10">
              <Eyebrow dark>Honest fit</Eyebrow>
              <h2 className="text-[clamp(26px,4vw,40px)] font-black mx-auto" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", color: F.bone, maxWidth: "20ch", lineHeight: 1.15 }}>Who each is best for</h2>
            </Reveal>
            <div className="grid md:grid-cols-2 gap-6">
              <Reveal>
                <div className="h-full rounded-[var(--g-radius-xl)] p-6 md:p-7" style={{ background: F.charcoalCard, border: `1px solid ${F.amber}` }}>
                  <h3 className="text-[18px] md:text-[20px] font-black mb-4" style={{ fontFamily: SERIF, color: F.bone }}>Gymbo is best for you if</h3>
                  <ul className="flex flex-col gap-3">
                    {GYMBO_FOR.map((b) => (
                      <li key={b} className="flex items-start gap-3">
                        <span className="grid place-items-center shrink-0 w-[22px] h-[22px] rounded-md mt-0.5" style={{ background: "rgba(251,191,36,0.14)", color: F.marigold }}><Check size={13} strokeWidth={2.5} /></span>
                        <span className="text-[14px] md:text-[15px]" style={{ color: F.bone, fontFamily: SANS, lineHeight: 1.5 }}>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
              <Reveal>
                <div className="h-full rounded-[var(--g-radius-xl)] p-6 md:p-7" style={{ background: F.charcoalCard, border: "1px solid rgba(240,240,235,0.1)" }}>
                  <h3 className="text-[18px] md:text-[20px] font-black mb-4" style={{ fontFamily: SERIF, color: F.bone }}>WellnessZ is the better choice if</h3>
                  <ul className="flex flex-col gap-3">
                    {WELLNESSZ_FOR.map((b) => (
                      <li key={b} className="flex items-start gap-3">
                        <span className="grid place-items-center shrink-0 w-[22px] h-[22px] rounded-md mt-0.5" style={{ background: "rgba(240,240,235,0.08)", color: F.boneMuted }}><Check size={13} strokeWidth={2.5} /></span>
                        <span className="text-[14px] md:text-[15px]" style={{ color: F.boneMuted, fontFamily: SANS, lineHeight: 1.5 }}>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            </div>
            <Reveal>
              <p className="mt-8 text-center text-[14px] md:text-[15px] mx-auto" style={{ color: F.boneMuted, fontFamily: SANS, fontWeight: 400, lineHeight: 1.6, maxWidth: "58ch" }}>
                We'd rather you pick the right tool than the wrong one. If nutrition is your business, WellnessZ is built for that. If training is, Gymbo is built for you.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ───────── switching ───────── */}
        <section aria-label="Switching from WellnessZ" style={{ background: F.beige }}>
          <div className="max-w-[820px] mx-auto px-5 md:px-12 py-16 md:py-24">
            <Reveal>
              <Eyebrow>Switching</Eyebrow>
              <h2 className="text-[clamp(26px,4vw,40px)] font-black" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", lineHeight: 1.15 }}>Moving from WellnessZ</h2>
            </Reveal>
            <Reveal>
              <p className="mt-6 text-[15px] md:text-[16px]" style={{ color: F.inkMuted, fontFamily: SANS, fontWeight: 400, lineHeight: 1.7 }}>
                Moving your clients over is straightforward: Gymbo supports bulk client import, so you can bring your roster in rather than re-typing it. Your sessions and payments start fresh in a structure built for training.
              </p>
            </Reveal>
            {/* Structural social-proof slot — Gymbo is in beta; a real switcher
                quote goes here post-launch. Do NOT fabricate a testimonial. */}
            <Reveal>
              <div className="mt-8 rounded-[var(--g-radius-xl)] p-6 text-center" style={{ background: F.beigeCard, border: "1px dashed var(--c-line)" }}>
                <p className="text-[14px] md:text-[15px]" style={{ color: F.inkLabel, fontFamily: SANS, lineHeight: 1.6 }}>
                  Gymbo is in beta. Real trainer stories will appear here as trainers come on board.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ───────── faq ───────── */}
        <section id="faq" aria-label="Frequently asked questions" style={{ background: F.beige }}>
          <div className="max-w-[800px] mx-auto px-5 md:px-12 pb-16 md:pb-24">
            <Reveal className="text-center mb-10">
              <Eyebrow>Questions</Eyebrow>
              <h2 className="text-[clamp(26px,4vw,40px)] font-black mx-auto" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", maxWidth: "18ch", lineHeight: 1.15 }}>Gymbo vs WellnessZ, answered</h2>
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
              <Eyebrow dark>In beta</Eyebrow>
              <h2 className="text-[clamp(28px,4.5vw,46px)] font-black mx-auto" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", color: F.bone, maxWidth: "18ch" }}>
                Built for trainers. Try it free.
              </h2>
              <p className="mt-4 text-[15px]" style={{ color: F.boneMuted, fontFamily: SANS }}>
                Join the waitlist and we'll tell you the moment it's your turn. Free for your first 7 days.
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
            <Reveal className="mt-10">
              <a href={`${HOME}#pricing`} className="text-[14px] underline underline-offset-4" style={{ color: F.boneMuted, fontFamily: SANS }}>See full Gymbo pricing →</a>
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
              <a href={HOME} className="text-[13px] transition-colors" style={{ color: F.boneMuted, fontFamily: SANS }}>Home</a>
              <a href={`${HOME}#pricing`} className="text-[13px] transition-colors" style={{ color: F.boneMuted, fontFamily: SANS }}>Pricing</a>
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
    </div>
  );
}
