// Post-build SSG: inject each route's prerendered body into its built HTML
// template, so page bodies (not just <head>) are in the initial document for
// crawlers / AI. Runs after `vite build` + `vite build --ssr`. The client
// entries hydrate this markup (hydrateRoot). Generalised over src/routes.ts —
// new routes prerender automatically.
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const ssrEntry = pathToFileURL(resolve(root, "dist-ssr/entry-server.js")).href;
const { render, ROUTES } = await import(ssrEntry);

const MARKER = '<div id="root"></div>';

// A page renders at most one <footer>. Wrap it; a page without one is left as is.
function emailOffFooter(html) {
  const open = html.indexOf("<footer");
  const close = html.lastIndexOf("</footer>");
  if (open === -1 || close === -1) return html;
  const end = close + "</footer>".length;
  return html.slice(0, open) + "<!--email_off-->" + html.slice(open, end) + "<!--/email_off-->" + html.slice(end);
}
let ok = 0;
for (const r of ROUTES) {
  const file = resolve(root, "dist", r.entry);
  const tpl = readFileSync(file, "utf8");
  if (!tpl.includes(MARKER)) {
    throw new Error(`prerender: marker '${MARKER}' not found in dist/${r.entry}`);
  }
  // App Review 1.5: exempt the footer (the support contact) from Cloudflare's
  // zone-wide email obfuscation, which rewrites addresses to "[email protected]"
  // for any reader without JavaScript. email_off is Cloudflare's documented
  // per-block opt-out. React's hydration skips plain comment nodes.
  const body = emailOffFooter(render(r.key));
  writeFileSync(file, tpl.replace(MARKER, `<div id="root">${body}</div>`));
  console.log(`  prerendered ${r.url.padEnd(34)} → dist/${r.entry}  (${(body.length / 1024).toFixed(1)} kB body)`);
  ok++;
}

// SSR bundle is a throwaway — don't ship it.
rmSync(resolve(root, "dist-ssr"), { recursive: true, force: true });
console.log(`SSG: ${ok}/${ROUTES.length} routes prerendered.`);
