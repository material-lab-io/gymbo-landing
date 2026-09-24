// gy-wwr2e.57: a cross-page promise needs a guard on its far end, not an inspection.
//
// The takedown form (functions/m/takedown.js) tells a reader their IP address "may also appear
// in our general service logs, described in our privacy notice". That is only true while the
// privacy notice keeps a "Technical data" list item that names IP address. A human confirmed it
// survives gymbo-landing#208 at one sha; nothing protected the NEXT edit. This test does.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const PRIVACY = new URL("../src/pages/Privacy.tsx", import.meta.url);

// A Technical data list item, in the notice's own markup, whose text mentions IP address.
export function hasTechnicalDataLineNamingIp(source) {
  const items = [...source.matchAll(/<li>\s*<strong>\s*Technical data\.?\s*<\/strong>([\s\S]*?)<\/li>/g)];
  return items.some(([, text]) => /\bIP address\b/i.test(text));
}

test("cross-page: the privacy notice still has a Technical data item naming IP address (the takedown form points at it)", () => {
  assert.ok(
    hasTechnicalDataLineNamingIp(readFileSync(PRIVACY, "utf8")),
    "src/pages/Privacy.tsx lost its 'Technical data' item naming IP address; the takedown form's " +
      "'described in our privacy notice' now points at nothing. Restore it, or change the form (gy-wwr2e.57).",
  );
});

test("cross-page NEG: deleting the line, renaming it, or dropping IP address from it turns the guard RED", () => {
  const real = readFileSync(PRIVACY, "utf8");
  const line = real.match(/<li><strong>Technical data\.<\/strong>[\s\S]*?<\/li>/)[0];
  assert.ok(hasTechnicalDataLineNamingIp(real), "liveness: the real page passes, so a red below means something");
  assert.equal(hasTechnicalDataLineNamingIp(real.replace(line, "")), false, "line deleted");
  assert.equal(hasTechnicalDataLineNamingIp(real.replace("Technical data.", "Server logs.")), false, "renamed");
  assert.equal(hasTechnicalDataLineNamingIp(real.replace(/IP address/g, "network address")), false, "no longer names IP address");
  assert.equal(hasTechnicalDataLineNamingIp(real.replace(/<li><strong>Technical data\.<\/strong>/, "<p><strong>Technical data.</strong>")), false, "no longer a list item");
});

test("cross-page: both ends name each other, so an editor of either sees the dependency", () => {
  assert.match(readFileSync(PRIVACY, "utf8"), /DEPENDANT: the takedown form/);
  assert.match(readFileSync(new URL("../functions/m/takedown.js", import.meta.url), "utf8"), /CROSS-PAGE PROMISE/);
});
