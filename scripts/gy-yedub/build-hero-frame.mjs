// gy-yedub item 4: build the "holed" three-phone hero frame — the exact same
// MockupWorld scene as hero-three-panel.png (shadows + metal + reflections +
// fan arrangement, mask UNCHANGED per Kaushik) but with the three screen
// apertures PUNCHED TRANSPARENT so live <video> layers can be placed BEHIND
// the frame and show through the glass. Also emits the three aperture screen
// quads in cropped-bbox FRACTIONAL coords so the React layer can position /
// perspective-warp each video without re-deriving geometry by eye.
//
// Reuses the geometry + crop constants from ../gy-7yhkh/build-hero.mjs so the
// output is pixel-aligned with the existing baked raster (same 4800x3236 bbox).
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const EXTRACT = path.resolve("assets/hero-source");
const OUT_DIR = path.resolve("public/mockups");

const CANVAS_W = 6000;
const CANVAS_H = 4500;

// group -> { shadow, frame, changeThis(mask), aperture {x,y,w,h} }  (canvas coords)
const PHONES = {
  _1: { shadow: "01__1_shadow.png", frame: "02__1_iPhone-17.png", changeThis: "03__1_Change-This.png", aperture: { x: 1243, y: 814, w: 1156, h: 3032 } },
  _3: { shadow: "04__3_shadow.png", frame: "05__3_iPhone-17.png", changeThis: "06__3_Change-This.png", aperture: { x: 3602, y: 813, w: 1159, h: 3036 } },
  _2: { shadow: "07__2_shadow.png", frame: "08__2_iPhone-17.png", changeThis: "09__2_Change-This.png", aperture: { x: 2291, y: 781, w: 1417, h: 3088 } },
};
const PAINT_ORDER = ["_1", "_3", "_2"];               // back-left, back-right, front-center (topmost)
const FRAME_ABS = { _1: { x: 1123, y: 773 }, _3: { x: 3570, y: 772 }, _2: { x: 2231, y: 730 } };
const SHADOW_ABS = { _1: { x: 189, y: 3612 }, _3: { x: 2884, y: 3558 }, _2: { x: 1390, y: 3631 } };
const SLANTED = new Set(["_1", "_3"]);                // side phones are perspective quads

// crop identical to build-hero.mjs → guarantees pixel alignment with the raster
const CONTENT_BBOX = { left: 552, top: 732, width: 5304 - 552, height: 3920 - 732 };
const PAD = 24;
const CROP = {
  left: Math.max(0, CONTENT_BBOX.left - PAD),
  top: Math.max(0, CONTENT_BBOX.top - PAD),
  width: CONTENT_BBOX.width + PAD * 2,
  height: CONTENT_BBOX.height + PAD * 2,
};

