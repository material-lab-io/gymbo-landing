import { marked } from "marked";
import { Plus } from "lucide-react";
import { PageShell } from "../components/PageShell";
import { F, SERIF, SANS, SHADOW } from "../forge-ui";
import type { Post } from "../content/blog/posts";

marked.setOptions({ gfm: true });

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
}: {
  post: Post;
  back?: { href: string; label: string };
  showDate?: boolean;
}) {
  const html = marked.parse(post.bodyMd) as string;
  return (
    <PageShell>
      <article className="max-w-[760px] mx-auto px-5 md:px-12 pt-12 md:pt-16 pb-20">
        <a href={back.href} className="text-[13px] font-semibold" style={{ color: F.amberText, fontFamily: SANS }}>{back.label}</a>
        <h1 className="mt-4 text-[clamp(28px,4.6vw,44px)] font-black" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", lineHeight: 1.12, color: F.ink }}>
          {post.title}
        </h1>
        {showDate && <p className="mt-3 text-[13px]" style={{ color: F.inkLabel, fontFamily: SANS }}>{formatDate(post.date)}</p>}
        {post.dek && <p className="mt-5 text-[17px]" style={{ color: F.inkMuted, fontFamily: SANS, lineHeight: 1.6 }}>{post.dek}</p>}

        <div className="article-prose mt-8" style={{ color: F.inkMuted, fontFamily: SANS, fontSize: "15.5px", lineHeight: 1.75 }} dangerouslySetInnerHTML={{ __html: html }} />

        <div className="mt-10 flex flex-col sm:flex-row sm:items-center gap-3.5">
          <a href="/#cta" className="inline-flex items-center justify-center gap-2 h-14 px-7 rounded-full font-bold text-[15px] transition-transform duration-150 hover:-translate-y-px active:scale-[0.97]" style={{ background: F.amber, color: F.onCta, boxShadow: SHADOW.cta, fontFamily: SANS }}>
            Try Gymbo free for a month →
          </a>
          <span className="text-[13px]" style={{ color: F.inkLabel, fontFamily: SANS }}>No card · sign in with your phone</span>
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
      </article>
    </PageShell>
  );
}
