// gy-454k3: internal references must not SHIP. Source comments carry bead ids and named people
// ("the register Kaushik called abrupt and jerky", "gy-becxi"). They are useful to whoever maintains
// the code, so they stay in SOURCE; this module finds and removes them from the BUILT output only.
//
// SCOPE, exactly as authorised (pm, gy-dwxbm 16:15Z): COMMENTS that carry a bead id or a named person.
// Not text. The public byline ("By Kaushik Naarayan, founder"), the JSON-LD Person and the privacy
// grievance contact are text, not comments, and are asserted to SURVIVE (see check-no-internal-comments).
// Comments without a marker (Cloudflare's <!--email_off--> directives among them) are left alone.
export const NAMED_PEOPLE = ["Kaushik", "Damini"];
export const MARKER = new RegExp(`\\bgy-[a-z0-9]{4,6}(?:\\.\\d+)?\\b|\\b(?:${NAMED_PEOPLE.join("|")})\\b`, "i");

const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
// A line comment needs whitespace or line start before // so "https://" never matches.
const LINE_COMMENT = /(^|[ \t])\/\/[^\n]*/gm;

const marked = (s) => MARKER.test(s);
const dropIfMarked = (m) => (marked(m) ? "" : m);

export function stripMarkedComments(text, kind) {
  if (kind === "css") return text.replace(BLOCK_COMMENT, dropIfMarked);
  if (kind === "js") return text.replace(BLOCK_COMMENT, dropIfMarked).replace(LINE_COMMENT, (m, lead) => (marked(m) ? lead : m));
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
