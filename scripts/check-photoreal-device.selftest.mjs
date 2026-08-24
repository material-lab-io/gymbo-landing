import { cp, mkdir, mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const fixture = await mkdtemp(path.join(tmpdir(), "gymbo-photoreal-gate-"));
const gate = path.resolve("scripts/check-photoreal-device.mjs");
const approved = [
  "hero-three-panel-800.webp",
  "hero-three-panel-1200.webp",
  "hero-three-panel-1800.webp",
  "hero-three-panel-1200.png",
  "iphone-frame-single-520.webp",
  "iphone-frame-single-720.webp",
  "iphone-frame-single-1080.webp",
  "iphone-frame-single.png",
];

const heroContract = `
  function HeroDeviceArt() { return <div data-testid="hero-device-art">${approved.filter((name) => name.startsWith("hero-")).join(" ")}</div>; }
  function App() { return <><HeroDeviceArt/><HeroDeviceArt/><ScreenshotFrame/></>; }
`;
const galleryContract = `
  export function ScreenshotFrame() { return <div data-testid="gallery-device-art">${approved.filter((name) => name.startsWith("iphone-")).join(" ")}<img alt="" aria-hidden="true" loading="lazy" decoding="async" style={{ pointerEvents: "none" }}/></div>; }
`;

function runGate(args = []) {
  return spawnSync(process.execPath, ["scripts/check-photoreal-device.mjs", ...args], {
    cwd: fixture,
    encoding: "utf8",
  });
}

function expectResult(name, result, shouldPass) {
  const passed = result.status === 0;
  if (passed !== shouldPass) {
    console.error(`${name}: expected ${shouldPass ? "PASS" : "FAIL"}, got exit ${result.status}`);
    console.error(result.stdout);
    console.error(result.stderr);
    process.exit(1);
  }
  console.log(`OK: ${name} ${shouldPass ? "passed" : "failed as required"}`);
}

try {
  await mkdir(path.join(fixture, "scripts"), { recursive: true });
  await mkdir(path.join(fixture, "public", "mockups"), { recursive: true });
  await mkdir(path.join(fixture, "src", "components"), { recursive: true });
  await mkdir(path.join(fixture, "dist", "mockups"), { recursive: true });
  await mkdir(path.join(fixture, "dist", "assets"), { recursive: true });
  await cp(gate, path.join(fixture, "scripts", "check-photoreal-device.mjs"));

  for (const name of approved) {
    await writeFile(path.join(fixture, "public", "mockups", name), "fixture");
    await writeFile(path.join(fixture, "dist", "mockups", name), "fixture");
  }
  await writeFile(path.join(fixture, "src", "App.tsx"), heroContract);
  await writeFile(path.join(fixture, "src", "components", "PhoneMockup.tsx"), galleryContract);
  await writeFile(path.join(fixture, "dist", "assets", "main.js"), `hero-device-art gallery-device-art ${approved.join(" ")}`);

  expectResult("positive source fixture", runGate(), true);
  expectResult("positive dist fixture", runGate(["--dist"]), true);

  await unlink(path.join(fixture, "public", "mockups", "hero-three-panel-800.webp"));
  expectResult("missing hero asset", runGate(), false);
  await writeFile(path.join(fixture, "public", "mockups", "hero-three-panel-800.webp"), "fixture");

  await unlink(path.join(fixture, "public", "mockups", "iphone-frame-single.png"));
  expectResult("missing gallery asset", runGate(), false);
  await writeFile(path.join(fixture, "public", "mockups", "iphone-frame-single.png"), "fixture");

  await writeFile(path.join(fixture, "src", "App.tsx"), `const raw = <ScreenCard data-testid="hero-device-art"/>; const gallery = <ScreenCard data-testid="gallery-device-art"/>; ${approved.join(" ")}`);
  expectResult("raw ScreenCard in required slots", runGate(), false);
  await writeFile(path.join(fixture, "src", "App.tsx"), heroContract);

  await writeFile(path.join(fixture, "dist", "assets", "main.js"), "screen-card screens/gallery/dashboard.png");
  expectResult("dist with raw screenshot but no device art", runGate(["--dist"]), false);
  await writeFile(path.join(fixture, "dist", "assets", "main.js"), `hero-device-art gallery-device-art ${approved.join(" ")}`);

  await writeFile(path.join(fixture, "public", "mockups", "hero-three-panel-unapproved.png"), "fixture");
  expectResult("unexpected device asset", runGate(), false);

  console.log("Photoreal-device gate self-test: 2 positive and 5 negative cases passed.");
} finally {
  await rm(fixture, { recursive: true, force: true });
}
