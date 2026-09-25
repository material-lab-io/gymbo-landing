// gy-jbax2 AC2: dist/build-sha.txt is a PER-COMMIT stamp the deploy workflow writes AFTER the copy
// gates run. Nothing pins it today only because of that order, and the order was an unrecorded
// invariant: if any workflow ran a copy gate AFTER a step that stamps a per-commit value into
// dist/, the gate would go red on literally every commit (the same bomb as gy-rro9u with a
// per-commit fuse instead of a per-day one).
//
// CHOICE, and why: ASSERT THE ORDER rather than mask build-sha.txt. Masking would make the gates
// blind to a real change in that file's shape, and it would let the order drift silently while
// still looking correct. Asserting keeps every gate strict and turns a reordering into a red
// check that names the workflow, job and both steps. A comment saying "keep these in order" is
// not an assertion; this is.
//
// Rules, over every job in every workflow file:
//   1. a step that runs a gate reading dist/ must come BEFORE any step that writes a per-commit
//      or per-run value (github.sha, GITHUB_SHA, github.run_id, github.run_number, github.run_attempt,
//      `date`) into dist/, and BEFORE any step that fetches a built dist from elsewhere
//      (download-artifact); inside one step, by line order;
//   2. no build script or config in the repo may itself write build-sha.txt (it belongs to the
//      workflow, after the gates), or the order rule could not see it.
// LIMITS: this is a line-based reading of the YAML (no yaml dependency on the runners); a stamp
// written by a script the workflow calls, or a reusable workflow, is invisible to rule 1.
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const GATE = /check:copy-output|copy-change-detector|check-canonical-terms|check-trial-eligibility|check-canonical-strings|check-no-em-dash|check-log-verb|check-no-internal-comments|shifted-clock-control/;
const STAMP = /build-sha\.txt|(?:^|[\s;&|(])date\b[^\n>]*>\s*["']?(?:\.\/)?dist\/|(?:github\.(?:sha|run_id|run_number|run_attempt)|GITHUB_SHA|GITHUB_RUN_ID|\$\(date|`date)[^\n]*>\s*["']?(?:\.\/)?dist\/|>\s*["']?(?:\.\/)?dist\/[^\n]*(?:github\.(?:sha|run_id|run_number|run_attempt)|GITHUB_SHA|GITHUB_RUN_ID|\$\(date)/;
const FETCH = /download-artifact/;

export function parseJobs(text) {
  const lines = text.split(/\r?\n/);
  const jobs = [];
  let inJobs = false, job = null, step = null;
  lines.forEach((line, i) => {
    if (/^jobs:\s*$/.test(line)) { inJobs = true; return; }
    if (!inJobs) return;
    const j = /^  ([\w.-]+):\s*(?:#.*)?$/.exec(line);
    if (j) { job = { name: j[1], steps: [] }; jobs.push(job); step = null; return; }
    if (!job) return;
    if (/^      - /.test(line)) { step = { line: i + 1, text: line + "\n" }; job.steps.push(step); return; }
    if (step) step.text += line + "\n";
  });
  return jobs;
}

const firstMatch = (text, re) => {
  const ls = text.split("\n");
  for (let i = 0; i < ls.length; i++) if (re.test(ls[i])) return i;
  return -1;
};

export function checkStepOrder(files) {
  const findings = [];
  let gates = 0, stamps = 0;
  for (const [file, text] of files) {
    for (const job of parseJobs(text)) {
      const idx = (re) => job.steps.map((s, i) => (re.test(s.text) ? i : -1)).filter((i) => i >= 0);
      const g = idx(GATE), st = idx(STAMP), f = idx(FETCH);
      gates += g.length; stamps += st.length;
      for (const gi of g) {
        for (const bad of [...st.map((i) => ({ i, kind: "stamps a per-commit/per-run value into dist/" })), ...f.map((i) => ({ i, kind: "fetches a built dist from elsewhere" }))]) {
          const where = `${file} job '${job.name}'`;
          if (bad.i < gi) findings.push({ kind: "gate-after-stamp", detail: `${where}: step at line ${job.steps[bad.i].line} ${bad.kind} BEFORE the copy gate at line ${job.steps[gi].line}; the gate would read a per-commit file and go red on every commit` });
          else if (bad.i === gi) {
            const gl = firstMatch(job.steps[gi].text, GATE), bl = firstMatch(job.steps[gi].text, bad.kind.startsWith("stamps") ? STAMP : FETCH);
            if (bl !== -1 && gl !== -1 && bl < gl) findings.push({ kind: "gate-after-stamp", detail: `${where}: inside the step at line ${job.steps[gi].line} the stamp (line ${bl + 1} of the step) comes before the gate (line ${gl + 1})` });
          }
        }
      }
    }
  }
  return { findings, gates, stamps };
}

export function checkScriptsDoNotStamp(files) {
  return files.filter(([, text]) => /build-sha/.test(text)).map(([file]) => ({ kind: "script-writes-build-sha", detail: `${file} mentions build-sha: the stamp belongs to the workflow, AFTER the gates; a build script that writes it would be invisible to the order rule` }));
}

const read = (dir, re) => readdirSync(dir).filter((n) => re.test(n)).sort().map((n) => [join(dir, n), readFileSync(join(dir, n), "utf8")]);

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const dir = process.argv[2] ?? ".github/workflows";
    const wf = read(dir, /\.ya?ml$/i);
    if (!wf.length) throw new Error(`no workflow files in ${dir}; refusing a vacuous pass`);
    const { findings, gates, stamps } = checkStepOrder(wf);
    const scripts = process.argv[2] ? [] : [...read("scripts", /\.(mjs|cjs|js|sh)$/).filter(([f]) => !/check-step-order|shifted-clock-control/.test(f)), ["vite.config.ts", readFileSync("vite.config.ts", "utf8")]];
    findings.push(...checkScriptsDoNotStamp(scripts));
    if (findings.length) {
      console.error(`FAIL: ${findings.length} step-order finding(s):`);
      for (const f of findings) console.error(`  ${f.kind}: ${f.detail}`);
      process.exitCode = 1;
    } else {
      console.log(`OK: in ${wf.length} workflow file(s), all ${gates} copy-gate step(s) run before every step that mentions the per-commit stamp (${stamps} such step(s), build-sha.txt); no script writes the stamp.`);
    }
  } catch (e) { console.error(`COULD NOT EVALUATE step order: ${e.message}`); process.exitCode = 2; }
}
