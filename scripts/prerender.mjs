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
let ok = 0;
for (const r of ROUTES) {
  const file = resolve(root, "dist", r.entry);
  const tpl = readFileSync(file, "utf8");
  if (!tpl.includes(MARKER)) {
    throw new Error(`prerender: marker '${MARKER}' not found in dist/${r.entry}`);
  }
  const body = render(r.key);
  writeFileSync(file, tpl.replace(MARKER, `<div id="root">${body}</div>`));
  console.log(`  prerendered ${r.url.padEnd(34)} → dist/${r.entry}  (${(body.length / 1024).toFixed(1)} kB body)`);
  ok++;
}

// SSR bundle is a throwaway — don't ship it.
rmSync(resolve(root, "dist-ssr"), { recursive: true, force: true });
console.log(`SSG: ${ok}/${ROUTES.length} routes prerendered.`);
