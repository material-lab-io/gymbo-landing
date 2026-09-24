// gy-454k3: internal comments (bead ids, named people) must not ship, and the strip must never
// damage code or eat the deliberate public text (byline, grievance contact, e-mail directive).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { transformSync } from "esbuild";
import { stripMarkedComments, findMarkedComments, MARKER } from "../scripts/internal-markers.mjs";
import { stripFile } from "../scripts/strip-internal-comments.mjs";
import { scanDist, MUST_SURVIVE } from "../scripts/check-no-internal-comments.mjs";

const parses = (c) => { try { transformSync(c, { loader: "js", logLevel: "silent" }); return true; } catch { return false; } };
const scratch = mkdtempSync(join(tmpdir(), "gymbo-comments-")); process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));

test("POSITIVE CONTROL: the shipped founder-quote comment and a bead id in an inline <style> are removed, the rules around them are not", () => {
  const html = `<html><head><style>.a{color:red}
/* gy-becxi: the inline reveal ... the register Kaushik called "abrupt and jerky" elsewhere. */
.b{animation:x .16s}</style></head><body><p>hi</p></body></html>`;
  const out = stripMarkedComments(html, "html");
  assert.doesNotMatch(out, /abrupt|Kaushik|gy-becxi/);
  assert.match(out, /\.a\{color:red\}/); assert.match(out, /\.b\{animation:x \.16s\}/);
  assert.deepEqual(findMarkedComments(out, "html"), []);
  assert.equal(findMarkedComments(html, "html").length, 1);
});

test("NEGATIVE CONTROL: a comment with NO bead id and NO named person is left alone", () => {
  const css = "/* scroll container is the wrapper, not the table */ .t{overflow-x:auto}";
  assert.equal(stripMarkedComments(css, "css"), css);
  const html = "<p>x</p><!-- plain note -->";
  assert.equal(stripMarkedComments(html, "html"), html);
});

test("SURVIVAL: the public byline, the JSON-LD Person, the grievance contact and the email_off directive are text/directives, not marked comments, and stay", () => {
  const html = `<script type="application/ld+json">{"@type":"Person","name":"Kaushik Naarayan","note":"/* gy-abcde */"}</script>
<footer><!--email_off-->contact Kaushik at <a href="mailto:grievance@getgymbo.com">grievance@getgymbo.com</a><!--/email_off--></footer><p>By Kaushik Naarayan, founder of Gymbo</p>`;
  assert.equal(stripMarkedComments(html, "html"), html, "nothing here is a marked comment; JSON-LD data is never touched even if it contains /* */");
  assert.deepEqual(findMarkedComments(html, "html"), []);
});

test("HTML comments and inline-script line comments are stripped; URLs that merely contain '//' are not", () => {
  const html = `<!-- gy-uesmd: light-only theme --><script>
    // gy-boxu9: bounce into the app deep link
    const u = "https://gy-abcde.example/x"; go(u);
  </script>`;
  const out = stripMarkedComments(html, "html");
  assert.doesNotMatch(out, /gy-uesmd|gy-boxu9/);
  assert.match(out, /https:\/\/gy-abcde\.example\/x/, "a bead-id-looking host in a URL is data, not a comment");
  assert.ok(parses(out.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/go\(u\)/, "0")), "the inline script still parses");
});

test("named people are matched case-insensitively and by word, bead ids by shape", () => {
  for (const s of ["/* Kaushik said */", "/* kaushik said */", "/* Damini asked */", "/* gy-a73px.9 note */", "/* gy-k2543.17 */"]) assert.ok(MARKER.test(s), s);
  for (const s of ["/* Kaushikian */", "/* gymbo gy */", "/* gy-x */"]) assert.ok(!MARKER.test(s), s);
  // DOCUMENTED TRADE-OFF: a comment that merely names a CSS class (gy-focus-ring) has the same shape as a
  // bead id, so it is stripped too. That can only remove a COMMENT; the class USE in markup/CSS is not a
  // comment and is untouched (asserted below). The rule errs toward removing, never toward leaking.
  assert.ok(MARKER.test("/* gy-focus-ring-dark: outline */"));
  const css = "/* gy-focus-ring-dark: outline */.gy-focus-ring-dark:focus-visible{outline:2px solid #fff}";
  assert.equal(stripMarkedComments(css, "css"), ".gy-focus-ring-dark:focus-visible{outline:2px solid #fff}");
});

