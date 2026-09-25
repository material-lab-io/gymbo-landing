// gy-uu7mt: does the DEPLOYED site equal the lock? Crawls a live origin (sitemap + internal
// links + every text endpoint the lock pins), masks Cloudflare's e-mail rewrite on both
// sides, and reports drift in either direction. Meant for a scheduled NON-required run
// (like gy-1je63): it reads production, so it must never block a merge, but it is the only
// check that enumerates from what actually shipped rather than from what dist/ says.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { copyBlocks, servedTextBlocks } from "./copy-blocks.mjs";
import { diffAgainstLock, maskEmails, maskVolatile, routeOfFile, BASELINE_FILE } from "./copy-change-detector.mjs";
import { fetchLive, internalLinks, routeOf } from "./crawl-surfaces.mjs";

export async function liveSurfaces(origin, lock) {
  const surfaces = new Map();
  const unreachable = [];
  const textRoutes = Object.keys(lock.routes).filter((r) => !r.endsWith("/") && r !== "/404.html" && !r.endsWith(".html"));
  const queue = ["/", "/auth/callback/", ...(await (async () => { const s = await fetchLive(origin, "/sitemap.xml"); return [...(s.body || "").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => routeOf(m[1], origin)).filter(Boolean); })())];
  const seen = new Set();
  while (queue.length) {
    const route = queue.shift();
    if (seen.has(route)) continue; seen.add(route);
    const r = await fetchLive(origin, route);
    if (r.status !== 200 || !r.body.includes("<html")) { unreachable.push(`${route} (HTTP ${r.status})`); continue; }
    surfaces.set(route, copyBlocks(r.body, route));
    for (const next of internalLinks(r.body, route, origin)) if (!seen.has(next)) queue.push(next);
  }
  // The 404 fallback is only served for a path that does not exist, so ask for one.
  if (lock.routes["/404.html"]) {
    const r = await fetchLive(origin, `/__copy-change-detector-probe-${Date.now()}/`);
    if (r.status === 404 && r.body.includes("<html")) surfaces.set("/404.html", copyBlocks(r.body, "/404.html"));
    else unreachable.push(`/404.html fallback (probe returned HTTP ${r.status})`);
  }
  for (const route of textRoutes) {
    const r = await fetchLive(origin, route);
    if (r.status !== 200) { unreachable.push(`${route} (HTTP ${r.status})`); continue; }
    surfaces.set(route, servedTextBlocks(r.body));
  }
  return { surfaces, unreachable };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
    const origin = opt("--origin", "https://getgymbo.com");
    const lock = JSON.parse(readFileSync(opt("--baseline", BASELINE_FILE), "utf8"));
    const { surfaces, unreachable } = await liveSurfaces(origin, lock);
    if (!surfaces.size) throw new Error(`nothing reachable at ${origin}; refusing a vacuous pass`);
    const notCrawled = Object.keys(lock.routes).filter((r) => !surfaces.has(r));
    // A route the crawl could not reach is UNDETERMINED, not equal: report it, do not diff it.
    const comparable = { ...lock, routes: Object.fromEntries(Object.entries(lock.routes).filter(([r]) => surfaces.has(r))) };
    const findings = diffAgainstLock(surfaces, comparable, { mask: (s) => maskVolatile(maskEmails(s)) });
    console.log(`live parity ${origin}: crawled ${surfaces.size} route/file(s); lock pins ${Object.keys(lock.routes).length}; UNDETERMINED (not reachable by crawl, not compared): ${notCrawled.length ? notCrawled.join(", ") : "none"}${unreachable.length ? `; unreachable during crawl: ${unreachable.join(", ")}` : ""}`);
    if (findings.length) { for (const f of findings.slice(0, 40)) console.error(`  ${f.kind} ${f.route}${f.surface ? ` [${f.surface}]` : ""}${f.text ? `: ${f.text.slice(0, 140)}` : ""}${f.detail ? ` (${f.detail})` : ""}`); console.error(`FAIL: the deployed site differs from the lock in ${findings.length} place(s)`); process.exitCode = 1; }
    else console.log("OK: every crawled block of the deployed site equals the lock (e-mail addresses masked on both sides).");
  } catch (e) { console.error(`COULD NOT EVALUATE live parity: ${e.message}`); process.exitCode = 2; }
}
