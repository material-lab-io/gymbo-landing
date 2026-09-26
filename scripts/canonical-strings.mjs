// gy-uu7mt: content's canonical strings, VENDORED verbatim (src/canonical/), and what the
// built site must do with them. A pin a human retypes is a pin that drifts, so this module
// never contains a string: it reads content's JSON, checks it is byte-identical to the
// recorded source, and turns it into ruled entries for the copy baseline plus presence checks.
//
// WHAT THIS CHECKS, stated so a green is not over-read (content's caveat 2): it checks the
// LISTED web surfaces for PRESENCE IN THE DOCUMENT, not visibility to a reader (gy-vawlh): home meta description, og/JSON-LD description, twitter description,
// the gallery caption, the trial line, the trial detail and the comparison row. 'Ask Gymbo'
// and 'punch' are pinned as TERMS only. Free-form sentences that use them are pinned only
// by the copy-change-detector as `observed`. So green here is NOT "no retired wording anywhere".
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { norm } from "./copy-blocks.mjs";
import { matchable } from "./text-normalise.mjs";

export const CANON_DIR = "src/canonical";
export const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

export function loadCanonical(dir = CANON_DIR) {
  const need = ["gymbo-canonical-strings.json", "SOURCE.json", "web-surface-map.json"].map((f) => join(dir, f));
  for (const f of need) if (!existsSync(f)) throw new Error(`${f} is missing; the vendored canonical strings are part of the gate`);
  const raw = readFileSync(need[0]);
  const doc = JSON.parse(raw.toString("utf8"));
  const source = JSON.parse(readFileSync(need[1], "utf8"));
  const map = JSON.parse(readFileSync(need[2], "utf8")).map;
  if (!Array.isArray(doc.strings) || !doc.strings.length) throw new Error("canonical strings file has no strings; refusing a vacuous pass");
  return { doc, source, map, sha: sha256(raw) };
}

// CONSTANTS-FILE CHECK (v3 `facts`): content rules the NUMBERS; src/lib/trialAccess.ts must EQUAL them.
// It is NOT a price check on the built site: see findBuiltPrices for what it does not read.
// Price sentences are worded per surface and are deliberately not string-pinned, so this is the
// only thing that ties the constants to what content ruled. It covers the CONSTANTS FILE only:
// a price typed by hand in Terms.tsx or index.html is not read here (copy-facts.spec.ts and the
// copy-change-detector are what watch those).
export function loadFactsMap(dir = CANON_DIR) {
  const f = join(dir, "facts-map.json");
  if (!existsSync(f)) throw new Error(`${f} is missing; the facts-to-constants map is part of the gate`);
  return JSON.parse(readFileSync(f, "utf8"));
}

// Strip comments BEFORE matching (a block comment quoting the old declaration was read as the constant:
// tester F2) and require EXACTLY ONE declaration. Both are regex-on-source, so this is still a heuristic
// for "what tsc will compile": it fails closed (cannot-read-constant) whenever it is not sure.
const stripTsComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
export function readConstants(src, names) {
  const code = stripTsComments(src);
  const out = {};
  for (const n of names) {
    const all = [...code.matchAll(new RegExp(`^\\s*export const ${n}\\s*=\\s*([^;\\n]*);`, "gm"))];
    if (all.length !== 1) continue;
    const m = all[0][1].trim().match(/^-?\d+$/);
    if (m) out[n] = Number(m[0]);
  }
  return out;
}

export function checkFacts(doc, factsMap, tsSource) {
  const findings = [];
  const facts = doc.facts;
  if (!facts || typeof facts !== "object") return [{ kind: "facts-missing", detail: "the vendored canonical file has no `facts` block; refusing a vacuous pass" }];
  const keys = Object.keys(facts).filter((k) => !k.startsWith("_"));
  if (!keys.length) return [{ kind: "facts-missing", detail: "the `facts` block is empty; refusing a vacuous pass" }];
  for (const k of keys) if (!factsMap.map[k]) findings.push({ kind: "unmapped-fact", id: k, detail: "content added a fact that facts-map.json does not tie to a constant; map it" });
  for (const k of Object.keys(factsMap.map)) if (!keys.includes(k)) findings.push({ kind: "unknown-fact-mapping", id: k, detail: "facts-map.json names a fact that is not in the vendored file" });
  const names = Object.values(factsMap.map);
  const got = readConstants(tsSource, names);
  for (const [k, name] of Object.entries(factsMap.map)) {
    if (!keys.includes(k)) continue;
    if (!(name in got)) { findings.push({ kind: "cannot-read-constant", id: k, detail: `${name} is not declared exactly once, outside comments, as a plain \`export const ${name} = <integer>;\` in ${factsMap.file}; fail closed rather than skip` }); continue; }
    if (got[name] !== facts[k]) findings.push({ kind: "fact-mismatch", id: k, detail: `${name} = ${got[name]} in ${factsMap.file}, content ruled ${facts[k]}` });
  }
  return findings;
}

