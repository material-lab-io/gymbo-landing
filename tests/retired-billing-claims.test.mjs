// gy-76z5i / gy-1vd9qy.10.4: the retired-claim gate (no trial, no App Store billing) must go RED on every planted old claim, on every surface
// it reads, and stay green on the new copy. These are the planted-old-price controls the ruling asked for.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PLANTED, RETIRED, scanText, selfTest } from "../scripts/check-retired-billing-claims.mjs";

const SCRIPT = new URL("../scripts/check-retired-billing-claims.mjs", import.meta.url).pathname;
const scratch = mkdtempSync(join(tmpdir(), "gymbo-retired-claims-"));
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));
let serial = 0;

const CLEAN = "Start free. Upgrade when you are ready. Pro is Rs 399 a month, paid on the web with Razorpay. iPhone app coming soon.";
const page = (body, head = "") => `<!doctype html><html><head><title>Gymbo</title>${head}</head><body>${body}</body></html>`;
function fixture(home, { llms = CLEAN, pricing = CLEAN } = {}) {
  const root = join(scratch, `case-${++serial}`);
  mkdirSync(join(root, "auth", "callback"), { recursive: true });
  writeFileSync(root + "/sitemap.xml", '<?xml version="1.0"?><urlset><url><loc>https://getgymbo.com/</loc></url></urlset>');
  writeFileSync(root + "/index.html", home);
  writeFileSync(join(root, "auth", "callback", "index.html"), page("<p>Opening Gymbo.</p>"));
  writeFileSync(root + "/404.html", page("<p>Page not found</p>"));
  writeFileSync(root + "/llms.txt", llms);
  writeFileSync(root + "/pricing.md", pricing);
  return root;
}
const run = (root) => spawnSync(process.execPath, [SCRIPT, "--root", root], { encoding: "utf8" });

test("POSITIVE CONTROL: the new option A copy passes, and the pages were actually read", () => {
  const r = run(fixture(page(`<p>${CLEAN}</p>`)));
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.match(r.stdout, /across 3 built page\(s\) plus llms\.txt and pricing\.md/);
});

test("the gate's own self-test sees all retired claims and no false finding", () => {
  const t = selfTest();
  assert.deepEqual(t, { missed: [], cleanFindings: [] });
  assert.equal(Object.keys(PLANTED).length, RETIRED.length, "every retired claim has a planted control");
});

for (const [id, planted] of Object.entries(PLANTED)) {
  test(`NEGATIVE CONTROL ${id}: "${planted}" planted in the page body goes red`, () => {
    const r = run(fixture(page(`<p>${CLEAN} ${planted}</p>`)));
    assert.equal(r.status, 1, r.stdout);
    assert.match(r.stderr, new RegExp(`\\[${id}\\] / `));
  });
  test(`NEGATIVE CONTROL ${id}: planted in llms.txt, pricing.md, page metadata and JSON-LD goes red`, () => {
    assert.equal(run(fixture(page(`<p>${CLEAN}</p>`), { llms: `${CLEAN}\n- ${planted}` })).status, 1, "llms.txt");
    assert.equal(run(fixture(page(`<p>${CLEAN}</p>`), { pricing: `${CLEAN}\n\n${planted}` })).status, 1, "pricing.md");
    assert.equal(run(fixture(page(`<p>${CLEAN}</p>`, `<meta name="description" content="${planted}" />`))).status, 1, "meta description");
    const ld = `<script type="application/ld+json">${JSON.stringify({ "@type": "FAQPage", mainEntity: [{ "@type": "Question", name: "Q?", acceptedAnswer: { "@type": "Answer", text: planted } }] })}</script>`;
    assert.equal(run(fixture(page(`<p>${CLEAN}</p>${ld}`))).status, 1, "JSON-LD");
  });
}

test("a dash variant or an upper-case spelling of the 7-day trial is still caught", () => {
  for (const v of ["Try Gymbo with a 7–day free trial.", "TRY IT FREE. SEVEN-DAY TRIAL.", "Your 7 day trial starts now."]) {
    assert.ok(scanText(v, "/", "x").some((f) => f.id === "trial-7-day" || f.id === "trial-ends"), v);
  }
});

test("a competitor's own free trial is not Gymbo's claim: '14 days, no card' passes", () => {
  assert.deepEqual(scanText("| Free trial | Free plan, no trial needed | 14 days, no card |", "/", "x"), []);
});

test("the legal pages may describe iPhone App Store billing and an introductory offer, but never the web trial, trial-end wording, iPhone-only or private alpha", () => {
  const apple = "On iPhone, the App Store takes the payment and handles billing under Apple's terms, including any introductory offer Apple shows you.";
  assert.deepEqual(scanText(apple, "/terms/", "x"), []);
  assert.deepEqual(scanText(apple, "/privacy/", "x"), []);
  assert.ok(scanText(apple, "/", "x").length > 0, "the same sentence on the home page is still red");
  for (const [id, planted] of Object.entries(PLANTED)) {
    if (["introductory-offer", "app-store-billing"].includes(id)) continue;
    assert.ok(scanText(planted, "/terms/", "x").some((f) => f.id === id), `${id} on /terms/`);
  }
});
