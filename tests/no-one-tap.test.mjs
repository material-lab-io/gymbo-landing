import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { scanTree } from "../scripts/check-no-one-tap.mjs";

const SCRIPT = new URL("../scripts/check-no-one-tap.mjs", import.meta.url).pathname;
const REPO = dirname(dirname(SCRIPT));
const scratch = mkdtempSync(join(tmpdir(), "gymbo-no-one-tap-"));
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));
let serial = 0;

function tree(files) {
  const root = join(scratch, `case-${++serial}`);
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), body);
  }
  return root;
}
const run = (root) => spawnSync(process.execPath, [SCRIPT, "--root", root], { encoding: "utf8" });

test("PLANTED CONTROL: every banned phrasing in src/public/route shells is caught, in every file type", () => {
  const bad = {
    "src/a.tsx": '"Punch a class in one tap"',
    "src/b.ts": "one-tap class punches",
    "src/c.ts": "Send it with a single tap",
    "src/d.ts": "a builder with voice and paste import",
    "public/llms.txt": "template library + voice/paste import",
    "alternatives/x/index.html": '{"text":"classes in One  Tap"}',
    "blog/y/index.html": "a builder plus voice import",
  };
  const found = scanTree(tree(bad));
  assert.deepEqual([...new Set(found.map((f) => f.file))].sort(), Object.keys(bad).sort());
  assert.equal(run(tree(bad)).status, 1);
});

test("NEGATIVE CONTROL: the ruled v5 wording and unrelated words pass", () => {
  const ok = {
    "src/a.tsx": '"Punch a class in a couple of taps, and balances update themselves"',
    "src/b.ts": "Tap once to open the drawer. Our brand voice is plain. Import your clients from a CSV.",
    "tests/ignored.test.mjs": "one tap",
  };
  assert.deepEqual(scanTree(tree(ok)), []);
  assert.equal(run(tree(ok)).status, 0);
});

test("THE REAL TREE is clean (red on the pre-fix tree, green once canonical v5 is vendored)", () => {
  assert.deepEqual(scanTree(REPO).map((f) => `${f.file}:${f.line}`), []);
});
