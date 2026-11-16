// GENERATED FILE — DO NOT EDIT.
//
// Source of truth: src/forge/forge.css
// Regenerate:     node scripts/gen-functions-forge-tokens.mjs
// Verified in CI: node scripts/gen-functions-forge-tokens.mjs --check
//
// The Pages Functions serve standalone HTML and cannot import the site's CSS,
// so the palette has to travel with them. This file is that copy, and it is
// generated precisely so it cannot drift from Forge unnoticed (gy-aczn1).
export const FORGE = {
  "--g-color-brand-amber-500": "#f59e0b",
  "--g-color-brand-marigold-500": "#fbbf24",
  "--g-color-brand-amber-text-light": "#92400e",
  "--g-color-brand-amber-text-light-hc": "#78350f",
  "--g-color-brand-marigold-text-dark-hc": "#fcd34d",
  "--g-color-mark-amber": "#ff9800",
  "--g-color-mark-deep": "#9d3900",
  "--g-color-neutral-dark-0": "#000000",
  "--g-color-neutral-dark-1": "#111111",
  "--g-color-neutral-dark-2": "#171719",
  "--g-color-neutral-dark-3": "#242426",
  "--g-color-neutral-dark-fg": "#ffffff",
  "--g-color-neutral-light-0": "#ffffff",
  "--g-color-neutral-light-1": "#f5f5f1",
  "--g-color-neutral-light-2": "#f3f3ef",
  "--g-color-neutral-light-3": "#ecece7",
  "--g-color-neutral-light-fg": "#000000",
  "--g-color-grey-muted-fg-dark": "#d0d0d0",
  "--g-color-grey-muted-fg-light": "#373737",
  "--g-color-grey-label-dark": "#afafaf",
  "--g-color-grey-label-light": "#4e4e4e",
  "--g-color-grey-placeholder-dark": "#afafaf",
  "--g-color-grey-placeholder-dark-elevated": "#afafaf",
  "--g-color-grey-placeholder-light": "#4e4e4e",
  "--g-color-grey-icon-muted-dark": "#858585",
  "--g-color-grey-icon-muted-light": "#6a6a6a",
  "--g-color-grey-separator-dark": "#646464",
  "--g-color-grey-separator-light": "#8c8c8c",
  "--g-color-status-green-fill-dark": "#4ade80",
  "--g-color-status-green-fill-light": "#22c55e",
  "--g-color-status-green-text": "#166534",
  "--g-color-status-destructive-dark": "#ff6961",
  "--g-color-status-destructive-light": "#b80f34",
  "--g-color-status-warning-dark": "#ea580c",
  "--g-color-status-warning-light": "#ea580c",
  "--g-color-system-blue": "#007aff",
  "--g-color-system-blue-text-light": "#0a58ca",
  "--g-color-system-blue-text-dark": "#409cff",
  "--g-color-button-inactive-bg-dark": "#333333",
  "--g-color-button-inactive-bg-light": "#e5e5e5",
  "--g-color-button-inactive-text-dark": "#a8a8a8",
  "--g-color-button-inactive-text-light": "#5c5c5c",
  "--g-color-button-active-text": "#0a0a0a",
  "--g-color-absolute-white": "#ffffff",
  "--g-color-absolute-black": "#0a0a0a",
};

// Emit ONLY the tokens a page actually uses, as :root custom properties.
// A page pulling all 45 would ship declarations it never reads to a client on
// mobile data, which is the same instinct this whole surface exists to serve.
//
// An unknown name THROWS rather than emitting nothing: a silently-missing custom
// property falls back to the browser default and the page renders in the wrong
// colour with no error anywhere.
export function rootVars(names) {
  return names
    .map((n) => {
      const key = `--g-color-${n}`;
      if (!(key in FORGE)) throw new Error(`unknown Forge token: ${key}`);
      return `${key}:${FORGE[key]}`;
    })
    .join(';') + ';';
}