// ── screen quad from a rounded-rect mask: fit lines to the 4 straight edge runs
//    and intersect (robust to corner radius). Coords are mask-local (0..w,0..h). ──
async function screenQuadFromMask(maskPath) {
  const { data, info } = await sharp(maskPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const a = (x, y) => data[(y * W + x) * 4 + 3];
  const fit = (pts) => {
    const n = pts.length; let sa = 0, sb = 0, saa = 0, sab = 0;
    for (const [u, v] of pts) { sa += u; sb += v; saa += u * u; sab += u * v; }
    const m = (n * sab - sa * sb) / (n * saa - sa * sa);
    return [m, (sb - m * sa) / n];
  };
  const meet = ([m1, c1], [m2, c2]) => { const x = (m2 * c1 + c2) / (1 - m1 * m2); return [x, m1 * x + c1]; };
  const yIn = Math.round(H * 0.12), xIn = Math.round(W * 0.15);
  const L = [], R = [], T = [], B = [];
  for (let y = yIn; y < H - yIn; y += 7) {
    let lo = -1, hi = -1;
    for (let x = 0; x < W; x++) if (a(x, y) > 128) { lo = x; break; }
    for (let x = W - 1; x >= 0; x--) if (a(x, y) > 128) { hi = x; break; }
    if (lo >= 0) { L.push([y, lo]); R.push([y, hi]); }
  }
  for (let x = xIn; x < W - xIn; x += 7) {
    let t = -1, b = -1;
    for (let y = 0; y < H; y++) if (a(x, y) > 128) { t = y; break; }
    for (let y = H - 1; y >= 0; y--) if (a(x, y) > 128) { b = y; break; }
    if (t >= 0) { T.push([x, t]); B.push([x, b]); }
  }
  const lT = fit(T), lB = fit(B), lL = fit(L), lR = fit(R);
  return { tl: meet(lT, lL), tr: meet(lT, lR), br: meet(lB, lR), bl: meet(lB, lL) };
}

// canvas point -> cropped-bbox FRACTION (0..1 across 4800x3236)
const frac = ([x, y]) => [ +((x - CROP.left) / CROP.width).toFixed(5), +((y - CROP.top) / CROP.height).toFixed(5) ];

async function build() {
  // Build the holed frame by interleaving per-phone: shadow, frame, then punch
  // THAT phone's aperture (dest-out) BEFORE the next phone paints over it — so
  // the front-centre phone re-fills the band where it overlaps the side screens.
  const composites = [];
  for (const g of PAINT_ORDER) {
    const p = PHONES[g];
    composites.push({ input: path.join(EXTRACT, p.shadow), left: SHADOW_ABS[g].x, top: SHADOW_ABS[g].y });
    composites.push({ input: path.join(EXTRACT, p.frame), left: FRAME_ABS[g].x, top: FRAME_ABS[g].y });
    composites.push({ input: path.join(EXTRACT, p.changeThis), left: p.aperture.x, top: p.aperture.y, blend: "dest-out" });
  }
  const full = await sharp({ create: { width: CANVAS_W, height: CANVAS_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(composites).png().toBuffer();
  const trimmed = await sharp(full).extract(CROP).png().toBuffer();
  const meta = await sharp(trimmed).metadata();
  console.log("holed frame cropped size:", meta.width, meta.height, "(expect 4800 x 3236)");

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await sharp(trimmed).png({ compressionLevel: 9 }).toFile(path.join(OUT_DIR, "hero-three-panel-frame.png"));
  for (const w of [800, 1200, 1800]) {
    await sharp(trimmed).resize({ width: w }).webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(OUT_DIR, `hero-three-panel-frame-${w}.webp`));
    await sharp(trimmed).resize({ width: w }).png({ compressionLevel: 9 }).toFile(path.join(OUT_DIR, `hero-three-panel-frame-${w}.png`));
  }

  // ── aperture geometry (cropped-fraction) ──
  const geo = {};
  for (const g of PAINT_ORDER) {
    const p = PHONES[g];
    if (SLANTED.has(g)) {
      const q = await screenQuadFromMask(path.join(EXTRACT, p.changeThis)); // mask-local
      const abs = (pt) => [p.aperture.x + pt[0], p.aperture.y + pt[1]];
      geo[g] = { kind: "quad", tl: frac(abs(q.tl)), tr: frac(abs(q.tr)), br: frac(abs(q.br)), bl: frac(abs(q.bl)) };
    } else {
      const { x, y, w, h } = p.aperture;
      geo[g] = { kind: "rect",
        tl: frac([x, y]), tr: frac([x + w, y]), br: frac([x + w, y + h]), bl: frac([x, y + h]) };
    }
  }
  const order = { left: "_1", center: "_2", right: "_3" };
  const out = { bbox: { w: CROP.width, h: CROP.height }, order, apertures: geo };
  fs.writeFileSync(path.join(OUT_DIR, "hero-apertures.json"), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));

  for (const f of fs.readdirSync(OUT_DIR).filter((f) => f.includes("frame") || f.endsWith(".json"))) {
    console.log(f, fs.statSync(path.join(OUT_DIR, f)).size, "bytes");
  }
}
build().catch((e) => { console.error(e); process.exit(1); });
