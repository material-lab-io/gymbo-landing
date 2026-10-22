#!/usr/bin/env node

// gy-qgq5g — prod-watch.yml runs on [self-hosted, gt2-host] (gt2-runner-1..3), which is a GT2 host: no browsers there. The browser half
// lives in prod-watch-console.yml. This gate fails when the curl workflow stops being curl-only, or leaves gt2-host:
//   * its runs-on must be exactly [self-hosted, gt2-host]
//   * outside comments, it must not mention npm, npx, node, setup-node, playwright, chromium or console-check
// Comments are ignored on purpose: they explain why those words are absent.

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const workflowsDir = process.argv[2] ?? '.github/workflows';
const file = path.join(workflowsDir, 'prod-watch.yml');
const BANNED = /\b(npm|npx|node|setup-node|playwright|chromium|console-check)\b/i;

let text;
try {
  text = await readFile(file, 'utf8');
} catch (error) {
  console.error(`::error::${file} is unreadable: ${error.message}. A missing curl workflow must not read as a clean one.`);
  process.exit(1);
}

const violations = [];
const lines = text.split(/\r?\n/);
const runsOn = lines.map((l) => l.match(/^\s*runs-on:\s*(.*?)\s*(?:#.*)?$/)).filter(Boolean).map((m) => m[1].trim());
if (runsOn.length === 0) violations.push(`${file}: no runs-on found; the gate could not look.`);
for (const r of runsOn) {
  if (r !== '[self-hosted, gt2-host]') violations.push(`${file}: runs-on is ${r}, expected exactly [self-hosted, gt2-host] (the curl half must not depend on the gt3 runners).`);
}
lines.forEach((line, i) => {
  const code = line.replace(/(^|\s)#.*$/, '');
  const hit = code.match(BANNED);
  if (hit) violations.push(`${file}:${i + 1}: "${hit[0]}" in the curl-only workflow. Browsers and Node tooling belong in prod-watch-console.yml.`);
});

if (violations.length > 0) {
  console.error('::error::prod-watch.yml is no longer curl-only on gt2-host.');
  for (const v of violations) console.error(v);
  process.exit(1);
}
console.log(`OK: ${file} is curl-only and runs on [self-hosted, gt2-host] (${runsOn.length} job runs-on).`);
