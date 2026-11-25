// gy-1vd9qy.10.2 rows 38-40 (marketer, 23 Nov 2026): landing copy never says 'unlimited clients'. It reads as if Free has a limit and Pro lifts it;
// no plan has a client cap (the same problem gy-t3aoyv.1.1.1 removed in the app). Old strings gone, new verbatim, planted controls per row.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ROWS = [
  [38, "public/llms.txt", "paid on the web. Unlimited clients.", "paid on the web. No plan has a client limit."],
  [39, "src/pages/CompareWellnessZ.tsx", 'gymbo: "unlimited: flat price, no per-client tiers"', 'gymbo: "no limit: flat price, no per-client tiers"'],
  [40, "src/pages/CompareWellnessZ.tsx", "with unlimited clients, so it doesn", "with no limit on clients, so it doesn"],
];
const FILES = ["public/llms.txt", "src/pages/CompareWellnessZ.tsx"];
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
export function check(files) {
  const bad = [];
  for (const [n, f, o, nw] of ROWS) {
    if (files[f].includes(o)) bad.push(`OLD still present (row ${n}) in ${f}: ${o}`);
    if (!files[f].includes(nw)) bad.push(`NEW missing (row ${n}) in ${f}: ${nw}`);
  }
  for (const f of FILES) if (/unlimited clients/i.test(files[f])) bad.push(`'unlimited clients' in ${f}`);
  return bad;
}
const load = () => Object.fromEntries(FILES.map((f) => [f, read(f)]));

test("both files were read and the table is whole", () => {
  for (const f of FILES) assert.ok(load()[f].length > 800, `${f} read empty`);
  assert.equal(ROWS.length, 3);
});
test("old gone, new verbatim, no 'unlimited clients' left on our side", () => assert.deepEqual(check(load()), []));
test("PLANTED CONTROL: each old string put back goes red by its own row", () => {
  for (const [n, f, o] of ROWS) {
    const files = load();
    files[f] += `\n${o}\n`;
    assert.ok(check(files).some((b) => b.startsWith(`OLD still present (row ${n})`)), `row ${n} did not go red`);
  }
});
test("PLANTED CONTROL: a dropped new string goes red", () => {
  for (const [n, f, , nw] of ROWS) {
    const files = load();
    files[f] = files[f].split(nw).join("x");
    assert.ok(check(files).some((b) => b.startsWith(`NEW missing (row ${n})`)), `row ${n} did not go red`);
  }
});
