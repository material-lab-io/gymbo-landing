// Optimize the real app screenshots the site renders (beads gy-9bmwm.4 and
// gy-dyu6r.6).
// Source: founder-approved curated masters in public/screens/real/ (current app UI).
// Output: public/screens/gallery/<slug>-<w>.webp (responsive srcset) + <slug>.png fallback.
// Run: node scripts/optimize-gallery.mjs
//
// The gallery places these derivatives in the approved photoreal frame. The
// four pillars use separately licensed light/dark motion demos and posters;
// the baked hero is a licensed composition derived from the first three masters.
import sharp from "sharp";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { SCREENS } from "./screens-map.mjs";

const SRC = "public/screens/real";
const OUT = "public/screens/gallery";

// 360/540 cover gallery apertures + pillar cards at 1x/2x; 720/1080 cover
// higher-density gallery apertures and the widest pillar card.
const WIDTHS = [360, 540, 720, 1080];
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