test("CODE-DAMAGE GUARD: a '/*' inside a string would make a naive strip delete code; the build REFUSES it instead of shipping broken JS", () => {
  const js = 'var a="/*";var b=1;/* gy-abcde note */var c=2;';
  assert.ok(parses(js));
  assert.equal(parses(stripMarkedComments(js, "js")), false, "control: the naive strip really does break this input");
  assert.throws(() => stripFile("bundle.js", js), /BROKE this bundle's syntax/);
});

test("a marked CSS comment INSIDE a JS string (how the founder quote shipped in the bundle) is removed and the bundle still parses", () => {
  const js = 'const css = `.x{a:b}\n/* gy-becxi the register Kaushik called abrupt */\n.y{c:d}`; export default css;';
  const r = stripFile("forge-ui.js", js);
  assert.equal(r.changed, true); assert.doesNotMatch(r.text, /Kaushik|gy-becxi/); assert.ok(parses(r.text)); assert.match(r.text, /\.x\{a:b\}[\s\S]*\.y\{c:d\}/);
});

test("IDEMPOTENT: stripping twice changes nothing", () => {
  const once = stripMarkedComments("<style>/* gy-abcde x */.a{b:c}</style><!-- Kaushik -->", "html");
  assert.equal(stripMarkedComments(once, "html"), once);
});

const files = (map) => ({ read: (p) => map[p] ?? map[p.split("/").slice(-2).join("/")] ?? (() => { throw new Error("nope"); })(), list: Object.keys(map) });
const okSite = { "/d/index.html": "<html>x</html>" };
function scan(map, root = "/d") { const read = (p) => { const rel = p.startsWith(root + "/") ? p.slice(root.length + 1) : p; const k = Object.keys(map).find((f) => f.endsWith(rel)); if (k === undefined) throw new Error("nope"); return map[k]; }; return scanDist(root, read, Object.keys(map)); }

test("THE CHECK FAILS on a leaked marked comment, and on missing public text; passes on a clean site with the public text present", () => {
  const clean = { "/d/index.html": "<html><script type='application/ld+json'>{\"name\":\"Kaushik Naarayan\"}</script>Kaushik Naarayan</html>", "/d/privacy/index.html": "<!--email_off-->grievance@getgymbo.com<!--/email_off-->" };
  const good = scan(clean); assert.deepEqual(good.leaks, []); assert.deepEqual(good.missing, []); assert.equal(good.scanned, 2);
  const leaky = scan({ ...clean, "/d/index.html": clean["/d/index.html"] + "<style>/* gy-becxi x */</style>" }); assert.equal(leaky.leaks.length, 1); assert.equal(leaky.leaks[0].file, "index.html");
  const eaten = scan({ "/d/index.html": "<html>no byline</html>", "/d/privacy/index.html": "<p>nothing</p>" }); assert.equal(eaten.missing.length, MUST_SURVIVE.length);
});

test("CLI: exit 2 on an empty dist (never a vacuous pass), exit 1 on a leak, exit 0 clean", () => {
  const run = (dir) => spawnSync(process.execPath, [new URL("../scripts/check-no-internal-comments.mjs", import.meta.url).pathname, dir], { encoding: "utf8" });
  const empty = join(scratch, "empty"); mkdirSync(empty); assert.equal(run(empty).status, 2);
  const d = join(scratch, "site"); mkdirSync(join(d, "privacy"), { recursive: true });
  writeFileSync(join(d, "index.html"), "<html>Kaushik Naarayan</html>"); writeFileSync(join(d, "privacy", "index.html"), "<!--email_off-->grievance@getgymbo.com<!--/email_off-->");
  assert.equal(run(d).status, 0);
  writeFileSync(join(d, "index.html"), "<html>Kaushik Naarayan<!-- gy-abcde --></html>"); const r = run(d); assert.equal(r.status, 1); assert.match(r.stderr, /LEAK index\.html/);
});

test("INLINE-SCRIPT DAMAGE GUARD: the same '/*'-in-a-string trap inside an inline <script> also aborts the build", () => {
  const html = '<html><script>var a="/*";var b=1;/* gy-abcde note */var c=2;</script></html>';
  assert.throws(() => stripFile("page.html", html), /broke inline <script>/);
  const safe = '<html><script>var a=1; /* gy-abcde note */ var c=2;</script></html>';
  assert.equal(stripFile("page.html", safe).changed, true);
});

test("CLI: the check exits 1 (not just reports) when the deliberate public text has been eaten", () => {
  const d = join(scratch, "eaten"); mkdirSync(join(d, "privacy"), { recursive: true });
  writeFileSync(join(d, "index.html"), "<html>a page with no byline</html>"); writeFileSync(join(d, "privacy", "index.html"), "<p>no contact, no directive</p>");
  const r = spawnSync(process.execPath, [new URL("../scripts/check-no-internal-comments.mjs", import.meta.url).pathname, d], { encoding: "utf8" });
  assert.equal(r.status, 1); assert.match(r.stderr, /MISSING index\.html: "Kaushik Naarayan"/); assert.match(r.stderr, /MISSING privacy\/index\.html: "grievance@getgymbo\.com"/);
});