// BUILT files that state a rupee amount. The facts check compares NONE of them to content's ruled
// numbers (it reads only the constants file), so on every green the gate names them: a price change
// can leave every one of these stale with all gates OK (tester's 399->449 drill left eight stale:
// 3 alternatives, 2 blogs, the compare page, llms.txt, pricing.md). This scans dist/, the thing that
// ships, not src/, because src cannot see public/ files or generated JSON-LD. It reads html, md, txt,
// xml and json only: text inside the .js bundles is NOT scanned, and neither are images.
// Informational, never a failure. Includes competitor prices and constant-derived text on purpose:
// the point is which files the check does not verify, not which are wrong.
// gy-53qq5.1 M4: every shipped TEXT file is read (markup, prose, data, scripts, styles, svg, manifests),
// not only html/md/txt/xml/json: terms-*.js and trialAccess-*.js state Gymbo's price on the real build.
// Bundles are content-hashed ('terms-6GmOuVPd.js'), so a registry key names them WITHOUT the hash
// ('assets/terms.js') and survives a rebuild. A hash must carry a digit or capital so an ordinary
// 8-letter word ('data-analysis.js') is never mistaken for one; if two files still reduce to one name the
// scan throws instead of guessing.
const SCANNED = /\.(html?|md|txt|xml|json|m?js|css|svg|webmanifest)$/i;
export const builtName = (rel) => rel.replace(/^(assets\/.*?)-(?=[A-Za-z0-9_-]*[0-9A-Z])[A-Za-z0-9_-]{8}(\.[A-Za-z0-9]+)$/, "$1$2");
export function findBuiltPrices(root = "dist") {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(join(root, d))) {
      const rel = d ? `${d}/${e}` : e;
      if (statSync(join(root, rel)).isDirectory()) { walk(rel); continue; }
      if (!SCANNED.test(e)) continue;
      const n = priceOccurrences(priceText(readFileSync(join(root, rel), "utf8"), rel)).length;
      if (n) out.push({ file: builtName(rel).replace(/\/index\.html$/, "/").replace(/^index\.html$/, "/"), count: n });
    }
  };
  if (!existsSync(root)) throw new Error(`${root} does not exist; cannot list the built files the price check does not read`);
  walk("");
  return out.sort((x, y) => x.file.localeCompare(y.file));
}

