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
      : {
          background: "rgba(255,255,255,0.04)",
          color: "rgba(255,255,255,0.75)",
          border: "1px solid rgba(255,255,255,0.08)",
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
