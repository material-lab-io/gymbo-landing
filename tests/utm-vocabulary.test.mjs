// gm-7e6: every utm value the site EMITS (/ig in public/_redirects, /r/ in functions/r/[token].js)
// must be inside ops/utm-vocabulary.md, and a placeholder-shaped token must never become a
// utm_campaign. Each check is a function, run twice: against the real code (must pass) and
// against an in-memory mutation of that code (must throw). A check that cannot go red is not a test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const REDIRECTS = read("public/_redirects");
const REFERRAL_SRC = read("functions/r/[token].js");
const DOC = read("ops/utm-vocabulary.md");

const loadReferral = (src) =>
  import(`data:text/javascript;base64,${Buffer.from(src).toString("base64")}`);

// ---- the vocabulary table, parsed from the doc so the doc and the code cannot drift ----
function section(doc, heading) {
  const start = doc.indexOf(`## ${heading}`);
  assert.notEqual(start, -1, `doc is missing the "${heading}" section`);
  const rest = doc.slice(start + 3);
  const next = rest.indexOf("\n## ");
  return next === -1 ? rest : rest.slice(0, next);
}
function rows(doc, heading) {
  return section(doc, heading)
    .split("\n")
    .filter((l) => l.startsWith("|") && !/^\|[-|\s]+\|?$/.test(l) && !/^\|\s*utm_source/.test(l))
    .map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));
}
const TOKEN_RE_IN_DOC = /\^\[[^\]]+\]\{\d+,\d+\}\$/;
function vocabulary(doc) {
  const live = rows(doc, "LIVE VALUES");
  const reserved = rows(doc, "RESERVED VALUES");
  const all = [...live, ...reserved];
  const triple = (r) => ({ source: r[0], medium: r[1], campaign: r[2] });
  return {
    live: live.map(triple),
    all: all.map(triple),
    mediums: new Set(all.map((r) => r[1]).filter((m) => m !== "any")),
    tokenShape: new RegExp(live.map((r) => r[2]).join(" ").match(TOKEN_RE_IN_DOC)[0]),
  };
}
const VOCAB = vocabulary(DOC);

// does one emitted (source, medium, campaign) sit inside the table? campaign null = absent.
function inTable(vocab, { source, medium, campaign }, { liveOnly = true } = {}) {
  const pool = liveOnly ? vocab.live : vocab.all;
  return pool.some((r) => {
    const sources = r.source.split(",").map((s) => s.trim());
    if (!sources.includes(source) && r.source !== "any") return false;
    if (r.medium !== medium && r.medium !== "any") return false;
    if (campaign === null) return /ABSENT/.test(r.campaign);
    if (/^[a-z0-9-]+$/.test(r.campaign)) return r.campaign === campaign;
    if (/TRAINER TOKEN/.test(r.campaign)) return vocab.tokenShape.test(campaign);
    return false;
  });
}
const triple = (loc) => {
  const q = new URL(loc).searchParams;
  return { source: q.get("utm_source"), medium: q.get("utm_medium"), campaign: q.get("utm_campaign") };
};
const redirectTargets = (text) =>
  text.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split(/\s+/)).filter((p) => p[1] && /utm_/.test(p[1]));

// ---- checks (each throws on violation) ----

// 1a. /ig: every utm redirect in _redirects is inside the table, and instagram/social/bio is pinned.
function checkIg(redirects, vocab) {
  const targets = redirectTargets(redirects);
  const ig = targets.find((p) => p[0] === "/ig");
  assert.ok(ig, "/ig must exist in _redirects with a utm-tagged target");
  assert.deepEqual(triple(ig[1]), { source: "instagram", medium: "social", campaign: "bio" });
  for (const [from, to] of targets) {
    assert.ok(inTable(vocab, triple(to), { liveOnly: false }), `${from} emits ${to}, outside the vocabulary`);
  }
}

