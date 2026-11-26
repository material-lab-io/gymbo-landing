import { createHash } from "node:crypto";
import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

// gy-sk86p2.2/.3 (pm ruling 26 Nov 11:0xZ): the HERO contract is the approved GYMBO hero (photo phone + app loop in the screen),
// pinned by name AND bytes. The three-panel art it replaced must not come back (no file in public/mockups, no reference in src).
const heroHashes = new Map([
  ["hero/photo.webp", "e46be11ba867a3b6eff5a35253214eb2a87e84a43035f79b4f3f2cb31fd90aa9"],
  ["hero/phone.webp", "6ccca22659afcd79d5d87981974b903965274aba3ad5d8ed8c481e15f6dd63e1"],
  ["hero/screen-loop.webm", "4ff605dd74ff450bf782b2d44c5a7362a0bc32f8becbcb871e7b132e9eb1e203"],
  ["hero/screen-loop.mp4", "d9817f68a95914b4e9894f1ed677d1038f3ae24b49b077cbe2d27501c44afa8c"],
  ["hero/screen-poster.jpg", "0c1092a1fa353545e4a4bd4a3665f9ab3dd6d8ffa52538de84014d3bc983b24d"],
  ["hero/screen-mask.png", "5b3fa76db99c4901d17a54936609bc5a6338a00891a1f05e78e470f0112fe642"],
]);
const frames = [
  "mockups/iphone-frame-single-520.webp",
  "mockups/iphone-frame-single-720.webp",
  "mockups/iphone-frame-single-1080.webp",
  "mockups/iphone-frame-single.png",
];
const demoIds = ["log-payment", "schedule", "branded-statement", "build-workout"];
const demos = demoIds.flatMap((id) =>
  ["light", "dark"].flatMap((theme) => ["mp4", "png"].map((extension) => `demos/${id}-${theme}.${extension}`)),
);
const approved = [...heroHashes.keys(), ...frames, ...demos];
const output = process.argv.includes("--dist");
const root = output ? "dist" : "public";
const source = output ? "dist" : "src";

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => (
    entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]
  )))).flat();
}

const missing = [];
for (const asset of approved) {
  await access(path.join(root, asset)).catch(() => missing.push(asset));
}

const alteredHero = [];
for (const [asset, expected] of heroHashes) {
  try {
    const digest = createHash("sha256").update(await readFile(path.join(root, asset))).digest("hex");
    if (digest !== expected) alteredHero.push(`${asset} (${digest})`);
  } catch {
    // Missing assets are reported above.
  }
}

const mockupDir = path.join(root, "mockups");
const approvedMockupNames = new Set(frames.map((asset) => path.basename(asset)));
const unexpected = (await readdir(mockupDir).catch(() => []))
  .filter((name) => /^(?:hero-three-panel|iphone-frame-single)/.test(name))
  .filter((name) => !approvedMockupNames.has(name));

const files = (await walk(source)).filter((file) => /\.(?:[cm]?[jt]sx?|html)$/.test(file));
const entries = await Promise.all(files.map(async (file) => [file, await readFile(file, "utf8")]));
const text = entries.map(([, contents]) => contents).join("\n");
const app = entries.find(([file]) => file.endsWith(path.join("src", "App.tsx")))?.[1] ?? "";
// gy-sk86p2.3: the hero moved into its own slot file; its photoreal contract is read there.
const hero = entries.find(([file]) => file.endsWith(path.join("src", "components", "HomeHero.tsx")))?.[1] ?? app;
const frame = entries.find(([file]) => file.endsWith(path.join("src", "components", "PhoneMockup.tsx")))?.[1] ?? "";
const absent = [];

const markers = [
  "hero-section",
  "gallery-device-art",
  "pillar-demo",
  "/hero/photo.webp",
  "/hero/phone.webp",
  "/hero/screen-loop.webm",
  "/hero/screen-loop.mp4",
  "/hero/screen-poster.jpg",
  "iphone-frame-single-520.webp",
  "iphone-frame-single-720.webp",
  "iphone-frame-single-1080.webp",
  "iphone-frame-single.png",
  ...demoIds,
];
for (const marker of markers) {
  if (!text.includes(marker)) absent.push(marker);
}
if (text.includes("hero-three-panel")) absent.push("no three-panel hero art reference (hero-three-panel found)");

