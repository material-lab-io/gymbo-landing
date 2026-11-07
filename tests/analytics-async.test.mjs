import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { checkHtml, scanTree } from "../scripts/check-analytics-async.mjs";

const TAG = (attr) => `<script ${attr} src="https://analytics.getgymbo.com/script.js" data-website-id="x" data-domains="getgymbo.com"></script>`;
const MODULE = '<script type="module" src="/assets/index.js"></script>';

test("async analytics tag before the module bundle passes", () => {
  const r = checkHtml(`<head>${TAG("async")}${MODULE}</head>`);
  assert.equal(r.loads, 1);
  assert.deepEqual(r.problems, []);
});

test("PLANTED: defer before the module bundle is RED (the 7 Nov incident)", () => {
  const r = checkHtml(`<head>${TAG("defer")}${MODULE}</head>`);
  assert.ok(r.problems.some((p) => /defer/.test(p)), r.problems.join());
  assert.ok(r.problems.some((p) => /without async/.test(p)), r.problems.join());
});

test("PLANTED: a bare synchronous tag is RED", () => {
  assert.ok(checkHtml(TAG("")).problems.some((p) => /without async/.test(p)));
});

test("async + defer together is still RED", () => {
  assert.ok(checkHtml(TAG("async defer")).problems.some((p) => /defer/.test(p)));
});

test("a data attribute value containing the word async does not fake it", () => {
  const html = '<script defer data-x="async" src="https://analytics.getgymbo.com/script.js"></script>';
  assert.ok(checkHtml(html).problems.length >= 1);
});

test("CLI: planted defer on one page fails by file name, empty tree is COULD-NOT-EVALUATE", () => {
  const root = mkdtempSync(join(tmpdir(), "aa-"));
  mkdirSync(join(root, "ok")); mkdirSync(join(root, "bad"));
  writeFileSync(join(root, "ok/index.html"), TAG("async"));
  writeFileSync(join(root, "bad/index.html"), TAG("defer"));
  const run = (r) => spawnSync(process.execPath, ["scripts/check-analytics-async.mjs", "--root", r], { encoding: "utf8" });
  const red = run(root);
  assert.equal(red.status, 1);
  assert.match(red.stderr, /bad\/index\.html: loaded with defer/);
  assert.doesNotMatch(red.stderr, /ok\/index\.html/);
  const empty = run(mkdtempSync(join(tmpdir(), "aa-empty-")));
  assert.equal(empty.status, 2);
  assert.match(empty.stderr, /COULD-NOT-EVALUATE/);
});

test("the real tree passes", () => {
  const { files, loads, findings } = scanTree(".");
  assert.ok(files > 0 && loads > 0);
  assert.deepEqual(findings, []);
});
