import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

const approved = ["mockups/hero-three-panel-800.webp", "mockups/hero-three-panel-1200.webp", "mockups/hero-three-panel-1800.webp", "mockups/hero-three-panel-1200.png", "mockups/iphone-frame-single-520.webp", "mockups/iphone-frame-single-720.webp", "mockups/iphone-frame-single-1080.webp", "mockups/iphone-frame-single.png"];
const output = process.argv.includes("--dist");
const root = output ? "dist" : "public";
const source = output ? "dist" : "src";
async function walk(dir) { const entries = await readdir(dir, { withFileTypes: true }); return (await Promise.all(entries.map(async (entry) => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]))).flat(); }
const missing = []; for (const asset of approved) await access(path.join(root, asset)).catch(() => missing.push(asset));
const text = (await Promise.all((await walk(source)).filter((file) => /\.(?:[cm]?[jt]sx?|html)$/.test(file)).map((file) => readFile(file, "utf8").catch(() => "")))).join("\n");
const absent = ["hero-device-art", "gallery-device-art", "hero-three-panel", "iphone-frame-single"].filter((needle) => !text.includes(needle));
if (missing.length || absent.length) { console.error(`FAIL: photoreal-device gate (${root})`); if (missing.length) console.error(`Missing approved assets: ${missing.join(", ")}`); if (absent.length) console.error(`Missing rendered contract: ${absent.join(", ")}`); process.exit(1); }
console.log(`OK: photoreal-device gate checked ${approved.length} assets and rendered markers in ${root}.`);
