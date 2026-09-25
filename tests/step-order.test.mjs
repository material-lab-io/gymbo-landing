// gy-jbax2 AC2: the copy gates must run BEFORE anything stamps a per-commit value into dist/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkStepOrder, checkScriptsDoNotStamp, parseJobs } from "../scripts/check-step-order.mjs";

const SCRIPT = new URL("../scripts/check-step-order.mjs", import.meta.url).pathname;
const ROOT = new URL("..", import.meta.url).pathname;
const scratch = mkdtempSync(join(tmpdir(), "gymbo-step-order-"));
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));

const wf = (steps, jobs = "deploy") => `name: t\non: push\njobs:\n  ${jobs}:\n    runs-on: [self-hosted, gt2]\n    steps:\n${steps}`;
const GATE = `      - name: copy gates\n        run: npm run check:copy-output\n`;
const STAMP = `      - name: Stamp build SHA\n        run: echo "\${{ github.sha }}" > dist/build-sha.txt\n`;
const check = (yaml) => checkStepOrder([["t.yml", yaml]]);

test("CONTROL: gate BEFORE the stamp (the real deploy.yml shape) is accepted", () => {
  const r = check(wf(GATE + STAMP));
  assert.deepEqual(r.findings, []);
  assert.equal(r.gates, 1);
  assert.equal(r.stamps, 1);
});

test("SEEDED: the stamp step BEFORE the gate is refused, naming the workflow, job and both lines", () => {
  const r = check(wf(STAMP + GATE));
  assert.equal(r.findings.length, 1);
  assert.match(r.findings[0].detail, /t\.yml job 'deploy'/);
  assert.match(r.findings[0].detail, /BEFORE the copy gate/);
});

test("SEEDED: inside ONE step, a stamp line above the gate line is refused; gate above stamp is accepted", () => {
  const stampFirst = wf(`      - name: both\n        run: |\n          echo "\${{ github.sha }}" > dist/build-sha.txt\n          npm run check:copy-output\n`);
  assert.equal(check(stampFirst).findings.length, 1);
  const gateFirst = wf(`      - name: both\n        run: |\n          npm run check:copy-output\n          echo "\${{ github.sha }}" > dist/build-sha.txt\n`);
  assert.deepEqual(check(gateFirst).findings, []);
});

test("SEEDED: ANY per-run stamp counts, not only the file called build-sha.txt (run_id, run_number, date)", () => {
  for (const stamp of [`echo "\${{ github.run_id }}" > dist/run.txt`, `echo "\${{ github.run_number }}" > dist/n.txt`, `echo "$GITHUB_SHA" > dist/x.txt`, `echo "$GITHUB_RUN_ID" > dist/r.txt`, `date > dist/built.txt`, `date -u +%s > ./dist/t.txt`]) {
    const y = wf(`      - name: stamp\n        run: ${stamp}\n` + GATE);
    const r = check(y);
    assert.equal(r.findings.length, 1, stamp);
  }
});

test("SEEDED: fetching a built dist from another job BEFORE the gate is refused", () => {
  const r = check(wf(`      - uses: actions/download-artifact@v4\n        with:\n          name: dist\n` + GATE));
  assert.equal(r.findings.length, 1);
  assert.match(r.findings[0].detail, /fetches a built dist/);
});

test("Jobs are independent: a stamp in a DIFFERENT job than the gate is not a finding; a job with no gate is fine", () => {
  const two = `name: t\non: push\njobs:\n  a:\n    runs-on: [self-hosted, gt2]\n    steps:\n${STAMP}  b:\n    runs-on: [self-hosted, gt2]\n    steps:\n${GATE}`;
  assert.deepEqual(check(two).findings, []);
  assert.deepEqual(check(wf(STAMP)).findings, []);
});

test("parseJobs reads jobs and steps; a workflow with no jobs yields nothing (and the CLI refuses an empty directory)", () => {
  assert.equal(parseJobs(wf(GATE + STAMP))[0].steps.length, 2);
  assert.deepEqual(parseJobs("name: x\non: push\n"), []);
  const empty = join(scratch, "empty"); mkdirSync(empty);
  assert.equal(spawnSync(process.execPath, [SCRIPT, empty], { encoding: "utf8" }).status, 2);
  assert.equal(spawnSync(process.execPath, [SCRIPT, join(scratch, "nope")], { encoding: "utf8" }).status, 2);
});

test("RULE 2: a build script or config that mentions build-sha is refused", () => {
  assert.equal(checkScriptsDoNotStamp([["scripts/prerender.mjs", "writeFileSync('dist/build-sha.txt', sha)"]]).length, 1);
  assert.deepEqual(checkScriptsDoNotStamp([["scripts/prerender.mjs", "writeFileSync('dist/index.html', html)"]]), []);
});

test("THE REAL REPO: every workflow passes, the deploy gate really is seen, and the CLI exits 0 with its count", () => {
  const dir = join(ROOT, ".github/workflows");
  const files = ["deploy.yml"].map((n) => [n, readFileSync(join(dir, n), "utf8")]);
  const r = checkStepOrder(files);
  assert.deepEqual(r.findings, []);
  assert.ok(r.gates >= 1, "deploy.yml's copy gate must be recognised, or this check is vacuous");
  assert.ok(r.stamps >= 1, "deploy.yml's Stamp build SHA step must be recognised, or this check is vacuous");
  const cli = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8", cwd: ROOT });
  assert.equal(cli.status, 0, cli.stderr);
  assert.match(cli.stdout, /^OK: in \d+ workflow file\(s\)/);
});

test("THE REAL deploy.yml, REORDERED: moving 'Stamp build SHA' above the copy gate turns the check RED", () => {
  const src = readFileSync(join(ROOT, ".github/workflows/deploy.yml"), "utf8");
  const stampBlock = /      - name: Stamp build SHA\n        run: [^\n]*\n/.exec(src)[0];
  const gateStep = /      - name: "gy-322bc\.1: no user-facing em dashes in built output"/.exec(src);
  assert.ok(gateStep, "expected the em-dash/copy gate step in deploy.yml");
  const moved = src.replace(stampBlock, "").replace(gateStep[0], stampBlock + "\n" + gateStep[0]);
  const r = checkStepOrder([["deploy.yml", moved]]);
  assert.ok(r.findings.length >= 1, "reordering the real workflow must be caught");
});

test("THE CLI WIRES RULE 2: a build script that mentions build-sha turns a run in a real-shaped project RED", () => {
  const proj = join(scratch, "proj"); mkdirSync(join(proj, ".github/workflows"), { recursive: true }); mkdirSync(join(proj, "scripts"));
  writeFileSync(join(proj, ".github/workflows/deploy.yml"), wf(GATE + STAMP));
  writeFileSync(join(proj, "vite.config.ts"), "export default {}\n");
  writeFileSync(join(proj, "scripts/prerender.mjs"), "// ok\n");
  assert.equal(spawnSync(process.execPath, [SCRIPT], { cwd: proj, encoding: "utf8" }).status, 0);
  writeFileSync(join(proj, "scripts/prerender.mjs"), "writeFileSync('dist/build-sha.txt', sha)\n");
  const r = spawnSync(process.execPath, [SCRIPT], { cwd: proj, encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /script-writes-build-sha/);
});
