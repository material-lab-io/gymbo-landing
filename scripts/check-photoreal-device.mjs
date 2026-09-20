import { createHash } from "node:crypto";
import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

const heroHashes = new Map([
  ["mockups/hero-three-panel-800.webp", "8f85bed10239137286b9f2fd2b98fa81b29a1b0fa58c92b7de147191ed85b1d2"],
  ["mockups/hero-three-panel-1200.webp", "b4cf57aebc029835663518a6b814185f9d0b25485c22aaa21d6165d86fc90286"],
  ["mockups/hero-three-panel-1800.webp", "006706ef31dfb6fb9f3ba84336013189a595aa22d0f82d57784f3083fbdae3fe"],
  ["mockups/hero-three-panel-1200.png", "b79fb8e9b4c8be4f9cc1d7915ae01a26dd9f799035b55d82db3de99474adac82"],
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
const approvedMockupNames = new Set([...heroHashes.keys(), ...frames].map((asset) => path.basename(asset)));
const unexpected = (await readdir(mockupDir).catch(() => []))
  .filter((name) => /^(?:hero-three-panel|iphone-frame-single)/.test(name))
  .filter((name) => !approvedMockupNames.has(name));

const files = (await walk(source)).filter((file) => /\.(?:[cm]?[jt]sx?|html)$/.test(file));
const entries = await Promise.all(files.map(async (file) => [file, await readFile(file, "utf8")]));
const text = entries.map(([, contents]) => contents).join("\n");
const app = entries.find(([file]) => file.endsWith(path.join("src", "App.tsx")))?.[1] ?? "";
const frame = entries.find(([file]) => file.endsWith(path.join("src", "components", "PhoneMockup.tsx")))?.[1] ?? "";
const absent = [];

for (const marker of [
  "hero-device-art",
  "gallery-device-art",
  "pillar-demo",
  "hero-three-panel-800.webp",
  "hero-three-panel-1200.webp",
  "hero-three-panel-1800.webp",
  "hero-three-panel-1200.png",
  "iphone-frame-single-520.webp",
  "iphone-frame-single-720.webp",
  "iphone-frame-single-1080.webp",
  "iphone-frame-single.png",
  ...demoIds,
]) {
  if (!text.includes(marker)) absent.push(marker);
}

let checks = approved.length + heroHashes.size + 12 + demoIds.length;
if (!output) {
  const wiredDemoIds = [...app.matchAll(/demoId:\s*"([^"]+)"/g)].map((match) => match[1]);
  const heroUsages = app.match(/<HeroDeviceArt\b/g)?.length ?? 0;
  if (!/function HeroDeviceArt\b/.test(app)) absent.push("HeroDeviceArt component");
  if (heroUsages !== 2) absent.push(`HeroDeviceArt desktop+mobile usage (found ${heroUsages}, expected 2)`);
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
      if (!/self-hosted/.test(line) || !/gt2/.test(line) || /(?:ubuntu|macos|windows)-latest/.test(line)) {
        absent.push(`unapproved runner declaration in ${workflow}: ${line.trim()}`);
      }
    }
  }
  if (runnerDeclarations === 0) absent.push("nonzero workflow runner coverage");
  checks += geometry.length + runnerDeclarations + 10;
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
