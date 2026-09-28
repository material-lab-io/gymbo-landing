// gy-454k3: internal references must not SHIP. Source comments carry bead ids and named people
// ("the register Kaushik called abrupt and jerky", "gy-becxi"). They are useful to whoever maintains
// the code, so they stay in SOURCE; this module finds and removes them from the BUILT output only.
//
// SCOPE, exactly as authorised (pm, gy-dwxbm 16:15Z): COMMENTS that carry a bead id or a named person.
// Not text. The public byline ("By Kaushik Naarayan, founder"), the JSON-LD Person and the privacy
// grievance contact are text, not comments, and are asserted to SURVIVE (see check-no-internal-comments).
// Comments without a marker (Cloudflare's <!--email_off--> directives among them) are left alone.
export const NAMED_PEOPLE = ["Kaushik", "Damini"];
// gy-454k3 AC2: the id suffix length is not fixed at the 4-6 chars observed so far — bound it wide
// (4-16) rather than to today's shape, so a longer id minted later is still caught. {4,6} previously
// missed a 7-char id outright (no shorter match exists to fall back to at that position).
export const MARKER = new RegExp(`\\bgy-[a-z0-9]{4,16}(?:\\.\\d+)?\\b|\\b(?:${NAMED_PEOPLE.join("|")})\\b`, "i");

const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
// gy-454k3 AC2: previously required whitespace/line-start before // so "https://" never matched —
// but that also missed the very common `statement;//comment` shape (no space before //). Exclude
// URLs by their actual distinguishing feature instead: a scheme colon immediately before the slashes.
const LINE_COMMENT = /(?<!:)\/\/[^\n]*/gm;

// gy-454k3 AC3: BLOCK_COMMENT is naive text matching, not a real parser — it pairs the FIRST `/*` it
// sees with the NEXT `*/`, wherever that is. A `/*` living inside one string followed, much later, by
// an unrelated `*/` inside another string would make it match (and, if marked, delete) everything in
// between, including real code — a minified-before/after diff can't tell that apart from the deliberate,
// legitimate case this bead exists to fix (a short marked comment embedded inside a JS template-literal
// string, gy-becxi/PR 215), because minification doesn't touch string contents either way: both look
// like "the string changed". What DOES distinguish them is length — a real comment is short by nature;
// a false pairing that swallows real code between two unrelated delimiters is not. Cap it.
// 2000 comfortably covers this codebase's real multi-line explanatory comments (the longest shipped
// one, gy-becxi's, is 559 chars) while staying far short of what an accidental cross-code pairing would
// span in practice.
const MAX_MARKED_BLOCK_COMMENT = 2000;
const marked = (s) => MARKER.test(s);
const dropIfMarked = (m) => {
  if (!marked(m)) return m;
  if (m.length > MAX_MARKED_BLOCK_COMMENT) throw new Error(`refusing to strip a ${m.length}-char marked comment (over ${MAX_MARKED_BLOCK_COMMENT}); this is more likely a false /* ... */ pairing across real code than a genuine comment — inspect and fix by hand: ${m.slice(0, 200)}...`);
  return "";
};

export function stripMarkedComments(text, kind) {
  if (kind === "css") return text.replace(BLOCK_COMMENT, dropIfMarked);
  if (kind === "js") return text.replace(BLOCK_COMMENT, dropIfMarked).replace(LINE_COMMENT, dropIfMarked);
  // html: comments anywhere; then CSS/JS comments inside <style> and non-JSON <script> bodies only
  // (never inside JSON-LD: a "/*" there is data, not a comment).
  let out = text.replace(HTML_COMMENT, dropIfMarked);
  out = out.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi, (_, a, body, c) => a + stripMarkedComments(body, "css") + c);
  out = out.replace(/(<script\b([^>]*)>)([\s\S]*?)(<\/script\s*>)/gi, (m, a, attrs, body, c) =>
    /type\s*=\s*["']?(?:application\/(?:ld\+)?json|text\/template)/i.test(attrs) ? m : a + stripMarkedComments(body, "js") + c);
  return out;
}

// Every marked comment still present, for the check. Same regexes as the stripper on purpose:
// the check must see exactly what the stripper is meant to remove.
export function findMarkedComments(text, kind) {
  const found = [];
  const collect = (s, k) => {
    const re = k === "css" ? [BLOCK_COMMENT] : k === "js" ? [BLOCK_COMMENT, LINE_COMMENT] : [HTML_COMMENT];
    for (const r of re) for (const m of s.matchAll(new RegExp(r.source, r.flags))) if (marked(m[0])) found.push(m[0].trim().replace(/\s+/g, " ").slice(0, 140));
  };
  if (kind === "html") {
    collect(text, "html");
    for (const m of text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) collect(m[1], "css");
    for (const m of text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) if (!/type\s*=\s*["']?(?:application\/(?:ld\+)?json|text\/template)/i.test(m[1])) collect(m[2], "js");
  } else collect(text, kind);
  return found;
}

export const kindOf = (path) => (/\.html?$/i.test(path) ? "html" : /\.css$/i.test(path) ? "css" : /\.m?js$/i.test(path) ? "js" : /\.svg$/i.test(path) ? "html" : null);
