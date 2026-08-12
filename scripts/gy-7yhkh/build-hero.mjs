import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const EXTRACT = path.resolve("assets/hero-source");
const SCREENS = path.resolve("public/screens/real");
const OUT_DIR = path.resolve("public/mockups");

const CANVAS_W = 6000;
const CANVAS_H = 4500;

// group name -> {shadow, frame, aperture: {x,y,w,h}}
const PHONES = {
  _1: {
    shadow: "01__1_shadow.png",
    frame: "02__1_iPhone-17.png",
    changeThis: "03__1_Change-This.png",
    aperture: { x: 1243, y: 814, w: 1156, h: 3032 },
    screenshot: "hero-02-who-owes-balance.png",
  },
  _3: {
    shadow: "04__3_shadow.png",
    frame: "05__3_iPhone-17.png",
    changeThis: "06__3_Change-This.png",
    aperture: { x: 3602, y: 813, w: 1159, h: 3036 },
    screenshot: "hero-03-log-payment.png",
  },
  _2: {
    shadow: "07__2_shadow.png",
    frame: "08__2_iPhone-17.png",
    changeThis: "09__2_Change-This.png",
    aperture: { x: 2291, y: 781, w: 1417, h: 3088 },
    screenshot: "hero-01-dashboard-clean.png",
  },
};

// document/paint order: _1 (back-left), _3 (back-right), _2 (front-center, topmost)
const PAINT_ORDER = ["_1", "_3", "_2"];

// device-frame abs positions (from manifest.json)
const FRAME_ABS = {
  _1: { x: 1123, y: 773, w: 1307, h: 3116 },
  _3: { x: 3570, y: 772, w: 1310, h: 3120 },
  _2: { x: 2231, y: 730, w: 1538, h: 3191 },
};
const SHADOW_ABS = {
  _1: { x: 189, y: 3612, w: 2959, h: 387 },
  _3: { x: 2884, y: 3558, w: 2789, h: 519 },
  _2: { x: 1390, y: 3631, w: 3299, h: 315 },
};

// gy-lwb7t: groups _1 (back-left) and _3 (back-right) are photographed at a
// real 3D angle — their Change-This mask apertures are trapezoids, not
// rectangles, because the physical screen glass recedes in perspective. The
// old code pasted an axis-aligned rectangular screenshot into that trapezoid
// aperture (masked to the correct silhouette but with unwarped, flat
// content) — correct outline, wrong perspective on the content. Fixing that
// requires warping the screenshot's four corners onto the mask's actual
// screen quad before compositing. sharp/libvips has no perspective-distort
// primitive, so this step shells out to ImageMagick (approved for this
// script only, PM 2026-08-12) via `convert -distort Perspective`.
//
// Quad corners below were measured directly from each Change-This mask's
// alpha channel (alpha>128 region), not eyeballed: for each mask, the pixel
// with min(x+y) is the top-left corner, max(x+y) is bottom-right,
// max(x-y) is top-right, min(x-y) is bottom-left — the standard corner-
// extraction trick for a convex quad. Group _2 (front-center) measured as a
// near-perfect rectangle (top/bottom y within 2-3px across the width),
// confirming it is genuinely head-on and does not need a warp — left as-is.
const SCREEN_QUAD = {
  _1: { tl: [66, 55], tr: [1094, 94], br: [1096, 2947], bl: [53, 2965] },
  _3: { tl: [62, 93], tr: [1090, 54], br: [1092, 2981], bl: [60, 2951] },
};

function perspectiveWarp(inputPath, w, h, quad) {
  const outPath = path.join(os.tmpdir(), `gy-lwb7t-warp-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
  const cp = (pt) => pt.join(",");
  // src corners are the flat screenshot's own rect; dst corners are the
  // mask's measured screen quad, in the same aperture-local pixel space.
  const controlPoints = [
    `0,0 ${cp(quad.tl)}`,
    `${w},0 ${cp(quad.tr)}`,
    `${w},${h} ${cp(quad.br)}`,
    `0,${h} ${cp(quad.bl)}`,
  ].join("  ");
  execFileSync("convert", [
    inputPath,
    "-matte",
    "-virtual-pixel",
    "transparent",
    "-distort",
    "Perspective",
    controlPoints,
    "-crop",
    `${w}x${h}+0+0`,
    "+repage",
    outPath,
  ]);
  const buf = fs.readFileSync(outPath);
  fs.rmSync(outPath, { force: true });
  return buf;
}

async function maskedScreenshot(group) {
  const p = PHONES[group];
  const { w, h } = p.aperture;
  let shotBuf = await sharp(path.join(SCREENS, p.screenshot))
    .resize(w, h, { fit: "cover", position: "top" })
    .png()
    .toBuffer();

  const quad = SCREEN_QUAD[group];
  if (quad) {
    const tmpIn = path.join(os.tmpdir(), `gy-lwb7t-flat-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
    fs.writeFileSync(tmpIn, shotBuf);
    shotBuf = perspectiveWarp(tmpIn, w, h, quad);
    fs.rmSync(tmpIn, { force: true });
  }

  const mask = await sharp(path.join(EXTRACT, p.changeThis)).png().toBuffer();
  const masked = await sharp(shotBuf)
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
  return masked;
}

