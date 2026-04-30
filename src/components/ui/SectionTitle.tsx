import type { ReactNode } from "react";

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2
      className="gsap-fade text-[24px] md:text-[32px] text-white tracking-[-0.03em] max-w-[600px]"
      style={{ fontFamily: "Merriweather, Georgia, serif", fontWeight: 400, lineHeight: 1.1 }}
    >
      {children}
    </h2>
  );
}
