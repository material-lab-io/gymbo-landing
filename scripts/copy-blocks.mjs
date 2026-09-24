// gy-uu7mt: split what a page SHIPS into reviewable blocks of copy. One block = one
// string a visitor, crawler or share preview can receive: a <title>, a <meta content>, a
// JSON-LD string, an accessibility attribute, or one block-level run of visible text
// (heading, paragraph, list item, table cell, button, link). Served text endpoints
// contribute one block per non-empty line.
import { createHash } from "node:crypto";
import { pageSurfaces } from "./check-no-em-dash.mjs";

const BLOCK_TAGS = "address|article|aside|blockquote|button|caption|dd|details|dialog|div|dl|dt|figcaption|figure|footer|form|h[1-6]|header|hr|label|li|main|nav|ol|option|p|pre|section|summary|table|tbody|td|tfoot|th|thead|tr|ul|a|img|svg|select|textarea|input";

export function decodeEntities(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
export const norm = (s) => decodeEntities(s).replace(/[ \s]+/g, " ").trim();
export const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);

export function visibleBlocks(html) {
  const body = (html.match(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i)?.[1] ?? html)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  const marked = body
    .replace(new RegExp(`</?(?:${BLOCK_TAGS})\\b[^>]*>`, "gi"), "\n")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "");
  return marked.split("\n").map(norm).filter(Boolean);
}

export function copyBlocks(html, route) {
  const rows = [];
  for (const { surface, value } of pageSurfaces(html, route)) {
    if (surface === "visible text") continue;
    const text = norm(value);
    if (text) rows.push({ surface: surface.replace(/\[\d+\]/g, "[]"), fullSurface: surface, text });
  }
  for (const text of visibleBlocks(html)) rows.push({ surface: "visible block", fullSurface: "visible block", text });
  return rows;
}

export function servedTextBlocks(text) {
  return String(text).split("\n").map(norm).filter(Boolean).map((t) => ({ surface: "served line", fullSurface: "served line", text: t }));
}
