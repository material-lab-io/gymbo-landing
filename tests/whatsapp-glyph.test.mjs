// gy-e9h9y F1 (designer read, 29 Oct): the WhatsApp primary's glyph is the ONLY thing
// that names the channel (the label says "Talk to the founder", and Forge declines a
// WhatsApp-green token). The handset alone reads as a phone call at 18px, so the mark
// must carry its speech-bubble ring too.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SRC = readFileSync(new URL("../src/forge-ui.tsx", import.meta.url), "utf8");

export function glyphPathData(src) {
  const fn = src.match(/export function WhatsAppGlyph[\s\S]*?<path d="([^"]+)"/);
  assert.ok(fn, "WhatsAppGlyph must render a <path d=...>");
  return fn[1];
}

// Handset + bubble outline + bubble inner edge: three move commands in the full mark.
export function moveCommands(d) {
  return (d.match(/[Mm]/g) || []).length;
}

test("WhatsAppGlyph is the full mark: handset AND speech-bubble ring", () => {
  const d = glyphPathData(SRC);
  assert.ok(moveCommands(d) >= 3, `expected handset + ring subpaths, got ${moveCommands(d)} move command(s)`);
  assert.ok(/12\.05 0C5\.495/.test(d), "the outer bubble ring (starts at 12.05 0) must be present");
});

test("planted control: the old handset-only path is rejected", () => {
  const handsetOnly = "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.57-.347z";
  assert.equal(moveCommands(handsetOnly), 1);
  assert.ok(moveCommands(handsetOnly) < 3, "a single-subpath glyph must fail the check above");
});

test("the glyph stays decorative and sized to currentColor", () => {
  const block = SRC.match(/export function WhatsAppGlyph[\s\S]*?<\/svg>/)[0];
  assert.match(block, /aria-hidden="true"/);
  assert.match(block, /fill="currentColor"/);
});
