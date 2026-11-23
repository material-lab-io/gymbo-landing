// gy-t3aoyv.7.2.2 (Kaushik ruling 23 Nov 02:57Z: invoices ship without founder or Damini sign-off): compliance's 'Shared invoice links' bullet is on /privacy,
// verbatim, in What we collect, before the invoice link is switched on. Planted controls: a missing bullet and a changed clause go red.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SRC = "src/pages/Privacy.tsx";
const TEXT = "When a trainer sends a client an invoice link, anyone who has the link can open a page with the trainer's name, the client's first name, the invoice number, the dates, the items and amounts, and what is still due. It shows no phone number, email or notes, and needs no sign-in. The link stops working after 30 days, when the trainer sends a new link or cancels it, or when the trainer deletes the client or their own account. Gymbo does not count or track who opens it.";
const read = () => readFileSync(new URL(`../${SRC}`, import.meta.url), "utf8");
export function check(src) {
  const bad = [];
  if (!src.includes(`<li><strong>Shared invoice links.</strong> ${TEXT}</li>`)) bad.push("the Shared invoice links bullet is missing or reworded");
  const collect = src.slice(src.indexOf("<h2>What we collect</h2>"), src.indexOf("<h2>How we use it</h2>"));
  if (!collect.includes("Shared invoice links.")) bad.push("the bullet is not under What we collect");
  if (/—/.test(TEXT)) bad.push("em dash in the bullet");
  return bad;
}
test("the file was read", () => assert.ok(read().length > 2000));
test("the bullet is on /privacy, verbatim, under What we collect", () => assert.deepEqual(check(read()), []));
test("PLANTED CONTROL: a missing bullet goes red", () => assert.ok(check(read().split("Shared invoice links.").join("x")).length > 0));
test("PLANTED CONTROL: a reworded clause (30 days -> 90 days) goes red", () => assert.ok(check(read().replace("after 30 days", "after 90 days")).length > 0));
