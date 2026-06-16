import { useRef, useEffect } from "react";
import gsap from "gsap";

const ACCENT = (typeof document !== "undefined" && getComputedStyle(document.documentElement).getPropertyValue("--g-primary-cta-fill").trim()) || "#FBBF24"; // Forge brand (auto-syncs on palette change)

// Mid-page marquee: emotional hooks and brand voice
const MARQUEE_PHRASES = [
  "Free for one month",
  "Built for trainers who do the work",
  "One app to run it all",
  "Your clients are waiting",
  "\u20B9200/month",
  "No more WhatsApp chaos",
];

export function DirectionalMarquee() {
  const row1Ref = useRef<HTMLDivElement>(null);
  const row2Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const row1 = row1Ref.current;
    const row2 = row2Ref.current;
    if (!row1 || !row2) return;

    const ctx = gsap.context(() => {
      // Row 1: scroll left
      const w1 = row1.scrollWidth / 2;
      gsap.set(row1, { x: 0 });
      gsap.to(row1, { x: -w1, duration: 40, ease: "none", repeat: -1 });

      // Row 2: scroll right
      const w2 = row2.scrollWidth / 2;
      gsap.set(row2, { x: -w2 });
      gsap.to(row2, { x: 0, duration: 45, ease: "none", repeat: -1 });
    });
    return () => ctx.revert();
  }, []);

  const renderPhrases = (isAccent: boolean) =>
    [...MARQUEE_PHRASES, ...MARQUEE_PHRASES, ...MARQUEE_PHRASES, ...MARQUEE_PHRASES].map((phrase, i) => (
      <span
        key={i}
        className="whitespace-nowrap mx-6 md:mx-10"
        style={{
          fontFamily: "var(--font-serif)",
          fontWeight: 400,
          color: isAccent ? ACCENT : "rgba(255,255,255,0.12)",
        }}
      >
        {phrase}
        <span className="mx-6 md:mx-10" style={{ color: "rgba(255,255,255,0.08)" }} aria-hidden="true">/</span>
      </span>
    ));

  return (
    <div className="overflow-hidden w-full" aria-hidden="true">
      <div className="flex flex-col gap-3">
        <div className="overflow-hidden">
          <div ref={row1Ref} className="flex text-[28px] md:text-[42px] tracking-[-0.03em] whitespace-nowrap">
            {renderPhrases(true)}
          </div>
        </div>
        <div className="overflow-hidden">
          <div ref={row2Ref} className="flex text-[22px] md:text-[34px] tracking-[-0.03em] whitespace-nowrap">
            {renderPhrases(false)}
          </div>
        </div>
      </div>
    </div>
  );
}
