// gy-sk86p2.3 STEP 1: THE HERO SLOT. The home page's first screen, in its own file so web_designer's hero (gy-sk86p2.2: black join,
// metallic shimmer, real phone video loop) replaces this component without touching any other section. Strings: src/content/home.ts (HOME.hero).
// Contract kept for scripts/check-photoreal-device.mjs: HeroDeviceArt lives here with its desktop + mobile usages.
import { F, SERIF, SANS, Eyebrow, WhatsAppCTA, StartFreeCTA } from "../forge-ui";
import { HOME } from "../content/home";

const HERO_SRCSET = "/mockups/hero-three-panel-800.webp 800w, /mockups/hero-three-panel-1200.webp 1200w, /mockups/hero-three-panel-1800.webp 1800w";
function HeroDeviceArt({ alt = "", priority = false }: { alt?: string; priority?: boolean }) {
  return <div data-testid="hero-device-art" style={{ aspectRatio: "4800 / 3236", lineHeight: 0 }}><picture><source type="image/webp" srcSet={HERO_SRCSET} sizes="(min-width: 1024px) min(46vw, 720px), min(92vw, 560px)" /><img src="/mockups/hero-three-panel-1200.png" alt={alt} aria-hidden={alt ? undefined : true} decoding="async" {...(priority ? { fetchpriority: "high" as const } : {})} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} /></picture></div>;
}

export function HomeHero({ prefersReduced }: { prefersReduced: boolean }) {
  return (
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
            {HOME.hero.eyebrow ? (
              <div className={prefersReduced ? "" : "hero-rise d1"}>
                <Eyebrow>{HOME.hero.eyebrow}</Eyebrow>
              </div>
            ) : null}
            {HOME.hero.word ? (
              <p className={`text-[clamp(20px,2.2vw,26px)] font-black mb-3 ${prefersReduced ? "" : "hero-rise d1"}`} style={{ fontFamily: SERIF, letterSpacing: "0.12em" }}>{HOME.hero.word}</p>
            ) : null}
            <h1 className={`text-[clamp(34px,5.4vw,62px)] font-black ${prefersReduced ? "" : "hero-rise d2"}`} style={{ fontFamily: SERIF, lineHeight: 1.08, letterSpacing: "-0.022em" }}>
              {HOME.hero.title.before}
              {HOME.hero.title.highlight ? (
                <span className="relative whitespace-nowrap" style={{ color: F.amberText }}>
                  <span aria-hidden="true" className="absolute rounded-lg" style={{ inset: "-0.04em -0.14em", background: "rgba(245,158,11,0.18)", zIndex: -1 }} />
                  {HOME.hero.title.highlight}
                </span>
              ) : null}
              {HOME.hero.title.after}
            </h1>
            <p className={`mt-6 text-[clamp(15px,1.6vw,18px)] ${prefersReduced ? "" : "hero-rise d3"}`} style={{ color: F.inkMuted, fontWeight: 400, lineHeight: 1.6, maxWidth: "46ch" }}>
              <b style={{ color: F.ink, fontWeight: 400 }}>{HOME.hero.sub.lead}</b>{HOME.hero.sub.rest}
            </p>
            {/* gy-1vd9qy.10.4 option A: Start free is the one filled amber CTA; the founder's WhatsApp is the outline one. */}
            <div className={`mt-8 ${prefersReduced ? "" : "hero-rise d4"}`}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3.5">
                <StartFreeCTA size="lg" position="hero" />
                <WhatsAppCTA size="lg" location="hero" variant="secondary" glyph={false}>{HOME.hero.talk}</WhatsAppCTA>
              </div>
              <p className="mt-4 text-[13px]" style={{ color: F.inkLabel, fontFamily: SANS }}>
                {HOME.hero.smallPrint}
              </p>
            </div>
            {/* Mobile/tablet keeps the approved three-phone composition below
                the copy, scaled as one coherent image so its screens and device
                silhouettes remain legible without clipping. */}
            <div className={`lg:hidden mt-12 flex justify-center ${prefersReduced ? "" : "hero-fade d6"}`} style={{ width: "min(92vw, 560px)" }}>
              <HeroDeviceArt alt={HOME.hero.deviceAlt} priority />
            </div>
          </div>
        </div>
      </header>
  );
}
