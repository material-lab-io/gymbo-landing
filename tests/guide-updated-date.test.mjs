// gy-k2543.21 rows 41-42 (marketer, 23 Nov 2026): the guides' byline date is a freshness claim, so it is the real edit date (one BYLINE constant covers all 10
// guides); the two blog posts keep their publish dates and only their JSON-LD dateModified moves. Planted controls: the old date back, a dropped new one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const PILLARS = "src/content/guide/pillars.ts";
const BLOGS = ["blog/best-apps-for-independent-personal-trainers-in-india-2026/index.html", "blog/how-india-independent-trainers-run-their-business/index.html"];
const OLD_BYLINE = "Last updated: 15 July 2026";
const NEW_BYLINE = "Last updated: 23 November 2026";
export function check(files) {
  const bad = [];
  if (files[PILLARS].includes(OLD_BYLINE)) bad.push(`OLD byline still present (row 41) in ${PILLARS}`);
  if (!files[PILLARS].includes(NEW_BYLINE)) bad.push(`NEW byline missing (row 41) in ${PILLARS}`);
  for (const b of BLOGS) {
    if (!files[b].includes('"dateModified": "2026-11-23"')) bad.push(`dateModified is not 2026-11-23 (row 42) in ${b}`);
    if (/"dateModified": "2026-06-2\d"/.test(files[b])) bad.push(`old June dateModified still present (row 42) in ${b}`);
  }
  return bad;
}
const load = () => Object.fromEntries([PILLARS, ...BLOGS].map((f) => [f, read(f)]));

test("the files were read", () => { const f = load(); for (const k of Object.keys(f)) assert.ok(f[k].length > 800, `${k} read empty`); });
test("byline = 23 November 2026 on all guides (one constant), blog dateModified moved, blog publish dates untouched", () => {
  assert.deepEqual(check(load()), []);
  for (const b of BLOGS) assert.match(read(b), /"datePublished": "2026-06-2\d"/, `${b} keeps its publish date`);
});
test("PLANTED CONTROL: the old byline put back goes red", () => {
  const f = load(); f[PILLARS] += `\n${OLD_BYLINE}\n`;
  assert.ok(check(f).some((b) => b.includes("row 41")));
});
test("PLANTED CONTROL: a dropped new byline and a June dateModified each go red", () => {
  const f = load(); f[PILLARS] = f[PILLARS].split(NEW_BYLINE).join("x");
  assert.ok(check(f).some((b) => b.startsWith("NEW byline missing")));
  const g = load(); g[BLOGS[0]] = g[BLOGS[0]].replace('"dateModified": "2026-11-23"', '"dateModified": "2026-06-24"');
  assert.ok(check(g).some((b) => b.includes("row 42")));
});
