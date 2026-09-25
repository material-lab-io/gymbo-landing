import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanHtml } from "../scripts/check-no-em-dash.mjs";

const SCRIPT = new URL("../scripts/check-no-em-dash.mjs", import.meta.url).pathname;
const scratch = mkdtempSync(join(tmpdir(), "gymbo-copy-output-"));
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));
let serial = 0;

function fixture(home) {
  const root = join(scratch, `case-${++serial}`);
  mkdirSync(join(root, "auth", "callback"), { recursive: true });
  writeFileSync(root + "/sitemap.xml", '<?xml version="1.0"?><urlset><url><loc>https://getgymbo.com/</loc></url></urlset>');
  writeFileSync(root + "/index.html", home);
  writeFileSync(join(root, "auth", "callback", "index.html"), "<!doctype html><html><head><title>Opening Gymbo</title></head><body><p>Opening Gymbo.</p></body></html>");
  writeFileSync(root + "/404.html", "<!doctype html><html><head><title>404 | Gymbo</title></head><body><p>Page not found</p></body></html>");
  return root;
}

function run(root) {
  return spawnSync(process.execPath, [SCRIPT, "--root", root], { encoding: "utf8" });
}

test("NEGATIVE CONTROL — em dashes in HTML, CSS and script comments stay inert", () => {
  const root = fixture(`<!doctype html><html><head>
    <title>Gymbo</title>
    <!-- metadata note — inert -->
    <style>/* CSS note — inert */</style>
  </head><body>
    <!-- body note — inert -->
    <p>Visible copy is clean.</p>
    <script>// script note — inert</script>
  </body></html>`);
  const result = run(root);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /OK: no user-facing em dashes/);
});

test("POSITIVE CONTROL — a visible paragraph makes the built-output gate fail", () => {
  const root = fixture("<!doctype html><html><head><title>Gymbo</title></head><body><p>Visible — regression</p></body></html>");
  const result = run(root);
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /\[visible text\].*Visible — regression/);
});

test("POSITIVE CONTROL — an Open Graph title makes the built-output gate fail", () => {
  const root = fixture('<!doctype html><html><head><title>Gymbo</title><meta property="og:title" content="Gymbo — regression"></head><body><p>Clean.</p></body></html>');
  const result = run(root);
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /\[metadata og:title\].*Gymbo — regression/);
});

test("JSON-LD strings and accessibility text are inspected, while internal attributes are not", () => {
  const html = `<!doctype html><html data-internal="ignore — this"><head><title>Gymbo</title>
    <script type="application/ld+json">{"description":"Schema — regression"}</script>
  </head><body><img data-note="ignore — this too" alt="Image — regression"></body></html>`;
  const findings = scanHtml(html, "/control/");
  assert.deepEqual(findings.map(({ surface }) => surface), ["JSON-LD $.description", "accessibility alt"]);
});
