// gy-322bc.1: fail when the BUILT public site exposes an em dash to a visitor
// or crawler. Source grep is intentionally insufficient: comments are inert,
// while prerendered React text, metadata and JSON-LD exist only in dist/.
import { existsSync, readFileSync } from "node:fs";
import { resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const DASH_ENTITY = /&(?:mdash|#0*8212|#x0*2014);?/gi;
const ACCESSIBLE_ATTRIBUTES = new Set([
  "alt",
  "aria-description",
  "aria-label",
  "aria-roledescription",
  "aria-valuetext",
  "placeholder",
  "title",
]);

function decodeDash(value) {
  return String(value).replace(DASH_ENTITY, "—");
}

function snippet(value) {
  const clean = decodeDash(value).replace(/\s+/g, " ").trim();
  const at = clean.indexOf("—");
  const start = Math.max(0, at - 55);
  const end = Math.min(clean.length, at + 56);
  return `${start ? "…" : ""}${clean.slice(start, end)}${end < clean.length ? "…" : ""}`;
}

function attributes(tag) {
  const body = tag
    .replace(/^<\s*[\w:-]+/, "")
    .replace(/\/?\s*>$/, "");
  const found = new Map();
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of body.matchAll(pattern)) {
    found.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? "");
  }
  return found;
}

function withoutComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, "");
}

function withoutInertSource(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "")
    .replace(/<template\b[^>]*>[\s\S]*?<\/template\s*>/gi, "");
}

function addFinding(findings, route, surface, value) {
  if (decodeDash(value).includes("—")) {
    findings.push({ route, surface, snippet: snippet(value) });
  }
}

function jsonStrings(value, path = "$", rows = []) {
  if (typeof value === "string") rows.push([path, value]);
  else if (Array.isArray(value)) value.forEach((entry, index) => jsonStrings(entry, `${path}[${index}]`, rows));
  else if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) jsonStrings(entry, `${path}.${key}`, rows);
  }
  return rows;
}

export function scanHtml(html, route = "unknown") {
  const findings = [];
  const uncommented = withoutComments(html);

  for (const match of uncommented.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/gi)) {
    addFinding(findings, route, "document title", match[1]);
  }

  for (const match of uncommented.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    if (!attrs.has("content")) continue;
    const label = attrs.get("property") || attrs.get("name") || attrs.get("itemprop") || "unnamed";
    addFinding(findings, route, `metadata ${label}`, attrs.get("content"));
  }

  for (const match of uncommented.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    const attrs = attributes(`<script ${match[1]}>`);
    if ((attrs.get("type") || "").toLowerCase() !== "application/ld+json") continue;
    let data;
    try {
      data = JSON.parse(match[2]);
    } catch (error) {
      throw new Error(`${route}: could not parse JSON-LD: ${error.message}`);
    }
    for (const [path, value] of jsonStrings(data)) addFinding(findings, route, `JSON-LD ${path}`, value);
  }

  const renderedMarkup = withoutInertSource(uncommented);
  for (const match of renderedMarkup.matchAll(/<[a-z][^>]*>/gi)) {
    const attrs = attributes(match[0]);
    for (const [name, value] of attrs) {
      if (ACCESSIBLE_ATTRIBUTES.has(name)) addFinding(findings, route, `accessibility ${name}`, value);
    }
  }

  const body = renderedMarkup.match(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i)?.[1] ?? renderedMarkup;
  const visibleText = body.replace(/<[^>]+>/g, " ");
  addFinding(findings, route, "visible text", visibleText);
  return findings;
}

function routeFile(root, pathname) {
  const decoded = decodeURIComponent(pathname);
  const relativePath = decoded === "/"
    ? "index.html"
    : decoded.endsWith("/")
      ? `${decoded.slice(1)}index.html`
      : decoded.slice(1);
  const file = resolve(root, relativePath);
  const rel = relative(resolve(root), file);
  if (rel.startsWith(`..${sep}`) || rel === "..") throw new Error(`route escapes build root: ${pathname}`);
  return file;
}

export function discoverBuiltPages(root = "dist") {
  const buildRoot = resolve(root);
  const sitemapPath = resolve(buildRoot, "sitemap.xml");
  if (!existsSync(sitemapPath)) throw new Error(`${sitemapPath} is missing; run the build before this gate`);
  const sitemap = readFileSync(sitemapPath, "utf8");
  const urls = [...sitemap.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((match) => match[1].trim());
  if (!urls.length) throw new Error(`${sitemapPath} contains no routes; refusing a vacuous pass`);

  const pages = urls.map((value) => {
    const url = new URL(value);
    if (url.origin !== "https://getgymbo.com") throw new Error(`unexpected sitemap origin: ${url.origin}`);
    return { route: url.pathname, file: routeFile(buildRoot, url.pathname), source: "sitemap" };
  });
  pages.push(
    { route: "/auth/callback/", file: routeFile(buildRoot, "/auth/callback/"), source: "required extra" },
    { route: "404 fallback", file: resolve(buildRoot, "404.html"), source: "required extra" },
  );

  const unique = new Map();
  for (const page of pages) unique.set(page.file, page);
  for (const page of unique.values()) {
    if (!existsSync(page.file)) throw new Error(`${page.route}: built page is missing at ${page.file}`);
  }
  return { pages: [...unique.values()], sitemapRoutes: urls.length };
}

export function scanBuiltOutput(root = "dist") {
  const { pages, sitemapRoutes } = discoverBuiltPages(root);
  const findings = pages.flatMap(({ route, file }) => scanHtml(readFileSync(file, "utf8"), route));
  return { findings, pages, sitemapRoutes };
}

function cliRoot(args) {
  if (!args.length) return "dist";
  if (args.length === 2 && args[0] === "--root") return args[1];
  throw new Error("usage: node scripts/check-no-em-dash.mjs [--root <built-site-dir>]");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = scanBuiltOutput(cliRoot(process.argv.slice(2)));
    if (result.findings.length) {
      console.error(`FAIL: ${result.findings.length} user-facing em dash occurrence(s) in built output:`);
      for (const finding of result.findings) {
        console.error(`  ${finding.route} [${finding.surface}] ${finding.snippet}`);
      }
      process.exitCode = 1;
    } else {
      console.log(`OK: no user-facing em dashes across ${result.sitemapRoutes} sitemap route(s) plus auth callback and real 404 (${result.pages.length} built page(s)).`);
    }
  } catch (error) {
    console.error(`COULD NOT EVALUATE built copy: ${error.message}`);
    process.exitCode = 2;
  }
}
