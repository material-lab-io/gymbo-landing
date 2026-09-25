// gy-jbax2 AC1: the standing shifted-clock control must be able to go RED, and must say when its
// own instrument did not run. The full build-based run is the workflow's job; these cover the logic.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compareBuilds, instrumentRan, selfTest, SHIM, VOLATILE_ALLOWED, GATES } from "../scripts/shifted-clock-control.mjs";

const scratch = mkdtempSync(join(tmpdir(), "gymbo-time-fuse-test-"));
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));
let n = 0;
const SITEMAP = (d) => `<urlset>\n  <url>\n    <loc>https://getgymbo.com/</loc>\n    <lastmod>${d}</lastmod>\n  </url>\n</urlset>\n`;
function build(date, over = {}) {
  const dir = join(scratch, `b${++n}`);
  mkdirSync(join(dir, "assets"), { recursive: true });
  const files = { "index.html": "<p>Punch a class.</p>", "llms.txt": "# Gymbo\n", "sitemap.xml": SITEMAP(date), "assets/app.js": "console.log(1)", "assets/app.css": "a{}", ...over };
  for (const [f, body] of Object.entries(files)) if (body !== null) writeFileSync(join(dir, f), body);
  return dir;
}

test("IDENTICAL builds: no findings, and the instrument is reported as NOT having run", () => {
  const r = compareBuilds(build("2026-09-25"), build("2026-09-25"));
  assert.deepEqual(r.findings, []);
  assert.deepEqual(r.volatile, []);
  assert.equal(instrumentRan(r.volatile, r.findings), false, "no difference at all means the shim did not reach the build");
});

test("THE ALLOWED CASE: only sitemap lastmod differs -> no findings, volatile = [sitemap.xml], instrument ran", () => {
  const r = compareBuilds(build("2026-09-25"), build("2027-10-30"));
  assert.deepEqual(r.findings, []);
  assert.deepEqual(r.volatile, ["sitemap.xml"]);
  assert.equal(instrumentRan(r.volatile, r.findings), true);
  assert.deepEqual(VOLATILE_ALLOWED, ["sitemap.xml"]);
});

test("SEEDED: a date in a served text file, an html page, a bundle, a stylesheet and a binary each go RED as a time fuse", () => {
  const real = build("2026-09-25");
  for (const [file, body] of [["llms.txt", "# Gymbo\nUpdated 2027-10-30\n"], ["index.html", "<p>Punch a class 2027.</p>"], ["assets/app.js", "console.log(2027)"], ["assets/app.css", "a{content:'2027'}"]]) {
    const r = compareBuilds(real, build("2026-09-25", { [file]: body }));
    assert.ok(r.findings.some((f) => f.kind === "time-fuse" && f.file === file), file);
  }
  const bin1 = build("2026-09-25", { "logo.png": Buffer.from([1, 2, 3]) }), bin2 = build("2026-09-25", { "logo.png": Buffer.from([1, 2, 4]) });
  assert.ok(compareBuilds(bin1, bin2).findings.some((f) => f.kind === "time-fuse" && f.file === "logo.png"));
});

test("SEEDED: a SECOND file that differs only by a <lastmod> date is NOT silently allowed (the allow-list is one file)", () => {
  const r = compareBuilds(build("2026-09-25", { "other.xml": SITEMAP("2026-09-25") }), build("2027-10-30", { "other.xml": SITEMAP("2027-10-30") }));
  assert.ok(r.findings.some((f) => f.kind === "unexpected-volatile-file" && f.file === "other.xml"));
});

test("SEEDED: a file present in only one build is a finding", () => {
  const r = compareBuilds(build("2026-09-25"), build("2026-09-25", { "extra.txt": "x" }));
  assert.ok(r.findings.some((f) => f.kind === "only-in-shifted-build" && f.file === "extra.txt"));
  assert.ok(compareBuilds(build("2026-09-25", { "extra.txt": "x" }), build("2026-09-25")).findings.some((f) => f.kind === "only-in-real-build"));
});

test("REGRESSION OF PR 224: with the mask OFF the sitemap is a time fuse, AND the instrument is still reported as having run", () => {
  const r = compareBuilds(build("2026-09-25"), build("2027-10-30"), { mask: (s) => s });
  assert.ok(r.findings.some((f) => f.kind === "time-fuse" && f.file === "sitemap.xml"));
  assert.equal(instrumentRan(r.volatile, r.findings), true, "the first version reported 'instrument did not run' here, which was wrong and hid the real finding");
});