// gy-53qq5: THE PRICE PIN ON BUILT FILES. findBuiltPrices only NAMES files; this one FAILS. Content's
// `facts` rule the amounts; price-surfaces.json says which built files must state which. Amounts are
// read from the facts, never retyped, so when content bumps a price every listed file still carrying
// the old number goes red (the 399 -> 449 drill), and a file that states a current Gymbo amount but is
// not listed fails too (a new page cannot quote the price unwatched).
//
// NORMALISED (tester's attack2, M1+M2): an amount is read the way a person reads it, not the way a
// template wrote it. Marker = rupee sign (raw, entity, or JSON escape), 'Rs', 'Rs.', 'INR', or a
// trailing 'rupees'. Between the marker and the digits the gap may hold whitespace, nbsp, HTML comments
// and tags: React's own render emits '\u20b9<!-- -->399', so an ordinary edit produces that form.
// Grouping commas are optional ('2,999' and '2999' are one amount).
//
// EVERY amount in a LISTED file is then classified: a current ruled price, or a third-party figure
// declared in price-surfaces.json with a reason. Anything else is price-unclassified, printed in the
// form it was written. That is what turns a leftover old price into a red naming that occurrence,
// whatever spelling it is in. gy-53qq5.1 closed M3 (a pinned amount must be in the page's VISIBLE text,
// not only a meta/alt/script; a third-party declaration at a ruled price on a listed page fails) and M5
// (a savings percent is read in every phrasing, not only 'Save N%'). M4 closed the file-type gap (.js/.mjs/.css/.svg/.webmanifest are read; hashed chunks are pinned by their
// hash-free name). Still NOT covered: an OLD Gymbo price on an unlisted page (M6), images, Devanagari digits.
const PRICE_KEYS = ["monthlyINR", "annualINR", "annualMonthlyEquivalentINR"];
export const rupees = (n) => `\u20b9${Number(n).toLocaleString("en-IN")}`;
// gy-53qq5 (tester M1/M2): the pin reads what a person READS, not the raw bytes. React's SSR puts a
// comment node between the rupee sign and the digits and the hand-typed meta says 'Rs.399', so the
// raw-text \u20b9399 regex missed both. priceText() drops comments and tags (html only: '<' is prose in
// md/txt), then applies the shared matchable() fold (entities, invisibles, look-alikes). priceOccurrences()
// then reads every amount in the spellings a reader treats as the same price: \u20b9 / Rs / Rs. / INR before, or 'rupees' /
// Rs / INR after, with or without the thousands comma. Still NOT read: Devanagari digits, images.
// A stripped tag keeps its text-bearing attributes: the compare page's hand-typed 'Rs.399' lives in a
// <meta content>, and alt/title/aria-label are read by people and crawlers too.
const tagText = (tag) => " " + [...tag.matchAll(/\b(?:content|alt|title|aria-label)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)].map((m) => m[1] ?? m[2]).join(" ") + " ";
// visibleOnly (gy-53qq5.1 M3): what a reader sees on the page. Comments, script/style/template/noscript
// blocks and tag attributes are dropped, so a price that lives only in a meta, an alt or JSON-LD does not
// satisfy a pin. The default keeps text-bearing attributes so a stale amount hidden there is still classified.
// R1 (gy-53qq5.1): a reader does not see an element that is `hidden`,
// or styled display:none / visibility:hidden / content-visibility:hidden, so its text is not PRESENCE. A hidden
// price still gets CLASSIFIED (this runs only for the visible view), so a stale amount hiding there is not
// exempt. Depth-tracked so nested same-name elements close correctly; void elements never open a skip; a
// hidden element that is never closed hides the rest of the page, which fails closed (the pin goes red).
// aria-hidden is NOT hiding: it removes text from assistive tech, a sighted reader still sees it (a visible price
// with a screen-reader twin is a common pattern). Class names are not read either: nothing here can know what
// a stylesheet hides, so a price kept only in a visually-hidden class is a named limit.
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
const HIDDEN_STYLE = /(?:^|[;\s])(?:display\s*:\s*none|visibility\s*:\s*hidden|content-visibility\s*:\s*hidden)(?![\w-])/i;
// Attributes are tokenised (name, then a quoted or bare value) so the word 'hidden' inside another attribute's
// VALUE (data-x="a hidden b") is never mistaken for the hidden attribute.
const ATTR = /([^\s=/"'<>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const isHiddenTag = (attrs) => {
  for (const m of attrs.matchAll(ATTR)) {
    const name = m[1].toLowerCase();
    if (name === "hidden") return true;
    if (name === "style" && HIDDEN_STYLE.test(m[2] ?? m[3] ?? m[4] ?? "")) return true;
  }
  return false;
};
const dropHiddenElements = (html) => {
  const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  let out = "", pos = 0, skip = null, depth = 0, m;
  while ((m = TAG.exec(html))) {
    const [whole, close, rawName, attrs] = m, name = rawName.toLowerCase(), selfClosing = /\/\s*$/.test(attrs) || VOID.has(name);
    if (skip === null) {
      out += html.slice(pos, m.index); pos = m.index + whole.length;
      if (!close && isHiddenTag(attrs)) { if (!selfClosing) { skip = name; depth = 1; } continue; }
      out += whole;
    } else {
      pos = m.index + whole.length;
      if (name !== skip) continue;
      if (close) { if (--depth === 0) skip = null; } else if (!selfClosing) depth++;
    }
  }
  return skip === null ? out + html.slice(pos) : out;
};
const dropHidden = (t) => dropHiddenElements(t.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " "));
export const priceText = (text, file = "", visibleOnly = false) => matchable(/\.(html?|svg)$/i.test(file) ? (visibleOnly ? dropHidden(text).replace(/<[^>]+>/g, " ") : text.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, tagText)) : text);
// priceOccurrences() runs on priceText() output (comments and tags already gone, entities decoded), so
// it needs no tag-gap handling. Marker before the digits: rupee sign (or its JSON escape), Rs, Rs., INR;
// or 'rupees' / Rs / INR after them. Grouping commas are optional. Every amount is returned with the form
// it was written in, so a finding can name the occurrence.
const MARK = String.raw`(?:\u20b9|\\u20b9|(?<![A-Za-z])Rs\.?|(?<![A-Za-z])INR)`;
const NUM = String.raw`(\d[\d,]*(?:\.\d+)?)`;
const AMOUNT_RE = () => new RegExp(`${MARK}\\s*${NUM}|${NUM}\\s*(?:rupees?\\b|(?<![A-Za-z])(?:Rs|INR)\\b)`, "gi");
export function priceOccurrences(text) {
  return [...text.matchAll(AMOUNT_RE())].map((m) => ({ raw: m[0], value: Number((m[1] ?? m[2]).replace(/,/g, "")), index: m.index }));
}
// gy-53qq5.1 M5: a savings percent is read in every phrasing a reader treats as the same claim, not
// only 'Save N%'. Saving word BEFORE the number ('Save up to 37 percent', 'Saving 37 %', 'discount of
// 20%'; not 'off': 'drop-off ~60%' is churn) or right AFTER it ('37% savings', '37% off the annual plan', '37% cheaper'). Deliberately tight:
// 'lower', 'less' and 'reduce' are not saving words here (the research page says 'lower churn' and '40%
// less admin' about things that are not a price). Returns every claim with the form it was written in.
// R2 (gy-53qq5.1): the vocabulary is a DECLARED list, so widening it is an edit to a named array, not to
// a regex. SAVING_WORDS open a claim when they come BEFORE the number; SAVING_FILLERS are the words that
// may sit between the saving word and the number ('saves YOU 37%', 'save AN EXTRA 37%', 'save AS MUCH AS
// 37%'). Anything else between them (a digit, another noun) ends the search, and a sentence boundary
// (. ! ? ;) ends it too, so 'Save. 60% of clients' is not a claim. A number AFTER the claim word is read
// with SAVING_AFTER ('37% savings', '37%-off', '37 pct cheaper'). 'lower', 'less' and 'reduce' stay out
// on purpose: the research page uses them about churn.
export const SAVING_WORDS = ["save", "saves", "saved", "saving", "savings", "discount", "cheaper"];
export const SAVING_FILLERS = ["you", "your", "an", "a", "the", "up", "to", "upto", "of", "by", "about", "around", "over", "nearly", "almost", "extra", "full", "further", "additional", "another", "more", "as", "much", "whopping", "huge", "than", "at", "least", "roughly", "close", "upwards", "massive"];
export const SAVING_AFTER = ["savings", "saving", "off", "cheaper", "discount"];
const PCT = String.raw`(?:%|percent|per cent|pct)`;
const SAVE_BEFORE = String.raw`\b(?:${SAVING_WORDS.join("|")})\b(?:[^\w.!?;]|\b(?:${SAVING_FILLERS.join("|")})\b)*?(\d+(?:\.\d+)?)\s?${PCT}`;
const SAVE_AFTER = String.raw`(\d+(?:\.\d+)?)\s?${PCT}[\s-]+(?:${SAVING_AFTER.join("|")})\b`;
export function savingsClaims(text) {
  const seen = new Set(), out = [];
  for (const re of [new RegExp(SAVE_BEFORE, "gid"), new RegExp(SAVE_AFTER, "gid")]) for (const m of text.matchAll(re)) {
    const at = m.indices[1][0]; if (seen.has(at)) continue; seen.add(at);
    out.push({ raw: m[0], value: Number(m[1]), index: m.index });
  }
  return out;
}
const listBuiltText = (root, visibleOnly = false) => {
  const out = new Map();
  const walk = (d) => {
    for (const e of readdirSync(join(root, d))) {
      const rel = d ? `${d}/${e}` : e;
      if (statSync(join(root, rel)).isDirectory()) { walk(rel); continue; }
      if (!SCANNED.test(e)) continue;
      const name = builtName(rel);
      if (out.has(name)) throw new Error(`${rel} and another built file both reduce to the same built name ${name}; the price pin cannot tell them apart, so it refuses to guess`);
      out.set(name, priceText(readFileSync(join(root, rel), "utf8"), rel, visibleOnly));
    }
  };
  if (!existsSync(root)) throw new Error(`${root} does not exist; cannot check prices on a build that is not there`);
  walk("");
  return out;
};
export function loadPriceSurfaces(dir = CANON_DIR) {
  const f = join(dir, "price-surfaces.json");
  if (!existsSync(f)) throw new Error(`${f} is missing; the price pin's surface list is part of the gate`);
  const j = JSON.parse(readFileSync(f, "utf8"));
  if (!j.surfaces || !Object.keys(j.surfaces).length) throw new Error("price-surfaces.json lists no surfaces; refusing a vacuous pass");
  return j;
}
// gy-53qq5.1 M6: the gate has no memory of what a price WAS, so after a bump a page that still quotes the
// old figure is invisible unless it is pinned. The ledger in price-surfaces.json records the prices the
// registry was last reconciled to (`ruled`) and every former Gymbo price (`retired`). This check makes a
// bump impossible to land quietly: if content's facts differ from `ruled`, the gate is RED until someone
// moves the old amount into `retired` and updates `ruled`; a retired amount is then flagged on every page
// that is not pinned (a pinned page already fails as price-unclassified). It cannot know an old price it
// was never told: the ledger starts empty, and only a bump made through it protects the next one.
export function checkPriceLedger(facts, reg) {
  const led = reg.priceLedger;
  if (!led) return [{ kind: "price-ledger-missing", detail: "price-surfaces.json has no priceLedger; without it an old price on an unpinned page cannot be recognised after a bump" }];
  const out = [];
  for (const k of PRICE_KEYS) if (led.ruled?.[k] !== facts[k]) out.push({ kind: "price-ledger-behind", id: k, detail: `content ruled ${facts[k]} for ${k} but the ledger records ${led.ruled?.[k] ?? "none"}; move the old amount into priceLedger.retired as { amount, was, note } and set priceLedger.ruled.${k} to ${facts[k]}, so the old price is flagged on every page that still quotes it` });
  const now = new Set(PRICE_KEYS.map((k) => facts[k]));
  for (const e of led.retired || []) {
    if (!Number.isInteger(e?.amount)) { out.push({ kind: "price-ledger-bad-entry", detail: `a priceLedger.retired entry has no integer amount: ${JSON.stringify(e)}` }); continue; }
    if (now.has(e.amount)) out.push({ kind: "price-ledger-retired-is-current", value: e.amount, detail: `priceLedger.retired lists ${e.amount}, which is a current ruled price; retiring a live price would hide it` });
  }
  return out;
}
// gy-53qq5.1 R3: the ledger can be SILENCED. checkPriceLedger only compares `ruled` to content's facts, so an
// editor who overwrites `ruled` with the new price and never moves the old one into `retired` gets a green
// gate, and the old price on an unpinned page passes (tester's L6c; retiring only some old prices is L7d).
// Against the PR base (the ledger as it was): every price `ruled` moved away from must now be in `retired`,
// and nothing may leave `retired`. A value that is still live under ANY key is exempt from both rules, so a
// price that goes back (reinstated) or moves between keys does not deadlock against checkPriceLedger, which
// refuses a live price in `retired`. What this cannot see: a workflow edit that skips the check, or a base
// that is itself already silenced; reviewers own those.
export function checkLedgerAppendOnly(base, head) {
  if (!head) return [{ kind: "price-ledger-missing", detail: "the head has no priceLedger, so the append-only check has nothing to read; a deleted ledger is refused" }];
  if (!base) return [];
  const out = [], amounts = (l) => (l.retired || []).map((e) => e?.amount).filter(Number.isInteger);
  const retiredNow = new Set(amounts(head)), liveNow = new Set(PRICE_KEYS.map((k) => head.ruled?.[k]).filter(Number.isInteger));
  for (const k of PRICE_KEYS) {
    const was = base.ruled?.[k];
    if (Number.isInteger(was) && !retiredNow.has(was) && !liveNow.has(was)) out.push({ kind: "price-ledger-old-not-retired", id: k, value: was, detail: `priceLedger.ruled.${k} changed from ${was} to ${head.ruled?.[k]} but ${was} is not in priceLedger.retired; retire it as { amount: ${was}, was: "${k}", note }, or the old price stays invisible on every unpinned page` });
  }
  for (const a of amounts(base)) if (!retiredNow.has(a) && !liveNow.has(a)) out.push({ kind: "price-ledger-retired-removed", value: a, detail: `${a} was in priceLedger.retired on the base and is gone; retired is append-only (remove it only if ${a} is a live price again)` });
  return out;
}