async function build() {
  const composites = [];
  for (const g of PAINT_ORDER) {
    const sh = SHADOW_ABS[g];
    composites.push({ input: path.join(EXTRACT, PHONES[g].shadow), left: sh.x, top: sh.y });
    const fr = FRAME_ABS[g];
    composites.push({ input: path.join(EXTRACT, PHONES[g].frame), left: fr.x, top: fr.y });
    const ap = PHONES[g].aperture;
    const masked = await maskedScreenshot(g);
    composites.push({ input: masked, left: ap.x, top: ap.y });
  }

  const base = sharp({
    create: { width: CANVAS_W, height: CANVAS_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite(composites);

  const fullBuf = await base.png().toBuffer();

  // sharp's trim() didn't detect the transparent margin reliably (mixed-alpha
  // edges from the soft shadow layers), so crop to the alpha-derived content
  // bbox instead — computed by scanning raw pixel alpha (see gy-7yhkh build notes).
  const CONTENT_BBOX = { left: 552, top: 732, width: 5304 - 552, height: 3920 - 732 };
  const PAD = 24;
  const crop = {
    left: Math.max(0, CONTENT_BBOX.left - PAD),
    top: Math.max(0, CONTENT_BBOX.top - PAD),
    width: Math.min(CANVAS_W, CONTENT_BBOX.width + PAD * 2),
    height: Math.min(CANVAS_H, CONTENT_BBOX.height + PAD * 2),
  };
  const trimmedBuf = await sharp(fullBuf).extract(crop).png().toBuffer();
  const meta = await sharp(trimmedBuf).metadata();
  console.log("cropped size:", meta.width, meta.height);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // full-res PNG (source of truth)
  await sharp(trimmedBuf).png({ compressionLevel: 9 }).toFile(path.join(OUT_DIR, "hero-three-panel.png"));

  // hero rendered width target: STAGE_U maxes at ~520px desktop, mobile ~320px.
  // Export at 1200w (2x for a ~600px max render width) as the primary asset, plus a 2400w @3x variant.
  for (const w of [800, 1200, 1800]) {
    await sharp(trimmedBuf).resize({ width: w }).png({ compressionLevel: 9 }).toFile(path.join(OUT_DIR, `hero-three-panel-${w}.png`));
    await sharp(trimmedBuf).resize({ width: w }).webp({ quality: 82 }).toFile(path.join(OUT_DIR, `hero-three-panel-${w}.webp`));
  }

  // Renders on light + dark ground for review
  for (const [name, bg] of [["light", "#FAFAF7"], ["dark", "#0A0A0A"]]) {
    await sharp(trimmedBuf)
      .resize({ width: 1200 })
      .flatten({ background: bg })
      .png()
      .toFile(path.join(OUT_DIR, `_review-on-${name}.png`));
  }

  for (const f of fs.readdirSync(OUT_DIR)) {
    const st = fs.statSync(path.join(OUT_DIR, f));
    console.log(f, st.size, "bytes");
  }
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});

// ── single-device frame for the "See Gymbo in action" gallery (item 2) ──
// Same MockupWorld asset, front/center phone only (largest, most iPhone-like
// aspect), with its Change-This aperture punched into a transparent hole so
// the gallery's many different screenshots can be layered under it at
// runtime via plain CSS (replaces react-device-mockup's IPhoneMockup).
async function buildSingleFrame() {
  const frame = sharp(path.join(EXTRACT, "08__2_iPhone-17.png"));
  const frameMeta = await frame.metadata();
  const { data: frameData } = await frame.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data: maskData, info: maskInfo } = await sharp(path.join(EXTRACT, "09__2_Change-This.png"))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const fw = frameMeta.width,
    fh = frameMeta.height;
  const offX = 60,
    offY = 51; // aperture's local offset within this frame image (2291-2231, 781-730)
  const out = Buffer.from(frameData);
  for (let y = 0; y < maskInfo.height; y++) {
    for (let x = 0; x < maskInfo.width; x++) {
      const maskAlpha = maskData[(y * maskInfo.width + x) * 4 + 3];
      if (maskAlpha > 20) {
        const fx = x + offX,
          fy = y + offY;
        if (fx >= 0 && fx < fw && fy >= 0 && fy < fh) out[(fy * fw + fx) * 4 + 3] = 0;
      }
    }
  }
  const holedBuf = await sharp(out, { raw: { width: fw, height: fh, channels: 4 } }).png().toBuffer();

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await sharp(holedBuf).png({ compressionLevel: 9 }).toFile(path.join(OUT_DIR, "iphone-frame-single.png"));
  for (const w of [520, 720, 1080]) {
    await sharp(holedBuf).resize({ width: w }).webp({ quality: 90 }).toFile(path.join(OUT_DIR, `iphone-frame-single-${w}.webp`));
  }
  console.log("single frame:", fw, fh, "aperture local", { x: offX, y: offY, w: maskInfo.width, h: maskInfo.height });
}

buildSingleFrame().catch((e) => {
  console.error(e);
  process.exit(1);
});
