#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

// Both are self-hosted label sets, never GitHub-hosted. `gt2-host` is carried by gt2-runner-1..3 (gy-qgq5g, 22 Oct 2026): the only jobs
// that may use it are CURL-ONLY ones (scripts/check-prod-watch-curl-only.mjs pins prod-watch.yml to that), because GT2 hosts run no browsers.
const approvedRunners = ['[self-hosted, gt2]', '[self-hosted, gt2-host]'];
const approvedRunner = approvedRunners.join(' or ');
const workflowsDir = process.argv[2] ?? '.github/workflows';

async function workflowFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name))
    .map((entry) => path.join(directory, entry.name))
    .sort();
}

let files;
try {
  files = await workflowFiles(workflowsDir);
} catch (error) {
  console.error(`::error::Unable to read workflow directory ${workflowsDir}: ${error.message}`);
  process.exit(1);
}

if (files.length === 0) {
  console.error(`::error::No workflow YAML files found in ${workflowsDir}.`);
  process.exit(1);
}

const violations = [];
for (const file of files) {
  const lines = (await readFile(file, 'utf8')).split(/\r?\n/);
  lines.forEach((line, index) => {
    const match = line.match(/^\s*runs-on:\s*(.*?)\s*(?:#.*)?$/);
    if (!match) return;

    const runner = match[1].trim();
    if (!approvedRunners.includes(runner)) {
      violations.push(`${file}:${index + 1}: runs-on must be ${approvedRunner}; found ${runner || '(empty)'}`);
    }
  });
}

if (violations.length > 0) {
  console.error('::error::GitHub-hosted or unapproved workflow runner detected.');
  for (const violation of violations) console.error(violation);
  process.exit(1);
}

console.log(`OK: ${files.length} workflow file(s) use only ${approvedRunner}.`);
