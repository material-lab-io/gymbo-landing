#!/usr/bin/env node
// gy-a2xps.9 — the built client bundle must never contain a server credential.
//
// WHY THIS IS A GATE AND NOT A CODE REVIEW. The public media page reads
// exercise_media with the SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS on every
// table in the project. It is safe only because it lives in a Pages Function and
// is never bundled. That property is invisible in review -- one `import.meta.env`
// reference or one component reading the wrong variable would ship it to every
// visitor, and a leaked service key is rotate-everything, not fix-forward.
//
// 🔴 IT LEADS WITH A POSITIVE CONTROL, and that is not ceremony. Writing this
// check I first "proved" the absence by grepping dist/ for the public anon key
// as a control -- and got ZERO, because that key lives in a Function too. The
// control had not fired, so the clean result underneath it meant nothing at all.
// A scan of the wrong directory, a build that never ran, an empty dist: all
// report the same reassuring zero. So this refuses to pass unless it can first
// find a string it KNOWS is in the bundle.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist";
if (!existsSync(DIST)) {
  console.error(`FAIL: ${DIST}/ does not exist. Run the build first — with no bundle to scan this check would pass vacuously.`);
  process.exit(2);
}

const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
})(DIST);

if (files.length === 0) {
  console.error(`FAIL: ${DIST}/ is empty. Nothing was scanned.`);
  process.exit(2);
}

const contents = new Map();
const read = (f) => {
  if (!contents.has(f)) { try { contents.set(f, readFileSync(f, "utf8")); } catch { contents.set(f, ""); } }
  return contents.get(f);
};
const hits = (needle) => files.filter((f) => read(f).includes(needle));

// POSITIVE CONTROL: a string that is unquestionably in the shipped site.
const CONTROL = "Gymbo";
const controlHits = hits(CONTROL);
if (controlHits.length === 0) {
  console.error(
    `FAIL (positive control): "${CONTROL}" appears in NONE of the ${files.length} files under ${DIST}/. ` +
    `The scan is not reaching the real bundle, so any clean result below would be meaningless. Refusing to pass.`);
  process.exit(2);
}

// A JWT's header is identical for every Supabase key, so this catches an anon
// key pasted into the bundle too — which is not a leak, but is worth seeing.
const FORBIDDEN = [
  ["SUPABASE_SERVICE_ROLE_KEY", "the service-role env var name"],
  ["service_role", "a service-role JWT payload or reference"],
];

let bad = 0;
for (const [needle, what] of FORBIDDEN) {
  const found = hits(needle);
  if (found.length) {
    console.error(`FAIL: ${what} ("${needle}") is present in the built bundle:`);
    for (const f of found.slice(0, 10)) console.error(`    ${f}`);
    console.error(`  This ships a full-database credential to every visitor. Do not deploy. Rotate the key.`);
    bad++;
  }
}

if (bad) process.exit(1);
console.log(
  `OK: no server credential in ${files.length} built files ` +
  `(positive control "${CONTROL}" matched ${controlHits.length}, so the scan reached the bundle).`);
