import { PageShell } from "../components/PageShell";
import { F, SERIF, SANS } from "../forge-ui";
import { POSTS } from "../content/blog/posts";

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${months[m - 1]} ${y}`;
}

/* /blog — index of content posts, newest first. */
export function Blog() {
  const posts = [...POSTS].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <PageShell>
      <div className="max-w-[760px] mx-auto px-5 md:px-12 pt-12 md:pt-16 pb-20">
        <h1 className="text-[clamp(30px,5vw,46px)] font-black" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", lineHeight: 1.1, color: F.ink }}>
          The Gymbo blog
        </h1>
        <p className="mt-4 text-[16px]" style={{ color: F.inkMuted, fontFamily: SANS, lineHeight: 1.7 }}>
          Practical guides for independent personal trainers in India — running the business, getting paid, and growing past the notebook.
        </p>

        <div className="mt-10 flex flex-col">
          {posts.map((p) => (
            <a key={p.slug} href={`/blog/${p.slug}/`} className="group block py-6 transition-opacity hover:opacity-80" style={{ borderTop: "1px solid var(--c-line)" }}>
              <span className="text-[12px]" style={{ color: F.inkLabel, fontFamily: SANS }}>{formatDate(p.date)}</span>
              <h2 className="mt-1.5 text-[20px] md:text-[24px] font-black" style={{ fontFamily: SERIF, letterSpacing: "-0.01em", lineHeight: 1.2, color: F.ink }}>{p.title}</h2>
              <p className="mt-2 text-[14px] md:text-[15px]" style={{ color: F.inkMuted, fontFamily: SANS, lineHeight: 1.6 }}>{p.dek}</p>
              <span className="mt-3 inline-block text-[13px] font-semibold" style={{ color: F.amberText, fontFamily: SANS }}>Read →</span>
            </a>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
