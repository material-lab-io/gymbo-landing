// gy-k2543.21: guide + blog claim-truth fixes (marketer string table v1, 36 rows, 22 Nov 2026).
// Each row's OLD string must be gone and its NEW string present, verbatim, in the guide and blog sources and in every checked-in shell
// that carries it (the shells hold the FAQ JSON-LD and meta; check-jsonld-sync reads them). Planted controls: any old string put back,
// or any new string dropped, goes red by row.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const ROWS = [
[
1,
"built for the independent trainer in India and running on iPhone, it keeps",
"built for the independent trainer in India and running in your browser, it keeps"
],
[
2,
"clean statement or receipt (add your GSTIN in the Gymbo iOS app, under Profile > Business, and your statements become GST-ready), so the professional",
"clean statement or receipt, so the professional"
],
[
3,
"helps with the mechanics: running on iPhone, it keeps",
"helps with the mechanics: running in your browser, it keeps"
],
[
4,
"plus clear per-client statements (add your GSTIN in the Gymbo iOS app, under Profile > Business, and your statements become GST-ready).",
"plus clear per-client statements."
],
[
5,
"(built for the independent trainer in India, on iPhone)",
"(built for the independent trainer in India, in your browser)"
],
[
6,
"and payments and statements with your GSTIN alongside each client",
"and payments and statements alongside each client"
],
[
7,
"and running on iPhone, it lets you set",
"and running in your browser, it lets you set"
],
[
8,
"into a clean statement (add your GSTIN in the Gymbo iOS app, under Profile > Business, and your statements become GST-ready).",
"into a clean statement."
],
[
9,
"live alongside each client (add your GSTIN in the Gymbo iOS app, under Profile > Business, and your statements become GST-ready).",
"live alongside each client."
],
[
10,
"running on iPhone, it lets you record",
"running in your browser, it lets you record"
],
[
11,
"into a statement (add your GSTIN in the Gymbo iOS app, under Profile > Business, and your statements become GST-ready).",
"into a statement."
],
[
12,
"and running on iPhone, keeps an accurate session history",
"and running in your browser, keeps an accurate session history"
],
[
13,
"buys you trust (add your GSTIN in the Gymbo iOS app, under Profile > Business, and your statements become GST-ready). (More on that in",
"buys you trust. (More on that in"
],
[
14,
"in India and running on iPhone: you punch",
"in India and running in your browser: you punch"
],
[
15,
"sit alongside each client (add your GSTIN in the Gymbo iOS app, under Profile > Business, and your statements become GST-ready), and pre-written",
"sit alongside each client, and pre-written"
],
[
16,
"UPI payments, GST-ready statements (once you add your GSTIN), WhatsApp reminders, a workout builder",
"UPI payments, PDF statements, reminders you send yourself on WhatsApp, a workout builder"
],
[
17,
"send a reminder; GST invoices; day/week/month scheduling",
"send a reminder; day/week/month scheduling"
],
[
18,
"UPI, GST, and an Indian price are built in, not bolted on.",
"UPI payment records and an Indian price are built in, not bolted on."
],
[
19,
"fits well (UPI, GST, WhatsApp, ₹399/mo)",
"fits well (UPI payment records, reminders you send yourself, ₹399/mo)"
],
[
20,
"Gymbo, Akton, and WellnessZ all support UPI billing and GST invoices.",
"Gymbo records UPI payments. Akton and WellnessZ support UPI billing and GST invoices."
],
[
21,
"built for the local market (UPI, INR, GST, WhatsApp):",
"built for the local market (UPI, INR, WhatsApp):"
],
[
22,
"India-native (UPI/GST/WhatsApp)",
"India-native (UPI/WhatsApp)"
],
[
23,
"Your numbers are always right",
"Your numbers are clear"
],
[
24,
"When balances are always accurate, money stays a non-issue, and money being a non-issue is a good signal of a professional business.",
"When balances are accurate, money stays a non-issue, and that is a good signal of a professional business."
],
[
25,
"The best marketing is a client saying",
"Good marketing is a client saying"
],
[
26,
"Clients refer trainers who are reliable, whose numbers are always right, and who make them feel looked-after, and who are easy to describe in one line",
"Clients are more likely to recommend trainers who are reliable, whose numbers are clear, who make them feel looked after, and who are easy to describe in one line"
],
[
27,
"Clients refer trainers who look organized.",
"Clients tend to recommend trainers who look organized."
],
[
28,
"What do most personal trainers in India use to manage their clients?",
"What do personal trainers in India use to manage their clients?"
],
[
29,
"Most use a free stack:",
"Many use a free stack:"
],
[
30,
"Usually when admin starts eating multiple hours a week and payments become hard to track.",
"Often when admin starts taking time you would rather spend training and payments become hard to track."
],
[
31,
"Most trainers start on WhatsApp, a diary, and a UPI app, then move to a single app once juggling those four by hand gets heavy, typically when",
"Many trainers start on WhatsApp, a diary, and a UPI app, then move to a single app once juggling those four by hand gets heavy, often when"
],
[
32,
"The time-sink for solo trainers is almost always re-counting",
"The time-sink for solo trainers is often re-counting"
],
[
33,
"is enough for most independent trainers, predictable",
"is enough for many independent trainers, predictable"
],
[
34,
"When a package is nearly used up or a session's coming, Gymbo has pre-written reminder templates:",
"When a package is nearly used up or a renewal is due, Gymbo has pre-written message templates:"
],
[
35,
"It also has pre-written reminder templates: review the message",
"It also has pre-written message templates for low packages, renewals and overdue payments: review the message"
],
[
36,
"It also gives you WhatsApp reminder templates to send between sessions, so clients don't quietly drift away.",
"It also gives you pre-written WhatsApp messages for low packages, renewals and overdue payments, so clients don't quietly drift away."
]
,
[37,"let the client card calculate the balance, and use colour-coded balances to see who owes you.","let the client card calculate the balance, and see in red who owes you classes, with a warning when a balance runs low."]];
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const SOURCES = ["src/content/guide/pillars.ts", "src/content/blog/posts.ts", "public/llms.txt"];
const shells = () => {
  const out = [];
  for (const d of ["guide", "blog"]) {
    const dir = new URL(`../${d}/`, import.meta.url);
    if (!existsSync(dir)) continue;
    for (const e of readdirSync(dir, { withFileTypes: true })) if (e.isDirectory() && existsSync(new URL(`../${d}/${e.name}/index.html`, import.meta.url))) out.push(`${d}/${e.name}/index.html`);
  }
  return out;
};
const GREPS = ["running on iPhone", "Profile > Business", "GSTIN", "GST-ready", "always right", "best marketing", "Clients refer trainers", "most personal trainers", "multiple hours a week", "a session's coming", "fits well (UPI, GST, WhatsApp", "colour-coded"];  // the last one is row 19 in its source form (the price is a template there, so the literal-price row only reaches the shell)

