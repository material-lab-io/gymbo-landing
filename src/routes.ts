// Single source of truth for every routed HTML page. Consumed by:
//  - vite.config.ts  → rollup multi-page inputs + generated sitemap.xml
//  - src/entry-server.tsx → which component to prerender per route
//  - scripts/prerender.mjs → which built HTML file to inject prerendered markup into
// Add a route here (+ its element in entry-server + its <route>/index.html +
// *-main.tsx) and it builds, prerenders, and lands in the sitemap automatically.
export interface RouteDef {
  /** rollup input key + entry-server element key */
  key: string;
  /** HTML template path relative to repo root (also the dist output path) */
  entry: string;
  /** canonical URL path (trailing slash — matches Cloudflare's 308 target) */
  url: string;
  priority: string;
  changefreq: string;
}

export const ROUTES: RouteDef[] = [
  { key: "main", entry: "index.html", url: "/", priority: "1.0", changefreq: "weekly" },
  { key: "compareWellnessz", entry: "compare/gymbo-vs-wellnessz/index.html", url: "/compare/gymbo-vs-wellnessz/", priority: "0.8", changefreq: "monthly" },
];
