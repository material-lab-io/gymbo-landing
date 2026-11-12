// gy-0ho2lx: the pillar bands that carry a demo figure are drawn on the colour the approved art was composed on.
//
// Every public/demos/*-{light,dark}.png is an opaque 1080x1920 frame with its page colour baked into every pixel, and the clips are MP4 (no alpha). When Forge
// set B moved the page to #FFF and the dark band to #000, the art did not move, so each figure showed as a box (web_designer, #332). FIGURE_SURFACE in
// src/figure-surface.ts is that baked colour. This test reads the real corner pixel of every poster, so the constant cannot drift from the art, and reads App.tsx so
// the demo bands cannot go back to the tokens while the art is unchanged.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

// Pixel (0,0) of an 8-bit non-interlaced RGB/RGBA PNG. The first pixel has no left or upper neighbour, so every PNG filter type (None, Sub, Up, Average, Paeth)
// leaves its raw bytes unchanged: the three bytes after the first scanline's filter byte ARE the colour.
export function cornerPixel(buf) {
  assert.equal(buf.subarray(1, 4).toString("latin1"), "PNG", "not a PNG");
  let off = 8, idat = [], ihdr = null;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.subarray(off + 4, off + 8).toString("latin1");
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") ihdr = { bitDepth: data[8], colorType: data[9], interlace: data[12] };
    if (type === "IDAT") idat.push(data);
    off += 12 + len;
  }
  assert.ok(ihdr, "no IHDR");
  assert.equal(ihdr.bitDepth, 8, "only 8-bit PNGs are read");
  assert.ok(ihdr.colorType === 2 || ihdr.colorType === 6, `colour type ${ihdr.colorType} is not RGB/RGBA`);
  assert.equal(ihdr.interlace, 0, "interlaced PNGs are not read");
  const raw = inflateSync(Buffer.concat(idat));
  return [raw[1], raw[2], raw[3]];
}
export const hex = ([r, g, b]) => "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("").toUpperCase();

const SURFACE = (() => {
  const m = readFileSync(join(ROOT, "src/figure-surface.ts"), "utf8").match(/FIGURE_SURFACE = \{ light: "(#[0-9A-Fa-f]{6})", dark: "(#[0-9A-Fa-f]{6})" \} as const/);
  assert.ok(m, "FIGURE_SURFACE is not declared in src/figure-surface.ts");
  return { light: m[1].toUpperCase(), dark: m[2].toUpperCase() };
})();

const posters = readdirSync(join(ROOT, "public/demos")).filter((f) => /-(light|dark)\.png$/.test(f));

test("there are demo posters to compare against (a vacuous pass is not a pass)", () => {
  assert.ok(posters.length >= 8, `found ${posters.length} posters in public/demos`);
  assert.ok(posters.some((f) => f.endsWith("-light.png")) && posters.some((f) => f.endsWith("-dark.png")));
});

test("FIGURE_SURFACE equals the baked corner pixel of every demo poster", () => {
  for (const f of posters) {
    const theme = f.endsWith("-dark.png") ? "dark" : "light";
    assert.equal(hex(cornerPixel(readFileSync(join(ROOT, "public/demos", f)))), SURFACE[theme], `${f}: the ${theme} figure surface no longer matches the art`);
  }
});

test("control: a surface one level off the art is NOT accepted (the comparison can fail)", () => {
  const baked = hex(cornerPixel(readFileSync(join(ROOT, "public/demos", posters.find((f) => f.endsWith("-light.png"))))));
  assert.notEqual(baked, "#FAFAF8");
  assert.notEqual(baked, "#FFFFFF", "the light art is not white: that is the whole defect");
});

test("the pillar bands that carry a demo are drawn on FIGURE_SURFACE, not on the page tokens", () => {
  const app = readFileSync(join(ROOT, "src/App.tsx"), "utf8");
  assert.match(app, /pillar-band-\$\{p\.id\}[^\n]*hasDemo \? \(dark \? FIGURE_SURFACE\.dark : FIGURE_SURFACE\.light\) : \(dark \? F\.charcoal : F\.beige\)/, "a demo band must use FIGURE_SURFACE");
});
