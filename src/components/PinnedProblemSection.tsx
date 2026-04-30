import { useRef, useEffect, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SectionLabel } from "./ui/SectionLabel";

gsap.registerPlugin(ScrollTrigger);

const ACCENT = "#F5B130";

interface PainPoint {
  num: string;
  title: string;
  desc: string;
}

export function PinnedProblemSection({ items }: { items: PainPoint[] }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      const panels = panelRefs.current.filter(Boolean) as HTMLDivElement[];

      panels.forEach((panel, i) => {
        ScrollTrigger.create({
          trigger: panel,
          start: "top 50%",
          end: "bottom 50%",
          onEnter: () => setActiveIndex(i),
          onEnterBack: () => setActiveIndex(i),
        });
      });
    }, sectionRef);

    return () => ctx.revert();
  }, [items]);

  return (
    <div ref={sectionRef} id="problem" className="relative">
      {/* Dot indicator */}
      <div
        className="sticky top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3 ml-auto w-fit pr-6 md:pr-10 h-0"
        style={{ pointerEvents: "none" }}
      >
        {items.map((pain, i) => (
          <div
            key={pain.num}
            className="w-[6px] h-[6px] rounded-full"
            style={{
              backgroundColor: i === activeIndex ? ACCENT : "rgba(255,255,255,0.15)",
              boxShadow: i === activeIndex ? `0 0 8px ${ACCENT}50` : "none",
              transition: "background-color 0.3s ease, box-shadow 0.3s ease",
            }}
          />
        ))}
      </div>

      {/* Stacking panels */}
      {items.map((pain, i) => (
        <div
          key={pain.num}
          ref={(el) => { panelRefs.current[i] = el; }}
          className="sticky top-0 h-[50vh] w-full flex items-center justify-center px-6 md:px-12 overflow-hidden"
          style={{
            background: `hsl(230 15% ${4 + i * 1.5}%)`,
            borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none",
            zIndex: i + 1,
          }}
        >
          {/* Large background number */}
          <span
            aria-hidden="true"
            className="absolute select-none pointer-events-none"
            style={{
              fontFamily: "Merriweather, Georgia, serif",
              fontWeight: 400,
              fontSize: "clamp(200px, 35vw, 450px)",
              lineHeight: 1,
              color: "transparent",
              WebkitTextStroke: "1px rgba(255,255,255,0.04)",
              right: "5%",
              bottom: "5%",
            }}
          >
            {pain.num}
          </span>

          {/* Content */}
          <div className="relative z-10 max-w-[720px] w-full">
            {i === 0 && (
              <div className="mb-6 md:mb-8">
                <SectionLabel>The problem</SectionLabel>
              </div>
            )}

            <div className="flex items-baseline gap-5 md:gap-8 mb-4">
              <span
                className="text-[13px] md:text-[14px] tracking-[0.1em] uppercase shrink-0"
                style={{
                  color: ACCENT,
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontWeight: 500,
                  opacity: 0.7,
                }}
              >
                {pain.num}
              </span>
              <div className="flex-1 h-[1px]" style={{ background: "rgba(255,255,255,0.06)" }} />
            </div>

            <h3
              className="text-[28px] md:text-[42px] text-white tracking-[-0.025em] mb-5"
              style={{ fontFamily: "Merriweather, Georgia, serif", fontWeight: 400, lineHeight: 1.1 }}
            >
              {pain.title}
            </h3>

            <p
              className="text-[15px] md:text-[17px] text-white/60 max-w-[520px]"
              style={{ lineHeight: 1.65, fontWeight: 300 }}
            >
              {pain.desc}
            </p>

            <div className="mt-5 w-12 h-[1px]" style={{ background: "rgba(255,255,255,0.06)" }} />
          </div>
        </div>
      ))}

      {/* Spacer */}
      <div
        className="h-[10vh]"
        style={{ background: `hsl(230 15% ${4 + (items.length - 1) * 1.5}%)` }}
        aria-hidden="true"
      />
    </div>
  );
}
