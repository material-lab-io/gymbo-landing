#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

// One approved label set, self-hosted, never GitHub-hosted: `pool`, the GARM/Incus VM pool (gcf-y4eyq.28.3), which also carries the CURL-ONLY
// prod-watch.yml (scripts/check-prod-watch-curl-only.mjs pins it). `gt3` is NOT approved: GT3 was cancelled on 6 Nov 2026 and a job pinned to it never starts
// (gy-3cerrq: prod watch went blind). `gt2` and `gt2-host` are not approved either: no CI on GT2 (gy-s8rfcl).
const approvedRunners = ['[self-hosted, pool]'];
// gy-spn9yu: the dedicated monitor runner (GARM prod-monitor-gt10, repo-scoped, one VM always ready) so a monitor never queues behind CI. It is NOT a second general
// pool: only the named curl-only monitor workflows may use it, and none of them may build or browse (a browser/npm job on the one monitor VM would starve the watch).
const monitorRunner = '[self-hosted, prod-monitor]';
const monitorWorkflows = new Set(['prod-watch.yml']); // reviewed allowlist; extend only for a CURL-ONLY monitor
const buildOrBrowse = /\b(?:npm\s+(?:ci|install|run|exec|i)|npx|pnpm|yarn|playwright|chromium|puppeteer|actions\/setup-node|vite|docker\s+build|next\s+build)\b/i;
const approvedRunner = approvedRunners.join(' or ');
const monitorAllowed = [...monitorWorkflows].join(', ');
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
    if (runner === monitorRunner) {
      if (!monitorWorkflows.has(path.basename(file))) {
        violations.push(`${file}:${index + 1}: PROD_MONITOR_NOT_ALLOWED: ${monitorRunner} is only for the curl-only monitor workflow(s) ${monitorAllowed}`);
      } else {
        lines.forEach((l, i) => {
          const hit = l.replace(/(^|\s)#.*$/, '').match(buildOrBrowse);
          if (hit) violations.push(`${file}:${i + 1}: PROD_MONITOR_BUILDS_OR_BROWSES: "${hit[0]}" in a workflow on ${monitorRunner}; the monitor runner is curl-only`);
        });
      }
      return;
    }
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

console.log(`OK: ${files.length} workflow file(s) use only ${approvedRunner} (plus ${monitorRunner} for ${monitorAllowed}, curl-only).`);