let checks = approved.length + heroHashes.size + markers.length + 1;
if (!output) {
  const wiredDemoIds = [...app.matchAll(/demoId:\s*"([^"]+)"/g)].map((match) => match[1]);
  // The hero clip: one <video> that is muted, loops, plays inline, carries the poster frame, and offers webm + mp4.
  const heroVideo = hero.match(/<video\b[^>]*>/)?.[0] ?? "";
  if (!heroVideo) absent.push("hero screen clip <video>");
  if (!/\bmuted\b/.test(heroVideo)) absent.push("hero clip muted");
  if (!/\bloop\b/.test(heroVideo)) absent.push("hero clip loop");
  if (!/\bplaysInline\b/.test(heroVideo)) absent.push("hero clip playsInline");
  if (!/poster="\/hero\/screen-poster\.jpg"/.test(heroVideo)) absent.push("hero clip poster (/hero/screen-poster.jpg)");
  if (!/<source src="\/hero\/screen-loop\.webm" type="video\/webm"/.test(hero) || !/<source src="\/hero\/screen-loop\.mp4" type="video\/mp4"/.test(hero)) absent.push("hero clip webm + mp4 sources");
  // Reduced motion serves the still: the clip never autoplays and is paused on its poster frame.
  if (!/autoPlay=\{!prefersReduced\}/.test(heroVideo) || !/if \(prefersReduced\) \{ v\.pause\(\); return; \}/.test(hero)) absent.push("hero reduced-motion still (no autoplay, paused on the poster)");
  if (!/<header\b[^>]*data-testid="hero-section"/.test(hero)) absent.push("hero-section header");
  if (/HeroDeviceArt|hero-three-panel/.test(hero)) absent.push("no three-panel hero art in HomeHero");
  if (!/<ScreenshotFrame\b/.test(app)) absent.push("ScreenshotFrame gallery usage");
  if (!/<DemoFrame\b/.test(app)) absent.push("DemoFrame pillar usage");
  if (wiredDemoIds.length !== 4 || demoIds.some((id) => !wiredDemoIds.includes(id))) {
    absent.push(`four wired demo IDs (${wiredDemoIds.join(", ") || "none"})`);
  }
  if (/<ScreenCard\b/.test(app)) absent.push("flat ScreenCard regression in App visual slots");

  const geometry = [
    /FRAME_W\s*=\s*1538/,
    /FRAME_H\s*=\s*3191/,
    /HOLE\s*=\s*\{\s*x:\s*60,\s*y:\s*51,\s*w:\s*1417,\s*h:\s*3088\s*\}/,
    /APERTURE_RADIUS_RATIO\s*=\s*0\.1656/,
    /APERTURE_RADIUS_CQW\s*=\s*\(HOLE_PCT\.width\s*\/\s*100\)\s*\*\s*APERTURE_RADIUS_RATIO\s*\*\s*100/,
    /containerType:\s*"inline-size"/,
    /borderRadius:\s*`\$\{APERTURE_RADIUS_CQW\}cqw`/,
    /overflow:\s*"hidden"/,
    /objectFit:\s*"cover"/,
    /filter:\s*SHADOW\.elevation4Filter/,
  ];
  geometry.forEach((pattern) => {
    if (!pattern.test(frame)) absent.push(`measured frame geometry ${pattern}`);
  });
  if (!/muted[\s\S]*loop[\s\S]*playsInline[\s\S]*autoPlay[\s\S]*preload="metadata"/.test(frame)) {
    absent.push("muted looping plays-inline lazy video contract");
  }
  if (!/prefers-reduced-motion:\s*reduce/.test(frame) || !/pillar-demo-poster/.test(frame)) {
    absent.push("reduced-motion poster fallback");
  }
  if (!/loading="lazy"/.test(frame) || !/decoding="async"/.test(frame)) absent.push("lazy async gallery media");
  if (!/pointerEvents:\s*"none"/.test(frame)) absent.push("non-interactive gallery overlay");

  const workflows = await walk(path.join(".github", "workflows")).catch(() => []);
  let runnerDeclarations = 0;
  for (const workflow of workflows.filter((file) => /\.ya?ml$/.test(file))) {
    const yaml = await readFile(workflow, "utf8");
    for (const line of yaml.split("\n").filter((candidate) => /^\s*runs-on\s*:/.test(candidate))) {
      runnerDeclarations += 1;
      if (!/self-hosted/.test(line) || !/\b(?:pool|prod-monitor)\b/.test(line) || /(?:ubuntu|macos|windows)-latest/.test(line)) {
        absent.push(`unapproved runner declaration in ${workflow}: ${line.trim()}`);
      }
    }
  }
  if (runnerDeclarations === 0) absent.push("nonzero workflow runner coverage");
  checks += geometry.length + runnerDeclarations + 17; // 8 frame/pillar rules + 9 hero rules
}

if (missing.length || alteredHero.length || unexpected.length || absent.length) {
  console.error(`FAIL: photoreal-device gate (${root})`);
  if (missing.length) console.error(`Missing approved assets: ${missing.join(", ")}`);
  if (alteredHero.length) console.error(`Altered approved hero assets: ${alteredHero.join(", ")}`);
  if (unexpected.length) console.error(`Unexpected device assets: ${unexpected.join(", ")}`);
  if (absent.length) console.error(`Missing rendered contract: ${[...new Set(absent)].join(", ")}`);
  process.exit(1);
}

console.log(`OK: photoreal-device gate completed ${checks} checks across ${approved.length} exact assets and the ${output ? "built" : "source"} visual contract.`);
