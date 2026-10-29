// gy-x0pdi (content ruling 28 Oct): the guide pages carry FAQPage JSON-LD only. Their HowTo step names/texts had no
// counterpart in the visible page (measured: 51 strings on 7 guide pages), and Google retired HowTo rich results in 2023,
// so content ruled DROP, not "add visible steps". This keeps the markup from quietly coming back.
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const GUIDE = resolve(import.meta.dirname, "..", "guide");
const dirs = readdirSync(GUIDE, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

function ldTypes(html) {
  const out = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    const j = JSON.parse(m[1]);
    for (const n of Array.isArray(j) ? j : (j["@graph"] || [j])) out.push(n["@type"]);
  }
  return out;
}

test("POSITIVE CONTROL: the shells are read (there are guide pages and each still carries FAQPage JSON-LD)", () => {
  assert.ok(dirs.length >= 10, `expected the ten guide shells, found ${dirs.length}`);
  for (const d of dirs) {
    const f = join(GUIDE, d, "index.html");
    if (!existsSync(f)) continue;
    assert.ok(ldTypes(readFileSync(f, "utf8")).includes("FAQPage"), `${d} lost its FAQPage JSON-LD`);
  }
});

test("no guide shell carries HowTo JSON-LD", () => {
  for (const d of dirs) {
    const f = join(GUIDE, d, "index.html");
    if (!existsSync(f)) continue;
    assert.ok(!ldTypes(readFileSync(f, "utf8")).includes("HowTo"), `${d}: HowTo JSON-LD is back (content ruled it dropped)`);
  }
});

test("NEGATIVE CONTROL: the detector does see a HowTo element when one is present", () => {
  const html = `<script type="application/ld+json">[{"@type":"HowTo","name":"x"},{"@type":"FAQPage"}]</script>`;
  assert.deepEqual(ldTypes(html), ["HowTo", "FAQPage"]);
});
