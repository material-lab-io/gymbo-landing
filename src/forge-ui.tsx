import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

/* ============================================================================
   forge-ui — shared design tokens, theme system, and presentational primitives
   for getgymbo.com. Single source of truth so the homepage (App.tsx) and the
   comparison pages stay visually identical. Forge palette: amber #F59E0B /
   marigold #FBBF24 accent on flat beige/charcoal, sentence case, no gradients.
   ============================================================================ */

export type ThemeName = "light" | "dark";

// Theme-reactive tokens resolve to CSS custom properties (see ForgeStyle:
// :root[data-theme=light|dark]). Charcoal/bone/marigold are always-dark-surface
// tokens (the contrast bands stay dark in both themes), so they're literal.
export const F = {
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

export const SHADOW = {
  cta: "0 1px 2px rgba(0,0,0,.08), 0 4px 12px rgba(0,0,0,.06)",
  chip: "0 1px 2px rgba(0,0,0,.10), 0 8px 24px -6px rgba(0,0,0,.18)",
  card: "0 1px 2px rgba(0,0,0,.06), 0 12px 32px -12px rgba(0,0,0,.12)",
};

export const SERIF = "var(--font-serif)"; // Merriweather
export const SANS = "var(--font-sans)"; // Open Sans

export const WHATSAPP = "https://wa.me/918050131733?text=Hi%2C%20I%27d%20like%20to%20try%20Gymbo";

/** Smooth-scroll to an in-page anchor by id (used by CTAs + nav). */
export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** data-theme + localStorage theme state, shared by every page.
   SSR/hydration-safe: the FIRST render is deterministically "light" on both
   server and client (so prerendered markup hydrates without mismatch). The
   real theme — already applied to <html data-theme> pre-paint by the no-flash
   script in each HTML <head>, so page colours are correct immediately via CSS
   vars — is read into JS state only AFTER hydration. The write-back effect is
   gated on `ready` so it never clobbers the no-flash value on first commit. */
export function useTheme(): { theme: ThemeName; setTheme: React.Dispatch<React.SetStateAction<ThemeName>> } {
  const [theme, setTheme] = useState<ThemeName>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = document.documentElement.getAttribute("data-theme");
    setTheme(t === "dark" ? "dark" : "light");
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("gymbo-theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme, ready]);

  return { theme, setTheme };
}

// Forge token + animation CSS. Injected via dangerouslySetInnerHTML (NOT JSX
// children): <style> is a raw-text element, and renderToString HTML-escapes
// element children — which would emit data-theme=&quot;light&quot; into the
// served CSS (invalid selector + a hydration mismatch). __html keeps it raw.
const FORGE_CSS = `
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
        .legal-prose h2{font-family:var(--font-serif);font-weight:800;font-size:21px;line-height:1.3;color:var(--c-ink);letter-spacing:-0.01em}
        .legal-prose h3{font-weight:700;font-size:16px;color:var(--c-ink)}
        .legal-prose p{margin:0}
        .legal-prose a{color:var(--c-brand-text);text-decoration:underline;text-underline-offset:2px}
        .legal-prose ul{list-style:disc;padding-left:22px;display:flex;flex-direction:column;gap:7px;margin:0}
        .legal-prose strong{color:var(--c-ink);font-weight:600}
        .article-prose>*+*{margin-top:18px}
        .article-prose h2{font-family:var(--font-serif);font-weight:800;font-size:clamp(20px,2.6vw,26px);line-height:1.25;letter-spacing:-0.01em;color:var(--c-ink);margin-top:36px}
        .article-prose h3{font-weight:700;font-size:17px;color:var(--c-ink);margin-top:24px}
        .article-prose a{color:var(--c-brand-text);text-decoration:underline;text-underline-offset:2px;overflow-wrap:anywhere}
        .article-prose strong{color:var(--c-ink);font-weight:600}
        .article-prose ul{list-style:disc;padding-left:22px;display:flex;flex-direction:column;gap:8px}
        .article-prose ol{list-style:decimal;padding-left:22px;display:flex;flex-direction:column;gap:8px}
        .article-prose blockquote{border-left:3px solid var(--c-brand);padding-left:16px;color:var(--c-ink-muted);font-style:italic}
        .article-prose hr{border:0;border-top:1px solid var(--c-line);margin:28px 0}
        .article-prose table{width:100%;border-collapse:collapse;font-size:14px;display:block;overflow-x:auto}
        .article-prose th,.article-prose td{border:1px solid var(--c-line);padding:10px 12px;text-align:left;vertical-align:top}
        .article-prose thead th{background:rgba(245,158,11,0.08);font-family:var(--font-serif);color:var(--c-ink)}
        .article-prose tbody td:first-child{color:var(--c-ink);font-weight:600}
        @media (prefers-reduced-motion:reduce){
          .hero-rise,.hero-fade{opacity:1!important;transform:none!important;animation:none!important}
          .reveal-on-scroll{opacity:1!important;transform:none!important;transition:none!important}
        }
      `;

/** The Forge token + animation CSS, rendered once per page. */
export function ForgeStyle() {
  return <style dangerouslySetInnerHTML={{ __html: FORGE_CSS }} />;
}

/* ── presentational primitives ── */

export function Eyebrow({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
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

export function PrimaryCTA({ dark, size = "md", className = "", children = "Join the waitlist" }: { dark?: boolean; size?: "md" | "lg"; className?: string; children?: React.ReactNode }) {
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

export function SecondaryButton({ dark, children }: { dark?: boolean; children: React.ReactNode }) {
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

export function RiskReversal({ dark }: { dark?: boolean }) {
  return (
    <p className="text-[13px]" style={{ color: dark ? F.boneLabel : F.inkLabel, fontFamily: SANS }}>
      Free · no credit card
    </p>
  );
}
