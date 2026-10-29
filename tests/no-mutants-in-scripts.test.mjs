// gy-e5kk2z: no test may write temp/mutant files INTO scripts/.
//
// tests/step-order.test.mjs (and any check that scans scripts/) reads that directory while `node --test` runs the other
// test files in parallel. A sibling that writes `.mutant-*.mjs` there and removes it makes the scanner lose the race
// ("COULD NOT EVALUATE step order: ENOENT ... scripts/.mutant-norm-*.mjs") and red-gates the deploy of a valid tree,
// which is exactly what stopped #316's deploy on main b74134a13. Mutated copies belong in a unique dir under os.tmpdir().
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const TESTS = new URL("./", import.meta.url);

// A test file that points a URL/path at ../scripts/ AND names a dot-prefixed mutant/temp file is writing into scripts/.
export function writesDotFileIntoScripts(src) {
  return /\.\.\/scripts\//.test(src) && /[`'"]\.mutant-|[`'"]\.tmp-|[`'"]\.scratch-/.test(src);
}

test("no test file writes a .mutant-* / .tmp-* file into scripts/", () => {
  const offenders = readdirSync(TESTS)
    .filter((f) => /\.(mjs|ts)$/.test(f) && f !== "no-mutants-in-scripts.test.mjs")
    .filter((f) => writesDotFileIntoScripts(readFileSync(new URL(f, TESTS), "utf8")));
  assert.deepEqual(offenders, [], "write mutated copies to a unique dir under os.tmpdir(), never into scripts/ (gy-e5kk2z)");
});

test("planted control: the pre-fix pattern is detected", () => {
  const old = 'const dir = new URL("../scripts/", import.meta.url);\nconst m = new URL(`.mutant-norm-${id}.mjs`, dir);';
  assert.equal(writesDotFileIntoScripts(old), true);
  const fixed = 'const d = join(scratch, `mutant-${id}`);\nconst SCRIPTS_DIR = new URL("../scripts/", import.meta.url);';
  assert.equal(writesDotFileIntoScripts(fixed), false, "a read of scripts/ plus a non-dot temp dir is fine");
});

test("scripts/ holds no leftover .mutant-* files right now", () => {
  const left = readdirSync(new URL("../scripts/", import.meta.url)).filter((f) => f.startsWith(".mutant-"));
  assert.deepEqual(left, []);
});
