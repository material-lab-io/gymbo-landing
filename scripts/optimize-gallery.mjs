// Optimize "See Gymbo in action" gallery screenshots (bead gy-9bmwm.4).
// Source: founder-approved curated set in public/screens/real/ (current app UI).
// Output: public/screens/gallery/<slug>-<w>.webp (responsive srcset) + <slug>.png fallback.
// Run: node scripts/optimize-gallery.mjs
import sharp from "sharp";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

const SRC = "public/screens/real";
const OUT = "public/screens/gallery";

// slug → source file. Each is a clean, full-screen real-app shot (light mode).
const SCREENS = {
  dashboard: "hero-01-dashboard-clean.png",
  schedule: "organized-01-schedule-day.png",
  payments: "revenue-01-ledger-history.png",
  ai: "extra-ai-assistant.png",
  workouts: "workouts-01-template-fullbody.png",
  export: "revenue-02-export-statement.png",
};

const WIDTHS = [360, 540, 720]; // phone renders ~230px CSS → covers 1.5x–3x
const FALLBACK_W = 540;

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

let total = 0;
for (const [slug, file] of Object.entries(SCREENS)) {
  const input = path.join(SRC, file);
  for (const w of WIDTHS) {
    const out = path.join(OUT, `${slug}-${w}.webp`);
    const info = await sharp(input).resize(w).webp({ quality: 78, effort: 6 }).toFile(out);
    total += info.size;
    console.log(`${out}  ${(info.size / 1024).toFixed(1)} kB`);
  }
  const pngOut = path.join(OUT, `${slug}.png`);
  const pInfo = await sharp(input).resize(FALLBACK_W).png({ compressionLevel: 9, palette: true }).toFile(pngOut);
  total += pInfo.size;
  console.log(`${pngOut}  ${(pInfo.size / 1024).toFixed(1)} kB  (fallback)`);
}
console.log(`\nTotal on disk: ${(total / 1024).toFixed(1)} kB across ${Object.keys(SCREENS).length} screens`);