// Where the base comes from in CI: the PR base sha, or the push's `before`, read from the event payload GitHub
// writes for every run. In CI an unresolvable base is an ERROR (never a silent skip: a skip is what silence
// looks like); off CI nothing is configured and the CLI decides. A manual workflow_dispatch carries no base commit:
// the CLI compares against the merge-base with origin/main (on main itself that is the same commit).
export function ledgerBaseFromEnv(env, readFile = (p) => readFileSync(p, "utf8")) {
  if (env.GITHUB_ACTIONS !== "true") return { ref: null };
  if (env.GITHUB_EVENT_NAME === "workflow_dispatch") return { ref: null, mergeBase: "origin/main" };
  if (!env.GITHUB_EVENT_PATH) return { error: "GITHUB_EVENT_PATH is not set, so the base commit for the ledger check cannot be read" };
  let ev; try { ev = JSON.parse(readFile(env.GITHUB_EVENT_PATH)); } catch (e) { return { error: `the event payload could not be read (${e.message})` }; }
  const name = env.GITHUB_EVENT_NAME, ref = name === "pull_request" || name === "pull_request_target" ? ev.pull_request?.base?.sha : name === "push" ? ev.before : undefined;
  if (name !== "pull_request" && name !== "pull_request_target" && name !== "push") return { error: `event "${name}" is not one this check knows how to find a base for` };
  if (!ref || /^0+$/.test(ref)) return { error: `no usable base sha in the ${name} event payload` };
  return { ref };
}

