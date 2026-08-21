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
// Group _2 (front-center) measures as a near-perfect rectangle (top/bottom y
// within 2-3px across the width), confirming it is genuinely head-on and does
// not need a warp — left as-is. _1 and _3 each slant ~46px across the width.
//
// gy-syg40: the quad corners used to be hardcoded, extracted by the "extremal
// point" trick — min(x+y) is top-left, max(x+y) bottom-right, max(x-y)
// top-right, min(x-y) bottom-left. That trick is only valid for a quad with
// SHARP corners. These apertures are rounded rectangles, so every extremal
// point lands somewhere on a corner ARC rather than on the corner itself, and
// each one is pulled inward by roughly the corner radius. The resulting quad
// spanned x 60..1092 inside a screen that actually spans 0..1156 — so the warp
// shrank the screenshot ~60px away from every screen edge, under-filling the
// glass and leaving the near-vertical hard edge the founder reported.
//
// Corners are now derived from the mask at build time instead: fit a least-
// squares line to each of the four STRAIGHT edge runs (sampled from the middle
// of each side, well clear of the corner arcs) and intersect adjacent lines to
// recover the true corner. This is robust to corner radius by construction and
// re-derives itself if the mask art is ever replaced.
const SLANTED_GROUPS = new Set(["_1", "_3"]);
const quadCache = new Map();

async function screenQuadFromMask(maskPath) {
  const { data, info } = await sharp(maskPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const alphaAt = (x, y) => data[(y * W + x) * 4 + 3];

  // y = m*x + c for the horizontal edges; x = m*y + c for the vertical ones.
  const fitLine = (pts) => {
    const n = pts.length;
    let sa = 0, sb = 0, saa = 0, sab = 0;
    for (const [a, b] of pts) { sa += a; sb += b; saa += a * a; sab += a * b; }
    const m = (n * sab - sa * sb) / (n * saa - sa * sa);
    return [m, (sb - m * sa) / n];
  };
  // intersect horizontal line (y = m1*x + c1) with vertical line (x = m2*y + c2)
  const intersect = ([m1, c1], [m2, c2]) => {
    const x = (m2 * c1 + c2) / (1 - m1 * m2);
    return [Math.round(x), Math.round(m1 * x + c1)];
  };

  const yInset = Math.round(H * 0.12), xInset = Math.round(W * 0.15);
  const left = [], right = [], top = [], bottom = [];
  for (let y = yInset; y < H - yInset; y += 7) {
    let lo = -1, hi = -1;
    for (let x = 0; x < W; x++) if (alphaAt(x, y) > 128) { lo = x; break; }
    for (let x = W - 1; x >= 0; x--) if (alphaAt(x, y) > 128) { hi = x; break; }
    if (lo >= 0) { left.push([y, lo]); right.push([y, hi]); }
  }
  for (let x = xInset; x < W - xInset; x += 7) {
    let t = -1, b = -1;
    for (let y = 0; y < H; y++) if (alphaAt(x, y) > 128) { t = y; break; }
    for (let y = H - 1; y >= 0; y--) if (alphaAt(x, y) > 128) { b = y; break; }
    if (t >= 0) { top.push([x, t]); bottom.push([x, b]); }
  }
  const lT = fitLine(top), lB = fitLine(bottom), lL = fitLine(left), lR = fitLine(right);
  return {
    tl: intersect(lT, lL), tr: intersect(lT, lR),
    br: intersect(lB, lR), bl: intersect(lB, lL),
  };
}

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

// gy-syg40: the side apertures are far narrower than the source screenshot's
// aspect — _1 is 1156x3032 (0.3814) and _3 is 1159x3036 (0.3818) against a
// 1206x2622 (0.4600) screenshot, a ~17% aspect mismatch. fit:"cover" resolves
// that by upscaling 1.156x and centre-cropping ~103px off BOTH horizontal
// edges (position:"top" only pins the vertical axis), which is what ate the
// leading characters — "Classes left: 7" rendered as "s left: 7". Those two
// panels are art-directed as foreshortened phones, and a real angled view
// compresses screen width uniformly rather than slicing its edges off, so
// fit:"fill" (non-uniform stretch into the exact box, nothing cropped) is the
// physically-correct treatment, not merely the least-bad one.
// _2 (front-centre) keeps "cover": its aperture aspect is 0.4589 vs the
// source's 0.4600, so cover crops ~1px there and the panel is already correct.
const SCREENSHOT_FIT = { _1: "fill", _3: "fill", _2: "cover" };

// gy-syg40: the front-centre phone is painted last and physically covers a
// band of each side phone's screen — measured from the _2 frame's opaque
// extent (abs x 2231..3768) against each side aperture: 168px off _1's RIGHT
// edge and 166px off _3's LEFT edge, ~14% of the screen each. Fitting a
// screenshot to the FULL aperture therefore drops that much of the app UI
// behind the centre phone, which is what cut the leading characters off
// "Classes left: 7" and "Per class:". The resize below targets only the
// VISIBLE part of the aperture and then extends the covered band with the
// screenshot's own background colour, so the whole app UI lands where the
// visitor can actually read it and the band under the centre phone still has
// opaque pixels (the frame's rounded corners don't cover it perfectly).
const OCCLUDED_BY_FRONT = {
  _1: { side: "right", px: 168 },
  _3: { side: "left", px: 166 },
};

async function maskedScreenshot(group) {
  const p = PHONES[group];
  const { w, h } = p.aperture;
  const src = sharp(path.join(SCREENS, p.screenshot));
  const occ = OCCLUDED_BY_FRONT[group];

  let shotBuf;
  if (occ) {
    // background colour to pad the covered band with — sampled from the
    // screenshot's own top-left corner, which is always chrome/background.
    const { data: px } = await src.clone().extract({ left: 4, top: 4, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
    const bg = { r: px[0], g: px[1], b: px[2], alpha: 1 };
    shotBuf = await src
      .clone()
      .resize(w - occ.px, h, { fit: "fill" })
      .extend({ [occ.side]: occ.px, background: bg })
      .png()
      .toBuffer();
  } else {
    shotBuf = await src.resize(w, h, { fit: SCREENSHOT_FIT[group], position: "top" }).png().toBuffer();
  }

  let quad = null;
  if (SLANTED_GROUPS.has(group)) {
    const maskPath = path.join(EXTRACT, p.changeThis);
    if (!quadCache.has(maskPath)) quadCache.set(maskPath, await screenQuadFromMask(maskPath));
    quad = quadCache.get(maskPath);
    console.log(`quad ${group}:`, JSON.stringify(quad));
  }
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
