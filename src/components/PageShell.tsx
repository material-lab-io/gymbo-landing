import { Sun, Moon } from "lucide-react";
import { F, SHADOW, SERIF, SANS, useTheme, ForgeStyle } from "../forge-ui";

/* ============================================================================
   PageShell — shared chrome (nav + footer + theme) for standalone content pages
   (privacy, terms, blog). Cross-page nav links point back to the homepage
   anchors. Keeps these pages visually identical to the rest of getgymbo.com
   without re-duplicating the header/footer markup.
   ============================================================================ */

const HOME = "/";

function FooterNav() {
  const link = { color: F.boneMuted, fontFamily: SANS } as const;
  return (
    <footer style={{ background: F.charcoal, borderTop: "1px solid rgba(240,240,235,0.06)" }}>
      <div className="max-w-[1100px] mx-auto px-5 md:px-12 py-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <span className="text-[13px]" style={{ color: F.boneMuted, fontFamily: SANS }}>
            <span className="font-bold" style={{ fontFamily: SERIF, color: F.bone }}>Gymbo.</span> Your business, in your pocket.
          </span>
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-7 gap-y-2">
            <a href={HOME} className="text-[13px]" style={link}>Home</a>
            <a href={`${HOME}#pricing`} className="text-[13px]" style={link}>Pricing</a>
            <a href="/privacy/" className="text-[13px]" style={link}>Privacy</a>
            <a href="/terms/" className="text-[13px]" style={link}>Terms</a>
            <a href="mailto:damini@materiallab.io" className="text-[13px]" style={link}>Contact</a>
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
  );
}

export function PageShell({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme();
  return (
    <div style={{ background: F.beige, color: F.ink, fontFamily: SANS, lineHeight: 1.5 }}>
      <ForgeStyle />

      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:px-4 focus:py-2 focus:rounded-lg" style={{ background: F.amber, color: F.onCta }}>
        Skip to content
      </a>

      <nav
        aria-label="Main navigation"
        className="sticky top-0 z-40 flex items-center justify-between px-5 md:px-12 py-4"
        style={{ background: "var(--c-nav-bg)", backdropFilter: "saturate(140%) blur(14px)", WebkitBackdropFilter: "saturate(140%) blur(14px)", borderBottom: "1px solid var(--c-line)" }}
      >
        <a href={HOME} className="flex items-center focus-visible:outline-none" aria-label="Gymbo — home">
          <img
            src={theme === "dark" ? "/gymbo-mark-amber-ff9800.svg" : "/gymbo-mark-darkorange-9d3900.svg"}
            alt=""
            className="h-[38px] w-[38px]"
          />
        </a>

        <div className="hidden md:flex items-center gap-8">
          <a href={`${HOME}#why`} className="text-[14px]" style={{ color: F.inkMuted, fontFamily: SANS, fontWeight: 500 }}>Why Gymbo</a>
          <a href={`${HOME}#pricing`} className="text-[14px]" style={{ color: F.inkMuted, fontFamily: SANS, fontWeight: 500 }}>Pricing</a>
          <a href={`${HOME}#faq`} className="text-[14px]" style={{ color: F.inkMuted, fontFamily: SANS, fontWeight: 500 }}>FAQ</a>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
            aria-pressed={theme === "dark"}
            className="grid place-items-center w-11 h-11 rounded-full transition-transform duration-150 hover:-translate-y-px active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2"
            style={{ background: F.beigeCard, color: F.ink, border: "1px solid var(--c-line)" }}
          >
            {theme === "light" ? <Moon size={17} strokeWidth={1.8} aria-hidden="true" /> : <Sun size={17} strokeWidth={1.8} aria-hidden="true" />}
          </button>
          <a href={`${HOME}#cta`} className="inline-flex items-center h-11 px-5 rounded-full text-[13px] font-bold transition-transform duration-150 hover:-translate-y-px active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2" style={{ background: F.amber, color: F.onCta, fontFamily: SANS, boxShadow: SHADOW.cta }}>
            Get Gymbo
          </a>
        </div>
      </nav>

      <main id="main">{children}</main>

      <FooterNav />
    </div>
  );
}

/* ── shared prose styling for long-form legal / content pages ── */
export function Prose({ children, title, updated, intro }: { children: React.ReactNode; title: string; updated?: string; intro?: string }) {
  return (
    <article className="max-w-[760px] mx-auto px-5 md:px-12 pt-12 md:pt-16 pb-20" style={{ fontFamily: SANS }}>
      <h1 className="text-[clamp(30px,5vw,46px)] font-black" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", lineHeight: 1.08, color: F.ink }}>{title}</h1>
      {updated && <p className="mt-3 text-[13px]" style={{ color: F.inkLabel }}>{updated}</p>}
      {intro && <p className="mt-6 text-[16px]" style={{ color: F.inkMuted, lineHeight: 1.7 }}>{intro}</p>}
      <div className="legal-prose mt-8 flex flex-col gap-6" style={{ color: F.inkMuted, fontSize: "15px", lineHeight: 1.7 }}>
        {children}
      </div>
    </article>
  );
}