// The base's price-surfaces.json read from git (the path is relative to canonDir, which may sit anywhere in the
// repo). A base that predates the registry has no ledger yet: that is `{ ledger: undefined }`, not an error.
export function readBaseLedger({ ref, canonDir = CANON_DIR }) {
  const git = (...a) => spawnSync("git", ["-C", canonDir, ...a], { encoding: "utf8" });
  const c = git("cat-file", "-e", `${ref}^{commit}`);
  if (c.status !== 0) return { error: `base commit ${ref} is not in this checkout (${(c.stderr || "").trim() || "git failed"}); fetch-depth 0 is expected` };
  if (git("cat-file", "-e", `${ref}:./price-surfaces.json`).status !== 0) return { ledger: undefined };
  const r = git("show", `${ref}:./price-surfaces.json`);
  try { return { ledger: JSON.parse(r.stdout).priceLedger }; } catch (e) { return { error: `the base's price-surfaces.json is not valid JSON (${e.message})` }; }
}
export function checkBuiltPricePin(facts, reg, root = "dist") {
  const findings = [];
  const files = listBuiltText(root), visible = listBuiltText(root, true);
  const amt = Object.fromEntries(PRICE_KEYS.map((k) => [k, facts[k]]));
  for (const k of PRICE_KEYS) if (!Number.isInteger(amt[k])) findings.push({ kind: "price-fact-missing", id: k, detail: `facts.${k} is not an integer; refusing a vacuous pass` });
  if (findings.length) return findings;
  const current = new Set(Object.values(amt));
  const tp = new Set((reg.thirdPartyAmounts?.entries || []).filter((e) => e.unit !== "percent").map((e) => `${e.file}|${e.amount}`));
  const retired = new Set((reg.priceLedger?.retired || []).map((e) => e?.amount).filter(Number.isInteger));
  const tpPct = new Set((reg.thirdPartyAmounts?.entries || []).filter((e) => e.unit === "percent").map((e) => `${e.file}|${e.amount}`));
  // gy-53qq5.1 M3: on a LISTED file a declaration at a ruled Gymbo price would let a competitor's figure
  // (or a stale Gymbo one) stand in for the pinned amount. Re-classify per occurrence before it is allowed.
  for (const e of reg.thirdPartyAmounts?.entries || []) if (e.unit !== "percent" && reg.surfaces[e.file] && PRICE_KEYS.some((k) => amt[k] === e.amount)) findings.push({ kind: "price-declared-collides-current", file: e.file, value: e.amount, detail: `${e.file} declares ${rupees(e.amount)} as a third-party amount, but that is now a ruled Gymbo price on a pinned page; the declaration would hide a stale or missing Gymbo statement. Remove it and tell the two occurrences apart` });
  const shown = (o) => o.raw.replace(/\s+/g, " ").slice(0, 60);
  for (const [file, keys] of Object.entries(reg.surfaces)) {
    const text = files.get(file);
    if (text === undefined) { findings.push({ kind: "price-surface-missing", file, detail: "listed in price-surfaces.json but not in the build; if it is a hashed bundle whose build hash happens to read as a plain word (all lowercase, so it is not stripped), a rebuild usually fixes it; otherwise remove it or fix the path" }); continue; }
    const occ = priceOccurrences(text), seen = priceOccurrences(visible.get(file) ?? "");
    for (const key of keys) {
      if (key === "annualSavingsPercent") {
        const found = savingsClaims(visible.get(file) ?? "").map((c) => c.value);
        if (!found.includes(facts.annualSavingsPercent)) findings.push({ kind: "price-stale", file, id: key, detail: `no savings claim of ${facts.annualSavingsPercent}% ('Save ${facts.annualSavingsPercent}%', '${facts.annualSavingsPercent}% savings', ...) in the visible text (found: ${found.join(", ") || "none"})` });
        continue;
      }
      if (!PRICE_KEYS.includes(key)) { findings.push({ kind: "price-registry-unknown-key", file, id: key, detail: "not a price fact this check knows" }); continue; }
      if (!seen.some((o) => o.value === amt[key])) findings.push({ kind: "price-stale", file, id: key, detail: `${file} does not state ${rupees(amt[key])} (${key}) in its visible text (an amount only in a meta, alt, script or comment does not count); the ruled price changed or the page did not follow` });
    }
    for (const o of occ) if (!current.has(o.value) && !tp.has(`${file}|${o.value}`)) findings.push({ kind: "price-unclassified", file, value: o.value, form: shown(o), detail: `${file} states ${JSON.stringify(shown(o))} (${o.value}), which is neither a current ruled price nor a declared third-party amount; if it is Gymbo's OLD price it is stale, otherwise declare it in thirdPartyAmounts with a reason` });
  }
  for (const [file, text] of files) {
    if (reg.surfaces[file]) continue;
    const seen = new Set();
    for (const o of priceOccurrences(text)) {
      const k = PRICE_KEYS.find((x) => amt[x] === o.value);
      if (retired.has(o.value) && !current.has(o.value) && !tp.has(`${file}|${o.value}`) && !seen.has(o.value)) { seen.add(o.value); findings.push({ kind: "price-retired-amount", file, value: o.value, form: shown(o), detail: `${file} states ${JSON.stringify(shown(o))} (${o.value}), a FORMER Gymbo price recorded in priceLedger.retired; update it, or declare it in thirdPartyAmounts with a reason if it is someone else's figure` }); }
      if (k && !tp.has(`${file}|${o.value}`) && !seen.has(o.value)) { seen.add(o.value); findings.push({ kind: "price-unregistered", file, id: k, detail: `${file} states ${JSON.stringify(shown(o))} (${rupees(o.value)}) but is not in price-surfaces.json; list it (so it is pinned) or declare it thirdPartyAmounts with a reason` }); }
    }
  }
  for (const [file, text] of files) for (const c of savingsClaims(text)) if (c.value !== facts.annualSavingsPercent && !tpPct.has(`${file}|${c.value}`)) findings.push({ kind: "price-stale", file, id: "annualSavingsPercent", form: c.raw.replace(/\s+/g, " ").slice(0, 60), detail: `${file} says ${JSON.stringify(c.raw.replace(/\s+/g, " ").slice(0, 60))}, content ruled ${facts.annualSavingsPercent}%. If this is not Gymbo\'s own annual saving (a competitor\'s advertised discount, or any other percentage that reads as a saving, such as time saved: it is not a price but it sits beside a saving word), declare it in thirdPartyAmounts as { file, amount: ${c.value}, unit: "percent", reason }` });
  return findings;
}

