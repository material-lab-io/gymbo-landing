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
  "--g-color-neutral-dark-0": "#0a0a0a",
  "--g-color-neutral-dark-1": "#141414",
  "--g-color-neutral-dark-2": "#1c1c1e",
  "--g-color-neutral-dark-3": "#2c2c2e",
  "--g-color-neutral-dark-fg": "#f0f0eb",
  "--g-color-neutral-light-0": "#fafaf7",
  "--g-color-neutral-light-1": "#eaeae5",
  "--g-color-neutral-light-2": "#e8e8e3",
  "--g-color-neutral-light-3": "#dcdcd9",
  "--g-color-neutral-light-fg": "#1a1a1a",
  "--g-color-grey-muted-fg-dark": "#b8b8b8",
  "--g-color-grey-muted-fg-light": "#555555",
  "--g-color-grey-label-dark": "#a0a0a0",
  "--g-color-grey-label-light": "#595959",
  "--g-color-grey-placeholder-dark": "#808080",
  "--g-color-grey-placeholder-dark-elevated": "#9a9a9a",
  "--g-color-grey-placeholder-light": "#666666",
  "--g-color-status-green-fill-dark": "#4ade80",
  "--g-color-status-green-fill-light": "#22c55e",
  "--g-color-status-green-text": "#15803d",
  "--g-color-status-destructive-dark": "#ff6961",
  "--g-color-status-destructive-light": "#b80f34",
  "--g-color-status-warning-dark": "#ea580c",
  "--g-color-status-warning-light": "#ea580c",
  "--g-color-system-blue": "#007aff",
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
// A page pulling all 38 would ship declarations it never reads to a client on
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
