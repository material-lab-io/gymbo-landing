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

import { POSTS } from "./content/blog/posts";
import { ALTERNATIVES } from "./content/alternatives/pages";
import { REPORTS } from "./content/research/reports";
import { ALL_GUIDES } from "./content/guide/pillars";

const STATIC_ROUTES: RouteDef[] = [
  { key: "main", entry: "index.html", url: "/", priority: "1.0", changefreq: "weekly" },
  { key: "compareWellnessz", entry: "compare/gymbo-vs-wellnessz/index.html", url: "/compare/gymbo-vs-wellnessz/", priority: "0.8", changefreq: "monthly" },
  { key: "privacy", entry: "privacy/index.html", url: "/privacy/", priority: "0.3", changefreq: "yearly" },
  { key: "terms", entry: "terms/index.html", url: "/terms/", priority: "0.3", changefreq: "yearly" },
  { key: "blog", entry: "blog/index.html", url: "/blog/", priority: "0.6", changefreq: "weekly" },
  { key: "guide", entry: "guide/index.html", url: "/guide/", priority: "0.7", changefreq: "weekly" },
];

// One route per blog post (each needs a matching blog/<slug>/index.html entry).
const POST_ROUTES: RouteDef[] = POSTS.map((p) => ({
  key: `blog-${p.slug}`,
  entry: `blog/${p.slug}/index.html`,
  url: `/blog/${p.slug}/`,
  priority: "0.7",
  changefreq: "monthly",
}));

// One route per /alternatives/<slug> comparison page.
const ALT_ROUTES: RouteDef[] = ALTERNATIVES.map((p) => ({
  key: `alt-${p.slug}`,
  entry: `alternatives/${p.slug}/index.html`,
  url: `/alternatives/${p.slug}/`,
  priority: "0.7",
  changefreq: "monthly",
}));

// One route per /guide/<slug> AEO how-to pillar (each needs a matching
// guide/<slug>/index.html carrying its FAQPage + HowTo JSON-LD).
const GUIDE_ROUTES: RouteDef[] = ALL_GUIDES.map((p) => ({
  key: `guide-${p.slug}`,
  entry: `guide/${p.slug}/index.html`,
  url: `/guide/${p.slug}/`,
  priority: "0.8",
  changefreq: "monthly",
}));

// One route per /research/<slug> original data report (each needs a matching
// research/<slug>/index.html carrying its Article + FAQPage JSON-LD).
const RESEARCH_ROUTES: RouteDef[] = REPORTS.map((p) => ({
  key: `research-${p.slug}`,
  entry: `research/${p.slug}/index.html`,
  url: `/research/${p.slug}/`,
  priority: "0.8",
  changefreq: "monthly",
}));

export const ROUTES: RouteDef[] = [...STATIC_ROUTES, ...POST_ROUTES, ...ALT_ROUTES, ...GUIDE_ROUTES, ...RESEARCH_ROUTES];