// The standing negative control: bump every price and require the pin to go RED for EVERY listed
// (file, key) AND for EVERY occurrence, in whatever spelling, of a current Gymbo amount in a listed
// file (gy-53qq5 AC4 + tester's M1/M2: a pin that has never been seen to catch each form is not evidence).
export function priceDrill(facts, reg, root = "dist", bump = 37) {
  const drifted = { ...facts, monthlyINR: facts.monthlyINR + bump, annualINR: facts.annualINR + bump, annualMonthlyEquivalentINR: facts.annualMonthlyEquivalentINR + bump, annualSavingsPercent: facts.annualSavingsPercent + 1 };
  const red = checkBuiltPricePin(drifted, reg, root);
  const got = new Set(red.filter((f) => f.kind === "price-stale").map((f) => `${f.file}|${f.id}`));
  const missed = [];
  for (const [file, keys] of Object.entries(reg.surfaces)) for (const k of keys) if (!got.has(`${file}|${k}`)) missed.push(`${file}|${k}`);
  const files = listBuiltText(root);
  const now = new Set(PRICE_KEYS.map((k) => facts[k]));
  let occurrences = 0;
  for (const file of Object.keys(reg.surfaces)) {
    const mine = priceOccurrences(files.get(file) || "").filter((o) => now.has(o.value));
    occurrences += mine.length;
    for (const v of now) {
      const want = mine.filter((o) => o.value === v).length;
      const have = red.filter((f) => f.kind === "price-unclassified" && f.file === file && f.value === v).length;
      if (have < want) missed.push(`${file}|${want - have} of ${want} occurrence(s) of ${v}`);
    }
  }
  let claims = 0;
  for (const [file, text] of files) {
    const want = savingsClaims(text).filter((c) => c.value === facts.annualSavingsPercent).length; claims += want;
    const have = red.filter((f) => f.kind === "price-stale" && f.id === "annualSavingsPercent" && f.form && f.file === file).length;
    if (have < want) missed.push(`${file}|${want - have} of ${want} savings claim(s)`);
  }
  return { missed, total: Object.values(reg.surfaces).reduce((n, k) => n + k.length, 0), occurrences, claims };
}

