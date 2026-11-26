// gy-1vd9qy.10.2: claim-truth fixes (pm rulings A and B, marketer string table v4, 22 Nov 2026).
// Each row's OLD string must be gone and its NEW string present, verbatim, in the one source the page is built from.
// The FAQ JSON-LD reads the same source as the visible text (tests/jsonld-sync.test.mjs), so one edit covers both.
// Planted controls: putting any old string back, or dropping any new one, must go red by name.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const ALT = "src/content/alternatives/pages.ts";
const ROWS = [
  [ALT, "GST-ready invoices | ✅", "", "trainerize/truecoach: GST-ready invoices rows deleted"],
  [ALT, "✅ Reminders & sharing", "✅ You send reminders yourself", "rows 2, 6"],
  [ALT, "You need GST-ready statements (once you add your GSTIN) and WhatsApp reminders.", "You need to track UPI and cash payments and send your own WhatsApp reminders.", "row 3"],
  [ALT, "(UPI payments, INR pricing, GST-ready invoices, and WhatsApp reminders)", "(payments in UPI or cash, INR pricing, and reminders you send yourself on WhatsApp)", "row 4"],
  [ALT, "You need GST-ready statements (once you add your GSTIN), WhatsApp reminders, and a real schedule.", "You need to track UPI and cash payments, send your own WhatsApp reminders, and run a real schedule.", "row 7"],
  [ALT, "(UPI payments, INR pricing, GST-ready invoices, WhatsApp reminders, and built-in scheduling)", "(payments in UPI or cash, INR pricing, reminders you send yourself on WhatsApp, and built-in scheduling)", "row 8"],
  [ALT, "or GST compliance. Gymbo is.", "or GST compliance. Gymbo records UPI and cash payments in rupees.", "row 9"],
  [ALT, "and during onboarding we help set up your client list and first sessions", "Gymbo cannot import from another app. You add clients by hand. On Android Chrome you can add them from your contacts.", "row 10"],
  [ALT, "Gymbo is built for UPI and GST from the ground up.", "Gymbo records UPI and cash payments in rupees.", "row 12"],
  [ALT, "GST-ready statements (once you add your GSTIN) and UPI", "UPI and cash payments", "akton row 9"],
  [ALT, "Both support UPI payments and GST invoicing and are built", "Both record UPI payments and are built", "akton row 10"],
  ["src/pages/CompareWellnessZ.tsx", "UPI + cash, GST invoices, colour-coded reminders", "UPI and cash, reminders you send yourself", "row 14"],
  ["public/llms.txt", "GST invoices, colour-coded reminders", "reminders you send yourself", "llms.txt carried row 14's claim"],
  ["src/App.tsx", 'name: "Your own URL"', "", "row 15"],
  ["src/App.tsx", "A muscle and body map for every plan", "", "row 16"],
  ["src/content/home.ts", 'name: "Custom branded client content"', "You can put your logo or brand name on your PDF statements.", "row 17"],
  ["src/App.tsx", 'name: "Brand theming"', "", "row 18"],
  ["src/content/home.ts", "your name, tagline, and details on each one", "You can send a client their statement to ask for payment.", "row 19"],
  ["src/content/home.ts", "A shareable QR profile card in three styles", "You can share a profile card with a QR code that opens your WhatsApp or website.", "row 20"],
];
const GREPS = ["GST-ready", "GSTIN", "during onboarding", "Your own URL", "body map", "Brand theming", "Custom branded client content", "three styles", "tagline, and details"];

// Returns the problems for a map of file -> text. Empty = clean.
export function check(files) {
  const bad = [];
  for (const [file, oldS, newS, why] of ROWS) {
    const t = files[file];
    if (t.includes(oldS)) bad.push(`OLD still present (${why}): ${file}: ${oldS}`);
    if (newS && !t.includes(newS)) bad.push(`NEW missing (${why}): ${file}: ${newS}`);
  }
  for (const f of ["src/App.tsx", "src/content/home.ts", "src/pages/CompareWellnessZ.tsx", "public/llms.txt"])
    for (const g of GREPS) if (files[f].includes(g)) bad.push(`banned claim '${g}' on our side: ${f}`);
  return bad;
}
// The checked-in shells carry their own FAQ JSON-LD (check-jsonld-sync reads them): the old answers must be gone there too.
const SHELLS = ["alternatives/akton/index.html", "alternatives/trainerize/index.html", "alternatives/truecoach/index.html"];
const SHELL_OLD = ["GST-ready", "GST invoicing and are built", "during onboarding", "built for UPI and GST from the ground up", "or GST compliance. Gymbo is."];
export function checkShells(shells) {
  const bad = [];
  for (const f of SHELLS) for (const o of SHELL_OLD) if (shells[f].includes(o)) bad.push(`OLD still in the checked-in shell ${f}: ${o}`);
  return bad;
}
const shells = () => Object.fromEntries(SHELLS.map((f) => [f, read(f)]));
const files = () => Object.fromEntries(["src/content/alternatives/pages.ts", "src/pages/CompareWellnessZ.tsx", "src/App.tsx", "src/content/home.ts", "public/llms.txt"].map((f) => [f, read(f)]));

test("the corpus is non-empty and the table was read", () => {
  const f = files();
  for (const k of Object.keys(f)) assert.ok(f[k].length > 500, `${k} read empty`);
  assert.equal(ROWS.length, 19);
});

test("every old claim is gone and every new string is present verbatim", () => {
  assert.deepEqual(check(files()), []);
});

test("PLANTED CONTROL: each old string put back goes red by its own row", () => {
  for (const [file, oldS, , why] of ROWS) {
    const f = files();
    f[file] += `\n${oldS}\n`;
    const bad = check(f);
    assert.ok(bad.some((b) => b.includes(`OLD still present (${why})`)), `row '${why}' did not go red`);
  }
});

test("PLANTED CONTROL: a banned claim typed into the home content file goes red by name", () => {
  const f = files();
  f["src/content/home.ts"] += '\nname: "Brand theming"\n';
  assert.ok(check(f).includes("banned claim 'Brand theming' on our side: src/content/home.ts"), check(f).join("\n"));
});

test("PLANTED CONTROL: a missing new string goes red", () => {
  for (const [file, , newS, why] of ROWS.filter((r) => r[2])) {
    const f = files();
    f[file] = f[file].split(newS).join("x");
    assert.ok(check(f).some((b) => b.includes(`NEW missing (${why})`)), `row '${why}' did not go red`);
  }
});

test("the checked-in shells' FAQ JSON-LD carries none of the old answers", () => {
  assert.deepEqual(checkShells(shells()), []);
});

test("PLANTED CONTROL: an old answer put back into a shell goes red by file", () => {
  for (const f of SHELLS) for (const o of SHELL_OLD) {
    const sh = shells();
    sh[f] += `\n${o}\n`;
    assert.ok(checkShells(sh).some((b) => b.includes(f) && b.includes(o)), `${f} / ${o} did not go red`);
  }
});
