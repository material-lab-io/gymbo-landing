// gy-uu7mt (AC-PIN-1): enumerate the TRAVELLING surfaces of a site from the thing that
// ships, not from the source it was built from. Works on a live origin
// (`--origin https://getgymbo.com`) or a built directory (`--root dist`), so the same
// inventory can be taken of both and compared.
//
// A "surface" is a place copy travels that a human reading the page does not necessarily
// see: <title>, every <meta content>, every JSON-LD string (by path), accessibility text,
// plus the visible text of a page and the served text endpoints. The inventory is a list
// of `route|surface` keys. The pin gate (check-pinned-strings.mjs) uses it to prove that
// every such surface is either pinned to a ruled string or knowingly not pinned.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pageSurfaces } from "./check-no-em-dash.mjs";

export const TEXT_ENDPOINTS = ["llms.txt", "pricing.md", "robots.txt", "sitemap.xml"];
const UA = "Mozilla/5.0 (X11; Linux x86_64) gymbo-landing-surface-crawl";

// A JSON-LD path like $.mainEntity[3].acceptedAnswer.text is a surface per SHAPE, not per
// index: adding a fifth FAQ must not look like a brand new surface class, but the value
// is still checked. Indices are normalised to [] for the surface KEY only.
export function surfaceKey(route, surface) {
  return `${route}|${surface.replace(/\[\d+\]/g, "[]")}`;
}

export function routeOf(url, origin) {
  const u = new URL(url, origin);
  if (u.origin !== new URL(origin).origin) return null;
  let p = u.pathname;
  if (!p.endsWith("/") && !/\.[a-z0-9]+$/i.test(p)) p += "/";
  return p;
}

export function internalLinks(html, route, origin) {
  const found = new Set();
  for (const m of html.matchAll(/<a\b[^>]*\shref="([^"#?]*)[^"]*"/gi)) {
    const href = m[1];
    if (!href || /^(mailto:|tel:|javascript:|https?:\/\/(?!getgymbo\.com))/i.test(href)) continue;
    const r = routeOf(href, new URL(route, origin).href);
    if (r && !/\.(png|jpe?g|webp|svg|ico|css|js|woff2?|mp4|pdf)$/i.test(r)) found.add(r);
  }
  return found;
}

export function inventoryOfHtml(html, route) {
  return pageSurfaces(html, route).map(({ surface, value }) => ({ key: surfaceKey(route, surface), surface, chars: String(value).length }));
}

export async function fetchLive(origin, route) {
  const res = await fetch(new URL(route, origin), { headers: { "user-agent": UA, "cache-control": "no-cache" }, redirect: "follow" });
  return { status: res.status, type: res.headers.get("content-type") || "", body: await res.text() };
}

function readBuilt(root, route) {
  const file = route.endsWith("/") ? join(root, route, "index.html") : join(root, route);
  return existsSync(file) && statSync(file).isFile() ? { status: 200, type: file.endsWith(".html") ? "text/html" : "text/plain", body: readFileSync(file, "utf8") } : { status: 404, type: "", body: "" };
}

export async function crawl({ origin, root, seeds = ["/"] }) {
  const get = origin ? (r) => fetchLive(origin, r) : async (r) => readBuilt(root, r);
  const base = origin || "https://getgymbo.com";
  const queue = [...seeds];
  const seen = new Set();
  const routes = [];
  const endpoints = [];
  const surfaces = [];
  const sitemapRoutes = new Set();

  for (const name of TEXT_ENDPOINTS) {
    const r = await get(`/${name}`);
    if (r.status !== 200) { endpoints.push({ route: `/${name}`, status: r.status }); continue; }
    endpoints.push({ route: `/${name}`, status: 200, chars: r.body.length });
    surfaces.push({ key: `/${name}|served text`, surface: "served text", chars: r.body.length });
    if (name === "sitemap.xml") for (const m of r.body.matchAll(/<loc>([^<]+)<\/loc>/g)) { const rt = routeOf(m[1], base); if (rt) sitemapRoutes.add(rt); }
  }
  for (const r of sitemapRoutes) queue.push(r);

  while (queue.length) {
    const route = queue.shift();
    if (seen.has(route)) continue;
    seen.add(route);
    const r = await get(route);
    if (r.status !== 200 || !/html/i.test(r.type) && !r.body.includes("<html")) { routes.push({ route, status: r.status, html: false }); continue; }
    routes.push({ route, status: 200, html: true, viaSitemap: sitemapRoutes.has(route) });
    surfaces.push(...inventoryOfHtml(r.body, route));
    for (const next of internalLinks(r.body, route, base)) if (!seen.has(next)) queue.push(next);
  }
  return { source: origin ? { origin } : { root }, routes, endpoints, sitemapRoutes: [...sitemapRoutes].sort(), surfaces };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
  const inv = await crawl({ origin: opt("--origin"), root: opt("--root") });
  const byType = {};
  for (const s of inv.surfaces) { const t = s.surface.replace(/ .*/, "").replace(/\$.*/, "JSON-LD"); byType[t] = (byType[t] || 0) + 1; }
  const keys = new Set(inv.surfaces.map((s) => s.key));
  console.log(JSON.stringify({ source: inv.source, routes: inv.routes.length, htmlRoutes: inv.routes.filter((r) => r.html).length, nonHtml: inv.routes.filter((r) => !r.html), notInSitemap: inv.routes.filter((r) => r.html && !r.viaSitemap).map((r) => r.route), endpoints: inv.endpoints, distinctSurfaceKeys: keys.size, byType }, null, 2));
  if (opt("--out")) (await import("node:fs")).writeFileSync(opt("--out"), JSON.stringify({ ...inv, keys: [...keys].sort() }, null, 1));
}