export const isWebId = (id, source) => (source.webSurfaceIdPrefixes || ["site.", "trial."]).some((p) => id.startsWith(p));

// Ruled entries for the copy baseline: every NON-waived target of every mapped web string.
export function canonicalRuled({ doc, source, map }) {
  const byId = new Map(doc.strings.map((s) => [s.id, s]));
  const out = [];
  for (const [id, m] of Object.entries(map)) {
    const s = byId.get(id);
    if (!s) continue;
    for (const t of m.targets) {
      if (t.waiver) continue;
      out.push({ id: `canonical.${id}`, route: t.route, surface: t.surface, [t.mode]: s.text, ref: `content canonical strings ${source.commit.slice(0, 8)} (${source.guideVersion})` });
    }
  }
  return out;
}

export function checkCanonical({ doc, source, map, sha }, surfaces, today = new Date().toISOString().slice(0, 10)) {
  const findings = [];
  const notes = [];
  if (sha !== source.sha256) findings.push({ kind: "canonical-hash-mismatch", detail: `vendored file sha256 ${sha.slice(0, 16)}... != recorded ${source.sha256.slice(0, 16)}... (hand edit, or a re-vendor without updating SOURCE.json)` });
  const byId = new Map(doc.strings.map((s) => [s.id, s]));
  for (const s of doc.strings) if (isWebId(s.id, source) && !map[s.id]) findings.push({ kind: "unmapped-web-string", id: s.id, detail: "content added a web-surface string that no target in web-surface-map.json says where to find; map it (or ask content to use an app-side id)" });
  for (const id of Object.keys(map)) if (!byId.has(id)) findings.push({ kind: "unknown-mapping", id, detail: "web-surface-map.json names an id that is not in the vendored strings" });
  const blocksOf = (t) => (surfaces.get(t.route) || []).filter((b) => b.surface === t.surface);
  const has = (t, text) => blocksOf(t).some((b) => (t.mode === "equals" ? b.text === norm(text) : b.text.includes(norm(text))));
  for (const [id, m] of Object.entries(map)) {
    const s = byId.get(id); if (!s) continue;
    for (const t of m.targets) {
      const where = `${t.route} [${t.surface}]`;
      // v2 adds `match` to a string that is a sentence inside larger blocks. Landing's map must
      // agree with content's own statement of how the string is matched, or it is a finding.
      if (s.match && s.match !== t.mode) findings.push({ kind: "match-mode-disagrees", id, route: t.route, surface: t.surface, detail: `content says match:${s.match}, web-surface-map.json says ${t.mode}` });
      const present = has(t, s.text);
      if (!t.waiver) { if (!present) findings.push({ kind: "canonical-string-missing", id, route: t.route, surface: t.surface, text: norm(s.text), detail: `${t.mode} on ${where}` }); continue; }
      if (present) { findings.push({ kind: "stale-waiver", id, route: t.route, surface: t.surface, detail: `the canonical string IS present on ${where}; remove the waiver` }); continue; }
      if (t.waiver.expires < today) findings.push({ kind: "waiver-expired", id, route: t.route, surface: t.surface, detail: `waiver expired ${t.waiver.expires} (${t.waiver.ref})` });
      if (!has(t, t.waiver.observed)) findings.push({ kind: "waiver-observed-missing", id, route: t.route, surface: t.surface, text: norm(t.waiver.observed), detail: "the text the waiver says the site carries is gone or changed: the divergence moved" });
      notes.push(`WAIVED ${id} on ${where}: site carries ${JSON.stringify(t.waiver.observed).slice(0, 90)} not the canonical string (${t.waiver.ref}; expires ${t.waiver.expires})`);
    }
  }
  return { findings, notes };
}

// What this gate deliberately does NOT read, written down so a green is not over-read. Each entry was MEASURED
// against the merged gate by tester (attack notes on gy-53qq5.1) and is pinned by a test that shows it is real.
// pm ruled these named limits, not fixes (gy-53qq5.1, 2026-09-26): 'less'/'lower' stay out because the research
// page says them about churn; the hiding variants need a rendering engine, not a text scan.
export const NAMED_LIMITS = [
  "less/lower savings phrasings ('Pay 37% less', '37% lower than monthly')",
  "'You get 37% back' (no saving word)",
  "hiding by opacity:0, font-size:0, an off-screen or clipped box, or a CSS comment inside style",
  "a price kept only in the <title> element",
  "hiding by a class name (a stylesheet is not read)",
  "Devanagari digits and text inside images",
];