test("SELF-TEST: every planted fuse turns the control RED when the detector behaves", () => {
  const real = build("2026-09-25"), shifted = build("2027-10-30");
  const res = selfTest({ realDir: real, shiftedDir: shifted, detect: (d) => (readFileText(d) ? 1 : 0), scratch: join(scratch, `st${++n}`) });
  for (const r of res) assert.ok(r.ok, r.name);
  assert.ok(res.length >= 5);
});
import { readFileSync } from "node:fs";
const readFileText = (d) => /Updated 20/.test(readFileSync(join(d, "llms.txt"), "utf8"));

test("THE CONTROL CAN GO RED ON ITSELF: a detector that never fails makes the planted-fuse control FAIL, so a blind detector cannot pass unnoticed", () => {
  const res = selfTest({ realDir: build("2026-09-25"), shiftedDir: build("2027-10-30"), detect: () => 0, scratch: join(scratch, `st${++n}`) });
  const detectorResult = res.find((r) => /copy detector goes RED/.test(r.name));
  assert.equal(detectorResult.ok, false);
});

test("SELF-TEST fails loudly if there is no bundle to plant a fuse in (it must not pass by skipping)", () => {
  const real = build("2026-09-25", { "assets/app.js": null }), shifted = build("2027-10-30", { "assets/app.js": null });
  assert.throws(() => selfTest({ realDir: real, shiftedDir: shifted, detect: () => 1, scratch: join(scratch, `st${++n}`) }), /no \.js file/);
});

test("THE SHIM: shifts new Date() and Date.now() by GYMBO_SHIFT_DAYS, defaults to more than a year, refuses a non-number", () => {
  const probe = (days) => spawnSync(process.execPath, ["--require", SHIM, "-e", "console.log(new Date().getUTCFullYear() - new Date(Date.now()).getUTCFullYear(), (Date.now() - Date.UTC(2000,0,1)) > 0, new Date(2020, 1, 1).getFullYear())"], { encoding: "utf8", env: { ...process.env, ...(days === undefined ? {} : { GYMBO_SHIFT_DAYS: days }) } });
  const year = (days) => Number(spawnSync(process.execPath, ["--require", SHIM, "-p", "new Date().getUTCFullYear()"], { encoding: "utf8", env: { ...process.env, GYMBO_SHIFT_DAYS: days } }).stdout);
  const real = new Date().getUTCFullYear();
  assert.ok(year("400") >= real + 1, "+400 days crosses a year boundary");
  assert.equal(year("0"), real);
  const dflt = Number(spawnSync(process.execPath, ["--require", SHIM, "-p", "new Date().getUTCFullYear()"], { encoding: "utf8", env: { ...process.env, GYMBO_SHIFT_DAYS: "" } }).stdout);
  assert.ok(dflt >= real + 1, "the default shift is over a year");
  assert.notEqual(probe("abc").status, 0, "a non-number must not silently mean no shift");
  assert.equal(probe("1").stdout.trim().split(" ")[2], "2020", "an explicit date is not shifted");
});

test("THE GATES it runs: the copy detector and the terms/trial gates are all listed, and canonical-strings is the ONE run on the real clock, with the reason stated", () => {
  const byScript = Object.fromEntries(GATES.map(([label, script, shim]) => [script, { label, shim }]));
  for (const s of ["scripts/copy-change-detector.mjs", "scripts/check-canonical-terms.mjs", "scripts/check-trial-eligibility.mjs"]) assert.equal(byScript[s].shim, true, s);
  assert.equal(byScript["scripts/check-canonical-strings.mjs"].shim, false);
  assert.match(byScript["scripts/check-canonical-strings.mjs"].label, /waiver-expiry/);
});

test("EACH PLANTED FUSE CAN FAIL: a BLIND comparator makes every comparator-based positive control report FAIL (none is hard-wired to pass)", () => {
  const blind = () => ({ findings: [], volatile: [], bundles: [] });
  const res = selfTest({ realDir: build("2026-09-25"), shiftedDir: build("2027-10-30"), detect: () => 1, scratch: join(scratch, `st${++n}`), compare: blind });
  const failed = res.filter((r) => !r.ok).map((r) => r.name);
  assert.equal(failed.length, 3, failed.join(" | "));
  assert.ok(failed.some((f) => /served text file: the two-build diff/.test(f)));
  assert.ok(failed.some((f) => /JS bundle/.test(f)));
  assert.ok(failed.some((f) => /mask is OFF/.test(f)));
});

test("A LEFTOVER planted copy cannot hide a missing bundle: the same scratch reused with a bundle-less build still throws", () => {
  const sc = join(scratch, `st${++n}`);
  selfTest({ realDir: build("2026-09-25"), shiftedDir: build("2027-10-30"), detect: () => 1, scratch: sc });
  assert.throws(() => selfTest({ realDir: build("2026-09-25", { "assets/app.js": null }), shiftedDir: build("2027-10-30", { "assets/app.js": null }), detect: () => 1, scratch: sc }), /no \.js file/);
});
