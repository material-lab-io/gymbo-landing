#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const approvedRunner = '[self-hosted, gt2]';
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
    if (runner !== approvedRunner) {
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
