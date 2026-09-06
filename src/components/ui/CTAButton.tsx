import type { ReactNode } from "react";

export function CTAButton({
  variant,
  size,
  onClick,
  children,
  className = "",
}: {
  variant: "primary" | "secondary";
  size: "sm" | "md" | "lg";
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  const sizeClasses = {
    sm: "px-6 h-12 text-[13px]",
    md: "px-8 h-12 text-[14px]",
    lg: "px-8 h-12 text-[14px]",
  };

  const variantStyles =
    variant === "primary"
      ? {
          background: "var(--accent)",
          color: "var(--accent-foreground)",
          border: "none",
          fontWeight: 600,
          fontFamily: "var(--font-sans)",
        }
      : // gy-lgaz6 — this variant had the same construction as the waitlist
        // field: on charcoal (#0a0a0a) its border composited to 1.23:1 against
        // its own fill, versus the 3:1 WCAG 1.4.11 needs for a control boundary.
        //
        // It has ZERO call sites today, which is exactly why it is fixed rather
        // than left: gy-vfrha named the dead `--border: rgba(255,255,255,0.08)`
        // as "a trap for the first person to use it", and an unused component in
        // ui/ that fails AA the moment somebody reaches for it is the same trap
        // with a nicer name. NOT deleted — removing a design-system primitive is
        // designer's call, not this file's.
        {
          background: "var(--g-color-neutral-dark-1)",
          color: "var(--g-color-grey-muted-fg-dark)",
          border: "1px solid var(--g-color-grey-placeholder-dark)",
          fontWeight: 400,
          fontFamily: "var(--font-sans)",
        };

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-xl transition-all hover:opacity-90 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none ${sizeClasses[size]} ${className}`}
      style={variantStyles}
    >
      {children}
    </button>
  );
}
