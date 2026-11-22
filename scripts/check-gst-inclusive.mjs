// gy-aqayff: every Gymbo price a visitor, crawler or share preview can read says it includes GST (Kaushik 22 Nov 10:57Z: Rs 399/mo and Rs 2,999/yr are
// GST-inclusive; compliance's words on gy-2ymb5y). Runs on BUILT dist (what ships): every html page, JSON-LD string, meta content and served text line.
//
// RULE: a Gymbo price (399, 2,999, 250, with a rupee sign, Rs or INR) must have "incl. GST" / "including GST" / "include(s) GST" / "inclusive of GST" in the SAME block of
// copy, or, for visible blocks and served lines only, in the block that directly follows it (the pricing card shows the figure in one block and its note in the next).
// NAMED LIMITS, not hidden: (1) a bare price followed by a GST sentence passes: the gate checks that the words are there, not that they sit next to this number;
// (2) competitor prices are not Gymbo's: only 399, 2,999 and 250 are matched, so a future Gymbo plan at another amount needs its number added to PRICES;
// (3) blog posts are out of scope by pm ruling 22 Nov (BLOG_OUT); (4) the exemptions below are the ONLY other bare prices allowed, each with its reason.
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { collectBlocks, walk } from "./copy-change-detector.mjs";

export const PRICES = ["399", "2,999", "2999", "250"];
export const PRICE_RE = new RegExp(`(?:₹|\\bRs\\.?\\s?|\\bINR\\s?)\\s?(?:${PRICES.map((p) => p.replace(",", ",?")).join("|")})(?![\\d,])`, "i");
export const GST_RE = /\b(?:incl\.?|including|includes?|inclusive of)\s+GST\b/i;
export const BLOG_OUT = "/blog/";
// Allowed bare prices, each named. A new entry needs a reason a reviewer can disagree with.
export const EXEMPT = [
  { route: "/", surface: /^metadata (?:og:)?description$|^metadata twitter:description$/, reason: "the home meta description is a content-RULED, byte-pinned string (src/canonical, 'Pro from ₹399/mo'): content + compliance rule whether it takes 'incl. GST' (gy-aqayff)" },
];

const exempt = (route, surface) => EXEMPT.some((e) => e.route === route && e.surface.test(surface));
const flowing = (surface) => surface === "visible block" || surface === "served line";

// blocks: [{surface, text}] for ONE route, in page order. Returns the bare-price findings.
export function barePrices(route, blocks) {
  if (route.startsWith(BLOG_OUT)) return { findings: [], priced: 0, covered: 0 };
  const findings = []; let priced = 0, covered = 0;
  blocks.forEach((b, i) => {
    if (!PRICE_RE.test(b.text)) return;
    priced++;
    const next = blocks[i + 1];
    if (GST_RE.test(b.text) || (flowing(b.surface) && next && flowing(next.surface) && GST_RE.test(next.text))) { covered++; return; }
    if (exempt(route, b.surface)) return;
    findings.push({ route, surface: b.surface, text: b.text.slice(0, 200) });
  });
  return { findings, priced, covered };
}

export function scan(root) {
  if (!existsSync(root)) throw new Error(`${root} does not exist; cannot check prices on a build that is not there`);
  const files = walk(root);
  const { surfaces } = collectBlocks((p) => readFileSync(join(root, p), "utf8"), files);
  const findings = []; let routes = 0, priced = 0, covered = 0;
  for (const [route, blocks] of surfaces) {
    routes++;
    const r = barePrices(route, blocks);
    findings.push(...r.findings); priced += r.priced; covered += r.covered;
  }
  return { findings, routes, priced, covered };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const root = resolve(args.includes("--root") ? args[args.indexOf("--root") + 1] : "dist");
  let res;
  try { res = scan(root); } catch (e) { console.error(`check-gst-inclusive: ${e.message}`); process.exit(2); }
  if (res.routes === 0 || res.covered === 0) {
    console.error(`check-gst-inclusive: scanned ${res.routes} route(s) and saw ${res.covered} price(s) with GST words: the scanner is blind (or the price copy is gone), refusing a vacuous pass`);
    process.exit(1);
  }
  if (res.findings.length) {
    console.error(`check-gst-inclusive: ${res.findings.length} gst-bare-price finding(s): a Gymbo price with no "incl. GST" in its block (${res.priced} prices seen, ${res.covered} covered)`);
    for (const f of res.findings) console.error(`  gst-bare-price ${f.route} [${f.surface}]: ${f.text}`);
    process.exit(1);
  }
  console.log(`check-gst-inclusive: ${res.priced} Gymbo price(s) across ${res.routes} route(s), all ${res.covered} say they include GST (blog out of scope; ${EXEMPT.length} named exemption)`);
}
