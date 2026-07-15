import { PageShell } from "../components/PageShell";
import { F, SERIF, SANS } from "../forge-ui";
import { PILLARS } from "../content/guide/pillars";

/* /guide — hub for the AEO how-to pillars. Newest first; grows as pillars 2-4 land. */
export function GuideIndex() {
  const pillars = [...PILLARS].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <PageShell>
      <div className="max-w-[760px] mx-auto px-5 md:px-12 pt-12 md:pt-16 pb-20">
        <h1 className="text-[clamp(30px,5vw,46px)] font-black" style={{ fontFamily: SERIF, letterSpacing: "-0.02em", lineHeight: 1.5, color: F.ink }}>
          Guides for independent trainers
        </h1>
        <p className="mt-4 text-[16px]" style={{ color: F.inkMuted, fontFamily: SANS, lineHeight: 1.7 }}>
          Practical, honest guides to running an independent personal-training business in India — the systems, the money, and the admin, without the jargon.
        </p>

        <div className="mt-10 flex flex-col">
          {pillars.map((p) => (
            <a key={p.slug} href={`/guide/${p.slug}/`} className="group block py-6 transition-opacity hover:opacity-80" style={{ borderTop: "1px solid var(--c-line)" }}>
              <h2 className="text-[20px] md:text-[24px] font-black" style={{ fontFamily: SERIF, letterSpacing: "-0.01em", lineHeight: 1.5, color: F.ink }}>{p.title}</h2>
              <p className="mt-2 text-[14px] md:text-[15px]" style={{ color: F.inkMuted, fontFamily: SANS, lineHeight: 1.6 }}>{p.quickAnswer ?? p.dek}</p>
              <span className="mt-3 inline-block text-[13px] font-semibold" style={{ color: F.amberText, fontFamily: SANS }}>Read the guide →</span>
            </a>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
