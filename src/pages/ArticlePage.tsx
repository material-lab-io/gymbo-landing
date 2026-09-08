import { marked, Renderer } from "marked";
import { Plus } from "lucide-react";
import { PageShell } from "../components/PageShell";
import { F, SERIF, SANS, SHADOW } from "../forge-ui";
import type { Post } from "../content/blog/posts";

marked.setOptions({ gfm: true });

/* gy-ma11q — keyboard access to wide tables.
   Guide/research bodies are markdown rendered to HTML and injected with
   dangerouslySetInnerHTML, so there is no JSX to hang attributes on: the wrapper has to
   come from the renderer. A horizontally scrollable region that contains no focusable
   element cannot be scrolled by keyboard or switch at all — the off-screen columns are
   simply unreachable (axe scrollable-region-focusable, WCAG-AA). Measured live on
   2026-09-06: 6 guide/research routes failed on exactly this.
   tabindex="0" makes the region scrollable by keyboard; role="region" + aria-label give it
   a name so it is announced rather than being an unlabelled tab stop. This is the single
   choke point for every markdown table on the site — ArticlePage is the only place marked
   runs and the only user of .article-prose.

   Implementation note, learned the hard way: do NOT `bind()` the default renderer here.
   marked attaches `parser` to the renderer instance it actually uses, and a bound copy of a
   bare `new Renderer()` has no parser — the build dies inside tablecell. Calling
   `Renderer.prototype.table` with `this` keeps the live renderer (and its parser) intact. */
marked.use({
  renderer: {
    table(this: Renderer, token: Parameters<Renderer["table"]>[0]) {
      const table = Renderer.prototype.table.call(this, token);
      return `<div class="table-scroll" tabindex="0" role="region" aria-label="Table — scroll horizontally to see all columns">${table}</div>`;
    },
  },
});

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${months[m - 1]} ${y}`;
}

/* Renders one content post: single H1 (post.title), dek, markdown body, a CTA,
   and a FAQ built from post.faq (same source as the FAQPage JSON-LD in <head>).
   Used for the cornerstone guide and the /alternatives comparison pages. */
export function ArticlePage({
  post,
  back = { href: "/blog/", label: "← all articles" },
  showDate = true,
  related,
}: {
  post: Post;
  back?: { href: string; label: string };
  showDate?: boolean;
  related?: { href: string; label: string }[];
}) {
  const html = marked.parse(post.bodyMd) as string;
  return (
    <PageShell>
      <article className="max-w-[760px] mx-auto px-5 md:px-12 pt-12 md:pt-16 pb-20">
        <a href={back.href} className="text-[13px] font-semibold" style={{ color: F.amberText, fontFamily: SANS }}>{back.label}</a>
        <h1 className="mt-4 text-[clamp(28px,4.6vw,44px)] font-black" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", lineHeight: 1.08, color: F.ink }}>
          {post.title}
        </h1>
        {showDate && <p className="mt-3 text-[13px]" style={{ color: F.inkLabel, fontFamily: SANS }}>{formatDate(post.date)}</p>}
        {post.quickAnswer && (
          <div className="mt-6 rounded-2xl p-5 md:p-6" style={{ background: F.beigeCard, fontFamily: SANS }}>
            <span className="text-[12px] font-bold uppercase" style={{ letterSpacing: "0.09em", color: F.amberText }}>Quick answer</span>
            <p className="mt-2 text-[16px] md:text-[17px]" style={{ color: F.ink, lineHeight: 1.65 }}>{post.quickAnswer}</p>
          </div>
        )}
        {post.dek && <p className="mt-5 text-[17px]" style={{ color: F.inkMuted, fontFamily: SANS, lineHeight: 1.6 }}>{post.dek}</p>}

        <div className="article-prose mt-8" style={{ color: F.inkMuted, fontFamily: SANS, fontSize: "15.5px", lineHeight: 1.75 }} dangerouslySetInnerHTML={{ __html: html }} />

        <div className="mt-10 flex flex-col sm:flex-row sm:items-center gap-3.5">
          <a href="/#cta" className="inline-flex items-center justify-center gap-2 h-14 px-7 rounded-full font-bold text-[15px] transition-transform duration-150 hover:-translate-y-px active:scale-[0.97]" style={{ background: F.amber, color: F.onCta, boxShadow: SHADOW.cta, fontFamily: SANS }}>
            Try Gymbo free for 7 days →
          </a>
          <span className="text-[13px]" style={{ color: F.inkLabel, fontFamily: SANS }}>Billed via the App Store</span>
        </div>

        {post.faq.length > 0 && (
          <section aria-label="Frequently asked questions" className="mt-14">
            <h2 className="text-[clamp(22px,3vw,30px)] font-black" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", color: F.ink }}>FAQ</h2>
            <div className="mt-5 flex flex-col">
              {post.faq.map((item) => (
                <details key={item.q} className="faq py-1" style={{ borderBottom: "1px solid var(--c-line)" }}>
                  <summary className="flex items-center justify-between gap-4 py-5">
                    <span className="text-[16px] md:text-[17px] font-bold" style={{ fontFamily: SERIF, color: F.ink }}>{item.q}</span>
                    <span className="faq-plus shrink-0 grid place-items-center w-7 h-7 rounded-full transition-transform duration-200" style={{ background: "rgba(245,158,11,0.14)", color: F.amberText }}>
                      <Plus size={15} strokeWidth={2.4} />
                    </span>
                  </summary>
                  <p className="pb-5 pr-10 text-[14px] md:text-[15px]" style={{ color: F.inkMuted, fontFamily: SANS, lineHeight: 1.6 }}>{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        {related && related.length > 0 && (
          <nav aria-label="Related guides" className="mt-14 pt-8" style={{ borderTop: "1px solid var(--c-line)" }}>
            <h2 className="text-[15px] font-bold uppercase" style={{ letterSpacing: "0.08em", color: F.inkLabel, fontFamily: SANS }}>Related guides</h2>
            <div className="mt-4 flex flex-col">
              {related.map((r) => (
                <a key={r.href} href={r.href} className="group block py-3.5 transition-opacity hover:opacity-70" style={{ borderTop: "1px solid var(--c-line)" }}>
                  <span className="text-[16px] md:text-[17px] font-bold" style={{ fontFamily: SERIF, color: F.ink }}>{r.label}</span>
                  <span className="ml-2 text-[14px] font-semibold" style={{ color: F.amberText, fontFamily: SANS }}>→</span>
                </a>
              ))}
            </div>
          </nav>
        )}
      </article>
    </PageShell>
  );
}
