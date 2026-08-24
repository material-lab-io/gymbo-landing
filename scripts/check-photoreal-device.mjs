import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

const approved = [
  "mockups/hero-three-panel-800.webp",
  "mockups/hero-three-panel-1200.webp",
  "mockups/hero-three-panel-1800.webp",
  "mockups/hero-three-panel-1200.png",
  "mockups/iphone-frame-single-520.webp",
  "mockups/iphone-frame-single-720.webp",
  "mockups/iphone-frame-single-1080.webp",
  "mockups/iphone-frame-single.png",
];
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

const mockupDir = path.join(root, "mockups");
const approvedNames = new Set(approved.map((asset) => path.basename(asset)));
const servedDeviceFiles = await readdir(mockupDir).catch(() => []);
const unexpected = servedDeviceFiles
  .filter((name) => /^(?:hero-three-panel|iphone-frame-single)/.test(name))
  .filter((name) => !approvedNames.has(name));

const files = (await walk(source)).filter((file) => /\.(?:[cm]?[jt]sx?|html)$/.test(file));
const entries = await Promise.all(files.map(async (file) => [file, await readFile(file, "utf8")]));
const text = entries.map(([, contents]) => contents).join("\n");
const app = entries.find(([file]) => file.endsWith(path.join("src", "App.tsx")))?.[1] ?? "";
const frame = entries.find(([file]) => file.endsWith(path.join("src", "components", "PhoneMockup.tsx")))?.[1] ?? "";

const absent = [];
for (const needle of ["hero-device-art", "gallery-device-art", ...approvedNames]) {
  if (!text.includes(needle)) absent.push(needle);
}

if (!output) {
  const heroUsages = app.match(/<HeroDeviceArt\b/g)?.length ?? 0;
  if (!/function HeroDeviceArt\b/.test(app)) absent.push("HeroDeviceArt component");
  if (heroUsages < 2) absent.push("HeroDeviceArt desktop+mobile usage");
  if (!/<ScreenshotFrame\b/.test(app)) absent.push("ScreenshotFrame gallery usage");
  if (!/alt=""\s+aria-hidden="true"/.test(frame)) absent.push("decorative gallery overlay semantics");
  if (!/loading="lazy"/.test(frame) || !/decoding="async"/.test(frame)) absent.push("lazy async gallery media");
  if (!/pointerEvents:\s*"none"/.test(frame)) absent.push("non-interactive gallery overlay");
}

if (missing.length || unexpected.length || absent.length) {
  console.error(`FAIL: photoreal-device gate (${root})`);
  if (missing.length) console.error(`Missing approved assets: ${missing.join(", ")}`);
  if (unexpected.length) console.error(`Unexpected device assets: ${unexpected.join(", ")}`);
  if (absent.length) console.error(`Missing rendered contract: ${[...new Set(absent)].join(", ")}`);
  process.exit(1);
}

console.log(`OK: photoreal-device gate checked ${approved.length} exact assets and rendered contract in ${root}.`);
