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
  white: "#ffffff",
  black: "#000000",
};

// Forge radius scale (--g-radius-sm/md/lg/xl/xxl/full in src/forge/forge.css:
// 8/12/16/20/28/9999) — the single source of truth for corner radii.
export const RADIUS = {
  sm: "var(--g-radius-sm)",
  md: "var(--g-radius-md)",
  lg: "var(--g-radius-lg)",
  xl: "var(--g-radius-xl)",
  xxl: "var(--g-radius-xxl)",
  full: "var(--g-radius-full)",
};

// 5-step layered elevation scale (--c-elevation-1..5 in FORGE_CSS above): one
// light direction, tight+medium+ambient layers per step, tinted to the surface
// hue (warm on light-theme beige, cool on dark-theme charcoal) instead of pure
// black, offset+blur scaling together as elevation rises. cta/chip/card are
// semantic aliases onto specific steps so existing call sites keep their names.
export const SHADOW = {
  elevation1: "var(--c-elevation-1)",
  elevation2: "var(--c-elevation-2)",
  elevation3: "var(--c-elevation-3)",
  elevation4: "var(--c-elevation-4)",
  elevation5: "var(--c-elevation-5)",
  // filter form for elements shadowed via CSS `filter: drop-shadow(...)`
  // (transparent-background device frames) — drop-shadow has no spread
  // parameter, so this is the closest filter-safe rendering of elevation-4.
  elevation4Filter: "var(--c-elevation-4-filter)",
  cta: "var(--c-elevation-2)",
  chip: "var(--c-elevation-3)",
  card: "var(--c-elevation-2)",
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
        :root,:root[data-theme="light"]{--c-bg:#fafaf7;--c-card:#eaeae5;--c-card2:#e8e8e3;--c-muted:#dcdcd9;--c-ink:#1a1a1a;--c-ink-muted:#555555;--c-ink-label:#595959;--c-brand:#f59e0b;--c-brand-text:#92400e;--c-line:rgba(26,26,26,.1);--c-nav-bg:rgba(250,250,247,.85);--c-elevation-1:0 1px 2px rgba(34,24,14,.05),0 4px 10px -4px rgba(34,24,14,.06),0 10px 20px -10px rgba(34,24,14,.05);--c-elevation-2:0 1px 2px rgba(34,24,14,.06),0 6px 16px -6px rgba(34,24,14,.08),0 16px 32px -14px rgba(34,24,14,.07);--c-elevation-3:0 2px 3px rgba(34,24,14,.07),0 10px 24px -8px rgba(34,24,14,.10),0 24px 48px -20px rgba(34,24,14,.09);--c-elevation-4:0 2px 4px rgba(34,24,14,.08),0 16px 32px -10px rgba(34,24,14,.11),0 36px 64px -26px rgba(34,24,14,.10);--c-elevation-5:0 3px 6px rgba(34,24,14,.09),0 20px 44px -12px rgba(34,24,14,.13),0 52px 96px -34px rgba(34,24,14,.14);--c-elevation-4-filter:drop-shadow(0 2px 3px rgba(34,24,14,.08)) drop-shadow(0 14px 26px rgba(34,24,14,.10)) drop-shadow(0 28px 46px rgba(34,24,14,.09))}
        :root[data-theme="dark"]{--c-bg:#0a0a0a;--c-card:#141414;--c-card2:#1c1c1e;--c-muted:#2c2c2e;--c-ink:#f0f0eb;--c-ink-muted:#b8b8b8;--c-ink-label:#a0a0a0;--c-brand:#fbbf24;--c-brand-text:#fbbf24;--c-line:rgba(240,240,235,.12);--c-nav-bg:rgba(10,10,10,.8);--c-elevation-1:0 1px 2px rgba(0,2,8,.06),0 4px 10px -4px rgba(0,2,8,.08),0 10px 20px -10px rgba(0,2,8,.07);--c-elevation-2:0 1px 2px rgba(0,2,8,.08),0 6px 16px -6px rgba(0,2,8,.11),0 16px 32px -14px rgba(0,2,8,.10);--c-elevation-3:0 2px 3px rgba(0,2,8,.09),0 10px 24px -8px rgba(0,2,8,.14),0 24px 48px -20px rgba(0,2,8,.12);--c-elevation-4:0 2px 4px rgba(0,2,8,.11),0 16px 32px -10px rgba(0,2,8,.15),0 36px 64px -26px rgba(0,2,8,.14);--c-elevation-5:0 3px 6px rgba(0,2,8,.12),0 20px 44px -12px rgba(0,2,8,.18),0 52px 96px -34px rgba(0,2,8,.19);--c-elevation-4-filter:drop-shadow(0 2px 3px rgba(0,2,8,.11)) drop-shadow(0 14px 26px rgba(0,2,8,.14)) drop-shadow(0 28px 46px rgba(0,2,8,.13))}
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
        @keyframes waiting-pulse{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(245,158,11,.22)}50%{transform:scale(1.06);box-shadow:0 0 0 9px rgba(245,158,11,0)}}
        .waiting-pulse{animation:waiting-pulse 2.8s cubic-bezier(.4,0,.6,1) infinite}
        @media (prefers-reduced-motion:reduce){
          .hero-rise,.hero-fade{opacity:1!important;transform:none!important;animation:none!important}
          .reveal-on-scroll{opacity:1!important;transform:none!important;transition:none!important}
          .waiting-pulse{animation:none!important;box-shadow:0 0 0 0 rgba(245,158,11,.22)!important}
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
      className="inline-flex items-center gap-2 text-[12px] font-bold mb-5 rounded-full"
      style={{
        letterSpacing: "0.08em",
        color: dark ? F.marigold : F.amberText,
        fontFamily: SANS,
        background: dark ? "rgba(251,191,36,0.12)" : "rgba(245,158,11,0.12)",
        border: dark ? "1px solid rgba(251,191,36,0.22)" : "1px solid rgba(245,158,11,0.22)",
        padding: "6px 12px 6px 10px",
        boxShadow: SHADOW.elevation1,
      }}
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

