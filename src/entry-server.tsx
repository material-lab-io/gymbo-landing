import { renderToString } from "react-dom/server";
import App from "./App";
import { CompareWellnessZ } from "./pages/CompareWellnessZ";
import { Privacy } from "./pages/Privacy";
import { Terms } from "./pages/Terms";
import { ROUTES } from "./routes";

// Map each route key to its page element. Adding a route = add it to ROUTES
// (src/routes.ts) and register its element here.
const ELEMENTS: Record<string, React.ReactElement> = {
  main: <App />,
  compareWellnessz: <CompareWellnessZ />,
  privacy: <Privacy />,
  terms: <Terms />,
};

export { ROUTES };

/** Prerender a route's body to a hydratable HTML string (scripts/prerender.mjs). */
export function render(key: string): string {
  const el = ELEMENTS[key];
  if (!el) throw new Error(`entry-server: no element registered for route "${key}"`);
  return renderToString(el);
}
