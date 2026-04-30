/**
 * Screen image paths mapped from feature keys.
 * Screenshots already include phone bezels + dynamic island.
 */
const SCREEN_MAP: Record<string, string> = {
  "light-checkin": "/screens/screen-checkin.png",
  "light-payments": "/screens/screen-payments.png",
  "light-schedule": "/screens/screen-schedule.png",
  "light-brand": "/screens/screen-brand.png",
  "light-invoicing": "/screens/screen-profile.png",
  "light-gymbo": "/screens/screen-ai.png",
};

/** Renders a real product screenshot for the given feature key */
export function renderScreen(screen: string) {
  const src = SCREEN_MAP[screen] ?? "/screens/screen-checkin.png";
  return (
    <img
      src={src}
      alt={`Gymbo ${screen.replace("light-", "")} screen`}
      className="w-full h-auto rounded-[clamp(16px,10%,32px)]"
      loading="lazy"
    />
  );
}

/**
 * Thin wrapper that adds a glow effect behind a phone screenshot.
 * Does NOT add a phone frame — screenshots already include bezels.
 */
export function ScreenWithGlow({
  src,
  alt,
  glowColor = "#F5B130",
  className = "",
}: {
  src: string;
  alt: string;
  glowColor?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <div
        className="absolute inset-0 blur-[80px] opacity-20 rounded-[60px] scale-90"
        style={{ background: glowColor }}
        aria-hidden="true"
      />
      <img
        src={src}
        alt={alt}
        className="relative w-full h-auto rounded-[clamp(16px,10%,32px)]"
        loading="lazy"
      />
    </div>
  );
}