// files: path -> text. Returns the problems; empty = clean.
export function check(files) {
  const bad = [];
  for (const [n, oldS, newS] of ROWS) {
    const all = Object.values(files);
    if (!all.some((t) => t.includes(newS))) bad.push(`NEW missing (row ${n}): ${newS}`);
    for (const [f, t] of Object.entries(files)) if (t.includes(oldS)) bad.push(`OLD still present (row ${n}) in ${f}: ${oldS}`);
  }
  for (const [f, t] of Object.entries(files)) for (const g of GREPS) if (t.includes(g)) bad.push(`banned claim '${g}' in ${f}`);
  return bad;
}
const load = () => Object.fromEntries([...SOURCES, ...shells()].map((f) => [f, read(f)]));

test("the corpus is non-empty: both sources and at least the shells that carry rows were read", () => {
  const f = load();
  for (const s of SOURCES) assert.ok(f[s].length > 1000, `${s} read empty`);
  assert.ok(Object.keys(f).length >= 6, "no shells read");
  assert.equal(ROWS.length, 37);
});

test("every old claim is gone and every new string is present verbatim", () => {
  assert.deepEqual(check(load()), []);
});

test("PLANTED CONTROL: each old string put back goes red by its own row", () => {
  for (const [n, oldS] of ROWS) {
    const f = load();
    f[SOURCES[0]] += `\n${oldS}\n`;
    assert.ok(check(f).some((b) => b.startsWith(`OLD still present (row ${n})`)), `row ${n} did not go red`);
  }
});

test("PLANTED CONTROL: a dropped new string goes red", () => {
  for (const [n, , newS] of ROWS) {
    const f = Object.fromEntries(Object.entries(load()).map(([k, t]) => [k, t.split(newS).join("x")]));
    assert.ok(check(f).some((b) => b.startsWith(`NEW missing (row ${n})`)), `row ${n} did not go red`);
  }
});
