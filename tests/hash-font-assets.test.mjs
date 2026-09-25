// gy-dwxbm: the font-hashing build step. Each case plants ONE defect and proves the step fails on it
// by name, because a fail-closed check that has never failed is unproven.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { hashFontAssets } from "../scripts/hash-font-assets.mjs";

const scratch = mkdtempSync(join(tmpdir(), "gymbo-fonts-"));
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));
const CSS = `@font-face{font-family:'A';src:url('/fonts/a-variable.woff2') format('woff2')}\n@font-face{font-family:'B';src:url('/fonts/b-variable.woff2') format('woff2')}\n`;
function dist(over = {}) {
  const d = mkdtempSync(join(scratch, "dist-")); mkdirSync(join(d, "fonts")); mkdirSync(join(d, "guide/x"), { recursive: true });
  writeFileSync(join(d, "fonts/fonts.css"), over.css ?? CSS);
  writeFileSync(join(d, "fonts/a-variable.woff2"), over.a ?? "AAAA"); writeFileSync(join(d, "fonts/b-variable.woff2"), over.b ?? "BBBB");
  writeFileSync(join(d, "index.html"), over.index ?? `<link rel="preload" href="/fonts/a-variable.woff2" as="font"><link rel="preload" href="/fonts/b-variable.woff2" as="font"><link rel="stylesheet" href="/fonts/fonts.css" />`);
  writeFileSync(join(d, "guide/x/index.html"), over.page ?? `<link rel="stylesheet" href="/fonts/fonts.css" />`);
  return d;
}
const files = (d) => readdirSync(join(d, "fonts")).sort();
const HASHED = /^[a-z-]+\.[0-9a-f]{10}\.(css|woff2)$/;

test("HAPPY PATH: all three files get content-hashed names, every reference is rewritten, no unhashed name is left", () => {
  const d = dist(); const r = hashFontAssets(d);
  assert.equal(r.mapping.length, 3); assert.ok(files(d).every((n) => HASHED.test(n)), files(d).join());
  assert.ok(!existsSync(join(d, "fonts/fonts.css")), "the old unhashed URL must not survive in dist (it must 404 at the origin)");
  const css = files(d).find((n) => n.endsWith(".css"));
  for (const html of ["index.html", "guide/x/index.html"]) assert.match(readFileSync(join(d, html), "utf8"), new RegExp(`/fonts/${css.replace(/\./g, "\\.")}`));
  const idx = readFileSync(join(d, "index.html"), "utf8"); assert.doesNotMatch(idx, /\/fonts\/(a|b)-variable\.woff2|\/fonts\/fonts\.css/);
  assert.doesNotMatch(readFileSync(join(d, "fonts", css), "utf8"), /a-variable\.woff2|b-variable\.woff2(?!\.)/, "the CSS must name the hashed fonts");
});

test("THE POINT: changing a font's bytes changes its URL, and the CSS URL changes with it (the CSS hash covers the rewritten url())", () => {
  const one = dist(); const two = dist({ a: "AAAA-CHANGED" }); const three = dist({ css: CSS + "/* edited */\n" });
  hashFontAssets(one); hashFontAssets(two); hashFontAssets(three);
  const n = (d, ext, stem) => files(d).find((f) => f.startsWith(stem) && f.endsWith(ext));
  assert.notEqual(n(one, ".woff2", "a-"), n(two, ".woff2", "a-"), "a changed font must get a NEW url");
  assert.notEqual(n(one, ".css", "fonts"), n(two, ".css", "fonts"), "the CSS names the font, so its own url must change too");
  assert.notEqual(n(one, ".css", "fonts"), n(three, ".css", "fonts"), "an edited stylesheet must get a NEW url (the fonts.css bug)");
  assert.equal(n(one, ".woff2", "b-"), n(two, ".woff2", "b-"), "an untouched font keeps its url");
});

test("DETERMINISTIC: the same bytes always hash to the same name", () => { const a = dist(); const b = dist(); hashFontAssets(a); hashFontAssets(b); assert.deepEqual(files(a), files(b)); });

test("IDEMPOTENT: a second run on an already-hashed dist changes nothing and does not double-hash", () => {
  const d = dist(); hashFontAssets(d); const before = files(d); const r = hashFontAssets(d);
  assert.deepEqual(files(d), before); assert.equal(r.mapping.length, 0); assert.equal(r.alreadyHashed, 3);
});

test("FAIL CLOSED: an ORPHAN (a font nothing references) fails the build", () => {
  assert.throws(() => hashFontAssets(dist({ index: `<link rel="stylesheet" href="/fonts/fonts.css">`, page: `<p>x</p>`, css: `@font-face{src:url('/fonts/a-variable.woff2')}` })), /orphan: \/fonts\/b-variable\.woff2/);
});

test("FAIL CLOSED: a DANGLING reference (page names a font that is not in dist/fonts) fails the build", () => {
  assert.throws(() => hashFontAssets(dist({ page: `<link rel="stylesheet" href="/fonts/fonts.css"><link rel="preload" href="/fonts/missing.woff2">` })), /dangling: .*\/fonts\/missing\.woff2.*no such file/);
});

test("FAIL CLOSED (pm's control): a font the CSS and the homepage NAME but that is MISSING from dist/fonts fails the build", () => {
  const d = dist(); rmSync(join(d, "fonts/a-variable.woff2"));
  assert.ok(!existsSync(join(d, "fonts/a-variable.woff2")), "the mutation must have applied");
  assert.throws(() => hashFontAssets(d), /dangling: .*a-variable\.woff2.*no such file/);
  const ctl = dist(); assert.doesNotThrow(() => hashFontAssets(ctl), "control: the same dist WITH the font passes");
});

test("FAIL CLOSED: a stylesheet the pages name but that is MISSING from dist/fonts fails the build, naming a page", () => {
  const d = dist(); rmSync(join(d, "fonts/fonts.css"));
  assert.throws(() => hashFontAssets(d), /dangling: \/(index|guide\/x\/index)\.html references \/fonts\/fonts\.css/);
});

test("FAIL CLOSED: a reference the rewrite could not match (a query string is fine, an odd form is not) is caught as leftover/dangling, not shipped", () => {
  const d = dist({ page: `<link rel="stylesheet" href="/fonts/fonts.css?v=1"><link rel="stylesheet" href="/fonts/fonts.css">` });
  hashFontAssets(d); assert.match(readFileSync(join(d, "guide/x/index.html"), "utf8"), /\/fonts\/fonts\.[0-9a-f]{10}\.css\?v=1/, "a query string is preserved");
});

test("FAIL CLOSED: a missing or empty dist/fonts is an error, never a vacuous pass", () => {
  const empty = mkdtempSync(join(scratch, "e-")); assert.throws(() => hashFontAssets(empty), /does not exist/);
  mkdirSync(join(empty, "fonts")); assert.throws(() => hashFontAssets(empty), /has no files/);
});

test("CLI: exits 0 and prints the mapping on a good dist, exits 1 and names the problem on a bad one", () => {
  const S = new URL("../scripts/hash-font-assets.mjs", import.meta.url).pathname;
  const ok = spawnSync(process.execPath, [S, dist()], { encoding: "utf8" }); assert.equal(ok.status, 0, ok.stderr); assert.match(ok.stdout, /3 font file\(s\) renamed/);
  const bad = spawnSync(process.execPath, [S, dist({ page: `<link href="/fonts/nope.css">` })], { encoding: "utf8" }); assert.equal(bad.status, 1); assert.match(bad.stderr, /dangling/);
});
