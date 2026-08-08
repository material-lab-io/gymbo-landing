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

const WIDTHS = [360, 540, 720, 1080]; // gallery ~230–360px CSS + the large hero phone (~600px → 1080 = ~1.8x)
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
// Hero device (gy-a73px.7): keep the master's full device aspect, like every other
// slug — no extra crop on top of the optimizer. HeroPhone's box (1206/2622) is still
// taller than this master (1206x2282, pre-trimmed by 340px upstream — see sibling
// bead for a clean full-height capture), so a small residual cover-crop remains, but
// the ~1.645x double-crop from the old top=690 region is gone.
{
  const heroSrc = path.join(SRC, "hero-01-dashboard-clean.png");
  for (const w of [540, 720, 1080]) {
    const out = path.join(OUT, `hero-dashboard-${w}.webp`);
    const info = await sharp(heroSrc).resize(w).webp({ quality: 80, effort: 6 }).toFile(out);
    total += info.size;
    console.log(`${out}  ${(info.size / 1024).toFixed(1)} kB`);
  }
  const heroPng = path.join(OUT, "hero-dashboard.png");
  await sharp(heroSrc).resize(540).png({ compressionLevel: 9, palette: true }).toFile(heroPng);
}

console.log(`\nTotal on disk: ${(total / 1024).toFixed(1)} kB across ${Object.keys(SCREENS).length} screens`);
