import { appendFile, cp, mkdir, mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const sourceRoot = process.cwd();
const fixture = await mkdtemp(path.join(tmpdir(), "gymbo-photoreal-gate-"));
const gate = path.resolve("scripts/check-photoreal-device.mjs");
// gy-sk86p2.2/.3: the approved GYMBO hero (public/hero/), pinned by bytes in the gate.
const hero = ["photo.webp", "phone.webp", "screen-loop.webm", "screen-loop.mp4", "screen-poster.jpg", "screen-mask.png", "phone-frame.webp"];
const frames = [
  "iphone-frame-single-520.webp",
  "iphone-frame-single-720.webp",
  "iphone-frame-single-1080.webp",
  "iphone-frame-single.png",
];
const demoIds = ["log-payment", "schedule", "branded-statement", "build-workout"];
const demos = demoIds.flatMap((id) =>
  ["light", "dark"].flatMap((theme) => ["mp4", "png"].map((extension) => `${id}-${theme}.${extension}`)),
);

const appContract = `
  const PILLARS = [
    { demoId: "log-payment" },
    { demoId: "schedule" },
    { demoId: "branded-statement" },
    { demoId: "build-workout" },
  ];
  function App() { return <><HomeHero/><DemoFrame/><ScreenshotFrame/></>; }
`;
const heroContract = `
  export function HomeHero({ prefersReduced }) {
    useEffect(() => { const v = video.current; if (!v) return; if (prefersReduced) { v.pause(); return; } v.play(); }, [prefersReduced]);
    return (
      <header ref={root} data-testid="hero-section" className="gh">
        <img src="/hero/photo.webp" alt="" /><img src="/hero/phone.webp" alt="" /><img src="/hero/phone-frame.webp" alt="" />
        <video ref={video} className="gh-scr" muted loop playsInline autoPlay={!prefersReduced} preload="metadata" poster="/hero/screen-poster.jpg" width={296} height={786}>
          <source src="/hero/screen-loop.webm" type="video/webm" />
          <source src="/hero/screen-loop.mp4" type="video/mp4" />
        </video>
      </header>
    );
  }
`;
const frameContract = `
  const FRAME_W = 1538;
  const FRAME_H = 3191;
  const HOLE = { x: 60, y: 51, w: 1417, h: 3088 };
  const APERTURE_RADIUS_RATIO = 0.1656;
  const HOLE_PCT = { width: 92 };
  const APERTURE_RADIUS_CQW = (HOLE_PCT.width / 100) * APERTURE_RADIUS_RATIO * 100;
  export function ScreenshotFrame() { return <div data-testid="gallery-device-art" style={{ filter: SHADOW.elevation4Filter, containerType: "inline-size" }}><div style={{ overflow: "hidden", borderRadius: \`\${APERTURE_RADIUS_CQW}cqw\` }}><img loading="lazy" decoding="async" style={{ objectFit: "cover" }}/></div><img src="iphone-frame-single.png" aria-hidden="true" style={{ pointerEvents: "none" }}/>iphone-frame-single-520.webp iphone-frame-single-720.webp iphone-frame-single-1080.webp</div>; }
  export function DemoFrame() { const query = matchMedia("(prefers-reduced-motion: reduce)"); return <div data-testid="pillar-demo"><video muted loop playsInline autoPlay preload="metadata"/><img data-testid="pillar-demo-poster" loading="lazy" decoding="async"/></div>; }
`;
const distContract = `hero-section gallery-device-art pillar-demo ${hero.map((h) => `/hero/${h}`).join(" ")} ${frames.join(" ")} ${demoIds.join(" ")}`;

function runGate(args = []) {
  return spawnSync(process.execPath, ["scripts/check-photoreal-device.mjs", ...args], {
    cwd: fixture,
    encoding: "utf8",
  });
}

let positiveCases = 0;
let negativeCases = 0;
// A negative case may also name the rule it must fail on (a planted control is RED BY NAME, not just red).
function expectResult(name, result, shouldPass, mustName) {
  const passed = result.status === 0;
  if (!shouldPass && mustName && !`${result.stdout}${result.stderr}`.includes(mustName)) {
    console.error(`${name}: failed, but not on '${mustName}'`);
    console.error(result.stderr);
    process.exit(1);
  }
  if (passed !== shouldPass) {
    console.error(`${name}: expected ${shouldPass ? "PASS" : "FAIL"}, got exit ${result.status}`);
    console.error(result.stdout);
    console.error(result.stderr);
    process.exit(1);
  }
  if (shouldPass) positiveCases += 1;
  else negativeCases += 1;
  console.log(`OK: ${name} ${shouldPass ? "passed" : "failed as required"}`);
}

async function restoreSourceContracts() {
  await writeFile(path.join(fixture, "src", "App.tsx"), appContract);
  await writeFile(path.join(fixture, "src", "components", "PhoneMockup.tsx"), frameContract);
  await writeFile(path.join(fixture, "src", "components", "HomeHero.tsx"), heroContract);
  await writeFile(path.join(fixture, ".github", "workflows", "gate.yml"), "jobs:\n  gate:\n    runs-on: [self-hosted, pool]\n");
}

try {
  await mkdir(path.join(fixture, "scripts"), { recursive: true });
  await mkdir(path.join(fixture, "public", "mockups"), { recursive: true });
  await mkdir(path.join(fixture, "public", "demos"), { recursive: true });
  await mkdir(path.join(fixture, "src", "components"), { recursive: true });
  await mkdir(path.join(fixture, ".github", "workflows"), { recursive: true });
  await mkdir(path.join(fixture, "dist", "mockups"), { recursive: true });
  await mkdir(path.join(fixture, "public", "hero"), { recursive: true });
  await mkdir(path.join(fixture, "dist", "hero"), { recursive: true });
  await mkdir(path.join(fixture, "dist", "demos"), { recursive: true });
  await mkdir(path.join(fixture, "dist", "assets"), { recursive: true });
  await cp(gate, path.join(fixture, "scripts", "check-photoreal-device.mjs"));

  for (const name of frames) {
    await cp(path.join(sourceRoot, "public", "mockups", name), path.join(fixture, "public", "mockups", name));
    await cp(path.join(sourceRoot, "public", "mockups", name), path.join(fixture, "dist", "mockups", name));
  }
  for (const name of hero) {
    await cp(path.join(sourceRoot, "public", "hero", name), path.join(fixture, "public", "hero", name));
    await cp(path.join(sourceRoot, "public", "hero", name), path.join(fixture, "dist", "hero", name));
  }
  for (const name of demos) {
    await cp(path.join(sourceRoot, "public", "demos", name), path.join(fixture, "public", "demos", name));
    await cp(path.join(sourceRoot, "public", "demos", name), path.join(fixture, "dist", "demos", name));
  }
  await restoreSourceContracts();
  await writeFile(path.join(fixture, "dist", "assets", "main.js"), distContract);

  expectResult("positive source fixture", runGate(), true);
  expectResult("positive dist fixture", runGate(["--dist"]), true);

  await unlink(path.join(fixture, "public", "hero", hero[0]));
  expectResult("missing hero asset", runGate(), false, "hero/photo.webp");
  await cp(path.join(sourceRoot, "public", "hero", hero[0]), path.join(fixture, "public", "hero", hero[0]));

  await appendFile(path.join(fixture, "public", "hero", hero[1]), "altered");
  expectResult("altered hero identity", runGate(), false, "Altered approved hero assets: hero/phone.webp");
  await cp(path.join(sourceRoot, "public", "hero", hero[1]), path.join(fixture, "public", "hero", hero[1]));

  // PLANTED CONTROL (pm 11:0xZ): the clip loses its poster frame -> RED by name.
  await writeFile(path.join(fixture, "src", "components", "HomeHero.tsx"), heroContract.replace(' poster="/hero/screen-poster.jpg"', ""));
  expectResult("hero clip poster removed", runGate(), false, "hero clip poster (/hero/screen-poster.jpg)");
  await restoreSourceContracts();

  await writeFile(path.join(fixture, "src", "components", "HomeHero.tsx"), heroContract.replace("autoPlay={!prefersReduced}", "autoPlay"));
  expectResult("hero clip autoplays under reduced motion", runGate(), false, "hero reduced-motion still");
  await restoreSourceContracts();

  await writeFile(path.join(fixture, "src", "components", "HomeHero.tsx"), `${heroContract}\nconst old = "/mockups/hero-three-panel-1200.png";`);
  expectResult("three-panel hero art referenced again", runGate(), false, "no three-panel hero art");
  await restoreSourceContracts();

  await unlink(path.join(fixture, "public", "demos", "log-payment-light.mp4"));
  expectResult("missing demo clip", runGate(), false);
  await cp(path.join(sourceRoot, "public", "demos", "log-payment-light.mp4"), path.join(fixture, "public", "demos", "log-payment-light.mp4"));

  await unlink(path.join(fixture, "public", "demos", "schedule-dark.png"));
  expectResult("missing demo poster", runGate(), false);
  await cp(path.join(sourceRoot, "public", "demos", "schedule-dark.png"), path.join(fixture, "public", "demos", "schedule-dark.png"));

  await writeFile(path.join(fixture, "src", "App.tsx"), appContract.replace('    { demoId: "build-workout" },\n', ""));
  expectResult("fewer than four wired demos", runGate(), false);
  await restoreSourceContracts();

  await writeFile(path.join(fixture, "src", "components", "PhoneMockup.tsx"), frameContract.replace("0.1656", "0.16"));
  expectResult("missing measured frame geometry", runGate(), false);
  await restoreSourceContracts();

  await writeFile(path.join(fixture, "src", "App.tsx"), `${appContract}\nconst regression = <ScreenCard/>;`);
  expectResult("flat ScreenCard visual regression", runGate(), false);
  await restoreSourceContracts();

  await writeFile(path.join(fixture, ".github", "workflows", "gate.yml"), "jobs:\n  gate:\n    runs-on: ubuntu-latest\n");
  expectResult("hosted runner regression", runGate(), false);
  await restoreSourceContracts();

  // gy-3cerrq: the pool is the only approved self-hosted lane; GT3 is cancelled (a job pinned to it never starts) and GT2 is no CI host (gy-s8rfcl).
  await writeFile(path.join(fixture, ".github", "workflows", "gate.yml"), "jobs:\n  gate:\n    runs-on: [self-hosted, pool]\n");
  expectResult("pool runner accepted", runGate(), true);
  await writeFile(path.join(fixture, ".github", "workflows", "gate.yml"), "jobs:\n  gate:\n    runs-on: [self-hosted, gt3]\n");
  expectResult("cancelled gt3 lane rejected", runGate(), false);
  await writeFile(path.join(fixture, ".github", "workflows", "gate.yml"), "jobs:\n  gate:\n    runs-on: [self-hosted, gt9]\n");
  expectResult("unknown self-hosted label set", runGate(), false);
  await restoreSourceContracts();

  await writeFile(path.join(fixture, "public", "mockups", "hero-three-panel-unapproved.png"), "fixture");
  expectResult("unexpected device art", runGate(), false);

  if (positiveCases !== 3 || negativeCases !== 14) {
    throw new Error(`nonzero coverage assertion failed: ${positiveCases} positive, ${negativeCases} negative`);
  }
  console.log(`Photoreal-device gate self-test: ${positiveCases} positive and ${negativeCases} negative cases passed.`);
} finally {
  await rm(fixture, { recursive: true, force: true });
}