// 1b. /r/: for a spread of tokens, every emitted triple is inside the table; the shape is pinned.
const GOOD_TOKENS = ["priya-jan", "Priya-Jan", "abc", "a".repeat(32), "testtoken001"];
function checkReferral(mod, vocab) {
  assert.equal(mod.TOKEN_SHAPE.source, vocab.tokenShape.source, "TOKEN_SHAPE drifted from the doc");
  for (const raw of [...GOOD_TOKENS, "ab", "a".repeat(33), "", undefined, ":token", "<token>"]) {
    const t = triple(mod.referralLocation(raw));
    assert.ok(inTable(vocab, t), `/r/${raw} emitted ${JSON.stringify(t)}, outside the vocabulary`);
  }
  for (const raw of GOOD_TOKENS) {
    const t = triple(mod.referralLocation(raw));
    assert.deepEqual(t, { source: "referral", medium: "referral", campaign: String(raw).toLowerCase() });
  }
}

// 1c. no other emitter hides in public/_redirects or functions/ (a new tag must be added to the doc first).
function walk(dir) {
  return readdirSync(join(ROOT, dir)).flatMap((n) => {
    const p = `${dir}/${n}`;
    return statSync(join(ROOT, p)).isDirectory() ? walk(p) : [p];
  });
}
function checkNoStrayEmitters(vocab, files) {
  for (const [path, text] of Object.entries(files)) {
    // `&amp;` is how an href carries the ampersand in served HTML; a raw `&` is the redirect/URL form.
    for (const m of text.matchAll(/utm_source=([^&"'`\s]*)(?:&amp;|&)utm_medium=([^&"'`\s]*)(?:(?:&amp;|&)utm_campaign=([^&"'`\s]*))?/g)) {
      const t = { source: m[1], medium: m[2], campaign: m[3] ?? null };
      assert.ok(inTable(vocab, t, { liveOnly: false }), `${path} emits ${m[0]}, outside the vocabulary`);
    }
  }
}
const emitterFiles = () => ({
  "public/_redirects": REDIRECTS,
  ...Object.fromEntries(walk("functions").map((p) => [p, read(p)])),
});

// 2. placeholder guard: a colon-prefixed word, angle brackets, curly braces, or their percent-encodings
//    never reach utm_campaign, and the redirect still happens as plain referral.
const PLACEHOLDERS = [
  ":token", "%3Atoken", "%3atoken", ":TOKEN", "<token>", "%3Ctoken%3E", "%3ctoken%3e",
  "{token}", "{{token}}", "%7Btoken%7D", "%7btoken%7d", "[token]", "anytoken`", "anytoken%60",
  "abc:def", "abc{x}", "abc<x>",
];
function checkPlaceholderGuard(mod) {
  for (const raw of PLACEHOLDERS) {
    const q = new URL(mod.referralLocation(raw)).searchParams;
    assert.equal(q.get("utm_campaign"), null, `placeholder ${JSON.stringify(raw)} reached utm_campaign`);
    assert.equal(q.get("utm_source"), "referral");
    assert.equal(q.get("utm_medium"), "referral");
  }
  // The live shape today: /r/:token is a 301 with source=referral and NO campaign.
  const res = mod.onRequestGet({ params: { token: ":token" } });
  assert.equal(res.status, 301);
  const loc = new URL(res.headers.get("Location"));
  assert.equal(loc.origin + loc.pathname, "https://getgymbo.com/");
  assert.equal(loc.searchParams.get("utm_campaign"), null);
}

// 3. the doc itself: measurement rule first, closed medium set of 5, chatgpt.com marked external.
function checkDoc(doc) {
  const body = doc.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
  const first = body.find((l) => !l.startsWith("Source:"));
  assert.match(first, /MEASUREMENT RULE/);
  assert.match(first, /POST \/api\/reports\/utm/);
  assert.match(first, /NEVER with utmSource/);
  assert.match(doc, /closed set of 5: social, email, referral, listing, product/);
  assert.match(doc, /utm_source=chatgpt\.com[\s\S]{0,60}we do not emit it and never must/);
}

// 4. gm-vt0: the /m/ media-page footer backlink. Checked on the RENDERED page, decoded the way a
//    browser decodes the href (so `&amp;` becomes `&`), on an ok page AND an unavailable page.
const MEDIA_SRC = read("functions/m/[id].js");
const MEDIA_ID = "11111111-2222-3333-4444-555555555555";
const MEDIA_ROW = {
  state: "ok", source: "wger", asset_kind: "video", author: "Goulart", author_url: null, work_title: null,
  source_url: "https://wger.de/en/exercise/512/view/", licence_id: "CC-BY-SA-4.0",
  licence_name: "Creative Commons Attribution Share Alike 4",
  licence_url: "https://creativecommons.org/licenses/by-sa/4.0/deed.en", is_derivative: false,
  modification_note: null, video_object_path: "wger/512/720p.mp4", poster_object_path: "wger/512/poster.jpg",
};
const decodeAttr = (v) => v.replace(/&amp;/g, "&");
async function renderMedia(src, id) {
  // the module's relative imports must resolve from a data: URL
  const abs = (f) => new URL(`../functions/m/${f}`, import.meta.url).href;
  const fixed = src.replace('"./_shared.js"', `"${abs("_shared.js")}"`).replace('"../_forge.js"', `"${new URL("../functions/_forge.js", import.meta.url).href}"`);
  const mod = await loadReferral(fixed);
  const real = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify([MEDIA_ROW]), { status: 200 });
  try {
    const res = await mod.onRequestGet({ env: { MEDIA_BUCKET: "exercise-media" }, params: { id } });
    return await res.text();
  } finally { globalThis.fetch = real; }
}
async function checkMediaFooter(src, vocab) {
  for (const id of [MEDIA_ID, "not-a-uuid"]) {
    const html = await renderMedia(src, id);
    const foot = html.match(/<p class="foot">([\s\S]*?)<\/p>/);
    assert.ok(foot, `no footer on ${id}`);
    const home = [...foot[1].matchAll(/<a href="(https:\/\/getgymbo\.com\/[^"]*)">([^<]*)<\/a>/g)];
    assert.equal(home.length, 1, "exactly one getgymbo.com backlink in the footer");
    assert.equal(home[0][2], "Gymbo", "visible text unchanged");
    const href = decodeAttr(home[0][1]);
    assert.equal(href, "https://getgymbo.com/?utm_source=media-page&utm_medium=product&utm_campaign=m-footer");
    assert.ok(inTable(vocab, triple(href), { liveOnly: false }), `${href} is outside the vocabulary`);
    // nothing else on the page may carry a utm tag, and the takedown link stays untagged
    assert.equal((html.match(/utm_/g) || []).length, 3, "exactly the three utm params of the one footer link");
    assert.match(foot[1], /<a href="\/m\/takedown">request its removal<\/a>/);
  }
}

// ---- green arm: the real code ----
test("/ig emits only values in the vocabulary, instagram/social/bio pinned", () => {
  checkIg(REDIRECTS, VOCAB);
});
test("/r/ emits only values in the vocabulary, referral/referral/TOKEN-SHAPE pinned", async () => {
  checkReferral(await loadReferral(REFERRAL_SRC), VOCAB);
});
test("no other file in public/_redirects or functions/ emits a utm value outside the vocabulary", () => {
  checkNoStrayEmitters(VOCAB, emitterFiles());
});
test("a placeholder-shaped token never reaches utm_campaign", async () => {
  checkPlaceholderGuard(await loadReferral(REFERRAL_SRC));
});
test("the vocabulary doc leads with the measurement rule and keeps the closed sets", () => {
  checkDoc(DOC);
});
test("the doc table parses to the four live rows", () => {
  assert.equal(VOCAB.live.length, 4);
  assert.deepEqual([...VOCAB.mediums].sort(), ["email", "listing", "product", "referral", "social"]);
});

// ---- red arm: mutate in memory, the same check must throw, print the mutated line ----
function mutate(src, from, to) {
  const out = src.replace(from, to);
  assert.notEqual(out, src, `mutation did not hit: ${from}`);
  const line = out.split("\n").find((l, i) => l !== src.split("\n")[i]);
  console.log(`  mutated line: ${line.trim()}`);
  assert.ok(!line.trim().startsWith("//") && !line.trim().startsWith("#"), "mutation landed in a comment");
  return out;
}

test("CONTROL 1a: an /ig campaign outside the table turns checkIg red", () => {
  const bad = mutate(REDIRECTS, "utm_campaign=bio 301", "utm_campaign=bio2 301");
  assert.throws(() => checkIg(bad, VOCAB), /instagram|vocabulary/);
});
test("CONTROL 1a': an /ig source outside the table turns checkIg red", () => {
  const bad = mutate(REDIRECTS, "utm_source=instagram", "utm_source=insta");
  assert.throws(() => checkIg(bad, VOCAB), /instagram|vocabulary/);
});
test("CONTROL 1b: a misspelt /r/ medium turns checkReferral red", async () => {
  const bad = mutate(REFERRAL_SRC, 'url.searchParams.set("utm_medium", "referral")', 'url.searchParams.set("utm_medium", "referal")');
  await assert.rejects(async () => checkReferral(await loadReferral(bad), VOCAB));
});
test("CONTROL 1b': a loosened TOKEN_SHAPE turns checkReferral red (shape drifted from the doc)", async () => {
  const bad = mutate(REFERRAL_SRC, "/^[a-z0-9-]{3,32}$/", "/^[a-z0-9-]{1,64}$/");
  await assert.rejects(async () => checkReferral(await loadReferral(bad), VOCAB), /drifted/);
});
test("CONTROL 1c: a new tagged link in functions/ outside the table turns the stray-emitter scan red", () => {
  const files = emitterFiles();
  files["functions/m/[id].js"] = 'const U = "https://getgymbo.com/?utm_source=media-page&utm_medium=blog&utm_campaign=m-footer";';
  assert.throws(() => checkNoStrayEmitters(VOCAB, files), /outside the vocabulary/);
});
test("CONTROL 2: removing the shape test turns the placeholder guard red", async () => {
  const bad = mutate(REFERRAL_SRC, "if (TOKEN_SHAPE.test(token)) url", "if (true) url");
  await assert.rejects(async () => checkPlaceholderGuard(await loadReferral(bad)), /reached utm_campaign/);
});
test("CONTROL 2': a shape that allows ':' or '%' turns the placeholder guard red", async () => {
  const bad = mutate(REFERRAL_SRC, "/^[a-z0-9-]{3,32}$/", "/^[a-z0-9:%{}<>`-]{3,32}$/");
  await assert.rejects(async () => checkPlaceholderGuard(await loadReferral(bad)), /reached utm_campaign/);
});
test("CONTROL 3: a doc that buries or drops the measurement rule turns checkDoc red", () => {
  const bad = mutate(DOC, "NEVER with utmSource", "Sometimes with utmSource");
  assert.throws(() => checkDoc(bad), /NEVER/);
});

test("gm-vt0: the /m/ footer backlink is media-page/product/m-footer, decoded, on an ok page and an unavailable page", async () => {
  await checkMediaFooter(MEDIA_SRC, VOCAB);
});
test("CONTROL 4: an untagged footer link turns the /m/ check red", async () => {
  const bad = mutate(MEDIA_SRC, "https://getgymbo.com/?utm_source=media-page&amp;utm_medium=product&amp;utm_campaign=m-footer", "https://getgymbo.com/");
  await assert.rejects(() => checkMediaFooter(bad, VOCAB), /utm_source=media-page|exactly the three|footer/);
});
test("CONTROL 4': a campaign outside the table turns the /m/ check red", async () => {
  const bad = mutate(MEDIA_SRC, "utm_campaign=m-footer", "utm_campaign=m-footr");
  await assert.rejects(() => checkMediaFooter(bad, VOCAB), /m-footer|vocabulary/);
});
test("CONTROL 4'': a raw '&' in the stray-emitter scan and an '&amp;' one are both seen", () => {
  for (const sep of ["&", "&amp;"]) {
    const files = emitterFiles();
    files["functions/x.js"] = `<a href="https://getgymbo.com/?utm_source=media-page${sep}utm_medium=blog${sep}utm_campaign=m-footer">`;
    assert.throws(() => checkNoStrayEmitters(VOCAB, files), /outside the vocabulary/, `separator ${sep}`);
  }
});
