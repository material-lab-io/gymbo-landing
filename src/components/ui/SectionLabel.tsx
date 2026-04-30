import type { ReactNode } from "react";

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span
      className="gsap-fade inline-block text-[10px] tracking-[0.2em] uppercase mb-3"
      style={{ color: "var(--accent)", fontWeight: 600 }}
    >
      {children}
    </span>
  );
}
