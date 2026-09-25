// gy-yedub item 6: optimize the trainer portrait for the "brand story" band.
// Source: Unsplash h4i9G-de7Po (John Arano, Standard Unsplash License, verified
// by designer). Downloaded from the images.unsplash.com CDN, NOT hot-linked.
// One landscape master serves both the tall desktop panel and the 16:9 mobile
// banner via CSS object-cover, so no pre-crop here — responsive webp + png
// fallback only, mirroring scripts/optimize-gallery.mjs.
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const SRC = process.env.SRC || "/tmp/item6/portrait-src.jpg";
const OUT = "public/photos";
const SLUG = "trainer-lifting";
const WIDTHS = [480, 720, 960, 1280, 1600];
const FALLBACK_W = 720;

await mkdir(OUT, { recursive: true });
let total = 0;
for (const w of WIDTHS) {
  const out = path.join(OUT, `${SLUG}-${w}.webp`);
  const info = await sharp(SRC).resize(w).webp({ quality: 80, effort: 6 }).toFile(out);
  total += info.size;
  console.log(`${out}  ${(info.size / 1024).toFixed(1)} kB`);
}
const pngOut = path.join(OUT, `${SLUG}.png`);
const pInfo = await sharp(SRC).resize(FALLBACK_W).png({ compressionLevel: 9, palette: true }).toFile(pngOut);
total += pInfo.size;
console.log(`${pngOut}  ${(pInfo.size / 1024).toFixed(1)} kB  (fallback)`);
console.log(`\nTotal: ${(total / 1024).toFixed(1)} kB`);
