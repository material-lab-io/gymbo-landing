import { renderToString } from "react-dom/server";
import App from "./App";
import { CompareWellnessZ } from "./pages/CompareWellnessZ";
import { Privacy } from "./pages/Privacy";
import { Terms } from "./pages/Terms";
import { Blog } from "./pages/Blog";
import { GuideIndex } from "./pages/GuideIndex";
import { ArticlePage } from "./pages/ArticlePage";
import { POSTS } from "./content/blog/posts";
import { ALTERNATIVES } from "./content/alternatives/pages";
import { PILLARS, relatedForPillar, pillarLinks } from "./content/guide/pillars";
import { ROUTES } from "./routes";

// The live cornerstone blog post links out to the /guide/ pillar cluster.
const CORNERSTONE_SLUG = "how-india-independent-trainers-run-their-business";

// Map each route key to its page element. Adding a route = add it to ROUTES
// (src/routes.ts) and register its element here. Blog posts register
// generically from POSTS (key `blog-<slug>`).
const ELEMENTS: Record<string, React.ReactElement> = {
  main: <App />,
  compareWellnessz: <CompareWellnessZ />,
  privacy: <Privacy />,
  terms: <Terms />,
  blog: <Blog />,
  guide: <GuideIndex />,
};
for (const p of POSTS) {
  ELEMENTS[`blog-${p.slug}`] = <ArticlePage post={p} related={p.slug === CORNERSTONE_SLUG ? pillarLinks() : undefined} />;
}
for (const p of ALTERNATIVES) {
  ELEMENTS[`alt-${p.slug}`] = <ArticlePage post={p} back={{ href: "/", label: "← gymbo" }} showDate={false} />;
}
for (const p of PILLARS) {
  ELEMENTS[`guide-${p.slug}`] = <ArticlePage post={p} back={{ href: "/guide/", label: "← all guides" }} showDate={false} related={relatedForPillar(p.slug)} />;
}

export { ROUTES };

/** Prerender a route's body to a hydratable HTML string (scripts/prerender.mjs). */
export function render(key: string): string {
  const el = ELEMENTS[key];
  if (!el) throw new Error(`entry-server: no element registered for route "${key}"`);
  return renderToString(el);
}
