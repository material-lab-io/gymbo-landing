#!/usr/bin/env node
// gy-ukcqm: build / validate / probe the edge rate-limit rules for POST /w/*.
//
//   node scripts/cf-w-ratelimit.mjs --selftest        offline checks of the rule file
//   node scripts/cf-w-ratelimit.mjs --body            print the PUT body for the ruleset
//   node scripts/cf-w-ratelimit.mjs --probe <url>     N+1 test: POST the url LIMIT+1 times,
//                                                     exit 0 only if the last is refused (429)
//
// The probe posts a MALFORMED token, which the function refuses itself (200 "link not
// available"), so it never writes a completion. The edge rule fires before the function.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FILE = new URL("../ops/cloudflare/w-ratelimit.json", import.meta.url);
const cfg = JSON.parse(readFileSync(FILE, "utf8"));

export function rulesetBody(c = cfg) {
  return { rules: c.rules.map(({ ref, description, expression, action, ratelimit }) =>
    ({ ref, description, expression, action, ratelimit, enabled: true })) };
}

export function validate(c = cfg) {
  const errs = [];
  if (c.phase !== "http_ratelimit") errs.push("phase must be http_ratelimit");
  if (!c.rules?.length) errs.push("no rules");
  for (const r of c.rules ?? []) {
    if (!/POST/.test(r.expression) || !/\/w\//.test(r.expression)) errs.push(`${r.ref}: must scope to POST and /w/`);
    if (/GET|HEAD/.test(r.expression)) errs.push(`${r.ref}: must not touch reads`);
    if (!r.ratelimit.characteristics.includes("ip.src")) errs.push(`${r.ref}: must key on ip.src`);
    // normal use: ~25 ticks + finish + double taps in a minute
    if (r.ratelimit.requests_per_period < 30) errs.push(`${r.ref}: threshold would hit a normal client`);
  }
  if (!c.rules?.some((r) => r.ratelimit.characteristics.includes("http.request.uri.path")))
    errs.push("no per-share-token rule");
  if (new Set(c.rules?.map((r) => r.ref)).size !== c.rules?.length) errs.push("duplicate rule refs");
  return errs;
}

async function probe(url, limit) {
  let last;
  for (let i = 1; i <= limit + 1; i++) {
    const res = await fetch(url, { method: "POST", redirect: "manual", body: new URLSearchParams({ block: "x" }) });
    last = res.status;
    if (i <= limit && res.status === 429) { console.error(`refused early at request ${i} <= limit ${limit}`); return 1; }
  }
  console.log(`request ${limit + 1} -> HTTP ${last}`);
  return last === 429 ? 0 : 1;
}

const arg = process.argv[2];
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (arg === "--body") console.log(JSON.stringify(rulesetBody()));
  else if (arg === "--probe") {
    const limit = Math.min(...cfg.rules.filter((r) => r.ratelimit.characteristics.includes("http.request.uri.path")).map((r) => r.ratelimit.requests_per_period));
    process.exit(await probe(process.argv[3], limit));
  } else {
    // --selftest (default): the file passes, and each planted defect is caught.
    const bad = (mut) => { const c = structuredClone(cfg); mut(c); return validate(c).length > 0; };
    const errs = validate();
    if (errs.length) { console.error(errs.join("\n")); process.exit(1); }
    const controls = {
      "threshold too low": (c) => { c.rules[0].ratelimit.requests_per_period = 5; },
      "covers reads": (c) => { c.rules[0].expression = "(starts_with(http.request.uri.path, \"/w/\") or http.request.method eq \"GET\")"; },
      "not scoped to /w/": (c) => { c.rules[0].expression = "(http.request.method eq \"POST\")"; },
      "no ip key": (c) => { c.rules.forEach((r) => { r.ratelimit.characteristics = ["cf.colo.id"]; }); },
      "no per-token rule": (c) => { c.rules = c.rules.filter((r) => !r.ratelimit.characteristics.includes("http.request.uri.path")); },
    };
    const missed = Object.entries(controls).filter(([, m]) => !bad(m)).map(([n]) => n);
    if (missed.length) { console.error(`negative controls NOT caught: ${missed.join(", ")}`); process.exit(1); }
    console.log(`ok: ${cfg.rules.length} rules valid, ${Object.keys(controls).length} negative controls caught`);
  }
}
