// gy-4rlx9l: what Search Console flagged must stay fixed. The middleware is called as Pages calls it; the files are read as shipped.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { onRequest } from "../functions/_middleware.js";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const NEXT = () => new Response("page", { status: 200, headers: { "content-type": "text/html" } });
const call = (url, method = "GET", next = NEXT) => onRequest({ request: new Request(url, { method }), next: async () => next() });

test("www answers 301 to the apex with the same path and query", async () => {
  for (const [from, to] of [
    ["https://www.getgymbo.com/", "https://getgymbo.com/"],
    ["http://www.getgymbo.com/guide/take-payments-upi-personal-trainer/", "https://getgymbo.com/guide/take-payments-upi-personal-trainer/"],
    ["https://www.getgymbo.com/compare/gymbo-vs-wellnessz/?utm_source=x&a=1%202", "https://getgymbo.com/compare/gymbo-vs-wellnessz/?utm_source=x&a=1%202"],
    ["https://www.getgymbo.com/404", "https://getgymbo.com/404"],
  ]) {
    for (const method of ["GET", "HEAD"]) {
      const r = await call(from, method);
      assert.equal(r.status, 301, from);
      assert.equal(r.headers.get("location"), to);
    }
  }
  assert.equal((await call("https://www.getgymbo.com/api/waitlist", "POST")).status, 308, "a POST keeps its method and body");
});

test("CONTROL: the apex, a preview host and a lookalike host pass through", async () => {
  for (const url of ["https://getgymbo.com/", "https://getgymbo.com/pricing.md", "https://abc.gymbo-landing.pages.dev/", "https://app.getgymbo.com/", "https://www.getgymbo.com.example.org/"]) {
    const r = await call(url);
    assert.equal(r.status, 200, url);
    assert.equal(r.headers.get("location"), null, url);
    assert.equal(r.headers.get("x-robots-tag"), null, url);
  }
});

test("/404 answers status 404 with noindex and the same page; a redirect from it is left alone", async () => {
  const r = await call("https://getgymbo.com/404");
  assert.equal(r.status, 404);
  assert.equal(r.headers.get("x-robots-tag"), "noindex");
  assert.equal(r.headers.get("content-type"), "text/html");
  assert.equal(await r.text(), "page");
  const moved = await call("https://getgymbo.com/404", "GET", () => new Response(null, { status: 308, headers: { Location: "/x" } }));
  assert.equal(moved.status, 308);
});

const headerBlock = (file, path) => file.split(/\n(?=\S)/).find((b) => b.split("\n")[0].trim() === path) ?? "";
test("the text copies of page content are noindex, and nothing is noindex site-wide", () => {
  const h = read("public/_headers");
  for (const p of ["/pricing.md", "/llms.txt"]) assert.match(headerBlock(h, p), /^\s+X-Robots-Tag: noindex$/m, p);
  assert.doesNotMatch(headerBlock(h, "/robots.txt"), /X-Robots-Tag/, "control: the block reader does not leak into a neighbour");
  assert.doesNotMatch(headerBlock(h, "/*"), /X-Robots-Tag/);
});

test("the function is invoked for pages and the two text files", () => {
  const r = JSON.parse(read("public/_routes.json"));
  assert.deepEqual(r.include, ["/*"]);
  for (const path of ["/", "/404", "/pricing.md", "/llms.txt", "/w/abc", "/api/waitlist", "/guide/x/"])
    assert.ok(!r.exclude.some((e) => (e.endsWith("*") ? path.startsWith(e.slice(0, -1)) : path === e)), `${path} must not be excluded`);
});

// Internal links to a page of ours carry the trailing slash, or every click and crawl costs a 308.
const LINKED = ["/alternatives/akton/", "/guide/brand-personal-training-business-india/", "/compare/gymbo-vs-wellnessz/", "/alternatives/trainerize/", "/alternatives/truecoach/", "/privacy/", "/terms/", "/guide/", "/blog/"];
const sources = (dir) => readdirSync(join(ROOT, dir)).flatMap((n) => {
  const p = `${dir}/${n}`;
  return statSync(join(ROOT, p)).isDirectory() ? sources(p) : /\.(tsx?|html|md|txt)$/.test(n) ? [p] : [];
});
// A link is an href, a Markdown link target, or a full getgymbo.com URL. A bare path in prose or in a comment is not a link.
export const slashless = (text, pages) => pages.filter((u) => {
  const bare = u.slice(0, -1).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:href\\s*[=:]\\s*\\{?["'\`]|\\]\\(|https://getgymbo\\.com)${bare}(?=["'\`)#?\\s<]|$)`, "m").test(text);
});

test("no source links to one of our pages without its trailing slash", () => {
  const files = [...sources("src"), ...sources("public")];
  assert.ok(files.length > 20, "the sources were read");
  assert.deepEqual(files.flatMap((f) => slashless(read(f), LINKED).map((u) => `${f}: ${u}`)), []);
});

test("CONTROL: each link shape without the slash is caught, with the slash is not", () => {
  for (const u of LINKED) {
    const bare = u.slice(0, -1);
    for (const shape of [`<a href="${bare}">x</a>`, `[x](${bare})`, `{ href: "${bare}" }`, `see https://getgymbo.com${bare} now`])
      assert.deepEqual(slashless(shape, [u]), [u], shape);
    assert.deepEqual(slashless(`<a href="${u}">x</a> [y](${u}) https://getgymbo.com${u} the ${bare} page`, [u]), [], u);
  }
});
